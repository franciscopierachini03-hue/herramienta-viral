// Buscador de virales vía Google "Videos cortos" (udm=39), usando SerpApi.
//
// Idea: un solo request a Google trae YouTube + TikTok + Instagram + Facebook
// YA rankeados por relevancia de Google → reemplaza varios scrapers (Apify /
// RapidAPI) por uno, más barato y unificado.
//
// Límite conocido: Google/SerpApi NO devuelve views/likes. Por eso esto es la
// capa de DESCUBRIMIENTO; el ranking por "más viral" se recupera enriqueciendo
// los top de YouTube/TikTok con las APIs gratis que ya tenemos (YouTube Data
// API / TikWM). Esa parte se conecta después de validar el POC.
//
// Endpoint: GET https://serpapi.com/search.json?engine=google_short_videos&q=...
// Respuesta: { short_video_results: [{ position, title, link, thumbnail, clip,
//              source, source_icon, channel, duration }] }

const SERP_ENDPOINT = 'https://serpapi.com/search.json';

export type GoogleShort = {
  id: string; title: string; channel: string;
  views: string; likes: string; viewsRaw: number; likesRaw: number;
  commentsRaw: number; commentScore: number;
  duration: number; thumbnail: string; url: string;
  platform: string; flag: string; langLabel: string; audioLang: string;
};

type SerpShort = {
  position?: number; title?: string; link?: string; thumbnail?: string;
  clip?: string; source?: string; source_icon?: string; channel?: string;
  duration?: string;
};

// "YouTube" / dominio del link → clave de plataforma del front.
function platformFromSource(source: string, link: string): string {
  const s = (source || '').toLowerCase();
  const u = (link || '').toLowerCase();
  if (s.includes('youtube') || u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (s.includes('tiktok') || u.includes('tiktok.com')) return 'tiktok';
  if (s.includes('instagram') || u.includes('instagram.com')) return 'instagram';
  if (s.includes('facebook') || u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
  return s || 'web';
}

// "0:47" / "1:20" / "1:02:03" → segundos.
function durationToSeconds(d: string): number {
  if (!d) return 0;
  const parts = d.split(':').map(n => parseInt(n, 10));
  if (parts.some(n => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function idFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const yt = u.searchParams.get('v');
    if (yt) return yt;
    const seg = u.pathname.split('/').filter(Boolean).pop() || '';
    return seg || url;
  } catch { return url; }
}

export async function searchGoogleShorts(
  tema: string,
  opts: { hl?: string; gl?: string; platform?: string; limit?: number } = {},
): Promise<GoogleShort[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error('Falta SERPAPI_KEY');

  const params = new URLSearchParams({
    engine: 'google_short_videos',
    q: tema,
    hl: opts.hl || 'es',
    gl: opts.gl || 'mx',
    api_key: key,
  });

  const res = await fetch(`${SERP_ENDPOINT}?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SerpApi ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const rows: SerpShort[] = Array.isArray(data?.short_video_results) ? data.short_video_results : [];

  const wantPlatform = opts.platform && opts.platform !== 'all' ? opts.platform : null;
  const out: GoogleShort[] = [];
  const seen = new Set<string>();

  for (const r of rows) {
    const url = r.link || '';
    if (!url || seen.has(url)) continue;
    const platform = platformFromSource(r.source || '', url);
    if (wantPlatform && platform !== wantPlatform) continue;
    seen.add(url);
    out.push({
      id: idFromUrl(url),
      title: (r.title || '').slice(0, 140) || 'Video',
      channel: r.channel || r.source || '',
      views: '', likes: '', viewsRaw: 0, likesRaw: 0,
      commentsRaw: 0, commentScore: 0.5,
      duration: durationToSeconds(r.duration || ''),
      thumbnail: r.thumbnail || '',
      url, platform,
      flag: '', langLabel: '', audioLang: '',
    });
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}
