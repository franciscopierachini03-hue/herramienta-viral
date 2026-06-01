import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendLegacyAccessEmail } from '@/lib/email/legacy-access';

// POST /api/integrations/sheet-access
//
// Lo llama el Google Apps Script cuando se agrega un email nuevo al Sheet.
// Por cada email:
//   1. Manda el correo de acceso Legacy (branded, con el código de esa fila)
//   2. Lo guarda en public.access_sends (la "base de datos" de invitados)
//   3. Dedupe: si el email ya fue enviado antes, NO reenvía (idempotente)
//
// Auth: header `x-webhook-token` que coincida con SHEET_WEBHOOK_TOKEN.
// (Token simple porque solo lo conoce el script — no expone datos sensibles.)

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-webhook-token');
  const expected = process.env.SHEET_WEBHOOK_TOKEN;
  if (!expected || token !== expected) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { email?: string; code?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  const code = (body.code || '').trim();
  const name = (body.name || '').trim() || null;

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if (!emailOk) return Response.json({ error: 'Email inválido', email }, { status: 400 });
  if (!code) return Response.json({ error: 'Falta el código', email }, { status: 400 });

  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: 'Resend no configurado' }, { status: 500 });
  }

  const sb = createServiceClient();

  // Dedupe: ¿ya le mandamos antes?
  const { data: existing } = await sb
    .from('access_sends')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return Response.json({ ok: true, status: 'ya_enviado', email });
  }

  // Enviar el correo
  let resendId: string | null = null;
  try {
    const r = await sendLegacyAccessEmail(email, code);
    resendId = (r as { data?: { id?: string } })?.data?.id ?? null;
    if ((r as { error?: unknown })?.error) {
      return Response.json(
        { error: 'Resend rechazó el envío', detail: (r as { error: { message?: string } }).error?.message },
        { status: 502 },
      );
    }
  } catch (e) {
    return Response.json({ error: `Error enviando: ${(e as Error).message}` }, { status: 502 });
  }

  // Guardar en la base
  const { error: insErr } = await sb.from('access_sends').insert({
    email, code, name, source: 'sheet', resend_id: resendId,
  });
  if (insErr) {
    console.error('[sheet-access] insert error:', insErr.message);
    // El correo ya salió — no fallamos por el log.
  }

  return Response.json({ ok: true, status: 'enviado', email, code });
}
