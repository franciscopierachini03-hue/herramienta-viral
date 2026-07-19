import { NextRequest } from 'next/server';
import { sendMensajeContacto, sendConfirmacionContacto } from '@/lib/email/resend';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// POST /api/ayuda/contacto — el formulario de contacto (público).
// Body: { nombre, email, asunto?, mensaje, hp? }. Manda el mensaje a
// contacto@viraladn.com (reply-to del usuario) + confirmación al usuario.
// hp = honeypot: si viene con algo, es un bot → respondemos ok sin enviar.

export const dynamic = 'force-dynamic';

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function POST(req: NextRequest) {
  // Anti-abuso: 5 mensajes cada 10 minutos por IP.
  const rl = rateLimit(`ayuda-contacto:${clientIp(req)}`, 5, 10 * 60_000);
  if (!rl.ok) return Response.json({ error: `Enviaste varios mensajes. Probá de nuevo en un rato.` }, { status: 429 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido.' }, { status: 400 }); }

  // Honeypot: campo invisible que solo un bot completa.
  if (typeof body.hp === 'string' && body.hp.trim() !== '') return Response.json({ ok: true });

  const nombre = String(body.nombre || '').trim().slice(0, 100);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  const asunto = (String(body.asunto || '').trim() || 'Consulta').slice(0, 140);
  const mensaje = String(body.mensaje || '').trim().slice(0, 4000);

  if (nombre.length < 2) return Response.json({ error: 'Decinos tu nombre.' }, { status: 400 });
  if (!emailOk(email)) return Response.json({ error: 'Poné un correo válido.' }, { status: 400 });
  if (mensaje.length < 5) return Response.json({ error: 'Contanos un poco más en el mensaje.' }, { status: 400 });

  // Adjunto opcional (imagen). El cliente ya la comprime a JPEG; validamos que
  // sea un data:image y que no exceda ~4 MB en base64 (tope del cuerpo de Vercel).
  let adjunto: { filename: string; base64: string } | undefined;
  const imagenRaw = typeof body.imagen === 'string' ? body.imagen : '';
  if (imagenRaw) {
    const m = imagenRaw.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i);
    if (!m) return Response.json({ error: 'La imagen adjunta no es válida.' }, { status: 400 });
    const base64 = m[2];
    if (base64.length * 0.75 > 4 * 1024 * 1024) return Response.json({ error: 'La imagen es muy pesada.' }, { status: 400 });
    const ext = (m[1].split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
    const base = String(body.imgNombre || 'adjunto').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'adjunto';
    adjunto = { filename: `${base}.${ext}`, base64 };
  }

  try {
    await sendMensajeContacto({ nombre, email, asunto, mensaje, adjunto });
  } catch (e) {
    console.error('[ayuda/contacto] envío:', e);
    return Response.json({ error: 'No pudimos enviar el mensaje. Probá de nuevo en un momento.' }, { status: 502 });
  }

  // La confirmación al usuario es "best-effort": si falla, el mensaje ya se envió.
  try { await sendConfirmacionContacto(email, nombre); } catch (e) { console.error('[ayuda/contacto] confirmación:', e); }

  return Response.json({ ok: true });
}
