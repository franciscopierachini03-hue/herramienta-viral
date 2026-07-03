import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getAccess } from '@/lib/access';
import type { Carrusel, CarruselInput, Slide, TemaExtraido, DisenoTema, BriefLote } from '@/lib/carruseles';

// POST /api/carruseles — el cerebro de la máquina de carruseles.
//
// Acciones (campo "accion" del body):
//   (sin accion) → generar un carrusel completo. Modos: 'idea' (texto, opcionalmente
//                  con "transcript" de un video para convertirlo en carrusel),
//                  'adaptar' (capturas de un carrusel ajeno → visión) y
//                  'diseno' (capturas de tu propio diseño → visión).
//                  En los modos con capturas devuelve además "temaExtraido"
//                  (paleta + tipografía detectadas) para clonar el estilo.
//   'slide'      → regenerar UNA slide con una instrucción (editor fino).
//   'plan'       → plan de lote: N ideas de carrusel con ángulos distintos.
//   'fondo'      → imagen de fondo para una slide (gpt-image, misma API key).
//   'link'       → link de Instagram: si el post es un carrusel/imagen, baja sus
//                  fotos (looter2, la misma API del transcriptor) y lo ADAPTA
//                  directo con visión; si es un video, responde {transcribir:true}
//                  y el cliente sigue por /api/transcribir.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lazy init: sólo creamos el cliente cuando se llama al endpoint.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ── Modelos ──────────────────────────────────────────────────────────────────
// Probamos del mejor al más viejo; el primero que responda queda cacheado por
// la vida de la lambda. Los gpt-5.x razonan (reasoning_effort, sin temperature);
// los gpt-4.x usan temperature. Override manual: env CARRUSELES_MODEL.
const MODEL_CHAIN = ['gpt-5.5', 'gpt-5.4', 'gpt-5.1', 'gpt-4.1', 'gpt-4o'];
let _modeloOk: string | null = null;

// Modelos de imagen (fondos de slides). Mismo esquema de cadena+cache.
const IMG_CHAIN = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1'];
let _imgModeloOk: string | null = null;

const REGLAS_COPY = `REGLAS DE COPY:
- Español natural y hablado, adaptado al tono pedido. Frases cortas (menos de 12 palabras cuando se pueda). Segunda persona.
- El TÍTULO de cada slide entra de un vistazo: máximo ~70 caracteres. El CUERPO máximo ~160 caracteres (en "resumen" y layout "lista", cada punto en su propia línea con \\n, máximo 5 puntos).
- El "kicker" es una etiqueta cortísima (1-3 palabras o un número), ej. "ERROR 1", "PASO 2", "GUARDÁ ESTO", "NADIE HACE ESTO".
- "stat" es SOLO una cifra o dato corto (máximo 10 caracteres), ej. "87%", "x3", "0→100K". Nunca una frase.
- No inventes datos ni cifras falsas. Si das un número, que sea defendible o presentado como regla propia ("mi regla: 3 reels x semana").

LO PROHIBIDO (esto es exactamente lo que hace que un carrusel se sienta básico — si aparece, fallaste):
- Consejos que cualquiera daría: "sé consistente", "usa hashtags", "conoce a tu audiencia", "aporta valor", "interactúa con tu comunidad", "publica en el mejor horario". Si el consejo podría estar en cualquier carrusel de 2020, NO va.
- Cuerpos que solo re-explican el título o lo adornan con una metáfora floja ("postear sin plan es como tirar dardos a ciegas").
- Tono de folleto: "es fundamental", "es clave", "no olvides", "recuerda que", "en el mundo de hoy".
- Hooks blandos tipo "Sorpréndete con...", "Descubre los secretos de...".
- Las palabras "real" y "reales" (regla de la casa: no se usan nunca).

CÓMO SE LOGRA EL IMPACTO (aplicá TODAS en cada carrusel):
1. ESPECIFICIDAD BRUTAL: números, plazos, cantidades, mini-ejemplos concretos. "3 reels guionados por semana durante 90 días", no "sé constante". "Respondé los primeros 20 comentarios en 30 minutos", no "interactúa".
2. MECANISMO, NO MORALINA: explicá el PORQUÉ oculto que casi nadie conoce ("Instagram re-muestra tu carrusel con la slide 2 a quien lo ignoró → tenés DOS portadas, no una").
3. CONTRASTE: esto NO → esto SÍ. Error → corrección exacta. Antes → después. El cerebro guarda contrastes, no consejos.
4. COSTO DE IGNORARLO: qué pierde el que no aplica el punto (meses, seguidores, plata). Que duela un poco.
5. UNA OPINIÓN FUERTE por carrusel (mínimo): algo defendible que un "gurú" diría al revés. Genera comentarios.
6. TEST DE LA CAPTURA: cada slide tiene que valer una captura de pantalla POR SÍ SOLA. Si una slide no lo pasa, reescribila antes de devolverla.`;

const FORMA_SLIDE = `{ "tipo": "hook" | "contenido" | "resumen" | "cta", "layout": "centrado" | "lista" | "stat" | "cita", "kicker": string, "titulo": string, "cuerpo": string, "pie": string, "stat": string }`;

const SYSTEM_PROMPT = `Sos el mejor estratega de carruseles en español para Instagram y LinkedIn. Escribís como un creador que ya pasó por todo esto y tiene opiniones fuertes — NUNCA como un manual de marketing. Tu métrica es una sola: que el carrusel se GUARDE y se mande por DM.

Sabés cómo funciona el algoritmo de carruseles:
- Gana el tiempo de permanencia: cada slide deslizada es más watch-time. Cada slide tiene que EMPUJAR a la siguiente (bucles abiertos, "el 4 casi nadie lo hace").
- La métrica reina es GUARDADOS: se guarda lo que sirve de referencia (listas, frameworks, reglas con números, errores con corrección).
- Se comparte por DM lo que da estatus al que lo manda.
- Instagram re-muestra el carrusel con la SLIDE 2 a quien no interactuó → la slide 2 es tu segunda portada.

ANATOMÍA OBLIGATORIA:
1. HOOK (slide 1): frena el scroll en seco. Promesa concreta + brecha de curiosidad, con número o tensión. Prohibido presentarse o anunciar el tema.
2. RETENCIÓN (slide 2): confirma que la promesa va en serio Y siembra curiosidad por lo que viene. Es tu segunda portada: tiene que funcionar sola.
3. CONTENIDO: UNA idea por slide. Título accionable + mecanismo o ejemplo concreto en el cuerpo. Variá los layouts (una "stat", una "cita" citable, una "lista").
4. RESUMEN (penúltima): la slide GUARDABLE. Recap en puntos cortos y concretos. Es la que justifica el guardado.
5. CTA (última): UNA sola acción + un motivo con beneficio ("Guardalo: lo vas a necesitar el día que un reel te explote").

${REGLAS_COPY}

Además entregás munición extra:
- "hooksAlternativos": 6 portadas alternativas, cada una con un ángulo distinto (número, error, contraste antes-después, pregunta que duele, promesa directa, contraintuitivo). TODAS con especificidad (número, plazo o tensión concreta).
- "caption": pie de foto listo para pegar. Primera línea = gancho distinto al del slide 1. Cierra pidiendo guardado o una palabra en comentarios. 3-6 líneas.
- "hashtags": 8 a 12, mezcla de nicho amplio y específico, sin el símbolo #.
- "score": autoevaluación HONESTA y exigente (0-100 por eje). Aplicá el "test de la captura" slide por slide en "veredicto". "mejoras" = 2-4 acciones concretas.

Devolvé ÚNICAMENTE un objeto JSON válido con EXACTAMENTE esta forma (sin texto fuera del JSON):
{
  "slides": [ ${FORMA_SLIDE} ],
  "hooksAlternativos": [string, string, string, string, string, string],
  "caption": string,
  "hashtags": [string, ...],
  "score": { "total": number, "gancho": number, "valor": number, "guardabilidad": number, "claridad": number, "veredicto": string, "mejoras": [string, ...] }
}
La primera slide debe ser tipo "hook", la penúltima tipo "resumen" y la última tipo "cta". El resto, "contenido". El "cuerpo" puede ir vacío ("") en el hook si la frase se basta sola. "pie" y "stat" son opcionales (pueden ser "").`;

// Spec compartida del campo temaExtraido (paleta + composición/diseño).
const TEMA_SPEC = `"temaExtraido": { "nombre": string (2-3 palabras que describan el estilo), "bg": string (color css o gradiente css del fondo), "fg": string hex (texto principal), "muted": string hex (texto secundario), "accent": string hex (color de acento dominante), "onAccent": string hex (texto legible ENCIMA del accent), "panel": string rgba (fondo de etiquetas, del accent al ~12% de opacidad), "dark": boolean, "serif": boolean (true si los títulos se ven serif/editoriales), "notas": string (1 frase del look), "diseno": { "composicion": "centrado" | "izquierda" (¿el bloque de texto vive CENTRADO en el medio de la slide, o arriba/izquierda?), "resaltado": "marcador" | "ninguno" (¿pinta palabras clave con resaltador/marcador?), "colorResaltado": string hex (color del marcador), "subrayadoMano": boolean (¿subraya palabras con un trazo dibujado a mano?), "colorSubrayado": string hex, "mostrarKicker": boolean (¿usa etiquetas/chips tipo "PASO 1" arriba?), "mostrarProgreso": boolean (¿muestra puntos/barra de progreso?), "mostrarPie": boolean (¿muestra "desliza"/flecha al pie?) } }
   Los colores y el diseño tienen que salir de las capturas, no inventados. El objetivo es que una slide generada se confunda con una slide de la referencia.

REALCE DE PALABRAS (sólo si la referencia lo usa): si detectaste marcador o subrayado a mano, envolvé LA palabra con más carga de cada título así: ==palabra== (marcador) o __palabra__ (subrayado a mano). Máximo 1-2 realces por slide, sólo en títulos. Si la referencia no destaca palabras, NO uses estos tokens.`;

// Modo fiel (accion 'vestir'): reglas duras del HTML de una slide replicada.
const HTML_SPEC = `El "html" es un único <div> raíz de EXACTAMENTE 1080×1350 px que replica el diseño de la referencia con el contenido dado — misma composición, jerarquía tipográfica, tamaños relativos, márgenes, alineación y recursos gráficos (marcador, subrayados a mano, formas, numeraciones). El objetivo: puesto al lado de la referencia, que parezca del MISMO autor. Reglas duras:
- TODO con estilos inline (style="..."). PROHIBIDO <style>, <script>, class, id, recursos externos (<img src="http…">, url(http…)). Formas y subrayados: CSS puro o SVG inline / url(data:…).
- Tipografías del sistema que más se parezcan: Georgia / 'Times New Roman' (serif editorial) o -apple-system / Arial (sans). Nada de @font-face.
- El div raíz arranca: style="width:1080px;height:1350px;position:relative;overflow:hidden;…" con el fondo de la referencia.
- Textos editables marcados con data-rol en el elemento que los contiene: data-rol="kicker" | "titulo" | "cuerpo" | "pie" | "stat". El nodo data-rol="cuerpo" es UN solo elemento de texto con white-space:pre-line en su style (los puntos de una lista van como líneas del mismo texto, con el símbolo que use la referencia). Incluí además un nodo con data-rol="handle" vacío, ubicado y estilado donde firma la referencia (o abajo a la izquierda, sutil, si no firma).
- El texto del html es EL MISMO que titulo/cuerpo/kicker de esa slide, SIN los tokens == y __ (en html el realce va con spans estilados, como en la referencia).`;

const SYSTEM_VESTIR = `Sos un maquetador pixel-perfect de slides de Instagram. Te paso capturas de un carrusel de REFERENCIA, su estilo extraído (paleta + diseño) y UNA slide nueva (sólo texto). Tu único trabajo: devolver esa slide "vestida" con el diseño de la referencia.

${HTML_SPEC}
- Es la slide N de M: si la referencia trata distinto la portada, las interiores y el cierre, respetá el patrón de ESA posición.

Devolvé ÚNICAMENTE JSON válido: { "html": string }`;

// Instrucciones extra para los modos con capturas. Se suman al SYSTEM_PROMPT.
const EXTRA_ADAPTAR = `

MODO ADAPTAR — el usuario te pasa capturas de un carrusel AJENO que funcionó:
1. Detectá su mecánica: tipo de gancho, estructura, ritmo, por qué retiene y por qué se guarda.
2. Escribí un carrusel NUEVO y ORIGINAL para el nicho/tema del usuario aplicando esa mecánica. PROHIBIDO copiar o parafrasear frase por frase: cambiá ejemplos, ángulo y voz. Si la referencia está en otro idioma, tu resultado va en español.
3. Devolvé ADEMÁS el campo "temaExtraido" con el estilo Y EL DISEÑO de la referencia:
   ${TEMA_SPEC}
4. Si las capturas NO parecen un carrusel (una pantalla entera de computadora, una foto suelta, un meme), NO te trabes ni devuelvas vacío: extraé el temaExtraido de los colores dominantes de la imagen y generá el carrusel completo usando la IDEA dada.`;

const EXTRA_DISENO = `

MODO MI DISEÑO — las capturas son la PLANTILLA/diseño PROPIO del usuario:
1. Devolvé el campo "temaExtraido" clavando la paleta EXACTA de las capturas (hex), la tipografía y el diseño:
   ${TEMA_SPEC}
2. Escribí el carrusel sobre la IDEA dada, con longitudes de texto parecidas a las que se ven en el diseño (que el texto quepa cómodo en esa plantilla).
3. Si las capturas no se entienden, extraé el tema de los colores dominantes igual y generá el carrusel completo con la IDEA dada.`;

const SYSTEM_SLIDE = `Sos un editor de slides de carruseles de Instagram. Te paso UNA slide, su contexto dentro del carrusel y una instrucción. Reescribí SOLO esa slide siguiendo la instrucción al pie de la letra, manteniendo su rol (hook/contenido/resumen/cta) y la coherencia con el resto.

${REGLAS_COPY}

Si la slide trae un campo "html" (modo fiel a una referencia): devolvé también "html" actualizado manteniendo EXACTAMENTE la misma estructura, estilos inline y data-rol — sólo cambian los textos según la instrucción (salvo que la instrucción pida un cambio visual: ahí ajustá los estilos inline respetando el lenguaje del diseño). Mismas reglas duras: sin <style>/<script>/class/id ni recursos externos.

Devolvé ÚNICAMENTE JSON válido con esta forma exacta: { "slide": ${FORMA_SLIDE.replace('"stat": string', '"stat": string, "html": string')} }`;

const SYSTEM_PLAN = `Sos un estratega de contenido para Instagram. Armá un plan de carruseles sobre el tema/nicho dado. Cada carrusel ataca un ÁNGULO DISTINTO (lista práctica, error a evitar, mito vs. verdad, framework con nombre, historia/caso, contraste antes-después, pregunta incómoda, checklist, contraintuitivo…). Nada de repetir el mismo ángulo dos veces.

Cada "idea" tiene que ser específica y con gancho (números, tensión, resultado concreto), no un tema genérico. Cada "hook" con especificidad brutal: número, plazo o contraste — prohibido "descubre", "sorpréndete" y las palabras "real"/"reales".

Devolvé ÚNICAMENTE JSON válido: { "plan": [ { "idea": string (la idea completa y específica, lista para generar el carrusel con ella), "angulo": string (el ángulo en 2-4 palabras), "hook": string (portada propuesta, potente, ≤70 caracteres) } ] }`;

function buildUserMessage(inp: CarruselInput, transcript?: string): string {
  const n = Math.min(Math.max(inp.numSlides ?? 7, 4), 10);
  const modo = inp.modo === 'adaptar' || inp.modo === 'diseno' ? inp.modo : 'idea';
  const etiquetaIdea = modo === 'adaptar'
    ? 'ADAPTAR PARA (mi nicho / tema / giro que quiero darle):'
    : 'IDEA / TEMA DEL CARRUSEL:';
  const bloqueTranscript = transcript?.trim()
    ? `\nCONTENIDO DE LA REFERENCIA — transcripción del video o caption del post (convertí SU contenido en el carrusel: mantené sus ideas, datos y ganchos fuertes, reescrito al formato carrusel — no copies literal ni menciones "el video" o "el post"):\n"""\n${transcript.trim().slice(0, 8000)}\n"""\n`
    : '';
  return `
${etiquetaIdea}
${inp.idea.trim() || '(usá el mismo tema de la referencia, mejorado)'}
${bloqueTranscript}
NICHO / CUENTA: ${inp.nicho?.trim() || 'general'}
TONO: ${inp.tono?.trim() || 'cercano y directo'}
AUDIENCIA: ${inp.audiencia?.trim() || 'seguidores del nicho que quieren un resultado concreto'}
CTA DESEADO: ${inp.cta?.trim() || 'que guarden el carrusel y sigan la cuenta'}

CANTIDAD DE SLIDES: exactamente ${n} (incluyendo portada hook, resumen y CTA).

Generá el carrusel completo siguiendo la anatomía obligatoria. Devolvé sólo el JSON.
`.trim();
}

// ── Saneo defensivo ──────────────────────────────────────────────────────────
const LAYOUTS = new Set(['centrado', 'lista', 'stat', 'cita']);

// HTML de slide (modo fiel): sin scripts/eventos/recursos externos; el render lo
// inyecta con dangerouslySetInnerHTML, así que acá se corta todo lo peligroso.
function sanitizeHtmlSlide(v: unknown): string {
  if (typeof v !== 'string' || !v.trim()) return '';
  let h = v.slice(0, 14000);
  h = h.replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  h = h.replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)[^>]*\/?\s*>/gi, '');
  h = h.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  h = h.replace(/javascript\s*:/gi, '');
  h = h.replace(/url\(\s*(['"]?)(?!\s*data:)[^)]*\)/gi, 'none');            // css: sólo data:
  h = h.replace(/\s(src|href)\s*=\s*(["'])(?!data:)[^"']*\2/gi, '');        // src/href: sólo data:
  return h;
}

function sanitizeSlide(s: unknown): Slide {
  const o = (s ?? {}) as Record<string, unknown>;
  const tipo = o.tipo === 'hook' || o.tipo === 'resumen' || o.tipo === 'cta' ? o.tipo : 'contenido';
  const layout = typeof o.layout === 'string' && LAYOUTS.has(o.layout) ? o.layout as Slide['layout'] : 'centrado';
  return {
    tipo: tipo as Slide['tipo'],
    layout,
    kicker: typeof o.kicker === 'string' ? o.kicker : '',
    titulo: typeof o.titulo === 'string' ? o.titulo : '',
    cuerpo: typeof o.cuerpo === 'string' ? o.cuerpo : '',
    pie: typeof o.pie === 'string' ? o.pie : '',
    stat: typeof o.stat === 'string' ? o.stat.slice(0, 14) : '',
    html: sanitizeHtmlSlide(o.html),
  };
}

// Sólo aceptamos valores css "con pinta de color/gradiente" (hex, rgb, gradient).
function cssColor(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const s = v.trim().slice(0, 220);
  return s && /^[#a-zA-Z0-9(),.%\s\/-]+$/.test(s) ? s : fallback;
}

function sanitizeDiseno(raw: unknown): DisenoTema | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  return {
    composicion: o.composicion === 'centrado' ? 'centrado' : 'izquierda',
    resaltado: o.resaltado === 'marcador' ? 'marcador' : 'ninguno',
    colorResaltado: cssColor(o.colorResaltado, '#fde047'),
    subrayadoMano: !!o.subrayadoMano,
    colorSubrayado: cssColor(o.colorSubrayado, '#ef4444'),
    mostrarKicker: o.mostrarKicker !== false,
    mostrarProgreso: o.mostrarProgreso !== false,
    mostrarPie: o.mostrarPie !== false,
  };
}

function sanitizeTema(raw: unknown): TemaExtraido | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const dark = !!o.dark;
  return {
    nombre: typeof o.nombre === 'string' ? o.nombre.slice(0, 40) : 'Clonado',
    bg: cssColor(o.bg, dark ? '#0a0a0a' : '#ffffff'),
    fg: cssColor(o.fg, dark ? '#ffffff' : '#111111'),
    muted: cssColor(o.muted, dark ? '#9a9a9a' : '#6b6b6b'),
    accent: cssColor(o.accent, '#8b5cf6'),
    onAccent: cssColor(o.onAccent, dark ? '#111111' : '#ffffff'),
    panel: cssColor(o.panel, dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'),
    dark,
    serif: !!o.serif,
    notas: typeof o.notas === 'string' ? o.notas.slice(0, 200) : '',
    diseno: sanitizeDiseno(o.diseno),
  };
}

function normalize(raw: unknown): Carrusel {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const slidesIn = Array.isArray(obj.slides) ? obj.slides : [];
  const slides = slidesIn.map(sanitizeSlide).filter(s => s.titulo || s.cuerpo);

  const score = (obj.score ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d = 0) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : d);

  return {
    slides,
    hooksAlternativos: Array.isArray(obj.hooksAlternativos)
      ? obj.hooksAlternativos.filter((h): h is string => typeof h === 'string').slice(0, 8)
      : [],
    caption: typeof obj.caption === 'string' ? obj.caption : '',
    hashtags: Array.isArray(obj.hashtags)
      ? obj.hashtags.filter((h): h is string => typeof h === 'string').map(h => h.replace(/^#/, '')).slice(0, 14)
      : [],
    score: {
      total: num(score.total), gancho: num(score.gancho), valor: num(score.valor),
      guardabilidad: num(score.guardabilidad), claridad: num(score.claridad),
      veredicto: typeof score.veredicto === 'string' ? score.veredicto : '',
      mejoras: Array.isArray(score.mejoras) ? score.mejoras.filter((m): m is string => typeof m === 'string') : [],
    },
    temaExtraido: sanitizeTema(obj.temaExtraido),
  };
}

// ── Capturas (visión) ────────────────────────────────────────────────────────
// La UI comprime a JPEG con presupuesto total antes de mandar; acá, límites duros.
function sanitizeImagenes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  let total = 0;
  for (const v of raw) {
    if (typeof v !== 'string' || !v.startsWith('data:image/')) continue;
    if (v.length > 2_500_000) continue;    // ~1.8MB por imagen
    total += v.length;
    if (total > 7_000_000) break;          // tope total del pedido
    out.push(v);
    if (out.length >= 8) break;
  }
  return out;
}

type ChatContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }>;

// Llama al mejor modelo disponible y devuelve el JSON parseado.
// Si un modelo no existe/no está habilitado para la cuenta, baja al siguiente.
async function pedirJSON(system: string, user: ChatContent): Promise<Record<string, unknown>> {
  const base = process.env.CARRUSELES_MODEL
    ? [process.env.CARRUSELES_MODEL, ...MODEL_CHAIN.filter(m => m !== process.env.CARRUSELES_MODEL)]
    : MODEL_CHAIN;
  const lista = _modeloOk ? [_modeloOk, ...base.filter(m => m !== _modeloOk)] : base;

  let lastErr: unknown = null;
  for (const model of lista) {
    try {
      const completion = await getOpenAI().chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        // Los gpt-5.x son razonadores: reasoning_effort y sin temperature.
        ...(model.startsWith('gpt-5')
          ? { reasoning_effort: 'low' as const }
          : { temperature: 0.8 }),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user as string | OpenAI.Chat.Completions.ChatCompletionContentPart[] },
        ],
      });
      _modeloOk = model;
      const text = completion.choices[0]?.message?.content || '{}';
      return JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : '';
      // Modelo inexistente / sin acceso / parámetro no soportado → siguiente de la lista.
      if (/model|not found|does not exist|unsupported|access/i.test(msg)) {
        console.error(`[carruseles] modelo ${model} no disponible:`, msg.slice(0, 160));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('ningún modelo disponible');
}

// ── Link de Instagram (modo 'link') ─────────────────────────────────────────
// Lee el post con instagram-looter2 (la misma API que usa el transcriptor).
const g = (o: unknown, k: string): unknown =>
  (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined);

type InfoPost =
  | { tipo: 'video' }
  | { tipo: 'imagenes'; urls: string[]; caption: string }
  | { tipo: 'error'; error: string };

async function inspeccionarInstagram(url: string): Promise<InfoPost> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return { tipo: 'error', error: 'Falta configurar RAPIDAPI_KEY para leer posts de Instagram.' };
  try {
    const res = await fetch(`https://instagram-looter2.p.rapidapi.com/post?link=${encodeURIComponent(url)}`, {
      headers: { 'x-rapidapi-host': 'instagram-looter2.p.rapidapi.com', 'x-rapidapi-key': key },
    });
    const data: unknown = await res.json().catch(() => ({}));
    const item = Array.isArray(data) ? data[0] : data;
    if (!res.ok || !item) return { tipo: 'error', error: 'No se pudo leer el post de Instagram. ¿Es público?' };
    if (/exceeded|quota|plan|limit/i.test(String(g(item, 'message') || ''))) {
      return { tipo: 'error', error: 'Se agotó el cupo de lecturas de Instagram. Probá más tarde.' };
    }

    // Reel / video → lo transcribe el flujo de video (cliente → /api/transcribir).
    if (g(item, 'is_video') === true || typeof g(item, 'video_url') === 'string') return { tipo: 'video' };

    // Carrusel: hijos del sidecar; post simple: display_url del propio item.
    const edges = g(g(item, 'edge_sidecar_to_children'), 'edges');
    const urls: string[] = [];
    if (Array.isArray(edges)) {
      for (const e of edges) {
        const node = g(e, 'node');
        if (g(node, 'is_video') === true) continue;
        const du = g(node, 'display_url');
        if (typeof du === 'string' && du.startsWith('http')) urls.push(du);
      }
    }
    if (!urls.length) {
      const du = g(item, 'display_url');
      if (typeof du === 'string' && du.startsWith('http')) urls.push(du);
    }
    if (!urls.length) return { tipo: 'error', error: 'El post no tiene imágenes ni video legibles.' };

    const capEdges = g(g(item, 'edge_media_to_caption'), 'edges');
    const caption = String(g(g(Array.isArray(capEdges) ? capEdges[0] : undefined, 'node'), 'text') || '');
    return { tipo: 'imagenes', urls: urls.slice(0, 8), caption };
  } catch {
    return { tipo: 'error', error: 'No se pudo leer el post de Instagram.' };
  }
}

// Baja las imágenes del post y las convierte a dataURL (el CDN de Instagram no
// siempre deja que OpenAI las lea directo; en base64 nunca falla).
async function descargarImagenes(urls: string[]): Promise<string[]> {
  const bajadas = await Promise.all(urls.map(async (u) => {
    try {
      const r = await fetch(u);
      if (!r.ok) return null;
      const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
      if (!mime.startsWith('image/')) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 1_800_000) return null; // demasiado pesada, la salteamos
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch { return null; }
  }));
  return bajadas.filter((x): x is string => !!x);
}

// Genera una imagen de fondo con gpt-image (misma key de OpenAI). JPEG comprimido
// para que la respuesta viaje liviana y el export a PNG no arrastre peso de más.
async function generarImagen(prompt: string): Promise<string> {
  const base = process.env.CARRUSELES_IMG_MODEL
    ? [process.env.CARRUSELES_IMG_MODEL, ...IMG_CHAIN.filter(m => m !== process.env.CARRUSELES_IMG_MODEL)]
    : IMG_CHAIN;
  const lista = _imgModeloOk ? [_imgModeloOk, ...base.filter(m => m !== _imgModeloOk)] : base;

  let lastErr: unknown = null;
  for (const model of lista) {
    try {
      const res = await getOpenAI().images.generate({
        model,
        prompt,
        size: '1024x1536',        // vertical, casi 4:5 — la slide lo muestra en cover
        quality: 'medium',
        output_format: 'jpeg',
        output_compression: 80,
      });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error('la respuesta vino sin imagen');
      _imgModeloOk = model;
      return `data:image/jpeg;base64,${b64}`;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : '';
      if (/model|not found|does not exist|unsupported|access|invalid value/i.test(msg)) {
        console.error(`[carruseles] modelo de imagen ${model} no disponible:`, msg.slice(0, 160));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('ningún modelo de imagen disponible');
}

// Genera el carrusel completo; si la respuesta viene rota/incompleta, reintenta
// UNA vez con una corrección explícita (evita el "no devolvió un carrusel usable").
async function generarCarrusel(system: string, user: ChatContent): Promise<Carrusel> {
  try {
    const out = await pedirJSON(system, user);
    const c = normalize(out);
    if (c.slides.length >= 2) return c;
    console.error('[carruseles] intento 1 sin slides usables:', JSON.stringify(out).slice(0, 400));
  } catch (err) {
    console.error('[carruseles] intento 1 falló:', err instanceof Error ? err.message.slice(0, 200) : String(err));
  }
  const out2 = await pedirJSON(
    system + '\n\nATENCIÓN: tu respuesta anterior NO cumplió el formato (faltaron slides o el JSON vino incompleto). Devolvé ahora el JSON COMPLETO con la forma EXACTA pedida, con TODAS las slides.',
    user,
  );
  return normalize(out2);
}

export async function POST(req: NextRequest) {
  // Solo admin: Carruseles está restringido al administrador.
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Esta herramienta es solo para administradores.' }, { status: 403 });

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Falta configurar la IA (OPENAI_API_KEY).' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }); }

  const accion = typeof body.accion === 'string' ? body.accion : 'generar';

  try {
    // ── 'slide': regenerar UNA slide con instrucción (editor fino) ───────────
    if (accion === 'slide') {
      const slide = sanitizeSlide(body.slide);
      const instruccion = String(body.instruccion || '').trim().slice(0, 500);
      if (!instruccion) return Response.json({ error: 'Escribí qué querés cambiar de la slide.' }, { status: 400 });
      const ctx = (body.contexto ?? {}) as Record<string, unknown>;
      const titulos = Array.isArray(ctx.titulos) ? ctx.titulos.filter((t): t is string => typeof t === 'string').slice(0, 12) : [];
      const indice = typeof body.indice === 'number' ? body.indice : 0;
      const total = typeof body.total === 'number' ? body.total : titulos.length || 7;

      const user = `
CARRUSEL (contexto): idea "${String(ctx.idea || '').slice(0, 300)}", nicho "${String(ctx.nicho || 'general').slice(0, 100)}", tono "${String(ctx.tono || 'cercano').slice(0, 100)}".
TÍTULOS DE TODAS LAS SLIDES: ${titulos.map((t, i) => `${i + 1}. ${t}`).join(' | ')}

SLIDE A REESCRIBIR (es la ${indice + 1} de ${total}):
${JSON.stringify(slide)}

INSTRUCCIÓN DEL USUARIO: ${instruccion}

Devolvé sólo el JSON con la slide reescrita.`.trim();

      const out = await pedirJSON(SYSTEM_SLIDE, user);
      const nueva = sanitizeSlide(out.slide);
      if (!nueva.titulo && !nueva.cuerpo) {
        return Response.json({ error: 'La IA no devolvió una slide usable. Probá otra instrucción.' }, { status: 502 });
      }
      // El tipo de slide no cambia desde acá (el rol lo define su posición).
      nueva.tipo = slide.tipo;
      return Response.json({ slide: nueva });
    }

    // ── 'link': post de Instagram → carrusel de imágenes se adapta directo ───
    if (accion === 'link') {
      const url = String(body.url || '').trim().slice(0, 500);
      if (!/^https?:\/\/(www\.)?instagram\.com\//i.test(url)) {
        // No es Instagram → es un video: que el cliente siga por /api/transcribir.
        return Response.json({ transcribir: true });
      }
      const info = await inspeccionarInstagram(url);
      if (info.tipo === 'error') return Response.json({ error: info.error }, { status: 502 });
      if (info.tipo === 'video') return Response.json({ transcribir: true });

      const imagenes = await descargarImagenes(info.urls);
      if (!imagenes.length) {
        return Response.json({ error: 'No pude bajar las imágenes del post. Sacale capturas y usá el modo Adaptar.' }, { status: 502 });
      }

      const inp: CarruselInput = {
        modo: 'adaptar',
        idea: String(body.idea || ''),
        nicho: typeof body.nicho === 'string' ? body.nicho : undefined,
        tono: typeof body.tono === 'string' ? body.tono : undefined,
        cta: typeof body.cta === 'string' ? body.cta : undefined,
        numSlides: typeof body.numSlides === 'number' ? body.numSlides : undefined,
      };
      const system = SYSTEM_PROMPT + EXTRA_ADAPTAR;
      const user: ChatContent = [
        {
          type: 'text',
          text: buildUserMessage(inp, info.caption ? `(Caption del post original)\n${info.caption}` : undefined)
            + `\n\nA continuación, las ${imagenes.length} slides del carrusel de referencia (en orden).`,
        },
        ...imagenes.map((u) => ({ type: 'image_url' as const, image_url: { url: u, detail: 'high' as const } })),
      ];
      const carrusel = await generarCarrusel(system, user);
      if (carrusel.slides.length < 2) {
        return Response.json({ error: 'La IA no devolvió un carrusel usable (ya reintenté). Probá de nuevo.' }, { status: 502 });
      }
      return Response.json(carrusel);
    }

    // ── 'vestir': réplica fiel — genera el HTML de cada slide EN PARALELO ────
    // (separado de la generación para no chocar con el límite de 60s de Vercel)
    if (accion === 'vestir') {
      let refs = sanitizeImagenes(body.imagenes);
      if (!refs.length) {
        const url = String(body.url || '').trim();
        if (/^https?:\/\/(www\.)?instagram\.com\//i.test(url)) {
          const info = await inspeccionarInstagram(url);
          if (info.tipo === 'imagenes') refs = await descargarImagenes(info.urls);
        }
      }
      if (!refs.length) return Response.json({ error: 'Faltan las capturas de referencia para clonar el diseño.' }, { status: 400 });

      const slidesIn = Array.isArray(body.slides) ? body.slides.map(sanitizeSlide).slice(0, 10) : [];
      if (!slidesIn.length) return Response.json({ error: 'Faltan las slides a vestir.' }, { status: 400 });
      const temaRef = sanitizeTema(body.temaExtraido);

      // 3 capturas alcanzan para el lenguaje visual (primera/medio/última).
      const refsMini = [refs[0], refs[Math.floor(refs.length / 2)], refs[refs.length - 1]]
        .filter((v, i, a) => a.indexOf(v) === i);

      const htmls = await Promise.all(slidesIn.map(async (s, i) => {
        try {
          const user: ChatContent = [
            {
              type: 'text',
              text: `ESTILO EXTRAÍDO DE LA REFERENCIA:\n${JSON.stringify(temaRef ?? {})}\n\nSLIDE ${i + 1} de ${slidesIn.length} (tipo: ${s.tipo}):\n${JSON.stringify({ ...s, html: undefined, fondo: undefined })}\n\nCapturas de la referencia a continuación. Devolvé sólo el JSON { "html": ... }.`,
            },
            ...refsMini.map(u => ({ type: 'image_url' as const, image_url: { url: u, detail: 'low' as const } })),
          ];
          const out = await pedirJSON(SYSTEM_VESTIR, user);
          return sanitizeHtmlSlide(out.html);
        } catch { return ''; }
      }));

      if (!htmls.some(Boolean)) {
        return Response.json({ error: 'No se pudo clonar el diseño esta vez. El carrusel queda con el render clásico.' }, { status: 502 });
      }
      return Response.json({ htmls });
    }

    // ── 'fondo': imagen de fondo para una slide (gpt-image) ──────────────────
    if (accion === 'fondo') {
      const prompt = String(body.prompt || '').trim().slice(0, 900);
      if (!prompt) return Response.json({ error: 'Falta describir el fondo.' }, { status: 400 });
      const image = await generarImagen(prompt);
      return Response.json({ image });
    }

    // ── 'plan': lote / calendario de contenido ───────────────────────────────
    if (accion === 'plan') {
      const tema = String(body.tema || body.idea || '').trim().slice(0, 400);
      if (!tema) return Response.json({ error: 'Escribí el tema o nicho del plan.' }, { status: 400 });
      const cantidad = Math.min(Math.max(Number(body.cantidad) || 7, 3), 10);
      const nicho = String(body.nicho || '').trim().slice(0, 100);

      const user = `
TEMA / NICHO DEL PLAN: ${tema}
${nicho ? `CUENTA / NICHO: ${nicho}` : ''}
CANTIDAD DE CARRUSELES: exactamente ${cantidad}.

Armá el plan. Devolvé sólo el JSON.`.trim();

      const out = await pedirJSON(SYSTEM_PLAN, user);
      const planRaw = Array.isArray(out.plan) ? out.plan : [];
      const plan: BriefLote[] = planRaw.map((b) => {
        const o = (b ?? {}) as Record<string, unknown>;
        return {
          idea: typeof o.idea === 'string' ? o.idea.slice(0, 400) : '',
          angulo: typeof o.angulo === 'string' ? o.angulo.slice(0, 60) : '',
          hook: typeof o.hook === 'string' ? o.hook.slice(0, 120) : '',
        };
      }).filter(b => b.idea);
      if (!plan.length) return Response.json({ error: 'La IA no devolvió un plan usable. Probá reformular el tema.' }, { status: 502 });
      return Response.json({ plan });
    }

    // ── default: generar carrusel completo (idea / adaptar / diseño) ─────────
    const inp: CarruselInput = {
      modo: body.modo === 'adaptar' || body.modo === 'diseno' ? body.modo : 'idea',
      idea: String(body.idea || ''),
      nicho: typeof body.nicho === 'string' ? body.nicho : undefined,
      tono: typeof body.tono === 'string' ? body.tono : undefined,
      audiencia: typeof body.audiencia === 'string' ? body.audiencia : undefined,
      cta: typeof body.cta === 'string' ? body.cta : undefined,
      numSlides: typeof body.numSlides === 'number' ? body.numSlides : undefined,
    };
    const imagenes = sanitizeImagenes(body.imagenes);
    const transcript = typeof body.transcript === 'string' ? body.transcript.slice(0, 12000) : undefined;
    const conCapturas = inp.modo === 'adaptar' || inp.modo === 'diseno';

    if (!conCapturas && !inp.idea.trim() && !transcript?.trim()) {
      return Response.json({ error: 'Escribí la idea o el tema del carrusel.' }, { status: 400 });
    }
    if (conCapturas && !imagenes.length) {
      return Response.json({ error: 'Subí al menos una captura del carrusel de referencia.' }, { status: 400 });
    }

    const system = SYSTEM_PROMPT + (inp.modo === 'adaptar' ? EXTRA_ADAPTAR : inp.modo === 'diseno' ? EXTRA_DISENO : '');
    const user: ChatContent = conCapturas
      ? [
          { type: 'text', text: buildUserMessage(inp, transcript) + `\n\nA continuación, las ${imagenes.length} capturas (en orden).` },
          ...imagenes.map((url) => ({ type: 'image_url' as const, image_url: { url, detail: 'high' as const } })),
        ]
      : buildUserMessage(inp, transcript);

    const carrusel = await generarCarrusel(system, user);

    if (carrusel.slides.length < 2) {
      return Response.json({ error: 'La IA no devolvió un carrusel usable (ya reintenté). Probá con menos capturas o reformulá la idea.' }, { status: 502 });
    }
    // temaExtraido sólo tiene sentido en los modos con capturas.
    if (!conCapturas) delete carrusel.temaExtraido;
    return Response.json(carrusel);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    // No filtramos detalles técnicos al usuario.
    console.error('[carruseles] error:', msg);
    return Response.json({ error: 'No se pudo generar. Intentá de nuevo en un momento.' }, { status: 500 });
  }
}
