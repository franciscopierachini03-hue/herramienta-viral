// Avatares IA — proveedores de generación.
//
//   • Imagen (avatar / "usa esta cara")  → Nano Banana = Google Gemini Image.
//   • Foto → video                        → fal.ai (cola async: submit + poll).
//
// DORMIDO por defecto: sin GEMINI_API_KEY / FAL_KEY cada función tira un error
// claro y la herramienta muestra "configúrame". Las APIs se cobran por uso →
// el costo se pasa al cliente vía créditos (lib/credits.ts).
//
// ⚠️ Al enchufar las keys, confirmar contra la doc vigente:
//    - GEMINI_IMAGE_MODEL: nombre del modelo de imagen de Gemini (Nano Banana).
//    - FAL_VIDEO_MODEL: endpoint del modelo image-to-video de fal.

export type StudioError = { error: string };

// ── Nano Banana (Gemini Image) ───────────────────────────────────────────────
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }
  | { inlineData?: { mimeType?: string; data?: string } };

// Genera/edita una imagen. Si pasás photoBase64 (+mime), el modelo usa esa cara
// como referencia ("ponme con este traje", etc.). Devuelve un data URL PNG.
// aspect: formato de salida — por defecto VERTICAL 9:16 (para reels).
export type AvatarAspect = '9:16' | '1:1' | '16:9';

export async function generateAvatarImage(opts: {
  prompt: string;
  photoBase64?: string;     // base64 SIN el prefijo data:
  photoMime?: string;       // ej. 'image/jpeg'
  aspect?: AvatarAspect;
}): Promise<{ dataUrl: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY no configurada (Nano Banana).');
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const aspect: AvatarAspect = opts.aspect || '9:16';

  // Refuerzo del formato también en el prompt (por si el modelo ignora config).
  const aspectTexto = aspect === '9:16' ? 'VERTICAL 9:16, formato de reel'
    : aspect === '16:9' ? 'horizontal 16:9' : 'cuadrado 1:1';
  const parts: GeminiPart[] = [{ text: `${opts.prompt}\n\nFormato de la imagen: ${aspectTexto}.` }];
  if (opts.photoBase64) {
    parts.push({ inline_data: { mime_type: opts.photoMime || 'image/jpeg', data: opts.photoBase64 } });
  }

  const pedir = (conImageConfig: boolean) =>
    fetch(`${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: conImageConfig
          ? { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } }
          : { responseModalities: ['IMAGE'] },
      }),
    });

  let res = await pedir(true);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Si el rechazo es por imageConfig (versión de API sin ese campo), reintenta
    // sin él — el formato queda reforzado igual por el prompt.
    if (res.status === 400 && /imageConfig|aspect/i.test(body)) {
      res = await pedir(false);
      if (!res.ok) {
        const b2 = await res.text().catch(() => '');
        throw new Error(`Gemini ${res.status}: ${b2.slice(0, 240)}`);
      }
    } else {
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 240)}`);
    }
  }
  const data = await res.json();
  const outParts: GeminiPart[] = data?.candidates?.[0]?.content?.parts || [];
  for (const p of outParts) {
    const inline = (p as { inlineData?: { mimeType?: string; data?: string } }).inlineData
      || (p as { inline_data?: { mime_type?: string; data?: string } }).inline_data;
    const b64 = (inline as { data?: string })?.data;
    const mime = (inline as { mimeType?: string; mime_type?: string })?.mimeType
      || (inline as { mime_type?: string })?.mime_type
      || 'image/png';
    if (b64) return { dataUrl: `data:${mime};base64,${b64}` };
  }
  throw new Error('Gemini no devolvió imagen (¿modelo sin salida de imagen?).');
}

// ── fal.ai — foto → video (cola async) ───────────────────────────────────────
const FAL_QUEUE = 'https://queue.fal.run';

// Dos niveles de calidad/costo (precios fal verificados 14-jul-26):
//   fast → LTX 13B distilled: $0.02/s ≈ $0.10 el clip de 5s (económico, DEFAULT)
//   pro  → Kling v2.1 standard: ≈ $0.28 el clip de 5s (más cine, más caro)
// Override por env: FAL_VIDEO_MODEL_FAST / FAL_VIDEO_MODEL.
export type VideoTier = 'fast' | 'pro';

export function falModel(tier: VideoTier = 'pro'): string {
  if (tier === 'fast') {
    return process.env.FAL_VIDEO_MODEL_FAST || 'fal-ai/ltxv-13b-098-distilled/image-to-video';
  }
  return process.env.FAL_VIDEO_MODEL || 'fal-ai/kling-video/v2.1/standard/image-to-video';
}

// Encola un job de video. imageUrl puede ser un data URL (base64) o una URL
// pública. Devuelve el request_id para hacer polling (con el MISMO tier).
export async function falVideoSubmit(opts: {
  imageUrl: string;
  prompt?: string;
  duration?: number;
  tier?: VideoTier;
}): Promise<{ requestId: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY no configurada (foto→video).');
  const model = falModel(opts.tier);

  const res = await fetch(`${FAL_QUEUE}/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: opts.imageUrl,
      prompt: opts.prompt || 'La persona habla a cámara con naturalidad, leve movimiento, parpadeo natural.',
      duration: opts.duration || 5,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`fal submit ${res.status}: ${body.slice(0, 240)}`);
  }
  const data = await res.json();
  const requestId = data?.request_id || data?.requestId;
  if (!requestId) throw new Error('fal no devolvió request_id.');
  return { requestId };
}

// ── fal.ai — CLON QUE HABLA (foto + audio → video hablando) ──────────────────
// sadtalker: barato (por segundo de cómputo), toma la foto directa. El audio
// sale de ElevenLabs (voz clonada). Override por env FAL_TALKING_MODEL.
export function falTalkingModel(): string {
  return process.env.FAL_TALKING_MODEL || 'fal-ai/sadtalker';
}

export async function falTalkingSubmit(opts: { imageUrl: string; audioUrl: string }): Promise<{ requestId: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY no configurada (clon que habla).');
  const res = await fetch(`${FAL_QUEUE}/${falTalkingModel()}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_image_url: opts.imageUrl, driven_audio_url: opts.audioUrl }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`fal talking submit ${res.status}: ${body.slice(0, 240)}`);
  }
  const data = await res.json();
  const requestId = data?.request_id || data?.requestId;
  if (!requestId) throw new Error('fal no devolvió request_id.');
  return { requestId };
}

export type FalStatus = { status: 'pending' | 'done' | 'error'; url?: string; error?: string };

// Consulta el estado de un job de fal para un MODELO dado (la cola es por
// modelo). Devuelve la URL del video cuando está listo.
async function falStatusByModel(requestId: string, model: string): Promise<FalStatus> {
  const key = process.env.FAL_KEY;
  if (!key) return { status: 'error', error: 'FAL_KEY no configurada.' };
  const headers = { Authorization: `Key ${key}` };

  const st = await fetch(`${FAL_QUEUE}/${model}/requests/${requestId}/status`, { headers, cache: 'no-store' });
  if (!st.ok) return { status: 'error', error: `fal status ${st.status}` };
  const sj = await st.json();
  const s = String(sj?.status || '').toUpperCase();
  if (s === 'COMPLETED' || s === 'OK') {
    const r = await fetch(`${FAL_QUEUE}/${model}/requests/${requestId}`, { headers, cache: 'no-store' });
    if (!r.ok) return { status: 'error', error: `fal result ${r.status}` };
    const rj = await r.json();
    const url = rj?.video?.url || rj?.output?.video?.url || rj?.video_url || (Array.isArray(rj?.videos) ? rj.videos[0]?.url : undefined);
    if (!url) return { status: 'error', error: 'fal sin URL de video en el resultado.' };
    return { status: 'done', url };
  }
  if (s === 'IN_QUEUE' || s === 'IN_PROGRESS' || s === 'PENDING') return { status: 'pending' };
  return { status: 'error', error: `fal estado inesperado: ${s || 'desconocido'}` };
}

// Estado de un job de foto→video. El tier tiene que ser el MISMO del submit.
export function falVideoStatus(requestId: string, tier: VideoTier = 'pro'): Promise<FalStatus> {
  return falStatusByModel(requestId, falModel(tier));
}

// Estado de un job del clon que habla.
export function falTalkingStatus(requestId: string): Promise<FalStatus> {
  return falStatusByModel(requestId, falTalkingModel());
}
