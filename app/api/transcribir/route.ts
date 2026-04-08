import { NextRequest } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { url, platform } = await req.json();

  if (!url) {
    return Response.json({ error: 'Falta la URL del video' }, { status: 400 });
  }

  if (platform === 'youtube') {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return Response.json({ error: 'URL de YouTube no válida. Asegúrate de pegar el link completo.' }, { status: 400 });
    }

    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'es' }).catch(
        () => YoutubeTranscript.fetchTranscript(videoId)
      );
      const texto = transcript.map(t => t.text).join(' ').replace(/\s+/g, ' ').trim();
      return Response.json({ texto });
    } catch {
      return Response.json({
        error: 'No se pudo obtener la transcripción. El video puede no tener subtítulos activados, ser privado, o estar restringido.'
      }, { status: 422 });
    }
  }

  if (platform === 'tiktok' || platform === 'instagram') {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return Response.json({
        error: `Para transcribir videos de ${platform === 'tiktok' ? 'TikTok' : 'Instagram'} necesitas configurar tu RAPIDAPI_KEY en el archivo .env.local. Ve a la pestaña "Conectar APIs" para instrucciones.`
      }, { status: 422 });
    }
    return Response.json({
      error: 'Soporte de TikTok/Instagram próximamente. Por ahora usa YouTube.'
    }, { status: 422 });
  }

  if (platform === 'facebook') {
    return Response.json({
      error: 'Facebook no permite acceso público a subtítulos. Prueba con un video de YouTube.'
    }, { status: 422 });
  }

  return Response.json({ error: 'Plataforma no soportada' }, { status: 400 });
}
