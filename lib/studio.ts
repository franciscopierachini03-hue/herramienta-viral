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
export async function generateAvatarImage(opts: {
  prompt: string;
  photoBase64?: string;     // base64 SIN el prefijo data:
  photoMime?: string;       // ej. 'image/jpeg'
}): Promise<{ dataUrl: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY no configurada (Nano Banana).');
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

  const parts: GeminiPart[] = [{ text: opts.prompt }];
  if (opts.photoBase64) {
    parts.push({ inline_data: { mime_type: opts.photoMime || 'image/jpeg', data: opts.photoBase64 } });
  }

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 240)}`);
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

function falModel(): string {
  return process.env.FAL_VIDEO_MODEL || 'fal-ai/kling-video/v2.1/standard/image-to-video';
}

// Encola un job de video. imageUrl puede ser un data URL (base64) o una URL
// pública. Devuelve el request_id para hacer polling.
export async function falVideoSubmit(opts: {
  imageUrl: string;
  prompt?: string;
  duration?: number;
}): Promise<{ requestId: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY no configurada (foto→video).');
  const model = falModel();

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

export type FalStatus = { status: 'pending' | 'done' | 'error'; url?: string; error?: string };

// Consulta el estado de un job de fal. Cuando está listo, devuelve la URL del video.
export async function falVideoStatus(requestId: string): Promise<FalStatus> {
  const key = process.env.FAL_KEY;
  if (!key) return { status: 'error', error: 'FAL_KEY no configurada.' };
  const model = falModel();
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
