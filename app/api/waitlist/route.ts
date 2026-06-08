// POST /api/waitlist — anota un correo en la lista de lanzamiento.
// Intenta guardar en la tabla `waitlist` (si existe). Si no existe todavía,
// te avisa por mail (Resend) para no perder ningún lead. Idempotente-ish.

import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER = 'franciscopierachini03@gmail.com';

export async function POST(req: Request) {
  let body: { email?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const email = (body.email || '').toString().trim().toLowerCase().slice(0, 200);
  if (!email || !/.+@.+\..+/.test(email)) return Response.json({ error: 'email inválido' }, { status: 400 });

  // 1) Guardar en la tabla waitlist si existe (no rompe si falta).
  let stored = false;
  try {
    const svc = createServiceClient();
    const { error } = await svc.from('waitlist').insert({ email });
    stored = !error || error.code === '23505'; // 23505 = duplicado → ya estaba, ok
  } catch {
    stored = false;
  }

  // 2) Si no se pudo guardar (falta la tabla), avisar por mail para no perderlo.
  if (!stored) {
    try {
      const key = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM || 'ViralADN <hola@viraladn.com>';
      if (key) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from, to: OWNER,
            subject: '🟢 Nuevo en la lista de lanzamiento',
            text: `${email} se anotó para el lanzamiento de ViralADN + TOPCUT.`,
          }),
        });
      }
    } catch { /* noop */ }
  }

  return Response.json({ ok: true });
}
