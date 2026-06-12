import { NextRequest } from 'next/server';

// Análisis de historial COMPLETO: canales grandes requieren decenas de pedidos
// paginados → puede tardar más que los 15s default de Vercel.
export const maxDuration = 300;

// Topes de seguridad por plataforma (no límites de producto):
//   YouTube  : 5.000 videos — cuota oficial: un canal de 5k ≈ 200 unidades de
//              las 10.000 diarias. Sin tope, un canal de 100k videos fundiría
//              la cuota del día en UN análisis.
//   TikTok   : 1.000 videos — TikWM (gratis) entrega de a 35 con ~1-2s por
//              página; más profundo = lentísimo y suele cortar a mitad.
//   Instagram: ~300 reels — el proveedor entrega 12 por pedido y cada página
//              consume la cuota MENSUAL de RapidAPI (300 ≈ 25 pedidos/análisis).
const YT_MAX = 5000;
const TT_MAX = 1000;
const IG_MAX = 300;
const TIME_BUDGET_MS = 150_000; // corte de seguridad global por análisis

function fmt(n: string | number | undefined): string {
  if (!n) return '0';
  const num = typeof n === 'string' ? parseInt(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K';
  return num.toLocaleString('es');
}

// Extrae info del canal de YouTube desde distintos formatos de URL
async function resolveYouTubeChannel(input: string, apiKey: string) {
  const base = 'https://www.googleapis.com/youtube/v3';

  // @handle → forHandle
  const handleMatch = input.match(/@([\w.-]+)/);
  if (handleMatch) {
    const res = await fetch(`${base}/channels?part=id,snippet,contentDetails&forHandle=@${handleMatch[1]}&key=${apiKey}`);
    const data = await res.json();
    if (data.items?.[0]) return data.items[0];
  }

  // /channel/UCxxx
  const channelIdMatch = input.match(/channel\/(UC[\w-]+)/);
  if (channelIdMatch) {
    const res = await fetch(`${base}/channels?part=id,snippet,contentDetails&id=${channelIdMatch[1]}&key=${apiKey}`);
    const data = await res.json();
    if (data.items?.[0]) return data.items[0];
  }

  // /c/name o /user/name → buscar por nombre
  const nameMatch = input.match(/(?:\/c\/|\/user\/)([\w.-]+)/);
  if (nameMatch) {
    const res = await fetch(`${base}/search?part=snippet&type=channel&q=${encodeURIComponent(nameMatch[1])}&maxResults=1&key=${apiKey}`);
    const data = await res.json();
    const channelId = data.items?.[0]?.id?.channelId;
    if (channelId) {
      const res2 = await fetch(`${base}/channels?part=id,snippet,contentDetails&id=${channelId}&key=${apiKey}`);
      const data2 = await res2.json();
      if (data2.items?.[0]) return data2.items[0];
    }
  }

  return null;
}

// Obtiene hasta `limit` video IDs del playlist de uploads (paginado)
async function getUploadVideoIds(playlistId: string, apiKey: string, limit = 100) {
  const base = 'https://www.googleapis.com/youtube/v3';
  const ids: string[] = [];
  let pageToken = '';

  while (ids.length < limit) {
    const url = `${base}/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    for (const item of data.items || []) {
      ids.push(item.contentDetails.videoId);
    }
    if (!data.nextPageToken || ids.length >= limit) break;
    pageToken = data.nextPageToken;
  }

  return ids.slice(0, limit);
}

// Obtiene estadísticas para un batch de video IDs
async function getVideoStats(ids: string[], apiKey: string) {
  const base = 'https://www.googleapis.com/youtube/v3';
  const results: Record<string, {
    title: string; channel: string;
    views: string; likes: string; comments: string;
    viewsRaw: number; likesRaw: number; commentsRaw: number;
    thumbnail: string; url: string; platform: string;
  }> = {};

  // Batch en grupos de 50, con concurrencia (un historial de 5.000 videos son
  // 100 páginas — secuencial tardaría minutos; en paralelo, segundos).
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, batches.length || 1) }, async () => {
    while (next < batches.length) {
      const batch = batches[next++].join(',');
      const res = await fetch(`${base}/videos?part=snippet,statistics&id=${batch}&key=${apiKey}`);
      const data = await res.json();
      for (const v of (data.items || [])) {
        results[v.id] = {
          title: v.snippet?.title || '',
          channel: v.snippet?.channelTitle || '',
          views:    fmt(v.statistics?.viewCount),
          likes:    fmt(v.statistics?.likeCount),
          comments: fmt(v.statistics?.commentCount),
          viewsRaw:    parseInt(v.statistics?.viewCount    || '0'),
          likesRaw:    parseInt(v.statistics?.likeCount    || '0'),
          commentsRaw: parseInt(v.statistics?.commentCount || '0'),
          thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || '',
          url: `https://www.youtube.com/watch?v=${v.id}`,
          platform: 'youtube',
        };
      }
    }
  }));

  return results;
}

// ── TikTok: obtener videos del perfil — TikWM (gratis, sin cuota) ─────────────
async function analyzeTikTok(username: string, _rapidApiKey: string) {
  // Quitar @ si viene incluido
  const uid = username.replace(/^@/, '');

  // 1️⃣ TikWM — gratis, sin cuota. Paginamos para llegar a ~100 videos.
  const items: Array<{
    video_id?: string; title?: string;
    play_count?: number; digg_count?: number; comment_count?: number;
    share_count?: number; collect_count?: number;
    author?: { nickname?: string; unique_id?: string };
    cover?: string;
  }> = [];

  // Historial completo (tope TT_MAX). TikWM entrega de a 35; si el servicio
  // gratuito corta a mitad de camino, devolvemos lo acumulado (best effort).
  let cursor = '0';
  const t0 = Date.now();
  for (let page = 0; page < 40 && items.length < TT_MAX && Date.now() - t0 < TIME_BUDGET_MS / 2; page++) {
    const res = await fetch(
      `https://www.tikwm.com/api/user/posts?unique_id=@${uid}&count=35&cursor=${cursor}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) {
      if (page === 0) throw new Error('No se pudo conectar con TikTok.');
      break;
    }
    const data = await res.json();
    const batch = data?.data?.videos || [];
    if (!batch.length && page > 0) break;
    items.push(...batch);
    if (!data?.data?.hasMore || !data?.data?.cursor) break;
    cursor = String(data.data.cursor);
  }

  if (!items.length) throw new Error('No se encontraron videos para este perfil de TikTok. Verifica que sea público.');

  return items.map(v => ({
    title:    v.title?.slice(0, 100) || 'Video de TikTok',
    channel:  v.author?.nickname || v.author?.unique_id || uid,
    views:    fmt(v.play_count),
    likes:    fmt(v.digg_count),
    comments: fmt(v.comment_count),
    shares:   fmt(v.share_count),
    saves:    fmt(v.collect_count),
    viewsRaw:    v.play_count    || 0,
    likesRaw:    v.digg_count    || 0,
    commentsRaw: v.comment_count || 0,
    sharesRaw:   v.share_count   || 0,
    savesRaw:    v.collect_count || 0,
    thumbnail: v.cover || '',
    url: `https://www.tiktok.com/@${v.author?.unique_id || uid}/video/${v.video_id}`,
    platform: 'tiktok',
  })).sort((a, b) => b.viewsRaw - a.viewsRaw);
}

// ── Instagram: cadena de fallbacks ──────────────────────────────────────────
type IGItem = {
  shortcode?: string; code?: string; pk?: string; id?: string;
  edge_media_to_caption?: { edges?: Array<{ node?: { text?: string } }> };
  caption?: string | { text?: string };
  edge_liked_by?: { count?: number }; like_count?: number;
  video_view_count?: number; play_count?: number; view_count?: number;
  edge_media_to_comment?: { count?: number }; comment_count?: number;
  thumbnail_src?: string; display_url?: string;
  image_versions2?: { candidates?: Array<{ url?: string }> };
  owner?: { username?: string }; user?: { username?: string };
};

function normalizeIGItem(item: IGItem, uid: string) {
  const code = item.shortcode || item.code || '';
  const captionRaw = item.edge_media_to_caption?.edges?.[0]?.node?.text
    || (typeof item.caption === 'string' ? item.caption : item.caption?.text)
    || '';
  const views    = item.video_view_count || item.play_count || item.view_count || 0;
  const likes    = item.edge_liked_by?.count || item.like_count || 0;
  const comments = item.edge_media_to_comment?.count || item.comment_count || 0;
  const thumb    = item.thumbnail_src || item.display_url || item.image_versions2?.candidates?.[0]?.url || '';
  return {
    title:    captionRaw.slice(0, 100) || `Reel de @${uid}`,
    channel:  item.owner?.username || item.user?.username || uid,
    views:    fmt(views),
    likes:    fmt(likes),
    comments: fmt(comments),
    viewsRaw:    views,
    likesRaw:    likes,
    commentsRaw: comments,
    thumbnail: thumb,
    url: code ? `https://www.instagram.com/reel/${code}/` : `https://www.instagram.com/${uid}/`,
    platform: 'instagram',
  };
}

async function analyzeInstagram(username: string, rapidApiKey: string) {
  const uid = username.replace(/^@/, '');
  const errors: string[] = [];

  const unwrap = (raw: Array<{ media?: IGItem } | IGItem>): IGItem[] =>
    raw.map(r => ('media' in r && r.media ? r.media : r as IGItem));

  // 0️⃣ username → user id NUMÉRICO. El proveedor cambió: /reels ya no acepta
  //    el link/username — pide el id numérico que devuelve /profile.
  let numericId = '';
  if (rapidApiKey) {
    try {
      const res = await fetch(
        `https://instagram-looter2.p.rapidapi.com/profile?username=${encodeURIComponent(uid)}`,
        { headers: { 'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com', 'x-rapidapi-key': rapidApiKey } }
      );
      const data = await res.json();
      if (data?.message?.toLowerCase?.().match(/exceeded|quota|plan/)) errors.push('looter2: cupo agotado');
      numericId = String(data?.id || data?.pk || '');
      if (!numericId && data?.status === false) errors.push(`looter2/profile: ${data?.errorMessage || 'perfil no encontrado'}`);
    } catch (e) { errors.push(`looter2/profile: ${(e as Error).message}`); }
  }

  // 1️⃣ instagram-looter2 /reels?id=<numérico> — primera opción, PAGINADO.
  //    El proveedor entrega ~12 por pedido (aunque pidas más): seguimos el
  //    max_id hasta IG_MAX. Ojo: cada página gasta cuota mensual de RapidAPI.
  if (rapidApiKey && numericId) {
    try {
      const acc: IGItem[] = [];
      let maxId = '';
      const t0 = Date.now();
      for (let page = 0; page < 30 && acc.length < IG_MAX && Date.now() - t0 < TIME_BUDGET_MS / 2; page++) {
        const url = `https://instagram-looter2.p.rapidapi.com/reels?id=${numericId}&count=100${maxId ? `&max_id=${encodeURIComponent(maxId)}` : ''}`;
        const res = await fetch(url, { headers: { 'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com', 'x-rapidapi-key': rapidApiKey } });
        const data = await res.json();
        if (data?.message?.toLowerCase?.().match(/exceeded|quota|plan/)) { errors.push('looter2: cupo agotado'); break; }
        const items = unwrap(data?.data?.items || data?.items || []);
        if (!items.length) break;
        acc.push(...items);
        const pg = data?.paging_info || data?.data?.paging_info;
        if (!pg?.more_available || !pg?.max_id) break;
        maxId = String(pg.max_id);
      }
      if (acc.length) return acc.map(it => normalizeIGItem(it, uid)).sort((a, b) => b.viewsRaw - a.viewsRaw);
    } catch (e) { errors.push(`looter2: ${(e as Error).message}`); }
  }

  // 2️⃣ instagram-api-fast-reliable-data-scraper — fallback (también pide user_id numérico)
  if (rapidApiKey && numericId) {
    try {
      const res = await fetch(
        `https://instagram-api-fast-reliable-data-scraper.p.rapidapi.com/reels?user_id=${numericId}&count=100`,
        { headers: { 'x-rapidapi-host': 'instagram-api-fast-reliable-data-scraper.p.rapidapi.com', 'x-rapidapi-key': rapidApiKey } }
      );
      const data = await res.json();
      const isQuota = data?.message?.toLowerCase?.().match(/exceeded|quota|plan/);
      if (!isQuota) {
        const items = unwrap(data?.data?.items || data?.items || []);
        if (items.length) return items.map(it => normalizeIGItem(it, uid)).sort((a, b) => b.viewsRaw - a.viewsRaw);
      } else {
        errors.push('fast-reliable: cupo agotado');
      }
    } catch (e) { errors.push(`fast-reliable: ${(e as Error).message}`); }
  }

  // 3️⃣ instagram-scraper-api2 — segundo fallback
  if (rapidApiKey) {
    try {
      const res = await fetch(
        `https://instagram-scraper-api2.p.rapidapi.com/v1.2/posts?username_or_id_or_url=${uid}`,
        { headers: { 'x-rapidapi-host': 'instagram-scraper-api2.p.rapidapi.com', 'x-rapidapi-key': rapidApiKey } }
      );
      const data = await res.json();
      const items: IGItem[] = data?.data?.items || [];
      if (items.length) return items.map(it => normalizeIGItem(it, uid)).sort((a, b) => b.viewsRaw - a.viewsRaw);
    } catch (e) { errors.push(`scraper-api2: ${(e as Error).message}`); }
  }

  // Si todo falló, error consolidado
  if (errors.some(e => e.includes('cupo'))) {
    throw new Error('⚠️ Cupos mensuales de Instagram API agotados en todos los proveedores. Reseteo el 1 del mes o suscribite a un plan superior en RapidAPI.');
  }
  throw new Error('No se encontraron reels para esta cuenta. Verifica que el perfil sea público.');
}

// ── Handler principal ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) return Response.json({ error: 'Falta la URL del perfil' }, { status: 400 });

  // Detectar plataforma
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isTikTok = url.includes('tiktok.com');
  const isInstagram = url.includes('instagram.com');

  // ── YouTube ──────────────────────────────────────────────
  if (isYouTube) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return Response.json({ error: 'Falta YOUTUBE_API_KEY.' }, { status: 422 });

    try {
      const channel = await resolveYouTubeChannel(url, apiKey);
      if (!channel) return Response.json({ error: 'No se encontró el canal. Verifica el link.' }, { status: 404 });

      const playlistId = channel.contentDetails?.relatedPlaylists?.uploads;
      if (!playlistId) return Response.json({ error: 'No se pudo obtener los videos del canal.' }, { status: 500 });

      const videoIds = await getUploadVideoIds(playlistId, apiKey, YT_MAX);
      const statsMap = await getVideoStats(videoIds, apiKey);

      const videos = videoIds
        .map(id => statsMap[id])
        .filter(Boolean)
        .sort((a, b) => b.viewsRaw - a.viewsRaw)
        .slice(0, YT_MAX);

      return Response.json({
        channel: {
          name: channel.snippet?.title || 'Canal',
          thumbnail: channel.snippet?.thumbnails?.default?.url || '',
          platform: 'youtube',
        },
        videos,
      });
    } catch (e) {
      return Response.json({ error: `YouTube: ${(e as Error).message}` }, { status: 502 });
    }
  }

  // ── TikTok / Instagram ───────────────────────────────────
  if (isTikTok || isInstagram) {
    const rapidApiKey = process.env.RAPIDAPI_KEY || '';

    try {
      // Extraer username del URL
      let username = '';
      if (isTikTok) {
        const m = url.match(/@([\w.]+)/);
        username = m ? m[1] : '';
      } else {
        const m = url.match(/instagram\.com\/([^/?#]+)/);
        username = m ? m[1].replace(/\/$/, '') : '';
      }
      if (!username) return Response.json({ error: 'No se pudo extraer el usuario del link.' }, { status: 400 });

      const videos = isTikTok
        ? await analyzeTikTok(username, rapidApiKey)   // usa TikWM (gratis)
        : await analyzeInstagram(username, rapidApiKey); // usa instagram-looter2

      return Response.json({
        channel: { name: `@${username}`, platform: isTikTok ? 'tiktok' : 'instagram' },
        videos,
      });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  return Response.json({ error: 'URL no reconocida. Usa links de YouTube, TikTok o Instagram.' }, { status: 400 });
}
