import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';

// GET /api/admin/costos — panel de gasto de TODAS las APIs (solo admin).
//
// Fuentes y costo de leerlas:
//   · SerpApi /account ........... GRATIS (no gasta búsquedas)
//   · Supadata /v1/me ............ GRATIS (no gasta créditos)
//   · looter2 (RapidAPI) ......... cuesta 1 request de 15.000 → caché 15 min
//   · scraptik / FB downloader ... SOLO con ?deep=1 (gastan 1 request de planes chicos)
//   · OpenAI ..................... requiere OPENAI_ADMIN_KEY (org costs API); si no
//                                  está, se muestra cómo activarlo.
// ?fresh=1 salta la caché; ?deep=1 además mide los respaldos.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Servicio = {
  key: string;
  icono: string;
  nombre: string;
  costoMes: number | null;   // USD fijos del plan (null = variable/por uso)
  gastoMes?: number | null;  // USD medidos del mes (OpenAI)
  limite?: number;
  usado?: number;
  restante?: number;
  unidad?: string;
  detalle?: string;
  nota?: string;
  estado: 'ok' | 'atencion' | 'agotado' | 'roto' | 'sin-dato';
};

let _cache: { data: Record<string, unknown>; ts: number } | null = null;
const TTL_MS = 15 * 60_000;

// ── Gastos que salen de la tarjeta (Mercury ••3883) sin API consultable ─────
// Fuente: extracto del banco (actualizado 2026-07-05). Cuando cambie un monto,
// se edita esta lista (o pedíselo a Claude).
type GastoTarjeta = {
  key: string; icono: string; nombre: string;
  costoMes: number | null;  // null = variable
  ultimo?: number;          // último cargo conocido (para los variables)
  nota?: string;
};
const GASTOS_TARJETA: GastoTarjeta[] = [
  { key: 'hetzner', icono: '🖥️', nombre: 'Hetzner Online — servidor', costoMes: 17.09 },
  { key: 'elevenlabs', icono: '🗣️', nombre: 'ElevenLabs — voz IA', costoMes: 22.00 },
  { key: 'heygen', icono: '🎭', nombre: 'HeyGen — avatares de video', costoMes: 29.00 },
  { key: 'captions', icono: '💬', nombre: 'Captions — edición y subtítulos', costoMes: 24.99 },
  { key: 'higgsfield', icono: '🎥', nombre: 'Higgsfield — video IA', costoMes: 30.51 },
  {
    key: 'apify', icono: '🕷️', nombre: 'Apify — scraping', costoMes: 33.09,
    nota: '⚠️ El buscador de virales ya NO usa Apify (lo reemplazó SerpApi). Si nada más lo usa, cancelalo: ahorro directo de $33/mes.',
  },
  { key: 'nokia', icono: '📞', nombre: 'Nokia of America — línea/servicio', costoMes: 9.90 },
  {
    key: 'fbads', icono: '📣', nombre: 'Facebook Ads — pauta', costoMes: null, ultimo: 25.00,
    nota: 'Variable según campañas. Último cargo: $25.00 (3 jul).',
  },
  {
    key: 'fees', icono: '🏦', nombre: 'Comisiones bancarias internacionales', costoMes: null, ultimo: 1.60,
    nota: '~$0.68–0.92 por cargo internacional (suman ~$1–2/mes).',
  },
];

function estadoPorUso(usado?: number, limite?: number): Servicio['estado'] {
  if (usado == null || !limite) return 'sin-dato';
  const f = usado / limite;
  if (f >= 1) return 'agotado';
  if (f >= 0.85) return 'atencion';
  return 'ok';
}

// Un request a una API de RapidAPI leyendo los headers de cuota del gateway.
async function medirRapidApi(host: string, path: string): Promise<{ limite?: number; restante?: number; body: string }> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return { body: 'sin RAPIDAPI_KEY' };
  try {
    const res = await fetch(`https://${host}${path}`, {
      headers: { 'x-rapidapi-host': host, 'x-rapidapi-key': key },
    });
    const lim = Number(res.headers.get('x-ratelimit-requests-limit'));
    const rem = Number(res.headers.get('x-ratelimit-requests-remaining'));
    const body = (await res.text()).slice(0, 160);
    return {
      limite: Number.isFinite(lim) ? lim : undefined,
      restante: Number.isFinite(rem) ? rem : undefined,
      body,
    };
  } catch (e) {
    return { body: (e as Error).message.slice(0, 100) };
  }
}

async function armar(deep: boolean): Promise<Record<string, unknown>> {
  const servicios: Servicio[] = [];

  // ── SerpApi (buscador de virales) — lectura gratis ─────────────────────────
  try {
    const r = await fetch(`https://serpapi.com/account?api_key=${process.env.SERPAPI_KEY}`, { cache: 'no-store' });
    const d = await r.json();
    const limite = Number(d.searches_per_month) || 0;
    const usado = Number(d.this_month_usage) || 0;
    servicios.push({
      key: 'serpapi', icono: '🔎', nombre: 'SerpApi — buscador de virales', costoMes: 75,
      limite, usado, restante: limite - usado, unidad: 'búsquedas',
      detalle: String(d.plan_name || ''), estado: estadoPorUso(usado, limite),
    });
  } catch {
    servicios.push({ key: 'serpapi', icono: '🔎', nombre: 'SerpApi — buscador de virales', costoMes: 75, estado: 'sin-dato', nota: 'No respondió el endpoint de cuenta.' });
  }

  // ── Supadata (YouTube) — lectura gratis ─────────────────────────────────────
  try {
    const r = await fetch('https://api.supadata.ai/v1/me', {
      headers: { 'x-api-key': process.env.SUPADATA_API_KEY || '' }, cache: 'no-store',
    });
    const d = await r.json();
    const limite = Number(d.maxCredits) || 0;
    const usado = Number(d.usedCredits) || 0;
    servicios.push({
      key: 'supadata', icono: '▶️', nombre: 'Supadata — transcripción YouTube', costoMes: 20.57,
      limite, usado, restante: limite - usado, unidad: 'créditos',
      detalle: `Plan ${d.plan || ''}`, nota: 'Plan $17 + impuestos = cargo $20.57.',
      estado: estadoPorUso(usado, limite),
    });
  } catch {
    servicios.push({ key: 'supadata', icono: '▶️', nombre: 'Supadata — YouTube', costoMes: 20.57, estado: 'sin-dato', nota: 'No respondió /v1/me.' });
  }

  // ── Instagram · looter2 — medirlo gasta 1 request (por eso la caché) ───────
  {
    const m = await medirRapidApi(
      'instagram-looter2.p.rapidapi.com',
      '/post?link=' + encodeURIComponent('https://www.instagram.com/p/DaVAJzbjGuu/'),
    );
    servicios.push({
      key: 'looter2', icono: '📸', nombre: 'Instagram — looter2 (transcribir + carruseles)', costoMes: 10,
      limite: m.limite, restante: m.restante,
      usado: m.limite != null && m.restante != null ? m.limite - m.restante : undefined,
      unidad: 'requests', nota: 'La medición gasta 1 request (caché de 15 min).',
      estado: m.limite ? estadoPorUso(m.limite - (m.restante ?? 0), m.limite) : 'sin-dato',
    });
  }

  // ── Respaldos (planes chicos): solo en medición profunda ───────────────────
  if (deep) {
    const sc = await medirRapidApi('scraptik.p.rapidapi.com', '/get-post?aweme_id=7118830446380698885');
    servicios.push({
      key: 'scraptik', icono: '🎵', nombre: 'TikTok — scraptik (respaldo)', costoMes: 0,
      limite: sc.limite, restante: sc.restante,
      usado: sc.limite != null && sc.restante != null ? sc.limite - sc.restante : undefined,
      unidad: 'requests', nota: 'Respaldo: TikWM (gratis) es el principal.',
      estado: sc.limite ? estadoPorUso(sc.limite - (sc.restante ?? 0), sc.limite) : 'sin-dato',
    });
    const fb = await medirRapidApi(
      'facebook-reel-and-video-downloader.p.rapidapi.com',
      '/app/main.php?url=' + encodeURIComponent('https://www.facebook.com/share/r/19hAnb69w2/'),
    );
    const sinSub = /not subscribed/i.test(fb.body);
    servicios.push({
      key: 'fbdl', icono: '📘', nombre: 'Facebook — downloader', costoMes: 0,
      limite: fb.limite, restante: fb.restante,
      usado: fb.limite != null && fb.restante != null ? fb.limite - fb.restante : undefined,
      unidad: 'requests',
      nota: sinSub ? 'FALTA la suscripción gratis (vikas5914/facebook-reel-and-video-downloader).' : undefined,
      estado: sinSub ? 'roto' : (fb.limite ? estadoPorUso(fb.limite - (fb.restante ?? 0), fb.limite) : 'ok'),
    });
  } else {
    servicios.push({
      key: 'scraptik', icono: '🎵', nombre: 'TikTok — scraptik (respaldo)', costoMes: 0,
      nota: 'Plan gratis 50/mes. Usá «Medición profunda» para ver el restante (gasta 1).', estado: 'ok',
    });
    servicios.push({
      key: 'fbdl', icono: '📘', nombre: 'Facebook — downloader', costoMes: 0,
      nota: 'Pendiente: suscripción gratis en RapidAPI (vikas5914). «Medición profunda» lo verifica.', estado: 'roto',
    });
  }

  // ── Siempre gratis ──────────────────────────────────────────────────────────
  servicios.push({ key: 'tikwm', icono: '🎬', nombre: 'TikTok — TikWM (principal)', costoMes: 0, nota: 'API pública sin key; sin límite conocido.', estado: 'ok' });
  servicios.push({ key: 'groq', icono: '🎙️', nombre: 'Groq Whisper — audio → texto', costoMes: 0, nota: 'Tier gratuito.', estado: 'ok' });

  // ── OpenAI (carruseles: gpt-5.5 + gpt-image-2) ─────────────────────────────
  const adminKey = process.env.OPENAI_ADMIN_KEY;
  if (adminKey) {
    try {
      const ahora = new Date();
      const inicioMes = Math.floor(new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime() / 1000);
      const r = await fetch(`https://api.openai.com/v1/organization/costs?start_time=${inicioMes}&limit=31`, {
        headers: { Authorization: `Bearer ${adminKey}` }, cache: 'no-store',
      });
      const d = await r.json();
      let total = 0;
      for (const b of (d.data || []) as Array<{ results?: Array<{ amount?: { value?: number } }> }>) {
        for (const res of b.results || []) total += Number(res?.amount?.value) || 0;
      }
      servicios.push({
        key: 'openai', icono: '🤖', nombre: 'OpenAI — carruseles (texto + imagen)', costoMes: null,
        gastoMes: Math.round(total * 100) / 100, unidad: 'USD', detalle: 'gasto del mes en curso', estado: 'ok',
      });
    } catch {
      servicios.push({ key: 'openai', icono: '🤖', nombre: 'OpenAI — carruseles', costoMes: null, gastoMes: null, estado: 'sin-dato', nota: 'OPENAI_ADMIN_KEY no pudo leer /organization/costs.' });
    }
  } else {
    servicios.push({
      key: 'openai', icono: '🤖', nombre: 'OpenAI — carruseles (texto + imagen)', costoMes: null, gastoMes: null,
      nota: 'Para ver el $ exacto: creá una Admin Key en platform.openai.com (Settings → API keys → Admin keys) y agregala en Vercel como OPENAI_ADMIN_KEY.',
      estado: 'sin-dato',
    });
  }

  const totalApis = servicios.reduce((n, s) => n + (s.costoMes || 0), 0);
  const totalTarjeta = GASTOS_TARJETA.reduce((n, g) => n + (g.costoMes || 0), 0);
  const variableTarjeta = GASTOS_TARJETA.reduce((n, g) => n + (g.ultimo || 0), 0);
  const gastoVariable = servicios.reduce((n, s) => n + (s.gastoMes || 0), 0);
  return {
    actualizado: new Date().toISOString(),
    deep,
    totalApis: Math.round(totalApis * 100) / 100,
    totalTarjeta: Math.round(totalTarjeta * 100) / 100,
    totalFijo: Math.round((totalApis + totalTarjeta) * 100) / 100,
    variableTarjeta: Math.round(variableTarjeta * 100) / 100,
    gastoVariable: Math.round(gastoVariable * 100) / 100,
    servicios,
    gastosTarjeta: GASTOS_TARJETA,
  };
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const deep = sp.get('deep') === '1';
  const fresh = deep || sp.get('fresh') === '1';

  if (!fresh && _cache && Date.now() - _cache.ts < TTL_MS) {
    return Response.json({ ..._cache.data, cacheado: true });
  }
  const data = await armar(deep);
  _cache = { data, ts: Date.now() };
  return Response.json(data);
}
