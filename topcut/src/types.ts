// Tipos compartidos de TOPCUT.

// Una palabra con su tiempo (en segundos) — sale de Whisper word-level.
export type Word = {
  text: string;
  start: number; // segundos
  end: number;   // segundos
};

// Props de la composición de subtítulos.
export type CaptionsProps = {
  // URL o ruta del video de fondo. null = fondo degradado (para previsualizar sin video).
  videoSrc: string | null;
  words: Word[];
  // Headline fijo arriba (opcional). Vacío = sin headline.
  headline: string;
  // Estilo de subtítulo.
  style: 'elegante' | 'impacto' | 'glass' | 'pop' | 'highlight' | 'karaoke';
  // Color de acento (palabra activa / headline).
  accent: string;
  // B-roll: clips de stock que se muestran encima del video base en su rango
  // de tiempo (el audio del video base sigue sonando; el b-roll va muteado).
  broll?: BRoll[];
  // Beat de intro animado (tarjeta de título al principio).
  intro?: Intro;
};

export type BRoll = {
  start: number; // segundos
  end: number;   // segundos
  src: string;   // URL del clip (Pexels) o ruta local
  query?: string;
};

// Beat de intro: tarjeta de título animada al principio del video.
export type Intro = {
  lines: string[];        // 1-3 líneas de texto
  durationSec: number;    // cuánto dura en pantalla (ej: 2.8)
  accentLine?: number;    // índice de la línea que va con color de acento
};

// Un "chunk" = grupo de palabras que se muestran juntas en pantalla.
export type Chunk = {
  words: Word[];
  start: number;
  end: number;
};
