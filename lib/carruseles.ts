// Carruseles — tipos compartidos (API ↔ UI) y temas visuales (plantillas).
//
// Un carrusel es un solo modelo de datos: { slides[], caption, hashtags, score }.
// Los 4 modos de entrada (idea / adaptar ajeno / mi diseño / lote) terminan
// llenando este mismo modelo — por eso todos comparten editor, temas y export.
//
// El render a PNG ocurre en el navegador (html-to-image): lo que ves en el preview
// es exactamente lo que se descarga. Cada slide es 1080×1350 (Instagram 4:5).

export type SlideTipo = 'hook' | 'contenido' | 'resumen' | 'cta';

// Cómo se dibuja la slide. La IA elige uno según el contenido y se puede
// cambiar a mano desde el editor. El resumen siempre se dibuja como lista.
export type SlideLayout = 'centrado' | 'lista' | 'stat' | 'cita';

export type Slide = {
  tipo: SlideTipo;
  layout?: SlideLayout; // default: centrado
  kicker?: string;   // etiqueta corta arriba (ej. "GUÍA", "PASO 1", "GUARDÁ ESTO")
  titulo: string;    // el texto protagonista de la slide
  cuerpo?: string;   // apoyo opcional; en "resumen"/"lista" cada línea (\n) es un punto
  pie?: string;      // footer opcional (ej. "desliza →")
  stat?: string;     // layout 'stat': la cifra protagonista (ej. "87%", "x3", "0→100K")
  fondo?: string;    // dataURL de imagen de fondo (subida o generada) — opcional
};

export type ScoreViral = {
  total: number;          // 0-100, índice de potencial viral
  gancho: number;         // 0-100, fuerza del slide 1 para frenar el scroll
  valor: number;          // 0-100, valor entregado
  guardabilidad: number;  // 0-100, ¿da ganas de guardarlo?
  claridad: number;       // 0-100, ¿se entiende de un vistazo?
  veredicto: string;      // una frase honesta
  mejoras: string[];      // 2-4 mejoras accionables
};

// Tema visual extraído por visión desde capturas (modos adaptar / mi diseño).
export type TemaExtraido = {
  nombre: string;
  bg: string;        // color css o gradiente
  fg: string;
  muted: string;
  accent: string;
  onAccent: string;
  panel: string;
  dark: boolean;
  serif: boolean;    // true si los títulos de la referencia se ven serif/editoriales
  notas?: string;    // descripción corta del estilo detectado
};

export type Carrusel = {
  slides: Slide[];
  hooksAlternativos: string[]; // 6 portadas alternativas para el slide 1 (A/B)
  caption: string;             // pie de foto listo para pegar
  hashtags: string[];          // 8-12 hashtags del nicho
  score: ScoreViral;
  temaExtraido?: TemaExtraido; // sólo en modos con capturas (adaptar / diseño)
};

export type ModoCarrusel = 'idea' | 'adaptar' | 'diseno';

// Lo que la UI manda al endpoint para generar.
export type CarruselInput = {
  modo?: ModoCarrusel; // default 'idea'
  idea: string;        // la idea (modo idea) o a qué nicho/tema adaptar (adaptar/diseño)
  nicho?: string;
  tono?: string;
  audiencia?: string;
  cta?: string;
  numSlides?: number;  // total de slides incluyendo portada y CTA (default 7)
  imagenes?: string[]; // dataURLs JPEG comprimidas (adaptar/diseño), máx 8
};

// Un ítem del plan de contenido (modo lote): listo para generar con un click.
export type BriefLote = {
  idea: string;   // la idea completa, lista para mandarla al generador
  angulo: string; // el ángulo en 2-4 palabras (ej. "error a evitar")
  hook: string;   // portada propuesta
};

export const CARRUSEL_W = 1080;
export const CARRUSEL_H = 1350; // 4:5

// ── Temas visuales (plantillas) ────────────────────────────────────────────
// Cada tema define la paleta y tipografía. El brand kit del usuario (acento,
// @handle, logo) se superpone encima en runtime.
export type Tema = {
  key: string;
  name: string;
  bg: string;        // background (color o gradiente css)
  fg: string;        // color del texto principal
  muted: string;     // color del texto secundario
  accent: string;    // acento por defecto (el brand kit puede overridear)
  onAccent: string;  // color del texto encima del acento
  panel: string;     // fondo de "chips"/kicker
  display: string;   // font-family de títulos
  body: string;      // font-family de cuerpo
  dark: boolean;     // true si el fondo es oscuro (define color de la barra de progreso)
};

const SANS = 'var(--font-outfit, system-ui, -apple-system, sans-serif)';
const DISPLAY = 'var(--font-bricolage, var(--font-outfit, system-ui, sans-serif))';
const SERIF = 'Georgia, "Times New Roman", serif';

export const TEMAS: Tema[] = [
  {
    key: 'noche', name: 'Noche', dark: true,
    bg: 'radial-gradient(ellipse 100% 60% at 30% 0%, #1a1033 0%, transparent 60%), #0b0b14',
    fg: '#f4f2ff', muted: '#a39fc4', accent: '#8b5cf6', onAccent: '#ffffff',
    panel: 'rgba(139,92,246,0.14)', display: DISPLAY, body: SANS,
  },
  {
    key: 'titan', name: 'Titán', dark: true,
    bg: '#0a0a0a',
    fg: '#ffffff', muted: '#9a9a9a', accent: '#d9f99d', onAccent: '#0a0a0a',
    panel: 'rgba(217,249,157,0.16)', display: DISPLAY, body: SANS,
  },
  {
    key: 'crema', name: 'Crema', dark: false,
    bg: '#f3ede1',
    fg: '#1c1a17', muted: '#6f685c', accent: '#e2552b', onAccent: '#ffffff',
    panel: 'rgba(28,26,23,0.06)', display: SERIF, body: SANS,
  },
  {
    key: 'sunset', name: 'Sunset', dark: true,
    bg: 'linear-gradient(150deg, #f23b6b 0%, #f0762f 55%, #f5a623 100%)',
    fg: '#ffffff', muted: 'rgba(255,255,255,0.82)', accent: '#1c1a17', onAccent: '#ffffff',
    panel: 'rgba(255,255,255,0.18)', display: DISPLAY, body: SANS,
  },
  {
    key: 'mono', name: 'Mono', dark: false,
    bg: '#ffffff',
    fg: '#0a0a0a', muted: '#7a7a7a', accent: '#0a0a0a', onAccent: '#ffffff',
    panel: 'rgba(10,10,10,0.05)', display: SERIF, body: SANS,
  },
  {
    key: 'oceano', name: 'Océano', dark: true,
    bg: 'linear-gradient(160deg, #0b2b3a 0%, #0a4f63 100%)',
    fg: '#eafcff', muted: '#9fd2dd', accent: '#34e0c4', onAccent: '#06222b',
    panel: 'rgba(52,224,196,0.15)', display: DISPLAY, body: SANS,
  },
  {
    key: 'editorial', name: 'Editorial', dark: false,
    bg: '#faf7f0',
    fg: '#161412', muted: '#6e685e', accent: '#d92b2b', onAccent: '#ffffff',
    panel: 'rgba(217,43,43,0.08)', display: SERIF, body: SANS,
  },
  {
    key: 'neon', name: 'Neón', dark: true,
    bg: 'radial-gradient(ellipse 90% 55% at 75% 100%, #14233a 0%, transparent 65%), #05060a',
    fg: '#eefcff', muted: '#8fa6bd', accent: '#22d3ee', onAccent: '#04141a',
    panel: 'rgba(34,211,238,0.13)', display: DISPLAY, body: SANS,
  },
  {
    key: 'bosque', name: 'Bosque', dark: true,
    bg: 'linear-gradient(165deg, #0d1f16 0%, #10291c 100%)',
    fg: '#f1f7ec', muted: '#9db8a3', accent: '#a3e635', onAccent: '#14210c',
    panel: 'rgba(163,230,53,0.13)', display: DISPLAY, body: SANS,
  },
  {
    key: 'electrico', name: 'Eléctrico', dark: true,
    bg: 'linear-gradient(155deg, #1e3a8a 0%, #172554 100%)',
    fg: '#f0f5ff', muted: '#a8b8e8', accent: '#fde047', onAccent: '#1f2408',
    panel: 'rgba(253,224,71,0.14)', display: DISPLAY, body: SANS,
  },
  {
    key: 'rosa', name: 'Rosa', dark: false,
    bg: 'linear-gradient(160deg, #fdf1f5 0%, #f7e8f2 100%)',
    fg: '#2b1b26', muted: '#8b6f80', accent: '#d6336c', onAccent: '#ffffff',
    panel: 'rgba(214,51,108,0.09)', display: DISPLAY, body: SANS,
  },
  {
    key: 'vino', name: 'Vino', dark: true,
    bg: 'linear-gradient(165deg, #3b0d1f 0%, #1f0812 100%)',
    fg: '#fbeef2', muted: '#c39aa8', accent: '#eab308', onAccent: '#241a02',
    panel: 'rgba(234,179,8,0.13)', display: SERIF, body: SANS,
  },
];

// Key reservada para el tema clonado desde capturas (no vive en TEMAS).
export const TEMA_CLONADO_KEY = 'clonado';

export function temaPorKey(key: string): Tema {
  return TEMAS.find(t => t.key === key) ?? TEMAS[0];
}

// Convierte el tema extraído por visión en un Tema usable por el render.
export function temaDesdeExtraido(t: TemaExtraido): Tema {
  return {
    key: TEMA_CLONADO_KEY,
    name: t.nombre?.trim() || 'Clonado',
    bg: t.bg, fg: t.fg, muted: t.muted, accent: t.accent, onAccent: t.onAccent,
    panel: t.panel, dark: !!t.dark,
    display: t.serif ? SERIF : DISPLAY,
    body: SANS,
  };
}

// Brand kit del usuario — se guarda en localStorage y se superpone a la plantilla.
export type BrandKit = {
  handle: string;   // @tuusuario
  accent: string;   // color de marca (override del acento del tema); '' = usar el del tema
  logo: string;     // dataURL del logo (opcional)
};

export const BRAND_KIT_VACIO: BrandKit = { handle: '', accent: '', logo: '' };
