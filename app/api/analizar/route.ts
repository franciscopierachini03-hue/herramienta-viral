import { NextRequest } from 'next/server';

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

  // Batch en grupos de 50
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).join(',');
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

  return results;
}

// ── TikTok: obtener videos del perfil — TikWM (gratis, sin cuota) ─────────────
async function analyzeTikTok(username: string, _rapidApiKey: string) {
  // Quitar @ si viene incluido
  const uid = username.replace(/^@/, '');

  // 1️⃣ TikWM — gratis, sin cuota
  const res = await fetch(
    `https://www.tikwm.com/api/user/posts?unique_id=@${uid}&count=50&cursor=0`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!res.ok) throw new Error('No se pudo conectar con TikTok.');
  const data = await res.json();

  const items: Array<{
    video_id?: string; title?: string;
    play_count?: number; digg_count?: number; comment_count?: number;
    share_count?: number; collect_count?: number;
    author?: { nickname?: string; unique_id?: string };
    cover?: string;
  }> = data?.data?.videos || [];

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

// ── Instagram: obtener reels del perfil — instagram-looter2 ──────────────────
async function analyzeInstagram(username: string, rapidApiKey: string) {
  const uid = username.replace(/^@/, '');
  const headers = {
    'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com',
    'x-rapidapi-key': rapidApiKey,
  };

  // Obtener reels directamente por username/URL del perfil
  const reelsRes = await fetch(
    `https://instagram-looter2.p.rapidapi.com/reels?link=https://www.instagram.com/${uid}/&count=50`,
    { headers }
  );
  const reelsData = await reelsRes.json();

  if (reelsData?.message?.toLowerCase().includes('exceeded') || reelsData?.message?.toLowerCase().includes('quota')) {
    throw new Error('⚠️ Cupo mensual de Instagram API agotado.');
  }

  // instagram-looter2 devuelve items en distintos formatos
  const items: Array<{
    shortcode?: string; code?: string;
    edge_media_to_caption?: { edges?: Array<{ node?: { text?: string } }> };
    caption?: string;
    edge_liked_by?: { count?: number }; like_count?: number;
    video_view_count?: number; play_count?: number;
    edge_media_to_comment?: { count?: number }; comment_count?: number;
    thumbnail_src?: string; display_url?: string;
    owner?: { username?: string };
  }> = reelsData?.data?.items
    || reelsData?.items
    || reelsData?.data
    || [];

  if (!items.length) throw new Error('No se encontraron reels para esta cuenta. Verifica que el perfil sea público.');

  return items.map(item => {
    const code = item.shortcode || item.code || '';
    const caption = item.edge_media_to_caption?.edges?.[0]?.node?.text || item.caption || '';
    const views    = item.video_view_count || item.play_count    || 0;
    const likes    = item.edge_liked_by?.count || item.like_count || 0;
    const comments = item.edge_media_to_comment?.count || item.comment_count || 0;
    return {
      title:    caption.slice(0, 100) || `Reel de @${uid}`,
      channel:  item.owner?.username || uid,
      views:    fmt(views),
      likes:    fmt(likes),
      comments: fmt(comments),
      viewsRaw:    views,
      likesRaw:    likes,
      commentsRaw: comments,
      thumbnail: item.thumbnail_src || item.display_url || '',
      url: code ? `https://www.instagram.com/reel/${code}/` : `https://www.instagram.com/${uid}/`,
      platform: 'instagram',
    };
  }).sort((a, b) => b.viewsRaw - a.viewsRaw);
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

      const videoIds = await getUploadVideoIds(playlistId, apiKey, 100);
      const statsMap = await getVideoStats(videoIds, apiKey);

      const videos = videoIds
        .map(id => statsMap[id])
        .filter(Boolean)
        .sort((a, b) => b.viewsRaw - a.viewsRaw)
        .slice(0, 100);

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
