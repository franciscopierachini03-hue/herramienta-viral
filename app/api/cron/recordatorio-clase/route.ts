import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAccess } from '@/lib/access';
import { CLASE, HORARIOS } from '@/app/comunidad/clase-config';

// Recordatorios por correo de la CLASE SEMANAL (miércoles 10:00 AM CDMX).
//
//   · 24h antes → martes   16:00 UTC (10 AM CDMX)  [cron semanal en vercel.json]
//   · 1h antes  → miércoles ~14:45 UTC (8:45 AM)   [lo dispara /api/cron/daily]
//
// El TIPO se infiere del día UTC (martes=24h, miércoles=1h) — así un tercero no
// puede disparar otra cosa que lo que ese día tocaba. Además:
//   · dedup: 1 envío por tipo por día (marca en ai_credits si la tabla existe)
//   · ventana horaria 13-19 UTC (fuera de eso, no manda)
//   · ?force=24h|1h (SOLO admin logueado): salta día/ventana/dedup — envío manual
//   · ?test=1: manda SOLO al dueño (para ver el correo sin molestar a nadie)
//   · ?dry=1: devuelve cuántos lo recibirían, sin enviar
// Destinatarios: profiles con subscription_status active/trialing (los que
// entran a /comunidad).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OWNER = 'franciscopierachini03@gmail.com';
const APP = 'https://www.viraladn.com';

function esCron(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  return (req.headers.get('user-agent') || '').includes('vercel-cron');
}

function emailHtml(tipo: '24h' | '1h'): { subject: string; html: string } {
  const es1h = tipo === '1h';
  const subject = es1h
    ? '🔴 En 1 hora: tu clase en vivo (10:00 AM CDMX)'
    : '🎓 Mañana: tu clase en vivo — miércoles 10:00 AM (CDMX)';
  const titulo = es1h ? 'La clase arranca en 1 hora' : 'Mañana es la clase';
  const intro = es1h
    ? 'Hoy nos vemos <b style="color:#fff;">en vivo a las 10:00 AM (Ciudad de México)</b>. Deja lista tu cuenta de Instagram/TikTok: la revisamos en la clase.'
    : 'Mañana miércoles nos sentamos <b style="color:#fff;">en vivo a las 10:00 AM (Ciudad de México)</b> a revisar qué está funcionando y qué publicar esta semana.';
  const zonas = HORARIOS.map(([b, h, p]) =>
    `<p style="margin:0 0 3px;font-size:13px;color:#9a9aa6;">${b} <b style="color:#fff;">${h}</b> ${p}</p>`).join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f0f17;border:1px solid #1f1f2b;border-radius:18px;padding:30px;">
<tr><td>
  <p style="margin:0 0 18px;font-size:16px;font-weight:800;color:#fff;">🎓 Comunidad <span style="color:#f59e0b;">ViralADN</span></p>
  <h1 style="margin:0 0 10px;font-size:26px;color:#fff;">${es1h ? '🔴 ' : ''}${titulo}</h1>
  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#b4b4c0;">${intro}</p>

  <div style="background:#0b0b14;border:1px solid #23232f;border-radius:14px;padding:16px 18px;margin:0 0 18px;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:1px;color:#f59e0b;">🕙 HORARIOS</p>
    ${zonas}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr>
    <td align="center" bgcolor="#f59e0b" style="border-radius:12px;">
      <a href="${CLASE.zoomUrl}" target="_blank" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:800;color:#1a1206;text-decoration:none;border-radius:12px;">
        🚀 Entrar a la ${CLASE.sala} (Zoom) →
      </a>
    </td>
  </tr></table>

  <p style="margin:0 0 4px;font-size:13px;color:#9a9aa6;">ID: <b style="color:#fff;font-family:monospace;">${CLASE.zoomId}</b> · Código: <b style="color:#fff;font-family:monospace;">${CLASE.zoomCodigo}</b></p>
  <p style="margin:0 0 18px;font-size:13px;color:#9a9aa6;">También la tienes siempre en <a href="${APP}/comunidad" style="color:#fcd34d;">viraladn.com/comunidad</a> (con el contador en vivo).</p>

  <p style="margin:0;font-size:12px;color:#6b6b78;border-top:1px solid #1a1a26;padding-top:14px;">
    Recibes este correo porque la clase semanal es parte de tu plan. Nos vemos adentro 💪
  </p>
</td></tr></table>
</td></tr></table></body></html>`;
  return { subject, html };
}

async function destinatarios(): Promise<string[]> {
  const sb = createServiceClient();
  const { data } = await sb.from('profiles')
    .select('email, subscription_status')
    .in('subscription_status', ['active', 'trialing'])
    .not('email', 'is', null)
    .limit(3000);
  return [...new Set((data || []).map(p => String(p.email).toLowerCase().trim()).filter(e => e.includes('@')))];
}

// Dedup best-effort: marca "cron:clase-<tipo>" en ai_credits (period = fecha).
// Si la tabla no existe todavía, sigue sin dedup (la ventana horaria protege).
async function yaEnviadoHoy(tipo: string): Promise<boolean> {
  try {
    const sb = createServiceClient();
    const hoy = new Date().toISOString().slice(0, 10);
    const key = `cron:clase-${tipo}`;
    const { data, error } = await sb.from('ai_credits').select('period').eq('email', key).maybeSingle();
    if (error) return false;
    if (data?.period === hoy) return true;
    await sb.from('ai_credits').upsert({ email: key, balance: 0, period: hoy, updated_at: new Date().toISOString() }, { onConflict: 'email' });
    return false;
  } catch { return false; }
}

async function enviar(emails: string[], subject: string, html: string): Promise<{ enviados: number; fallidos: number }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Falta RESEND_API_KEY.');
  const from = process.env.RESEND_FROM || 'ViralADN <hola@viraladn.com>';
  let enviados = 0, fallidos = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const payload = chunk.map(to => ({ from, to: [to], subject, html }));
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) enviados += chunk.length;
      else { fallidos += chunk.length; console.error('[recordatorio-clase] batch', r.status, await r.text().catch(() => '')); }
    } catch (e) { fallidos += chunk.length; console.error('[recordatorio-clase]', e); }
  }
  return { enviados, fallidos };
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  const cron = esCron(req);
  if (!cron && !admin) return Response.json({ error: 'No autorizado.' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const force = sp.get('force');
  if (force && !admin) return Response.json({ error: 'force es solo para el admin logueado.' }, { status: 403 });

  // Tipo por día UTC: martes=24h antes · miércoles=1h antes.
  const ahora = new Date();
  const dia = ahora.getUTCDay();
  const inferido = dia === 2 ? '24h' : dia === 3 ? '1h' : '';
  const tipo = (force === '24h' || force === '1h') ? force : inferido;

  if (!tipo) return Response.json({ ok: true, skip: 'hoy no toca recordatorio (solo martes y miércoles)' });

  const dry = sp.get('dry') === '1';
  const test = sp.get('test') === '1';

  // Ventana horaria de los crons (13-19 UTC) — force/test/dry la saltan.
  const h = ahora.getUTCHours();
  if (!force && !test && !dry && (h < 13 || h > 19)) {
    return Response.json({ ok: true, skip: `fuera de ventana (hora UTC ${h})` });
  }

  const { subject, html } = emailHtml(tipo as '24h' | '1h');

  if (test) {
    const r = await enviar([OWNER], `[PRUEBA] ${subject}`, html);
    return Response.json({ ok: true, test: true, tipo, ...r, a: OWNER });
  }

  const lista = await destinatarios();
  if (dry) return Response.json({ ok: true, dry: true, tipo, destinatarios: lista.length });

  if (!force && await yaEnviadoHoy(tipo)) {
    return Response.json({ ok: true, skip: `el recordatorio ${tipo} de hoy ya se envió` });
  }

  const r = await enviar(lista, subject, html);
  console.log(`[recordatorio-clase] ${tipo}: ${r.enviados} enviados, ${r.fallidos} fallidos`);
  return Response.json({ ok: true, tipo, ...r });
}
