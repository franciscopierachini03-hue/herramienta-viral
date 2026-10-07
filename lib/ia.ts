// 🧠 IA DE LA PLATAFORMA — un solo lugar por el que pasan todas las generaciones.
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// El 7 de octubre de 2026 la cuenta de OpenAI se quedó sin saldo y DOCE
// apartados dejaron de funcionar al mismo tiempo: guiones, historias, formatos,
// la calculadora, analizar perfil, métricas, el centro de ayuda y el traductor
// del buscador. Cada uno llamaba a OpenAI por su cuenta, así que cada uno se
// cayó por su cuenta, en silencio y sin avisar a nadie.
//
// Groq seguía funcionando todo el tiempo. Lo único que faltaba era que alguien
// probara el segundo motor cuando el primero no contesta — exactamente lo que
// ya hacía la transcripción (lib/transcribir-audio) desde septiembre.
//
// ── Cómo funciona ──────────────────────────────────────────────────────────
//   1. OpenAI con el modelo que pida quien llama (gpt-4o por defecto)
//   2. Groq como respaldo: gpt-oss-120b para texto, qwen para JSON
//
// Si OpenAI responde "sin saldo" NO se reintenta: reintentar una tarjeta vacía
// solo gasta segundos. Se pasa directo al respaldo.

// El contenido puede ser texto o la forma multimodal de OpenAI (texto + imágenes),
// que es la que usan analizar-perfil y métricas para leer capturas.
export type Mensaje = { role: 'system' | 'user' | 'assistant'; content: string | unknown[] };

export type PedidoIA = {
  mensajes: Mensaje[];
  json?: boolean;          // exige respuesta en JSON (response_format json_object)
  temperatura?: number;
  maxTokens?: number;
  modelo?: string;         // modelo de OpenAI preferido
  etiqueta?: string;       // aparece en los logs: de qué apartado viene
};

export type RespuestaIA = { texto: string; motor: string };

// Groq cambia su catálogo sin avisar (ya retiró llama-3.3-70b en septiembre).
// Estos dos están verificados el 7-oct-2026; se pueden pisar por variable de
// entorno sin tocar código ni volver a desplegar.
const GROQ_TEXTO = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
// qwen es el único de Groq que acepta JSON forzado Y leer imágenes (verificado
// 7-oct-2026: gpt-oss-120b falla en los dos casos).
const GROQ_JSON  = process.env.GROQ_MODEL_JSON || 'qwen/qwen3.8-27b';

// 25 s por intento: un modelo que no contestó en ese tiempo no va a salvar el
// pedido, y mientras tanto se come el tiempo del segundo motor. Vercel corta la
// función entera a los 60 s.
const TOPE_MS = Number(process.env.IA_TIMEOUT_MS || 25000);

export class SinIA extends Error {
  constructor(public detalle: string) {
    super(`Ningún motor de IA pudo responder — ${detalle}`);
  }
}

async function pedir(url: string, key: string, cuerpo: Record<string, unknown>) {
  const corte = AbortSignal.timeout(TOPE_MS);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(cuerpo),
    signal: corte,
  });
  const cuerpoTxt = await r.text();
  if (!r.ok) return { ok: false as const, status: r.status, detalle: cuerpoTxt.slice(0, 200) };
  try {
    const d = JSON.parse(cuerpoTxt);
    const texto = d?.choices?.[0]?.message?.content;
    if (typeof texto === 'string' && texto.trim()) return { ok: true as const, texto };
    return { ok: false as const, status: 200, detalle: 'respuesta vacía' };
  } catch {
    return { ok: false as const, status: 200, detalle: 'respuesta ilegible' };
  }
}

export async function generar(p: PedidoIA): Promise<RespuestaIA> {
  const et = p.etiqueta || 'ia';
  const base: Record<string, unknown> = { messages: p.mensajes };
  if (p.temperatura != null) base.temperature = p.temperatura;
  if (p.maxTokens != null) base.max_tokens = p.maxTokens;
  // OpenAI EXIGE que la palabra "json" aparezca en los mensajes cuando se usa
  // este formato. Si falta, devuelve 400 y el apartado se rompe sin motivo
  // visible — ya pasó con el clasificador de estilos en agosto.
  if (p.json) base.response_format = { type: 'json_object' };
  const pistas: string[] = [];

  // ── 1. OpenAI ──
  const oa = process.env.OPENAI_API_KEY;
  if (oa) {
    try {
      const r = await pedir('https://api.openai.com/v1/chat/completions', oa,
        { ...base, model: p.modelo || 'gpt-4o' });
      if (r.ok) return { texto: r.texto, motor: `openai/${p.modelo || 'gpt-4o'}` };
      const sinSaldo = /insufficient_quota|no credits remaining|billing/i.test(r.detalle);
      pistas.push(`openai ${r.status}${sinSaldo ? ' SIN SALDO' : ''}`);
      console.error(`[${et}] OpenAI ${r.status}${sinSaldo ? ' — SIN SALDO, pasando al respaldo' : ''}: ${r.detalle.slice(0, 120)}`);
    } catch (e) {
      pistas.push('openai sin respuesta');
      console.error(`[${et}] OpenAI no respondió: ${(e as Error).message.slice(0, 100)}`);
    }
  } else pistas.push('openai sin llave');

  // ── 2. Groq ──
  const gq = process.env.GROQ_API_KEY;
  if (gq) {
    // Con imágenes o JSON forzado solo sirve qwen; para texto suelto va primero
    // el modelo grande. Si el primero no entrega, se prueba el otro: son
    // gratis y tardan menos de un segundo.
    const conImagenes = p.mensajes.some(m => Array.isArray(m.content));
    const candidatos = (p.json || conImagenes) ? [GROQ_JSON] : [GROQ_TEXTO, GROQ_JSON];
    for (const modelo of candidatos) {
      // gpt-oss PIENSA antes de contestar y, sin este freno, se gasta todas las
      // palabras pensando y devuelve el texto vacío (verificado 7-oct-2026).
      const extra = modelo.includes('gpt-oss') ? { reasoning_effort: 'low' } : {};
      try {
        const r = await pedir('https://api.groq.com/openai/v1/chat/completions', gq, { ...base, ...extra, model: modelo });
        if (r.ok) {
          console.log(`[${et}] respondió el respaldo de Groq (${modelo})`);
          return { texto: r.texto, motor: `groq/${modelo}` };
        }
        pistas.push(`groq/${modelo} ${r.status}`);
        console.error(`[${et}] Groq ${modelo} ${r.status}: ${r.detalle.slice(0, 120)}`);
      } catch (e) {
        pistas.push(`groq/${modelo} sin respuesta`);
        console.error(`[${et}] Groq ${modelo} no respondió: ${(e as Error).message.slice(0, 100)}`);
      }
    }
  } else pistas.push('groq sin llave');

  throw new SinIA(pistas.join(' · '));
}

// Lo mismo, pero devolviendo el objeto ya parseado. Si el motor contesta algo
// que no es JSON válido, se trata como fallo del motor y no como dato bueno.
export async function generarJSON<T = Record<string, unknown>>(p: Omit<PedidoIA, 'json'>): Promise<{ datos: T; motor: string }> {
  const { texto, motor } = await generar({ ...p, json: true });
  try {
    return { datos: JSON.parse(texto) as T, motor };
  } catch {
    const m = texto.match(/\{[\s\S]*\}/);            // a veces lo envuelven en texto
    if (m) { try { return { datos: JSON.parse(m[0]) as T, motor }; } catch { /* sigue abajo */ } }
    throw new SinIA(`${motor} devolvió algo que no es JSON`);
  }
}

// Mensaje para la persona cuando no hay ningún motor disponible. No se le
// cuenta el problema de facturación: se le dice qué hacer.
export const MENSAJE_SIN_IA =
  'En este momento no podemos generar esto. Ya quedó registrado y lo estamos revisando — vuelve a intentarlo en unos minutos.';
