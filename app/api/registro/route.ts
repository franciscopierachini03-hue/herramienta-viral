// POST /api/registro — guarda un registro del formulario (/registro).
// Lo guarda en la tabla `registros` si existe; si no, igual te avisa por correo
// (Resend) para no perder ninguno. Devuelve siempre ok para no trabar al usuario.

import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER = 'franciscopierachini03@gmail.com';

export async function POST(req: Request) {
  let body: Record<string, string>;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const s = (v: unknown, max: number) => (v || '').toString().trim().slice(0, max);
  const nombre = s(body.nombre, 120);
  const apellido = s(body.apellido, 120);
  const telefono = s(body.telefono, 40);
  const correo = s(body.correo, 200).toLowerCase();
  const seguidores = s(body.seguidores, 60);
  const objetivo = s(body.objetivo, 2000);
  const oferta = s(body.oferta, 2000);

  if (!correo || !/.+@.+\..+/.test(correo)) return Response.json({ error: 'correo inválido' }, { status: 400 });
  if (nombre.length < 2) return Response.json({ error: 'nombre inválido' }, { status: 400 });

  // 1) Guardar en `registros` si la tabla existe (no rompe si falta).
  let stored = false;
  try {
    const svc = createServiceClient();
    const { error } = await svc.from('registros').insert({ nombre, apellido, telefono, correo, seguidores, objetivo, oferta });
    stored = !error || error.code === '23505';
  } catch { stored = false; }

  // 2) Avisar por correo SIEMPRE (así no se pierde aunque falte la tabla).
  try {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || 'Registros <onboarding@resend.dev>';
    if (key) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to: OWNER,
          subject: `🟢 Nuevo registro${stored ? '' : ' (¡corré el SQL de registros!)'} — ${nombre} ${apellido}`,
          text: `Nombre: ${nombre} ${apellido}\nWhatsApp: ${telefono}\nCorreo: ${correo}\nSeguidores: ${seguidores}\n\nObjetivo:\n${objetivo}\n\nOferta:\n${oferta}`,
        }),
      });
    }
  } catch { /* noop */ }

  // 3) Agregar la fila al Google Sheet (Apps Script web app).
  //    Se puede sobreescribir con SHEET_WEBHOOK_URL (env) para no exponer la URL.
  const SHEET_WEBHOOK = process.env.SHEET_WEBHOOK_URL
    || 'https://script.google.com/macros/s/AKfycbwJAbptdB64W80raiVe5oZoYkIat_RkBVzsP9xT0wInfxnnrBip05K7OPE7RqxyaaTH/exec';
  if (SHEET_WEBHOOK) {
    try {
      await fetch(SHEET_WEBHOOK, {
        method: 'POST',
        body: new URLSearchParams({ nombre, apellido, telefono, correo, seguidores, objetivo, oferta }),
      });
    } catch { /* noop */ }
  }

  return Response.json({ ok: true });
}
