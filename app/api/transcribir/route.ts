import { NextRequest } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export const maxDuration = 120;

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

function extractTikTokId(url: string): string | null {
  const match = url.match(/video\/(\d+)/);
  return match ? match[1] : null;
}

function extractInstagramCode(url: string): string | null {
  const match = url.match(/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

// ── Transcribir con Groq Whisper (18x más barato, mucho más rápido) ──────────
async function transcribeWithGroq(audioUrl: string): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('Falta GROQ_API_KEY');

  // Descargar el audio
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error('No se pudo descargar el audio del video');
  const audioBuffer = await audioRes.arrayBuffer();
  const audioBlob   = new Blob([audioBuffer], { type: 'audio/mp4' });

  // Enviar a Groq Whisper Large V3
  const form = new FormData();
  form.append('file', new File([audioBlob], 'audio.mp4', { type: 'audio/mp4' }));
  form.append('model', 'whisper-large-v3');
  form.append('language', 'es');
  form.append('response_format', 'json');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error: ${err}`);
  }

  const data = await res.json();
  return data.text || '';
}

export async function POST(req: NextRequest) {
  const { url, platform } = await req.json();
  if (!url) return Response.json({ error: 'Falta la URL del video' }, { status: 400 });

  // ── YouTube ────────────────────────────────────────────────────────────────
  if (platform === 'youtube') {
    const videoId = extractYouTubeId(url);
    if (!videoId) return Response.json({
      error: 'URL de YouTube no válida. Pega el link completo del video.'
    }, { status: 400 });

    // 1️⃣ Supadata — funciona desde servidores en la nube sin bloqueos
    const supadata = process.env.SUPADATA_API_KEY;
    if (supadata) {
      try {
        const res = await fetch(
          `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`,
          { headers: { 'x-api-key': supadata } }
        );
        if (res.ok) {
          const data = await res.json();
          const texto = (data.content as string || '').replace(/\s+/g, ' ').trim();
          if (texto) return Response.json({ texto });
        }
      } catch { /* fallback */ }
    }

    // 2️⃣ Fallback: youtube-transcript (funciona en local, puede fallar en producción)
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'es' }).catch(
        () => YoutubeTranscript.fetchTranscript(videoId)
      );
      const texto = transcript.map(t => t.text).join(' ').replace(/\s+/g, ' ').trim();
      if (!texto) throw new Error('El video no tiene subtítulos disponibles.');
      return Response.json({ texto });
    } catch (e) {
      const msg = (e as Error).message || '';
      if (msg.toLowerCase().includes('captcha') || msg.toLowerCase().includes('too many')) {
        return Response.json({
          error: 'YouTube está bloqueando el servidor. Intenta en unos minutos o usa otro video.'
        }, { status: 429 });
      }
      if (msg.toLowerCase().includes('disabled') || msg.toLowerCase().includes('not available') || msg.toLowerCase().includes('no transcripts')) {
        return Response.json({
          error: 'Este video no tiene subtítulos. Probá con un video que tenga CC habilitados.'
        }, { status: 422 });
      }
      return Response.json({
        error: `No se pudieron obtener los subtítulos. Intentá con otro video.`
      }, { status: 422 });
    }
  }

  const rapidApiKey = process.env.RAPIDAPI_KEY;

  // ── TikTok ─────────────────────────────────────────────────────────────────
  if (platform === 'tiktok') {
    const videoId = extractTikTokId(url);
    if (!videoId) return Response.json({
      error: 'URL de TikTok no válida. Formato: https://www.tiktok.com/@usuario/video/123456'
    }, { status: 400 });

    // 1️⃣ TikWM — gratis, sin cuota, confiable
    try {
      const tikwmRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const tikwmData = await tikwmRes.json();
      const videoUrl = tikwmData?.data?.play || tikwmData?.data?.wmplay;

      if (videoUrl) {
        // Intentar subtítulos primero
        const subtitles = tikwmData?.data?.subtitles || [];
        if (subtitles.length > 0) {
          const sub = subtitles.find((s: { LanguageCodeName?: string }) =>
            s.LanguageCodeName?.includes('es') || s.LanguageCodeName?.includes('spa')
          ) || subtitles[0];
          if (sub?.Url) {
            const subRes  = await fetch(sub.Url);
            const subText = await subRes.text();
            const texto   = subText
              .split('\n')
              .filter(l => l && !l.includes('-->') && !l.match(/^\d+$/) && !l.startsWith('WEBVTT'))
              .join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (texto) return Response.json({ texto });
          }
        }
        // Sin subtítulos → Groq Whisper
        const texto = await transcribeWithGroq(videoUrl);
        if (texto) return Response.json({ texto });
      }
    } catch { /* fallback a ScrapTik */ }

    // 2️⃣ ScrapTik (RapidAPI) — fallback
    if (rapidApiKey) {
    try {
      const res  = await fetch(`https://scraptik.p.rapidapi.com/get-post?aweme_id=${videoId}`, {
        headers: {
          'x-rapidapi-host': 'scraptik.p.rapidapi.com',
          'x-rapidapi-key':  rapidApiKey,
        },
      });
      const data = await res.json();

      if (data?.message?.includes('exceeded') || data?.message?.includes('quota') || data?.message?.includes('plan')) {
        throw new Error('⚠️ Cupo mensual de la API de TikTok agotado.');
      }
      if (!res.ok) {
        throw new Error(`Error de la API (${res.status}): ${data?.message || 'respuesta inesperada'}`);
      }

      const item = data?.aweme_detail || {};

      if (!item || Object.keys(item).length === 0) {
        throw new Error('Video no encontrado. Puede ser privado o haber sido eliminado.');
      }

      // Intentar subtítulos primero (gratis, instantáneo)
      const subtitles = item?.subtitle_infos || item?.subtitleInfos || [];
      if (subtitles.length > 0) {
        const sub = subtitles.find((s: { LanguageCodeName?: string }) =>
          s.LanguageCodeName?.includes('es') || s.LanguageCodeName?.includes('spa')
        ) || subtitles[0];
        const subRes  = await fetch(sub.Url);
        const subText = await subRes.text();
        const texto   = subText
          .split('\n')
          .filter(l => l && !l.includes('-->') && !l.match(/^\d+$/) && !l.startsWith('WEBVTT'))
          .join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (texto) return Response.json({ texto });
      }

      // Sin subtítulos → Groq Whisper con el audio del video
      const videoUrl = item?.video?.play_addr?.url_list?.[0]
        || item?.video?.download_addr?.url_list?.[0]
        || item?.video?.play_addr_lowbr?.url_list?.[0];

      if (!videoUrl) throw new Error('No se pudo obtener la URL del video. Puede ser un video privado.');

      const texto = await transcribeWithGroq(videoUrl);
      return Response.json({ texto });

    } catch { /* ScrapTik también falló */ }
    } // fin if(rapidApiKey)

    return Response.json({ error: 'No se pudo obtener el video de TikTok. Verifica que sea público.' }, { status: 502 });
  }

  // ── Instagram ──────────────────────────────────────────────────────────────
  if (platform === 'instagram') {
    if (!rapidApiKey) return Response.json({ error: 'Falta configurar RAPIDAPI_KEY.' }, { status: 422 });

    const code = extractInstagramCode(url);
    if (!code) return Response.json({
      error: 'URL de Instagram no válida. Formato: https://www.instagram.com/reel/ABC123/'
    }, { status: 400 });

    try {
      const res = await fetch(
        `https://instagram-api-fast-reliable-data-scraper.p.rapidapi.com/post?shortcode=${code}`,
        {
          headers: {
            'x-rapidapi-host': 'instagram-api-fast-reliable-data-scraper.p.rapidapi.com',
            'x-rapidapi-key':  rapidApiKey,
          },
        }
      );
      const data = await res.json();

      if (data?.message?.includes('exceeded') || data?.message?.includes('quota')) {
        throw new Error('⚠️ Cupo mensual de la API de Instagram agotado.');
      }
      if (!res.ok || data?.status === 'error') {
        throw new Error(data?.error || 'No se pudo obtener el reel de Instagram');
      }

      const videoUrl = data?.video_versions?.[0]?.url;
      const caption  = data?.caption?.text || '';
      const username = data?.user?.username || '';

      // Groq Whisper si hay video
      if (videoUrl) {
        const texto = await transcribeWithGroq(videoUrl);
        return Response.json({ texto });
      }

      // Fallback: caption
      if (caption) {
        return Response.json({
          texto: `[Caption del reel]\n\n${caption}\nCreador: @${username}`
        });
      }

      throw new Error('No se pudo obtener el contenido del reel');
    } catch (e) {
      return Response.json({ error: `Instagram: ${(e as Error).message}` }, { status: 502 });
    }
  }

  return Response.json({ error: 'Plataforma no soportada' }, { status: 400 });
}
