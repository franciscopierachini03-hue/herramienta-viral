import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendLegacyAccessBatch } from '@/lib/email/legacy-access';

// POST /api/admin/send-access
//
// Envío masivo del correo de acceso Legacy (branded, con el código de descuento
// que la persona pone en el checkout de Stripe). Pegas una lista de emails +
// eliges el código → Resend manda el correo a cada uno.
//
// Solo accesible para admins. No crea cuentas — solo envía el correo.

export const maxDuration = 60;

const PERMANENT_OWNERS = ['franciscopierachini03@gmail.com'];

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (PERMANENT_OWNERS.includes(e)) return true;
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(e);
}

// Extrae emails válidos de un texto libre (separados por coma, espacio o salto).
function parseEmails(raw: string): { valid: string[]; invalid: string[] } {
  const tokens = (raw || '')
    .split(/[\s,;]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (re.test(t)) valid.push(t);
    else invalid.push(t);
  }
  return { valid, invalid };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return Response.json({ error: 'No autorizado' }, { status: 403 });
  }

  let body: { emails?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const code = (body.code || '').trim();
  if (!code) {
    return Response.json({ error: 'Falta el código de descuento.' }, { status: 400 });
  }

  const { valid, invalid } = parseEmails(body.emails || '');
  if (valid.length === 0) {
    return Response.json({ error: 'No hay emails válidos en la lista.', invalid }, { status: 400 });
  }
  // Tope de seguridad por request (para no exceder el timeout).
  if (valid.length > 500) {
    return Response.json({
      error: `Demasiados emails (${valid.length}). Manda de a 500 como máximo por tanda.`,
    }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: 'Resend no está configurado.' }, { status: 500 });
  }

  const { sent, errors } = await sendLegacyAccessBatch(valid, code);

  return Response.json({
    code,
    total: valid.length,
    sent,
    failed: valid.length - sent,
    invalid,
    errors: errors.slice(0, 5),
  });
}
