// POST /api/evento — registra un lead para el evento de conversión.
// Guarda en la tabla `event_leads` si existe; si no, te avisa por mail (Resend)
// para no perder ningún registro. Devuelve siempre ok para no trabar al usuario.

import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER = 'franciscopierachini03@gmail.com';

export async function POST(req: Request) {
  let body: { name?: string; email?: string; phone?: string; event?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const name = (body.name || '').toString().trim().slice(0, 120);
  const email = (body.email || '').toString().trim().toLowerCase().slice(0, 200);
  const phone = (body.phone || '').toString().trim().slice(0, 40);
  const event = (body.event || 'masterclass-viraladn').toString().trim().slice(0, 80);

  if (!email || !/.+@.+\..+/.test(email)) return Response.json({ error: 'email inválido' }, { status: 400 });
  if (name.length < 2) return Response.json({ error: 'nombre inválido' }, { status: 400 });

  // 1) Guardar en event_leads si la tabla existe (no rompe si falta).
  let stored = false;
  try {
    const svc = createServiceClient();
    const { error } = await svc.from('event_leads').insert({ name, email, phone, event });
    stored = !error || error.code === '23505'; // duplicado → ya estaba, ok
  } catch {
    stored = false;
  }

  // 2) Avisar por mail SIEMPRE (para tener el lead a mano aunque la tabla exista).
  try {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || 'ViralADN <hola@viraladn.com>';
    if (key) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to: OWNER,
          subject: `🟢 Nuevo registro al evento${stored ? '' : ' (¡corré el SQL de event_leads!)'}`,
          text: `Nombre: ${name}\nEmail: ${email}\nWhatsApp: ${phone}\nEvento: ${event}`,
        }),
      });
    }
  } catch { /* noop */ }

  return Response.json({ ok: true });
}
