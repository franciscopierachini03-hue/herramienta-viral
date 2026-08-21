import { NextRequest } from 'next/server';
import { sendMensajeContacto } from '@/lib/email/resend';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// POST /api/diagnostico — Diagnóstico de crecimiento (diagnostico.franpierachini.com).
// Público. Honeypot + rate limit. Guarda en Sheet (si SHEET_DIAGNOSTICO_URL
// está configurado) y avisa por correo (Resend) con TODAS las respuestas + la
// etapa donde la persona está más trabada (su mayor oportunidad de mejora).

export const dynamic = 'force-dynamic';

type Body = Record<string, string>;

// Las 6 etapas del proceso (mismas keys que el form).
const ETAPAS: Array<[string, string]> = [
  ['claridad',     '🎯 Claridad de nicho y mensaje'],
  ['ideas',        '💡 Encontrar ideas virales'],
  ['guion',        '✍️ Guiones y hooks'],
  ['produccion',   '🎬 Grabar y editar'],
  ['distribucion', '📈 Constancia y algoritmo'],
  ['monetizacion', '💰 Convertir en clientes'],
];

const NIVEL_SCORE: Record<string, number> = {
  'Es mi mayor problema': 1,
  'Me cuesta bastante': 2,
  'Más o menos': 3,
  'Lo manejo bien': 4,
};

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`diagnostico:${ip}`, 5, 10 * 60 * 1000)) {
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

  // Etapa más trabada (menor score) = mayor oportunidad de mejora.
  let peorEtapa = ETAPAS[0][1];
  let peorScore = 99;
  const etapasResumen = ETAPAS.map(([k, label]) => {
    const resp = (body[`etapa_${k}`] || '—').trim();
    const s = NIVEL_SCORE[resp] ?? 3;
    if (s < peorScore) { peorScore = s; peorEtapa = label; }
    return `${label}: ${resp}`;
  }).join('\n');

  const lineas =
    `👤 Nombre: ${nombre}\n` +
    `📧 Email: ${email}\n` +
    `📱 WhatsApp: ${whatsapp}\n` +
    `📸 Instagram: ${(body.instagram || '—').trim().slice(0, 120)}\n` +
    `🏷️ Nicho: ${(body.nicho || '—').trim().slice(0, 200)}\n\n` +
    `👥 Seguidores: ${(body.seguidores || '—')}\n` +
    `⏳ Hace cuánto crea: ${(body.hace_cuanto || '—')}\n` +
    `📅 Frecuencia: ${(body.frecuencia || '—')}\n\n` +
    `━━ PROCESO (etapa por etapa) ━━\n${etapasResumen}\n\n` +
    `🔥 MAYOR OPORTUNIDAD DE MEJORA: ${peorEtapa}\n\n` +
    `❓ Principal duda/traba:\n${(body.duda || '—').trim().slice(0, 1500)}\n\n` +
    `🚫 Qué intentó y no funcionó:\n${(body.intentado || '—').trim().slice(0, 1200)}\n\n` +
    `🎯 Objetivo: ${(body.objetivo || '—')}\n` +
    `⚡ Urgencia: ${(body.urgencia || '—')}`;

  // 1) 📊 Sheet manda (si está configurado): la persona nunca se pierde.
  let enSheet = false;
  const txt = (v: unknown, max = 200) => {
    const t = String(v ?? '').slice(0, max);
    return /^[=+\-@]/.test(t) ? `'${t}` : t;
  };
  const sheet = process.env.SHEET_DIAGNOSTICO_URL;
  if (sheet) {
    try {
      const rs = await fetch(sheet, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
          nombre: txt(nombre), email: txt(email), whatsapp: txt(whatsapp, 40),
          instagram: txt(body.instagram, 120), nicho: txt(body.nicho, 200),
          seguidores: txt(body.seguidores, 60), hace_cuanto: txt(body.hace_cuanto, 60), frecuencia: txt(body.frecuencia, 60),
          oportunidad: txt(peorEtapa, 80),
          claridad: txt(body.etapa_claridad, 40), ideas: txt(body.etapa_ideas, 40), guion: txt(body.etapa_guion, 40),
          produccion: txt(body.etapa_produccion, 40), distribucion: txt(body.etapa_distribucion, 40), monetizacion: txt(body.etapa_monetizacion, 40),
          duda: txt(body.duda, 1500), intentado: txt(body.intentado, 1200),
          objetivo: txt(body.objetivo, 60), urgencia: txt(body.urgencia, 60),
        }),
      });
      enSheet = rs.ok;
    } catch (e) { console.error('[diagnostico] sheet:', (e as Error).message.slice(0, 120)); }
  }

  // 2) 📧 Aviso por correo (best-effort).
  let enCorreo = false;
  try {
    const r = await sendMensajeContacto({
      nombre,
      email,
      asunto: `🩺 Diagnóstico — ${nombre} · trabado en: ${peorEtapa}`,
      mensaje: `Nuevo diagnóstico de crecimiento:\n\n${lineas}`,
    });
    if (r.error) console.error('[diagnostico] resend:', String((r.error as { message?: string })?.message || r.error).slice(0, 200));
    else enCorreo = true;
  } catch (e) { console.error('[diagnostico] resend excepción:', (e as Error).message.slice(0, 150)); }

  if (!enSheet && !enCorreo) {
    return Response.json({ error: 'No pudimos registrar tu diagnóstico. Escribinos y te ayudamos.' }, { status: 502 });
  }

  return Response.json({ ok: true, oportunidad: peorEtapa });
}
