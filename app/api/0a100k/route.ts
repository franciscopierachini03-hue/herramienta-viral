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

  const r = await sendMensajeContacto({
    nombre,
    email,
    asunto: `🚀 Aplicación 0a100K — ${nombre} (${resumen})`,
    mensaje: `Nueva aplicación del funnel 0 a 100K:\n\n${lineas}`,
  });
  if (r.error) return Response.json({ error: 'No pudimos enviar tu aplicación. Probá de nuevo.' }, { status: 502 });

  return Response.json({ ok: true });
}
