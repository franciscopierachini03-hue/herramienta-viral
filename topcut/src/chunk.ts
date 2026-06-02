import type { Word, Chunk } from './types';

// Agrupa palabras en "chunks" (lo que se muestra junto en pantalla).
// Reglas: máximo `maxWords` por chunk, y corta antes si hay una pausa larga
// (> `maxGap` segundos) — así los subtítulos respetan el ritmo del habla.
export function chunkWords(words: Word[], maxWords = 4, maxGap = 0.6): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Word[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];
    const gap = prev ? w.start - prev.end : 0;

    // Cortar si: el chunk llenó el máximo, o hubo una pausa larga.
    if (current.length >= maxWords || (current.length > 0 && gap > maxGap)) {
      chunks.push(toChunk(current));
      current = [];
    }
    current.push(w);
  }
  if (current.length) chunks.push(toChunk(current));
  return chunks;
}

function toChunk(words: Word[]): Chunk {
  return {
    words,
    start: words[0].start,
    end: words[words.length - 1].end,
  };
}
