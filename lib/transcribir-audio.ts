// 🎙️ TRANSCRIBIR AUDIO — el paso final de TODAS las plataformas.
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// Instagram y Facebook dependen de este paso al 100%, y TikTok casi siempre.
// Hasta ahora había un solo motor (Groq Whisper) escrito a mano en dos
// archivos: si Groq se caía, retiraba el modelo o devolvía 429, TODAS las
// plataformas morían al mismo tiempo y la persona solo veía "no pudimos
// encontrarlo en este momento".
//
// No es hipotético: Groq retiró `llama-3.3-70b-versatile` sin avisar y dejó el
// chat de palabras clave mudo hasta que alguien lo reportó. El mismo día puede
// pasarle a `whisper-large-v3`.
//
// Ahora hay una CADENA. El audio se descarga UNA vez y se prueba contra cada
// motor hasta que uno conteste:
//   1. Groq whisper-large-v3      — el más barato y rápido
//   2. OpenAI gpt-4o-mini-transcribe — respaldo (la llave ya estaba)
//   3. OpenAI whisper-1           — último recurso
//
// Y cada intento queda ANOTADO en la traza: qué motor, si funcionó, por qué no
// y cuánto tardó. Sin eso no hay forma de saber qué está roto — que era
// exactamente el problema.

export type Intento = { motor: string; ok: boolean; detalle: string; ms: number };

// Groq corta en 25MB; OpenAI también. Nos quedamos abajo por seguridad.
export const MAX_BYTES = 24 * 1024 * 1024;

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));

type Motor = { nombre: string; url: string; modelo: string; llave: () => string | undefined };

const MOTORES: Motor[] = [
  { nombre: 'groq/whisper-large-v3', url: 'https://api.groq.com/openai/v1/audio/transcriptions', modelo: 'whisper-large-v3', llave: () => process.env.GROQ_API_KEY },
  { nombre: 'openai/gpt-4o-mini-transcribe', url: 'https://api.openai.com/v1/audio/transcriptions', modelo: 'gpt-4o-mini-transcribe', llave: () => process.env.OPENAI_API_KEY },
  { nombre: 'openai/whisper-1', url: 'https://api.openai.com/v1/audio/transcriptions', modelo: 'whisper-1', llave: () => process.env.OPENAI_API_KEY },
];

// Un motor, con reintento ante 429/5xx (el problema pasa solo; no hay que
// quemar el siguiente motor por una sobrecarga de un segundo).
async function probarMotor(m: Motor, audio: ArrayBuffer, traza: Intento[]): Promise<string | null> {
  const key = m.llave();
  if (!key) { traza.push({ motor: m.nombre, ok: false, detalle: 'sin llave configurada', ms: 0 }); return null; }

  for (let intento = 0; intento < 3; intento++) {
    const t0 = Date.now();
    try {
      const form = new FormData();
      form.append('file', new File([audio], 'audio.mp4', { type: 'audio/mp4' }), 'audio.mp4');
      form.append('model', m.modelo);
      form.append('response_format', 'text');   // sin forzar idioma: lo detecta solo

      const res = await fetch(m.url, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
      const cuerpo = (await res.text()).trim();
      const ms = Date.now() - t0;

      if (res.ok) {
        // Un 200 con texto vacío es un video sin voz, no una falla del motor:
        // cambiar de motor no lo va a arreglar, así que se corta la cadena.
        traza.push({ motor: m.nombre, ok: true, detalle: cuerpo ? `${cuerpo.length} caracteres` : 'sin voz detectada', ms });
        return cuerpo;
      }

      // 429 / 5xx → esperar y reintentar el MISMO motor.
      if (res.status === 429 || res.status >= 500) {
        traza.push({ motor: m.nombre, ok: false, detalle: `HTTP ${res.status} (intento ${intento + 1}/3)`, ms });
        if (intento < 2) { await dormir(600 * 2 ** intento); continue; }
        return null;
      }

      // 4xx → el motor no va a cambiar de opinión. Al siguiente.
      traza.push({ motor: m.nombre, ok: false, detalle: `HTTP ${res.status} · ${cuerpo.slice(0, 120)}`, ms });
      return null;
    } catch (e) {
      traza.push({ motor: m.nombre, ok: false, detalle: (e as Error).message.slice(0, 120), ms: Date.now() - t0 });
      if (intento < 2) { await dormir(600 * 2 ** intento); continue; }
      return null;
    }
  }
  return null;
}

// Descarga el audio y lo transcribe con el primer motor que conteste.
// `traza` se llena con lo que pasó en cada paso — pasala siempre: es lo único
// que queda cuando algo falla.
export async function transcribirAudio(audioUrl: string, traza: Intento[] = []): Promise<string> {
  // ── 1. Bajar el audio (una sola vez para todos los motores) ──
  const t0 = Date.now();
  let audio: ArrayBuffer;
  try {
    const res = await fetch(audioUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      traza.push({ motor: 'descarga', ok: false, detalle: `HTTP ${res.status}`, ms: Date.now() - t0 });
      throw new Error('No se pudo descargar el audio del video');
    }
    audio = await res.arrayBuffer();
  } catch (e) {
    if (!traza.some(t => t.motor === 'descarga')) {
      traza.push({ motor: 'descarga', ok: false, detalle: (e as Error).message.slice(0, 120), ms: Date.now() - t0 });
    }
    throw e;
  }

  const mb = audio.byteLength / 1024 / 1024;
  traza.push({ motor: 'descarga', ok: true, detalle: `${mb.toFixed(1)} MB`, ms: Date.now() - t0 });

  if (audio.byteLength > MAX_BYTES) {
    // No es cuota ni caída: el archivo no entra. Quien llama debería haber
    // pasado el stream de audio del DASH (≈1MB) en vez del video entero.
    throw new Error(`archivo muy grande (${Math.round(mb)}MB, el tope son 24MB)`);
  }

  // ── 2. Probar los motores en orden ──
  for (const m of MOTORES) {
    const texto = await probarMotor(m, audio, traza);
    if (texto !== null) return texto;   // '' incluido: 200 sin voz corta la cadena
  }

  throw new Error(`ningún motor de transcripción respondió — ${resumenTraza(traza)}`);
}

// La traza en una línea, para logs y para guardar en la base.
export function resumenTraza(traza: Intento[]): string {
  return traza.map(t => `${t.motor}: ${t.ok ? '✓' : '✗'} ${t.detalle} (${t.ms}ms)`).join(' · ');
}

// ── Con tiempos por palabra ─────────────────────────────────────────────────
// El editor (/api/process-video) no quiere el texto: quiere saber en qué
// segundo se dice cada palabra, para cortar. Eso pide `verbose_json`, que solo
// aceptan los Whisper completos — gpt-4o-mini-transcribe no los devuelve, así
// que acá la cadena es más corta.

export type TranscripcionConTiempos = { text: string; words: unknown[]; segments: unknown[] };

const MOTORES_CON_TIEMPOS: Motor[] = [
  { nombre: 'groq/whisper-large-v3', url: 'https://api.groq.com/openai/v1/audio/transcriptions', modelo: 'whisper-large-v3', llave: () => process.env.GROQ_API_KEY },
  { nombre: 'openai/whisper-1', url: 'https://api.openai.com/v1/audio/transcriptions', modelo: 'whisper-1', llave: () => process.env.OPENAI_API_KEY },
];

export async function transcribirConTiempos(archivo: File | Blob, traza: Intento[] = []): Promise<TranscripcionConTiempos> {
  for (const m of MOTORES_CON_TIEMPOS) {
    const key = m.llave();
    if (!key) { traza.push({ motor: m.nombre, ok: false, detalle: 'sin llave configurada', ms: 0 }); continue; }

    const t0 = Date.now();
    try {
      const form = new FormData();
      form.append('file', archivo);
      form.append('model', m.modelo);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');
      form.append('timestamp_granularities[]', 'segment');

      const res = await fetch(m.url, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
      const ms = Date.now() - t0;
      if (!res.ok) {
        traza.push({ motor: m.nombre, ok: false, detalle: `HTTP ${res.status} · ${(await res.text()).slice(0, 120)}`, ms });
        continue;
      }
      const d = await res.json();
      traza.push({ motor: m.nombre, ok: true, detalle: `${(d.words || []).length} palabras`, ms });
      return { text: d.text || '', words: d.words || [], segments: d.segments || [] };
    } catch (e) {
      traza.push({ motor: m.nombre, ok: false, detalle: (e as Error).message.slice(0, 120), ms: Date.now() - t0 });
    }
  }
  throw new Error(`ningún motor con tiempos respondió — ${resumenTraza(traza)}`);
}
