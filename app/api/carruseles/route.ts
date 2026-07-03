import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getAccess } from '@/lib/access';
import type { Carrusel, CarruselInput, Slide, TemaExtraido, BriefLote } from '@/lib/carruseles';

// POST /api/carruseles — el cerebro de la máquina de carruseles.
//
// Acciones (campo "accion" del body):
//   (sin accion) → generar un carrusel completo. Modos: 'idea' (texto),
//                  'adaptar' (capturas de un carrusel ajeno → visión) y
//                  'diseno' (capturas de tu propio diseño → visión).
//                  En los modos con capturas devuelve además "temaExtraido"
//                  (paleta + tipografía detectadas) para clonar el estilo.
//   'slide'      → regenerar UNA slide con una instrucción (editor fino).
//   'plan'       → plan de lote: N ideas de carrusel con ángulos distintos.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lazy init: sólo creamos el cliente cuando se llama al endpoint.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const REGLAS_COPY = `REGLAS DE COPY:
- Español natural y hablado, adaptado al tono pedido. Si el tono es informal, sé informal.
- Frases cortas. Cero palabras de relleno ("en conclusión", "cabe destacar", "hoy en día").
- El TÍTULO de cada slide entra de un vistazo: máximo ~70 caracteres. El CUERPO máximo ~160 caracteres (en "resumen" y layout "lista", cada punto en su propia línea con \\n, máximo 5 puntos).
- El "kicker" es una etiqueta cortísima (1-3 palabras o un número), ej. "GUÍA", "ERROR 1", "PASO 2", "GUARDÁ ESTO", "TU TURNO".
- No inventes datos ni cifras falsas. Si das un número, que sea defendible o general.

LAYOUTS (campo "layout" de cada slide — variálos para que el carrusel respire):
- "centrado": la frase es la protagonista. El default para hooks y CTAs.
- "lista": el cuerpo son puntos (uno por línea con \\n, 3-5 puntos numerables).
- "stat": una cifra manda. Poné la cifra en "stat" (ej. "87%", "x3", "0→100K") y el título la explica.
- "cita": una frase citable/memorable, como para compartirla sola.`;

const FORMA_SLIDE = `{ "tipo": "hook" | "contenido" | "resumen" | "cta", "layout": "centrado" | "lista" | "stat" | "cita", "kicker": string, "titulo": string, "cuerpo": string, "pie": string, "stat": string }`;

const SYSTEM_PROMPT = `Eres un estratega de carruseles virales para Instagram y LinkedIn. Tu trabajo NO es escribir bonito: es escribir carruseles que la gente GUARDA, COMPARTE y termina de deslizar.

Sabes cómo funciona el algoritmo de carruseles:
- Gana el tiempo de permanencia: cada slide que se desliza es más watch-time. Por eso cada slide tiene que empujar a la siguiente.
- La métrica reina es GUARDADOS. Se guarda lo que es de referencia: listas, frameworks, pasos, errores a evitar.
- Se comparte por DM lo que da estatus al que lo manda.
- Instagram re-muestra el carrusel usando la SLIDE 2 si no hubo interacción con la portada → la slide 2 también es una portada.

ANATOMÍA OBLIGATORIA (de la primera a la última):
1. HOOK (slide 1): para el scroll en seco. Promesa concreta + brecha de curiosidad. Frase corta y potente. Nada de introducciones. Prohibido "En este carrusel te voy a contar".
2. RETENCIÓN (slide 2): confirma la promesa y obliga a seguir. Puede sembrar curiosidad ("el punto 4 casi nadie lo aplica").
3. CONTENIDO (slides intermedias): UNA sola idea por slide. Título corto y accionable + 1 o 2 frases de apoyo. Concreto, con ejemplos, sin relleno.
4. RESUMEN (penúltima): la slide GUARDABLE. Recap en puntos cortos de todo el carrusel. Es la que justifica el guardado.
5. CTA (última): una sola acción (seguir / guardar / comentar una palabra / compartir) + un motivo. Cierra con la identidad de la cuenta.

${REGLAS_COPY}

Además entregas munición extra:
- "hooksAlternativos": 6 portadas alternativas para el slide 1, cada una con un ángulo distinto (número/lista, error a evitar, contraste antes-después, pregunta que duele, promesa directa, contraintuitivo).
- "caption": pie de foto listo para pegar. Primera línea = gancho. Cierra pidiendo el guardado/compartido. 3-6 líneas.
- "hashtags": 8 a 12, mezcla de nicho amplio y específico, sin el símbolo #.
- "score": autoevaluación HONESTA y exigente (0-100 cada eje). Si el gancho es flojo, dilo. "mejoras" = 2-4 acciones concretas para subir el potencial.

Devuelve ÚNICAMENTE un objeto JSON válido con EXACTAMENTE esta forma (sin texto fuera del JSON):
{
  "slides": [ ${FORMA_SLIDE} ],
  "hooksAlternativos": [string, string, string, string, string, string],
  "caption": string,
  "hashtags": [string, ...],
  "score": { "total": number, "gancho": number, "valor": number, "guardabilidad": number, "claridad": number, "veredicto": string, "mejoras": [string, ...] }
}
La primera slide debe ser tipo "hook", la penúltima tipo "resumen" y la última tipo "cta". El resto, "contenido". El campo "cuerpo" puede ir vacío ("") en el hook si la frase se basta sola. "pie" y "stat" son opcionales (pueden ser "").`;

// Instrucciones extra para los modos con capturas. Se suman al SYSTEM_PROMPT.
const EXTRA_ADAPTAR = `

MODO ADAPTAR — el usuario te pasa capturas de un carrusel AJENO que funcionó:
1. Detectá su mecánica: tipo de gancho, estructura, ritmo, por qué retiene y por qué se guarda.
2. Escribí un carrusel NUEVO y ORIGINAL para el nicho/tema del usuario aplicando esa mecánica. PROHIBIDO copiar o parafrasear frase por frase: cambiá ejemplos, ángulo y voz. Si la referencia está en otro idioma, tu resultado va en español.
3. Devolvé ADEMÁS el campo "temaExtraido" con el estilo visual de la referencia:
   "temaExtraido": { "nombre": string (2-3 palabras que describan el estilo), "bg": string (color css o gradiente css del fondo), "fg": string hex (texto principal), "muted": string hex (texto secundario), "accent": string hex (color de acento dominante), "onAccent": string hex (texto legible ENCIMA del accent), "panel": string rgba (fondo de etiquetas, del accent al ~12% de opacidad), "dark": boolean, "serif": boolean (true si los títulos se ven serif/editoriales), "notas": string (1 frase del look) }
   Los colores tienen que salir de las capturas, no inventados.`;

const EXTRA_DISENO = `

MODO MI DISEÑO — las capturas son la PLANTILLA/diseño PROPIO del usuario:
1. Devolvé el campo "temaExtraido" (misma forma que abajo) clavando la paleta EXACTA de las capturas (hex) y si los títulos son serif:
   "temaExtraido": { "nombre": string, "bg": string, "fg": string, "muted": string, "accent": string, "onAccent": string, "panel": string, "dark": boolean, "serif": boolean, "notas": string }
2. Escribí el carrusel sobre la IDEA dada, con longitudes de texto parecidas a las que se ven en el diseño (que el texto quepa cómodo en esa plantilla).`;

const SYSTEM_SLIDE = `Sos un editor de slides de carruseles de Instagram. Te paso UNA slide, su contexto dentro del carrusel y una instrucción. Reescribí SOLO esa slide siguiendo la instrucción al pie de la letra, manteniendo su rol (hook/contenido/resumen/cta) y la coherencia con el resto.

${REGLAS_COPY}

Devolvé ÚNICAMENTE JSON válido con esta forma exacta: { "slide": ${FORMA_SLIDE} }`;

const SYSTEM_PLAN = `Sos un estratega de contenido para Instagram. Armá un plan de carruseles sobre el tema/nicho dado. Cada carrusel ataca un ÁNGULO DISTINTO (lista práctica, error a evitar, mito vs. verdad, framework con nombre, historia/caso, contraste antes-después, pregunta incómoda, checklist, contraintuitivo…). Nada de repetir el mismo ángulo dos veces.

Devolvé ÚNICAMENTE JSON válido: { "plan": [ { "idea": string (la idea completa y específica, lista para generar el carrusel con ella), "angulo": string (el ángulo en 2-4 palabras), "hook": string (portada propuesta, potente, ≤70 caracteres) } ] }`;

function buildUserMessage(inp: CarruselInput): string {
  const n = Math.min(Math.max(inp.numSlides ?? 7, 4), 10);
  const modo = inp.modo === 'adaptar' || inp.modo === 'diseno' ? inp.modo : 'idea';
  const etiquetaIdea = modo === 'adaptar'
    ? 'ADAPTAR PARA (mi nicho / tema / giro que quiero darle):'
    : 'IDEA / TEMA DEL CARRUSEL:';
  return `
${etiquetaIdea}
${inp.idea.trim() || '(usá el mismo tema de la referencia, mejorado)'}

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
    stat: typeof o.stat === 'string' ? o.stat : '',
  };
}

// Sólo aceptamos valores css "con pinta de color/gradiente" (hex, rgb, gradient).
function cssColor(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const s = v.trim().slice(0, 220);
  return s && /^[#a-zA-Z0-9(),.%\s\/-]+$/.test(s) ? s : fallback;
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
// La UI comprime a JPEG ≤1100px antes de mandar; acá sólo ponemos límites duros.
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

async function pedirJSON(system: string, user: ChatContent, temperature = 0.8): Promise<Record<string, unknown>> {
  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      // El SDK tipa content de user como string | array de partes; casteamos la unión.
      { role: 'user', content: user as never },
    ],
  });
  const text = completion.choices[0]?.message?.content || '{}';
  return JSON.parse(text) as Record<string, unknown>;
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

      const out = await pedirJSON(SYSTEM_SLIDE, user, 0.8);
      const nueva = sanitizeSlide(out.slide);
      if (!nueva.titulo && !nueva.cuerpo) {
        return Response.json({ error: 'La IA no devolvió una slide usable. Probá otra instrucción.' }, { status: 502 });
      }
      // El tipo de slide no cambia desde acá (el rol lo define su posición).
      nueva.tipo = slide.tipo;
      return Response.json({ slide: nueva });
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

      const out = await pedirJSON(SYSTEM_PLAN, user, 0.9);
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
    const conCapturas = inp.modo === 'adaptar' || inp.modo === 'diseno';

    if (!conCapturas && !inp.idea.trim()) {
      return Response.json({ error: 'Escribí la idea o el tema del carrusel.' }, { status: 400 });
    }
    if (conCapturas && !imagenes.length) {
      return Response.json({ error: 'Subí al menos una captura del carrusel de referencia.' }, { status: 400 });
    }

    const system = SYSTEM_PROMPT + (inp.modo === 'adaptar' ? EXTRA_ADAPTAR : inp.modo === 'diseno' ? EXTRA_DISENO : '');
    const user: ChatContent = conCapturas
      ? [
          { type: 'text', text: buildUserMessage(inp) + `\n\nA continuación, las ${imagenes.length} capturas (en orden).` },
          ...imagenes.map((url) => ({ type: 'image_url' as const, image_url: { url, detail: 'high' as const } })),
        ]
      : buildUserMessage(inp);

    const out = await pedirJSON(system, user, 0.8);
    const carrusel = normalize(out);

    if (carrusel.slides.length < 2) {
      return Response.json({ error: 'La IA no devolvió un carrusel usable. Probá de nuevo o reformulá la idea.' }, { status: 502 });
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
