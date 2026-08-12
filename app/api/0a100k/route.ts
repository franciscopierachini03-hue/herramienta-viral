import { NextRequest } from 'next/server';
import { sendMensajeContacto } from '@/lib/email/resend';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// POST /api/0a100k — aplicación del funnel "0 a 100K" (franpierachini.com/0a100k).
// Público. Honeypot + rate limit. Cada aplicación llega por correo (Resend) a
// CONTACTO_EMAIL con TODAS las respuestas y reply-to del aplicante.

export const dynamic = 'force-dynamic';

type Body = Record<string, string>;

const CAMPOS: Array<[string, string]> = [
  ['nombre', '👤 Nombre'],
  ['email', '📧 Email'],
  ['whatsapp', '📱 WhatsApp'],
  ['instagram', '📸 Instagram'],
  ['seguidores', '👥 Seguidores'],
  ['oferta', '💼 Qué vende (oferta y precio)'],
  ['facturacion', '💵 Facturación mensual actual'],
  ['meta', '🎯 Meta a 12 meses'],
  ['freno', '🧱 Qué lo está frenando'],
  ['frecuencia', '📅 Frecuencia de contenido'],
  ['equipo', '🧑‍🤝‍🧑 Equipo'],
  ['inversion', '💳 Listo para invertir'],
];

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`0a100k:${ip}`, 5, 10 * 60 * 1000)) {
    return Response.json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }, { status: 429 });
  }

  let body: Body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Formato inválido.' }, { status: 400 }); }

  if ((body.hp || '').trim()) return Response.json({ ok: true }); // honeypot: bot → fingimos éxito

  const nombre = (body.nombre || '').trim().slice(0, 120);
  const email = (body.email || '').trim().slice(0, 160).toLowerCase();
  const whatsapp = (body.whatsapp || '').trim().slice(0, 40);
  if (nombre.length < 2) return Response.json({ error: 'Contanos tu nombre.' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ error: 'Revisá tu email.' }, { status: 400 });
  if (whatsapp.replace(/\D/g, '').length < 8) return Response.json({ error: 'Dejanos un WhatsApp válido (con código de país).' }, { status: 400 });

  const lineas = CAMPOS.map(([k, label]) => `${label}:\n${String(body[k] || '—').trim().slice(0, 1200)}`).join('\n\n');
  const resumen = `${(body.facturacion || '?')} → meta ${(body.meta || '?')}`;

  // 1) 📊 EL SHEET MANDA: la aplicación se guarda ahí SIEMPRE. Si el correo
  // falla (p. ej. cupo diario de Resend agotado), la persona NO se pierde.
  let enSheet = false;
  // Google Sheets interpreta como FÓRMULA lo que empieza con = + - @ (el
  // WhatsApp "+52…" salía #ERROR!). El apóstrofo lo fuerza a texto y no se ve.
  const txt = (v: unknown, max = 200) => {
    const t = String(v ?? '').slice(0, max);
    return /^[=+\-@]/.test(t) ? `'${t}` : t;
  };
  const sheet = process.env.SHEET_0A100K_URL;
  if (sheet) {
    try {
      const rs = await fetch(sheet, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
          nombre: txt(nombre), email: txt(email), whatsapp: txt(whatsapp, 40),
          instagram: txt(body.instagram, 120),
          seguidores: txt(body.seguidores, 60),
          oferta: txt(body.oferta, 1200),
          facturacion: txt(body.facturacion, 60),
          meta: txt(body.meta, 60),
          freno: txt(body.freno, 1200),
          frecuencia: txt(body.frecuencia, 60),
          equipo: txt(body.equipo, 60),
          inversion: txt(body.inversion, 60),
        }),
      });
      enSheet = rs.ok;
    } catch (e) { console.error('[0a100k] sheet:', (e as Error).message.slice(0, 120)); }
  }

  // 2) 📧 Aviso por correo (best-effort): si falla, queda registrado en el log
  // pero la aplicación ya está guardada en el Sheet.
  let enCorreo = false;
  try {
    const r = await sendMensajeContacto({
      nombre,
      email,
      asunto: `🚀 Aplicación 0a100K — ${nombre} (${resumen})`,
      mensaje: `Nueva aplicación del funnel 0 a 100K:\n\n${lineas}`,
    });
    if (r.error) console.error('[0a100k] resend:', String((r.error as { message?: string })?.message || r.error).slice(0, 200));
    else enCorreo = true;
  } catch (e) { console.error('[0a100k] resend excepción:', (e as Error).message.slice(0, 150)); }

  // Solo es error si NO quedó registrada en ningún lado.
  if (!enSheet && !enCorreo) {
    return Response.json({ error: 'No pudimos registrar tu aplicación. Escribinos y te ayudamos.' }, { status: 502 });
  }

  return Response.json({ ok: true });
}
