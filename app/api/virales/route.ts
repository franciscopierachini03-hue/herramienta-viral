import { NextRequest } from 'next/server';

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: { title: string; channelTitle: string };
}

interface YouTubeVideoItem {
  id: string;
  statistics: { viewCount?: string; likeCount?: string };
}

function formatNumber(n: string | undefined): string {
  if (!n) return '0';
  const num = parseInt(n);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K';
  return num.toLocaleString('es');
}

export async function POST(req: NextRequest) {
  const { tema } = await req.json();

  if (!tema) {
    return Response.json({ error: 'Falta el tema' }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json({
      error: 'No está configurada la YOUTUBE_API_KEY. Sigue las instrucciones en la pestaña "Conectar APIs" para obtenerla gratis en Google Cloud Console.'
    }, { status: 422 });
  }

  // 1. Buscar videos por tema, ordenados por relevancia y filtrados por muchas vistas
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id,snippet&q=${encodeURIComponent(tema)}&type=video&order=viewCount&maxResults=15&relevanceLanguage=es&key=${apiKey}`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    const err = await searchRes.json();
    const msg = err?.error?.message || 'Error al conectar con YouTube';
    return Response.json({ error: `YouTube API: ${msg}` }, { status: 502 });
  }

  const searchData = await searchRes.json();
  const items: YouTubeSearchItem[] = searchData.items || [];

  if (items.length === 0) {
    return Response.json({ videos: [] });
  }

  // 2. Obtener estadísticas (vistas, likes) de esos videos
  const videoIds = items.map(i => i.id.videoId).join(',');
  const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`;

  const statsRes = await fetch(statsUrl);
  const statsData = await statsRes.json();
  const statsMap: Record<string, YouTubeVideoItem['statistics']> = {};
  for (const v of (statsData.items || []) as YouTubeVideoItem[]) {
    statsMap[v.id] = v.statistics;
  }

  // 3. Combinar y ordenar por vistas
  const videos = items
    .map(item => {
      const stats = statsMap[item.id.videoId] || {};
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        views: formatNumber(stats.viewCount),
        likes: formatNumber(stats.likeCount),
        viewsRaw: parseInt(stats.viewCount || '0'),
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      };
    })
    .sort((a, b) => b.viewsRaw - a.viewsRaw)
    .slice(0, 10)
    .map(({ viewsRaw: _, ...v }) => v);

  return Response.json({ videos });
}
