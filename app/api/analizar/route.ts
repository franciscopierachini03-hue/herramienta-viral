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

// ── TikTok: obtener videos del perfil ──────────────────────
async function analyzeTikTok(username: string, rapidApiKey: string) {
  const res = await fetch(
    `https://scraptik.p.rapidapi.com/user-posts?username=${encodeURIComponent(username)}&count=50`,
    { headers: { 'x-rapidapi-host': 'scraptik.p.rapidapi.com', 'x-rapidapi-key': rapidApiKey } }
  );
  const data = await res.json();
  if (data?.message?.toLowerCase().includes('exceeded') || data?.message?.toLowerCase().includes('quota')) {
    throw new Error('⚠️ Cupo mensual de TikTok API agotado.');
  }
  const items = data?.aweme_list || data?.data?.aweme_list || [];
  if (!items.length) throw new Error('No se encontraron videos para este perfil de TikTok.');

  return items.map((v: {
    aweme_id?: string;
    desc?: string;
    statistics?: { play_count?: number; digg_count?: number; comment_count?: number; share_count?: number; collect_count?: number };
    author?: { nickname?: string; unique_id?: string };
    video?: { cover?: { url_list?: string[] } };
  }) => ({
    title: v.desc?.slice(0, 100) || 'Video de TikTok',
    channel: v.author?.nickname || v.author?.unique_id || username,
    views:    fmt(v.statistics?.play_count),
    likes:    fmt(v.statistics?.digg_count),
    comments: fmt(v.statistics?.comment_count),
    shares:   fmt(v.statistics?.share_count),
    saves:    fmt(v.statistics?.collect_count),
    viewsRaw:    v.statistics?.play_count    || 0,
    likesRaw:    v.statistics?.digg_count    || 0,
    commentsRaw: v.statistics?.comment_count || 0,
    sharesRaw:   v.statistics?.share_count   || 0,
    savesRaw:    v.statistics?.collect_count || 0,
    thumbnail: v.video?.cover?.url_list?.[0] || '',
    url: `https://www.tiktok.com/@${v.author?.unique_id}/video/${v.aweme_id}`,
    platform: 'tiktok',
  }))
    .sort((a: { viewsRaw: number }, b: { viewsRaw: number }) => b.viewsRaw - a.viewsRaw);
}

// ── Instagram: obtener reels del perfil ───────────────────
async function analyzeInstagram(username: string, rapidApiKey: string) {
  const headers = {
    'x-rapidapi-host': 'instagram-api-fast-reliable-data-scraper.p.rapidapi.com',
    'x-rapidapi-key': rapidApiKey,
  };

  const userRes = await fetch(
    `https://instagram-api-fast-reliable-data-scraper.p.rapidapi.com/user_id_by_username?username=${encodeURIComponent(username)}`,
    { headers }
  );
  const userData = await userRes.json();
  if (userData?.message?.toLowerCase().includes('exceeded') || userData?.message?.toLowerCase().includes('quota')) {
    throw new Error('⚠️ Cupo mensual de Instagram API agotado.');
  }
  const userId = userData?.UserID;
  if (!userId) throw new Error(`No se encontró la cuenta @${username} en Instagram.`);

  const reelsRes = await fetch(
    `https://instagram-api-fast-reliable-data-scraper.p.rapidapi.com/reels?user_id=${userId}&count=50`,
    { headers }
  );
  const reelsData = await reelsRes.json();
  const items = reelsData?.data?.items || [];
  if (!items.length) throw new Error('No se encontraron reels para esta cuenta.');

  return items.map((item: {
    media?: {
      code?: string; caption?: { text?: string }; like_count?: number;
      play_count?: number; user?: { username?: string };
      image_versions2?: { candidates?: { url?: string }[] };
    };
  }) => {
    const m = item.media || {};
    return {
      title:    m.caption?.text?.slice(0, 100) || `Reel de @${username}`,
      channel:  m.user?.username || username,
      views:    fmt(m.play_count),
      likes:    fmt(m.like_count),
      comments: fmt((m as {comment_count?: number}).comment_count),
      viewsRaw:    m.play_count  || 0,
      likesRaw:    m.like_count  || 0,
      commentsRaw: (m as {comment_count?: number}).comment_count || 0,
      thumbnail: m.image_versions2?.candidates?.[0]?.url || '',
      url: m.code ? `https://www.instagram.com/reel/${m.code}/` : `https://www.instagram.com/${username}/`,
      platform: 'instagram',
    };
  }).sort((a: { viewsRaw: number }, b: { viewsRaw: number }) => b.viewsRaw - a.viewsRaw);
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
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) return Response.json({ error: 'Falta RAPIDAPI_KEY.' }, { status: 422 });

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
        ? await analyzeTikTok(username, rapidApiKey)
        : await analyzeInstagram(username, rapidApiKey);

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
