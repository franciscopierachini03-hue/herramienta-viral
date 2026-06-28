import { NextRequest } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import ytdl from '@distube/ytdl-core';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const maxDuration = 120;

// Cache + rate limit configurables por env
const RATE_LIMIT_PER_DAY = parseInt(process.env.TRANSCRIBE_RATE_LIMIT_PER_DAY || '30', 10);

// Cache key estable por plataforma + ID del video. Si la URL cambia (parámetros
// de tracking, etc.) pero el ID es el mismo → mismo cache hit.
function cacheKeyFor(platform: string, url: string): string | null {
  if (platform === 'youtube') {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? `yt:${m[1]}` : null;
  }
  if (platform === 'tiktok') {
    const m = url.match(/video\/(\d+)/);
    return m ? `tt:${m[1]}` : null;
  }
  if (platform === 'instagram') {
    const m = url.match(/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/);
    return m ? `ig:${m[1]}` : null;
  }
  return null;
}

// Lookup en cache. Si hit → bumpea hits + last_hit_at y devuelve el texto.
async function getFromCache(cacheKey: string): Promise<string | null> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from('transcription_cache')
      .select('transcript')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (data?.transcript) {
      // Incrementar hits async (no bloquea respuesta)
      sb.rpc('increment_transcription_hits', { p_cache_key: cacheKey }).then(() => {}, () => {});
      // Fallback si la función RPC no existe: update directo
      sb.from('transcription_cache')
        .update({ last_hit_at: new Date().toISOString() })
        .eq('cache_key', cacheKey)
        .then(() => {}, () => {});
      return data.transcript;
    }
  } catch (e) {
    console.warn('[transcribir/cache] read error', e);
  }
  return null;
}

// Guardar transcripción exitosa para reuso futuro
async function saveToCache(cacheKey: string, platform: string, url: string, transcript: string) {
  if (!transcript || transcript.length < 20) return; // muy corto = ruido, no cachear
  try {
    const sb = createServiceClient();
    await sb.from('transcription_cache').upsert({
      cache_key: cacheKey,
      platform,
      video_url: url,
      transcript,
    }, { onConflict: 'cache_key' });
  } catch (e) {
    console.warn('[transcribir/cache] write error', e);
  }
}

// Log de la transcripción (para rate limit + analytics)
async function logTranscription(email: string, platform: string, url: string, cacheHit: boolean) {
  try {
    const sb = createServiceClient();
    await sb.from('transcription_log').insert({
      user_email: email,
      platform,
      video_url: url,
      cache_hit: cacheHit,
    });
  } catch { /* no bloquea */ }
}

// Cuenta cuántas transcripciones REALES (no cache hits) hizo este user en 24h
async function countRecentTranscriptions(email: string): Promise<number> {
  try {
    const sb = createServiceClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Contamos VIDEOS distintos, no filas: una misma acción puede reintentar /
    // re-disparar la transcripción del mismo video y, si contábamos filas, el
    // cupo se gastaba sin que la persona transcribiera videos nuevos.
    const { data } = await sb
      .from('transcription_log')
      .select('video_url')
      .eq('user_email', email)
      .eq('cache_hit', false)
      .gte('created_at', since)
      .limit(1000);
    const urls = new Set(
      (data || [])
        .map(r => String((r as { video_url?: string }).video_url || '').trim())
        .filter(Boolean),
    );
    return urls.size;
  } catch {
    return 0;
  }
}

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
  // Acepta /reel/, /reels/ (plural), /p/ y /tv/ — Instagram usa varias formas.
  const match = url.match(/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/);
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

  // ── Identificar usuario logueado (para rate limit + log) ──────────────
  let userEmail: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userEmail = user?.email || null;
  } catch { /* anónimo */ }

  // ── Cache lookup (gratis, instantáneo) ────────────────────────────────
  const cacheKey = cacheKeyFor(platform, url);
  if (cacheKey) {
    const cached = await getFromCache(cacheKey);
    if (cached) {
      console.log(`[transcribir] CACHE HIT ${cacheKey} (${platform})`);
      if (userEmail) logTranscription(userEmail, platform, url, true);
      return Response.json({ texto: cached, cached: true });
    }
  }

  // ── Rate limit: máx N transcripciones reales (no cache) por día por user ──
  if (userEmail && RATE_LIMIT_PER_DAY > 0) {
    const count = await countRecentTranscriptions(userEmail);
    if (count >= RATE_LIMIT_PER_DAY) {
      return Response.json({
        error: `Llegaste al límite de ${RATE_LIMIT_PER_DAY} transcripciones por día. Vuelve mañana o avisa al admin si necesitas más.`
      }, { status: 429 });
    }
  }

  // Helper para responder con transcripción + guardar en cache + log
  function ok(texto: string) {
    if (cacheKey) saveToCache(cacheKey, platform, url, texto);
    if (userEmail) logTranscription(userEmail, platform, url, false);
    return Response.json({ texto });
  }

  // ── YouTube ────────────────────────────────────────────────────────────────
  if (platform === 'youtube') {
    const videoId = extractYouTubeId(url);
    if (!videoId) return Response.json({
      error: 'URL de YouTube no válida. Pega el link completo del video.'
    }, { status: 400 });

    // Tracker de qué pasó en cada fallback para dar un error específico al final
    let supadataExhausted = false;

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
          if (texto) return ok(texto);
          // Si trajo OK pero sin contenido, podría ser que no tenga captions o cuota agotada
          if (data.error === 'limit-exceeded' || data.message === 'limit-exceeded') {
            supadataExhausted = true;
            console.warn('[transcribir/youtube] Supadata limit-exceeded');
          }
        } else {
          // Error HTTP — leer el body para ver si es limit-exceeded
          const errBody = await res.text().catch(() => '');
          if (errBody.includes('limit-exceeded')) {
            supadataExhausted = true;
            console.warn('[transcribir/youtube] Supadata limit-exceeded (HTTP)');
          }
        }
      } catch { /* fallback */ }
    }

    // 2️⃣ Fallback: youtube-transcript (suele estar bloqueado en Vercel)
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'es' }).catch(
        () => YoutubeTranscript.fetchTranscript(videoId)
      );
      const texto = transcript.map(t => t.text).join(' ').replace(/\s+/g, ' ').trim();
      if (texto) return ok(texto);
    } catch { /* fallback */ }

    // 3️⃣ RapidAPI fallback (si el user se suscribió a alguna de las APIs de transcripts)
    const rapidKey = process.env.RAPIDAPI_KEY;
    if (rapidKey) {
      // Probamos múltiples hosts; el primero que responda gana.
      // Si no te suscribiste a ninguno → todos devuelven "not subscribed" y caemos al next fallback.
      const rapidHosts = [
        { host: 'youtube-transcript3.p.rapidapi.com',  path: `/api/transcript?videoId=${videoId}`,   extract: (d: Record<string, unknown>) => {
          const tr = d.transcript;
          if (Array.isArray(tr)) return (tr as Array<{ text?: string }>).map(t => t.text || '').join(' ');
          return '';
        }},
        { host: 'youtube-transcriptor.p.rapidapi.com', path: `/transcript?video_id=${videoId}&lang=es`, extract: (d: unknown) => {
          if (Array.isArray(d) && d[0]) {
            const entry = d[0] as Record<string, unknown>;
            const t = entry.transcription || entry.transcript;
            if (Array.isArray(t)) return (t as Array<{ subtitle?: string }>).map(x => x.subtitle || '').join(' ');
            if (typeof t === 'string') return t;
          }
          return '';
        }},
      ];
      for (const r of rapidHosts) {
        try {
          const res = await fetch(`https://${r.host}${r.path}`, {
            headers: { 'x-rapidapi-host': r.host, 'x-rapidapi-key': rapidKey },
          });
          if (!res.ok) continue;
          const data = await res.json();
          if (typeof data === 'object' && data?.message === 'You are not subscribed to this API.') continue;
          const texto = (r.extract(data) || '').replace(/\s+/g, ' ').trim();
          if (texto.length > 20) {
            console.log(`[transcribir/youtube] RapidAPI fallback OK via ${r.host}`);
            return ok(texto);
          }
        } catch { /* try next */ }
      }
    }

    // 4️⃣ Sin subtítulos → descargar audio con ytdl-core + Groq Whisper
    // (Generalmente bloqueado en Vercel pero lo dejamos como último intento)
    try {
      const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
      const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
      if (audioFormats.length > 0) {
        const best = audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
        if (best.url) {
          const texto = await transcribeWithGroq(best.url);
          if (texto) return ok(texto);
        }
      }
    } catch { /* ytdl también bloqueado */ }

    // Error específico según qué falló:
    if (supadataExhausted) {
      return Response.json({
        error: 'El servicio de transcripción agotó su cuota mensual. Prueba con TikTok o Instagram, o espera al reset del próximo mes.'
      }, { status: 503 });
    }
    return Response.json({
      error: 'Este video no tiene subtítulos disponibles. Prueba con un Short que tenga CC habilitado, o con TikTok/Instagram.'
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
            if (texto) return ok(texto);
          }
        }
        // Sin subtítulos → Groq Whisper
        const texto = await transcribeWithGroq(videoUrl);
        if (texto) return ok(texto);
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
        if (texto) return ok(texto);
      }

      // Sin subtítulos → Groq Whisper con el audio del video
      const videoUrl = item?.video?.play_addr?.url_list?.[0]
        || item?.video?.download_addr?.url_list?.[0]
        || item?.video?.play_addr_lowbr?.url_list?.[0];

      if (!videoUrl) throw new Error('No se pudo obtener la URL del video. Puede ser un video privado.');

      const texto = await transcribeWithGroq(videoUrl);
      return ok(texto);

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
              if (texto) return ok(texto);
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
              if (texto) return ok(texto);
              debug.push('fast-reliable: video sin audio transcribible');
            } catch (e) { debug.push(`fast-reliable: groq falló — ${(e as Error).message.slice(0, 60)}`); }
          } else {
            const caption  = data?.caption?.text || '';
            const username = data?.user?.username || '';
            if (caption) return ok(`[Caption del reel — no se pudo extraer audio]\n\n${caption}\nCreador: @${username}`);
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
              if (texto) return ok(texto);
              debug.push('scraper-api2: video sin audio transcribible');
            } catch (e) { debug.push(`scraper-api2: groq falló — ${(e as Error).message.slice(0, 60)}`); }
          } else {
            const caption = item?.caption?.text || item?.caption || '';
            if (caption) return ok(`[Caption del reel — no se pudo extraer audio]\n\n${caption}`);
            debug.push('scraper-api2: sin video ni caption');
          }
        } else debug.push(`scraper-api2: HTTP ${res.status}`);
      } catch (e) { debug.push(`scraper-api2: ${(e as Error).message.slice(0, 60)}`); }
    }

    // 4️⃣ Apify — fallback robusto cuando los 3 RapidAPI se agotan/fallan.
    // Usa el actor oficial `apify/instagram-scraper` que toma la URL directa del
    // post y devuelve videoUrl. Tarda ~10-30s pero es muy confiable.
    const apifyToken = process.env.APIFY_TOKEN;
    if (apifyToken) {
      try {
        const res = await fetch(
          `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}&memory=512&timeout=120`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directUrls: [url], resultsType: 'posts', resultsLimit: 1, addParentData: false }),
          }
        );
        if (res.ok) {
          const items = await res.json();
          const item = Array.isArray(items) ? items[0] : items;
          const videoUrl = item?.videoUrl || item?.video_url || item?.video_versions?.[0]?.url;
          if (videoUrl) {
            try {
              const texto = await transcribeWithGroq(videoUrl);
              if (texto) return ok(texto);
              debug.push('apify: video sin audio transcribible');
            } catch (e) { debug.push(`apify: groq falló — ${(e as Error).message.slice(0, 60)}`); }
          } else {
            const caption = item?.caption || '';
            if (caption) return ok(`[Caption del reel — no se pudo extraer audio]\n\n${caption}`);
            debug.push('apify: sin video ni caption');
          }
        } else debug.push(`apify: HTTP ${res.status}`);
      } catch (e) { debug.push(`apify: ${(e as Error).message.slice(0, 60)}`); }
    }

    // Detectar si TODOS los proveedores fallaron por cupo agotado para dar
    // un mensaje específico (en vez de "prueba con otro reel" que confunde
    // cuando el problema es facturación, no el reel).
    const allQuotaExhausted = quotaCount >= 2 ||
      debug.some(d => d.includes('hard limit') || d.includes('cupo agotado'));

    // Tambien detectar si Apify devolvió monthly hard limit
    const apifyExhausted = debug.some(d => d.toLowerCase().includes('hard limit'));

    console.warn('[transcribir/instagram] todos los proveedores fallaron:', debug.join(' · '));

    if (allQuotaExhausted || apifyExhausted) {
      return Response.json({
        error: 'Los servicios de transcripción de Instagram agotaron su cuota mensual. Avisa al admin para renovar el plan.'
      }, { status: 503 });
    }
    if (debug.some(d => d.includes('groq'))) {
      return Response.json({
        error: 'No pudimos transcribir este reel ahora. Puede que el audio sea muy corto o no tenga voz. Prueba con otro.'
      }, { status: 502 });
    }
    return Response.json({
      error: 'No pudimos encontrarlo en este momento. Prueba de nuevo en un rato o con otro reel.'
    }, { status: 502 });
  }

  // ── Facebook ─────────────────────────────────────────────────────────────────
  // FB no expone el video sin un descargador. Usamos uno de RapidAPI (all-in-one,
  // configurable por env). Si no hay key / no estás suscrito → mensaje claro (501),
  // no rompe. Default: social-media-video-downloader.
  if (platform === 'facebook') {
    const fbHost = process.env.FB_DL_HOST || 'social-media-video-downloader.p.rapidapi.com';
    const fbPath = process.env.FB_DL_PATH || '/smvd/get/all?url=';
    if (!rapidApiKey) {
      return Response.json({ error: 'La transcripción de Facebook todavía no está configurada (falta el descargador).' }, { status: 501 });
    }
    try {
      const res = await fetch(`https://${fbHost}${fbPath}${encodeURIComponent(url)}`, {
        headers: { 'x-rapidapi-host': fbHost, 'x-rapidapi-key': rapidApiKey },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 || /not subscribed/i.test(JSON.stringify(data || ''))) {
        return Response.json({ error: 'La transcripción de Facebook necesita activar el descargador en RapidAPI (suscripción gratis). Avisa al admin.' }, { status: 501 });
      }
      // Extraer la mejor URL de video de las formas comunes de estos downloaders.
      const cands: string[] = [];
      const push = (x: unknown) => {
        if (typeof x === 'string' && /^https?:\/\//.test(x)) cands.push(x);
        else if (x && typeof x === 'object') {
          const o = x as { link?: string; url?: string };
          if (o.link) cands.push(o.link);
          if (o.url) cands.push(o.url);
        }
      };
      for (const arr of [data?.links, data?.medias, data?.video, data?.videos]) {
        if (Array.isArray(arr)) arr.forEach(push);
      }
      for (const s of [data?.url, data?.hd, data?.sd, data?.hd_src, data?.sd_src]) push(s);
      const videoUrl = cands.find(u => /\.mp4|\/video|videoplayback/i.test(u)) || cands[0];
      if (videoUrl) {
        const texto = await transcribeWithGroq(videoUrl);
        if (texto) return ok(texto);
      }
    } catch (e) {
      console.warn('[transcribir/facebook]', (e as Error).message);
    }
    return Response.json({ error: 'No pudimos obtener este video de Facebook. Verifica que sea público o prueba con otro.' }, { status: 502 });
  }

  return Response.json({ error: 'Plataforma no soportada' }, { status: 400 });
}
