import { NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/access';
import { createClient } from '@/lib/supabase/server';

// GET /api/cron/health — VIGILANTE de la transcripción y las cuotas.
//
// Corre solo (Vercel Cron, ver vercel.json) 2× al día y también on-demand desde
// /admin/costos. Prueba el pipeline REAL de cada plataforma + los cupos, y si
// algo está ROTO o por AGOTARSE (<15% de cupo) manda un email de alerta al
// admin — así nos enteramos ANTES que los usuarios, no por una captura.
//
// Barato a propósito: no depende del caché ni gasta Groq. Verifica que el
// proveedor responda, que el audio se pueda extraer (fix del DASH) y los cupos.
//
// Acceso: header `Authorization: Bearer $CRON_SECRET` (lo manda Vercel Cron) o
// sesión de admin. Si no hay CRON_SECRET seteado, igual corre (con warning).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OWNER = 'franciscopierachini03@gmail.com';
// Reels/videos FIJOS de prueba (ejercitan el pipeline completo, incl. el path
// del audio-DASH que arreglamos). Si alguno se borra, cambiar acá.
const TEST_IG = 'https://www.instagram.com/reel/C0MhSpaLVNT/';
const TEST_TIKTOK = 'https://www.tiktok.com/@bb.tran96/video/7118830446380698885';

type Check = { servicio: string; estado: 'ok' | 'alerta' | 'roto'; detalle: string };

function audioUrlFromDash(mpd: unknown): string | null {
  if (typeof mpd !== 'string' || !mpd.includes('AdaptationSet')) return null;
  const set = mpd.split(/<AdaptationSet/).find(s => /contentType="audio"|mimeType="audio/i.test(s));
  const m = set?.match(/<BaseURL>([^<]+)<\/BaseURL>/);
  return m ? m[1].replace(/&amp;/g, '&') : null;
}

async function checkInstagram(): Promise<Check> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return { servicio: 'Instagram · looter2', estado: 'roto', detalle: 'Falta RAPIDAPI_KEY' };
  try {
    const res = await fetch(`https://instagram-looter2.p.rapidapi.com/post?link=${encodeURIComponent(TEST_IG)}`,
      { headers: { 'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com', 'x-rapidapi-key': key } });
    const lim = Number(res.headers.get('x-ratelimit-requests-limit')) || 0;
    const rem = Number(res.headers.get('x-ratelimit-requests-remaining'));
    const data = await res.json().catch(() => ({}));
    const item = Array.isArray(data) ? data[0] : data;
    if (/exceeded|quota|plan|limit/i.test(String(item?.message || ''))) {
      return { servicio: 'Instagram · looter2', estado: 'roto', detalle: 'CUOTA AGOTADA — renovar el plan de looter2' };
    }
    const videoUrl = audioUrlFromDash(item?.video_dash_manifest) || item?.video_url || item?.video_versions?.[0]?.url;
    if (!res.ok || !videoUrl) {
      return { servicio: 'Instagram · looter2', estado: 'roto', detalle: `Sin video utilizable (HTTP ${res.status})` };
    }
    // Cupo bajo → alerta preventiva.
    if (lim && rem >= 0 && rem < lim * 0.15) {
      return { servicio: 'Instagram · looter2', estado: 'alerta', detalle: `Cupo bajo: ${rem}/${lim} restantes` };
    }
    return { servicio: 'Instagram · looter2', estado: 'ok', detalle: `OK · ${rem}/${lim} requests${audioUrlFromDash(item?.video_dash_manifest) ? ' · audio-DASH ✓' : ''}` };
  } catch (e) {
    return { servicio: 'Instagram · looter2', estado: 'roto', detalle: (e as Error).message.slice(0, 80) };
  }
}

async function checkYouTube(): Promise<Check> {
  const key = process.env.SUPADATA_API_KEY;
  if (!key) return { servicio: 'YouTube · Supadata', estado: 'roto', detalle: 'Falta SUPADATA_API_KEY' };
  try {
    const res = await fetch('https://api.supadata.ai/v1/me', { headers: { 'x-api-key': key } });
    const d = await res.json().catch(() => ({}));
    const max = Number(d.maxCredits) || 0;
    const used = Number(d.usedCredits) || 0;
    if (!res.ok) return { servicio: 'YouTube · Supadata', estado: 'roto', detalle: `HTTP ${res.status}` };
    if (max && used >= max) return { servicio: 'YouTube · Supadata', estado: 'roto', detalle: 'CUOTA AGOTADA — renovar Supadata' };
    if (max && used > max * 0.85) return { servicio: 'YouTube · Supadata', estado: 'alerta', detalle: `Cupo bajo: ${used}/${max} usados` };
    return { servicio: 'YouTube · Supadata', estado: 'ok', detalle: `OK · ${used}/${max} créditos · ${d.plan || ''}` };
  } catch (e) {
    return { servicio: 'YouTube · Supadata', estado: 'roto', detalle: (e as Error).message.slice(0, 80) };
  }
}

async function checkTikTok(): Promise<Check> {
  try {
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(TEST_TIKTOK)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000),
    });
    const d = await res.json().catch(() => ({}));
    const play = d?.data?.play || d?.data?.wmplay;
    if (d?.code === 0 && play) return { servicio: 'TikTok · TikWM', estado: 'ok', detalle: 'OK · gratis' };
    return { servicio: 'TikTok · TikWM', estado: 'roto', detalle: `TikWM sin video (code ${d?.code})` };
  } catch (e) {
    return { servicio: 'TikTok · TikWM', estado: 'roto', detalle: (e as Error).message.slice(0, 80) };
  }
}

async function checkGroq(): Promise<Check> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { servicio: 'Groq Whisper', estado: 'roto', detalle: 'Falta GROQ_API_KEY' };
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } });
    return res.ok
      ? { servicio: 'Groq Whisper', estado: 'ok', detalle: 'OK · key activa' }
      : { servicio: 'Groq Whisper', estado: 'roto', detalle: `HTTP ${res.status}` };
  } catch (e) {
    return { servicio: 'Groq Whisper', estado: 'roto', detalle: (e as Error).message.slice(0, 80) };
  }
}

async function checkSerp(): Promise<Check> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return { servicio: 'SerpApi · buscador', estado: 'ok', detalle: 'Sin key (buscador off)' };
  try {
    const res = await fetch(`https://serpapi.com/account?api_key=${key}`);
    const d = await res.json().catch(() => ({}));
    const max = Number(d.searches_per_month) || 0;
    const used = Number(d.this_month_usage) || 0;
    if (!res.ok) return { servicio: 'SerpApi · buscador', estado: 'roto', detalle: `HTTP ${res.status}` };
    if (max && used >= max) return { servicio: 'SerpApi · buscador', estado: 'roto', detalle: 'CUOTA AGOTADA — buscador caído' };
    if (max && used > max * 0.85) return { servicio: 'SerpApi · buscador', estado: 'alerta', detalle: `Cupo bajo: ${used}/${max}` };
    return { servicio: 'SerpApi · buscador', estado: 'ok', detalle: `OK · ${used}/${max} búsquedas` };
  } catch (e) {
    return { servicio: 'SerpApi · buscador', estado: 'roto', detalle: (e as Error).message.slice(0, 80) };
  }
}

async function avisar(checks: Check[]) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const malos = checks.filter(c => c.estado !== 'ok');
  const from = process.env.RESEND_FROM || 'ViralADN Salud <onboarding@resend.dev>';
  const rotos = malos.filter(c => c.estado === 'roto').length;
  const asunto = rotos
    ? `🚨 ViralADN: ${rotos} servicio(s) CAÍDO(S)`
    : `⚠️ ViralADN: ${malos.length} servicio(s) por agotarse`;
  const cuerpo = [
    'El vigilante detectó problemas en las herramientas:',
    '',
    ...malos.map(c => `${c.estado === 'roto' ? '🚨' : '⚠️'} ${c.servicio} — ${c.detalle}`),
    '',
    'Estado completo: viraladn.com/admin/costos',
  ].join('\n');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: OWNER, subject: asunto, text: cuerpo }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* noop */ }
}

export async function GET(req: NextRequest) {
  // Auth (cualquiera vale): (a) el Cron de Vercel — trae user-agent vercel-cron
  // y, si hay CRON_SECRET, el Bearer; (b) admin logueado (para el botón en
  // /admin). El endpoint solo LEE estados y dispara alerta al OWNER — bajo
  // riesgo — así funciona out-of-the-box sin configurar nada.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  let autorizado = ua.includes('vercel-cron') || (!!secret && auth === `Bearer ${secret}`);
  if (!autorizado) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      autorizado = isAdminEmail(user?.email);
    } catch { /* no session */ }
  }
  if (!autorizado) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const checks = await Promise.all([
    checkInstagram(), checkYouTube(), checkTikTok(), checkGroq(), checkSerp(),
  ]);

  const hayProblema = checks.some(c => c.estado !== 'ok');
  const noManual = req.nextUrl.searchParams.get('noalert') === '1';
  if (hayProblema && !noManual) await avisar(checks);

  return Response.json({
    ok: !hayProblema,
    revisado: new Date().toISOString(),
    checks,
  });
}
