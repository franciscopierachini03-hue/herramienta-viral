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
  style: 'pop' | 'highlight' | 'karaoke';
  // Color de acento (palabra activa / headline).
  accent: string;
};

// Un "chunk" = grupo de palabras que se muestran juntas en pantalla.
export type Chunk = {
  words: Word[];
  start: number;
  end: number;
};
