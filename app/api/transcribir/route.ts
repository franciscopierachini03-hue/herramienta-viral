import { NextRequest } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from '@distube/ytdl-core';

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

  // Enviar a Groq Whisper Large V3 (sin forzar idioma → auto-detecta)
  const form = new FormData();
  form.append('file', new File([audioBlob], 'audio.mp4', { type: 'audio/mp4' }));
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'json');
  // No forzamos idioma para que Whisper auto-detecte inglés, español, etc.

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

    // 2️⃣ Fallback: youtube-transcript
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'es' }).catch(
        () => YoutubeTranscript.fetchTranscript(videoId)
      );
      const texto = transcript.map(t => t.text).join(' ').replace(/\s+/g, ' ').trim();
      if (texto) return Response.json({ texto });
    } catch { /* fallback a Whisper */ }

    // 3️⃣ Sin subtítulos → descargar audio con ytdl-core + Groq Whisper
    try {
      const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
      const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
      if (audioFormats.length > 0) {
        const best = audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
        if (best.url) {
          const texto = await transcribeWithGroq(best.url);
          if (texto) return Response.json({ texto });
        }
      }
    } catch { /* ytdl también bloqueado */ }

    return Response.json({
      error: 'Este video no tiene subtítulos y YouTube bloquea la descarga de audio desde servidores. Probá con un Short que tenga CC habilitados (la mayoría los tiene).'
    }, { status: 422 });
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
    const code = extractInstagramCode(url);
    if (!code) return Response.json({
      error: 'URL de Instagram no válida. Formato: https://www.instagram.com/reel/ABC123/'
    }, { status: 400 });

    const debug: string[] = [];
    let quotaCount = 0;

    // 1️⃣ instagram-looter2 (RapidAPI) — 500 req/mes gratis, muy confiable
    if (rapidApiKey) {
      try {
        const res = await fetch(
          `https://instagram-looter2.p.rapidapi.com/post?link=${encodeURIComponent(url)}`,
          { headers: { 'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com', 'x-rapidapi-key':  rapidApiKey } }
        );
        const data = await res.json().catch(() => ({}));
        const msg = (data?.message || '').toLowerCase();
        if (msg.match(/exceeded|quota|plan|limit/)) { quotaCount++; debug.push('looter2: cupo agotado'); }
        else if (res.ok) {
          const item = Array.isArray(data) ? data[0] : data;
          const videoUrl = item?.url || item?.video_url || item?.media?.[0]?.url || item?.video_versions?.[0]?.url;
          if (videoUrl) {
            try {
              const texto = await transcribeWithGroq(videoUrl);
              if (texto) return Response.json({ texto });
              debug.push('looter2: video sin audio transcribible');
            } catch (e) { debug.push(`looter2: groq falló — ${(e as Error).message.slice(0, 60)}`); }
          } else debug.push('looter2: respuesta sin URL de video (¿es carrusel sin reel?)');
        } else debug.push(`looter2: HTTP ${res.status}`);
      } catch (e) { debug.push(`looter2: ${(e as Error).message.slice(0, 60)}`); }
    }

    // 2️⃣ instagram-api-fast-reliable-data-scraper (RapidAPI) — fallback
    if (rapidApiKey) {
      try {
        const res = await fetch(
          `https://instagram-api-fast-reliable-data-scraper.p.rapidapi.com/post?shortcode=${code}`,
          { headers: { 'x-rapidapi-host': 'instagram-api-fast-reliable-data-scraper.p.rapidapi.com', 'x-rapidapi-key':  rapidApiKey } }
        );
        const data = await res.json().catch(() => ({}));
        const msg = (data?.message || '').toLowerCase();
        if (msg.match(/exceeded|quota|plan|limit/)) { quotaCount++; debug.push('fast-reliable: cupo agotado'); }
        else if (res.ok && data?.status !== 'error') {
          const videoUrl = data?.video_versions?.[0]?.url || data?.video_url;
          if (videoUrl) {
            try {
              const texto = await transcribeWithGroq(videoUrl);
              if (texto) return Response.json({ texto });
              debug.push('fast-reliable: video sin audio transcribible');
            } catch (e) { debug.push(`fast-reliable: groq falló — ${(e as Error).message.slice(0, 60)}`); }
          } else {
            const caption  = data?.caption?.text || '';
            const username = data?.user?.username || '';
            if (caption) return Response.json({ texto: `[Caption del reel — no se pudo extraer audio]\n\n${caption}\nCreador: @${username}` });
            debug.push('fast-reliable: sin video ni caption');
          }
        } else debug.push(`fast-reliable: HTTP ${res.status}`);
      } catch (e) { debug.push(`fast-reliable: ${(e as Error).message.slice(0, 60)}`); }
    }

    // 3️⃣ instagram-scraper-api2 — segundo fallback
    if (rapidApiKey) {
      try {
        const res = await fetch(
          `https://instagram-scraper-api2.p.rapidapi.com/v1/post_info?code_or_id_or_url=${encodeURIComponent(url)}`,
          { headers: { 'x-rapidapi-host': 'instagram-scraper-api2.p.rapidapi.com', 'x-rapidapi-key':  rapidApiKey } }
        );
        const data = await res.json().catch(() => ({}));
        const msg = (data?.message || '').toLowerCase();
        if (msg.match(/exceeded|quota|plan|limit/)) { quotaCount++; debug.push('scraper-api2: cupo agotado'); }
        else if (res.ok) {
          const item = data?.data || data;
          const videoUrl = item?.video_url || item?.video_versions?.[0]?.url;
          if (videoUrl) {
            try {
              const texto = await transcribeWithGroq(videoUrl);
              if (texto) return Response.json({ texto });
              debug.push('scraper-api2: video sin audio transcribible');
            } catch (e) { debug.push(`scraper-api2: groq falló — ${(e as Error).message.slice(0, 60)}`); }
          } else {
            const caption = item?.caption?.text || item?.caption || '';
            if (caption) return Response.json({ texto: `[Caption del reel — no se pudo extraer audio]\n\n${caption}` });
            debug.push('scraper-api2: sin video ni caption');
          }
        } else debug.push(`scraper-api2: HTTP ${res.status}`);
      } catch (e) { debug.push(`scraper-api2: ${(e as Error).message.slice(0, 60)}`); }
    }

    // Mensaje final inteligente según qué falló
    const fullErrorContext = debug.join(' · ');
    if (quotaCount >= 2) {
      return Response.json({
        error: `⚠️ Cupos mensuales de Instagram API agotados en múltiples proveedores. Reseteo el día 1 del mes, o suscribite a un plan superior en RapidAPI. [${fullErrorContext}]`
      }, { status: 429 });
    }
    if (debug.some(d => d.includes('groq'))) {
      return Response.json({
        error: `Encontramos el reel pero no se pudo transcribir el audio (puede ser muy corto, sin voz, o un video sin sonido). [${fullErrorContext}]`
      }, { status: 502 });
    }
    return Response.json({
      error: `No se pudo obtener el reel. Causa probable: cuenta privada, reel recién publicado (las APIs aún no lo cachearon), o restringido por Meta. [${fullErrorContext}]`
    }, { status: 502 });
  }

  return Response.json({ error: 'Plataforma no soportada' }, { status: 400 });
}
