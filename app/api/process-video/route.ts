import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 120;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 5 * 60 * 1000,
  maxRetries: 0,
});

// ── Muletillas / fillers ───────────────────────────────────────────────────────
const FILLERS = [
  'um','uh','eh','este','bueno','mmm','ah','hmm',
  'mm','aa','eeh','em','aaa','eee','aja','ajá','osea',
  'o sea','entonces','básicamente','literalmente','digamos',
  'como que','tipo que','igual','o sea que',
];

type WordTS    = { word: string; start: number; end: number };
type SegmentTS = { text: string; start: number; end: number };

type RawCut = {
  id: string;
  type: 'filler' | 'pause' | 'repetition' | 'mistake';
  start: number;
  end: number;
  word?: string;
  duration?: number;
  phrase?: string;
  reason?: string;
};

// ── 1. Filler detection ────────────────────────────────────────────────────────
function detectFillers(words: WordTS[]): RawCut[] {
  return words
    .filter(w => {
      const clean = w.word.toLowerCase().replace(/[^a-záéíóúüñ\s]/gi, '').trim();
      return FILLERS.some(f =>
        clean === f ||
        (clean.length >= 2 && f.startsWith(clean) && clean.length <= f.length)
      );
    })
    .map((w, i) => ({
      id:    `f${i}`,
      type:  'filler' as const,
      start: Math.max(0, w.start - 0.05),
      end:   w.end + 0.1,
      word:  w.word.trim(),
    }));
}

// ── 2. Pause detection (gap > 1.0s between segments) ──────────────────────────
function detectPauses(segments: SegmentTS[]): RawCut[] {
  const cuts: RawCut[] = [];
  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    if (gap > 1.0) {
      cuts.push({
        id:       `p${i}`,
        type:     'pause',
        start:    segments[i - 1].end + 0.1,
        end:      segments[i].start   - 0.1,
        duration: parseFloat(gap.toFixed(2)),
      });
    }
  }
  return cuts;
}

// ── 3. Repetition detection (false starts / phrase repeats) ───────────────────
// When someone starts a phrase, stumbles, and repeats it
function detectRepetitions(words: WordTS[]): RawCut[] {
  const cuts: RawCut[] = [];
  const used = new Set<number>();

  for (let i = 0; i < words.length - 2; i++) {
    if (used.has(i)) continue;

    for (let len = 2; len <= 6; len++) {
      if (i + len * 2 > words.length) break;

      const normalize = (s: string) =>
        s.toLowerCase().replace(/[^a-záéíóúüñ]/gi, '').trim();

      const seg1 = words.slice(i, i + len).map(w => normalize(w.word)).join(' ');
      const seg2 = words.slice(i + len, i + len * 2).map(w => normalize(w.word)).join(' ');

      if (
        seg1 === seg2 &&
        seg1.replace(/\s/g, '').length >= 4 && // avoid tiny matches like "a a"
        words[i + len].start - words[i].start < 20 // within 20 seconds
      ) {
        const cutStart = Math.max(0, words[i].start - 0.05);
        const cutEnd   = words[i + len].start - 0.05;

        // Don't overlap with existing repetition cuts
        const overlaps = cuts.some(c => c.start < cutEnd && c.end > cutStart);
        if (!overlaps) {
          cuts.push({
            id:     `r${i}`,
            type:   'repetition',
            start:  cutStart,
            end:    cutEnd,
            phrase: seg1,
          });
          for (let k = i; k < i + len; k++) used.add(k);
        }
        break;
      }
    }
  }
  return cuts;
}

// ── 4. GPT mistake detection ───────────────────────────────────────────────────
// Sends word timestamps to GPT-4o-mini and asks it to find mistakes/corrections
async function detectMistakes(words: WordTS[], transcript: string): Promise<RawCut[]> {
  if (words.length === 0) return [];

  // Compact word timeline: "0.5:hola 1.2:bueno 1.8:quiero..."
  // Keep it short — max 300 words to stay within token budget
  const wordList = words.slice(0, 300)
    .map(w => `${w.start.toFixed(1)}:${w.word.replace(/\s/g, '_')}`)
    .join(' ');

  const prompt = `Sos un editor de video profesional EXPERTO en detectar errores de habla. Tu trabajo es encontrar exactamente dónde la persona se equivocó para cortarlo.

DETECTÁ estos casos con precisión quirúrgica:
1. FALSE START: empieza una frase, se traba y la vuelve a empezar (ej: "yo fui a... yo fui al super")
2. AUTOCORRECCIÓN: dice algo y lo corrige al instante (ej: "ayer... digo hoy")
3. TARTAMUDEO: repite sílabas o palabras (ej: "yo yo yo", "el el el")
4. FRASE ROTA: empieza algo, deja de hablar y retoma distinto (gap + cambio de idea)
5. PALABRA EQUIVOCADA + CORRECCIÓN: "voy al banco... a la farmacia"

REGLAS CRÍTICAS:
- El timestamp de START debe ser JUSTO antes del error (0.1s antes)
- El timestamp de END debe ser JUSTO donde termina el error y empieza la parte limpia
- NO incluyas la parte correcta — solo lo que hay que eliminar
- NO marques pausas normales entre oraciones
- Sé conservador: solo marcá lo que estás 100% seguro que es un error
- Si una frase se repite exactamente, marcá la PRIMERA instancia para cortar

Respondé SOLO con JSON válido, sin markdown:
{
  "mistakes": [
    { "start": 4.2, "end": 6.8, "reason": "false start — reinicia la frase" },
    { "start": 12.1, "end": 13.5, "reason": "tartamudeo — repite 'yo yo'" }
  ]
}

Si no hay errores claros, devolvé: { "mistakes": [] }

Transcript completo: "${transcript.slice(0, 2000)}"

Timeline de palabras (tiempo:palabra): ${wordList}`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 600,
      temperature: 0.0,
    });

    const parsed = JSON.parse(res.choices[0].message.content || '{}');
    const raw = (parsed.mistakes || []) as { start: number; end: number; reason?: string }[];

    const videoDur = words[words.length - 1]?.end || 999;

    return raw
      .filter(m =>
        typeof m.start === 'number' &&
        typeof m.end   === 'number' &&
        m.end > m.start &&
        m.end - m.start >= 0.3 &&  // at least 300ms
        m.end - m.start <= 15 &&   // no more than 15s (avoid hallucinated mega-cuts)
        m.start >= 0 &&
        m.end <= videoDur + 1
      )
      .map((m, i) => ({
        id:     `m${i}`,
        type:   'mistake' as const,
        start:  Math.max(0, m.start),
        end:    m.end,
        reason: m.reason || 'error detectado',
      }));
  } catch {
    return [];
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY)
    return Response.json({ error: 'Falta OPENAI_API_KEY' }, { status: 422 });

  let file: File;
  try {
    const fd = await req.formData();
    file = fd.get('video') as File;
    if (!file?.name) throw new Error('no file');
  } catch {
    return Response.json({ error: 'No se recibió ningún archivo de video' }, { status: 400 });
  }

  if (file.size > 24 * 1024 * 1024)
    return Response.json(
      { error: 'El audio extraído es demasiado grande (>24MB). Cortá el video en partes de máximo 15 min.' },
      { status: 413 }
    );

  // ── Groq Whisper Large V3 (18x más barato, 250x más rápido) ──────────────────
  let transcription: Record<string, unknown>;
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('Falta GROQ_API_KEY');

    const form = new FormData();
    form.append('file', file);
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.append('timestamp_granularities[]', 'segment');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      throw new Error(err);
    }

    transcription = await groqRes.json();
  } catch (e) {
    return Response.json({ error: `Whisper: ${(e as Error).message}` }, { status: 502 });
  }

  const transcript = (transcription.text as string) || '';
  const words      = (transcription.words    as WordTS[])    || [];
  const rawSegs    = (transcription.segments as Record<string, unknown>[]) || [];
  const segments: SegmentTS[] = rawSegs.map(s => ({
    text:  (s.text as string).trim(),
    start:  s.start as number,
    end:    s.end   as number,
  }));

  // ── Run all detections in parallel ───────────────────────────────────────────
  const [fillerCuts, pauseCuts, repetitionCuts, mistakeCuts] = await Promise.all([
    Promise.resolve(detectFillers(words)),
    Promise.resolve(detectPauses(segments)),
    Promise.resolve(detectRepetitions(words)),
    detectMistakes(words, transcript),
  ]);

  // Merge and deduplicate — remove cuts that overlap with a mistake/repetition cut
  const allCuts: RawCut[] = [...fillerCuts, ...pauseCuts, ...repetitionCuts, ...mistakeCuts];

  // Sort and remove overlaps (keep the one that starts later = more precise)
  allCuts.sort((a, b) => a.start - b.start);
  const deduped: RawCut[] = [];
  for (const cut of allCuts) {
    const prev = deduped[deduped.length - 1];
    if (prev && cut.start < prev.end) {
      // Overlap: keep whichever has higher priority (mistake > repetition > pause > filler)
      const priority = { mistake: 4, repetition: 3, pause: 2, filler: 1 };
      if (priority[cut.type] > priority[prev.type]) {
        deduped[deduped.length - 1] = cut;
      }
      // else keep prev
    } else {
      deduped.push(cut);
    }
  }

  // ── Extract opening hook ──────────────────────────────────────────────────────
  const openingWords = words.filter(w => w.start <= 6).map(w => w.word).join(' ').trim();
  const openingText  = openingWords || segments.slice(0, 2).map(s => s.text).join(' ').trim();

  // ── GPT: hook + broll + music (parallel with mistake detection above) ─────────
  const hookNatural  = openingText;
  let hookEnhanced = '';
  let brollQueries: string[] = [];
  let musicMood    = 'upbeat';
  let trimStartSec = 0;
  let trimEndSec   = 0;

  try {
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Sos un experto en contenido viral para redes sociales. Analizá este transcript y respondé SOLO con JSON válido sin markdown:

{
  "hook_enhanced": "versión mejorada y más impactante de lo que dice al inicio (MAX 8 palabras, en mayúsculas, tipo TikTok). Basate en el sentido de las primeras palabras, no las inventes de cero.",
  "broll_queries": ["query EN para slot 1", "query EN para slot 2", "query EN para slot 3", "query EN para slot 4", "query EN para slot 5", "query EN para slot 6"],
  "music_mood": "uno exacto de: motivacional, épico, chill, upbeat, corporate, cinematic",
  "trim_start_sec": 0,
  "trim_end_sec": 0
}

REGLAS para broll_queries:
- Generá exactamente 6 queries en inglés, una por cada slot de B-Roll que aparecerá en el video
- Cada query debe ser DIFERENTE y representar visualmente lo que se dice en esa parte del video
- Usa términos concretos y visuales (ej: "person working laptop coffee shop", "city buildings sunrise", "gym workout motivation")
- Evitá términos abstractos — pensá en qué imagen refuerza cada momento del discurso
- El orden importa: las queries van de inicio a fin del video

Primeras palabras del video (hook): "${openingText}"

Transcript completo: "${transcript.slice(0, 2000)}"`,
      }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const ai     = JSON.parse(aiRes.choices[0].message.content || '{}');
    hookEnhanced = (ai.hook_enhanced   as string)   || '';
    brollQueries = (ai.broll_queries   as string[]) || [];
    musicMood    = (ai.music_mood      as string)   || 'upbeat';
    trimStartSec = Number(ai.trim_start_sec)        || 0;
    trimEndSec   = Number(ai.trim_end_sec)          || 0;
  } catch { /* continue without AI */ }

  // ── Pexels B-Roll — un clip representativo por cada query ────────────────────
  let brollResults: unknown[] = [];
  const pexelsKey = process.env.PEXELS_API_KEY;

  if (pexelsKey && brollQueries.length > 0) {
    try {
      const settled = await Promise.allSettled(
        brollQueries.slice(0, 6).map(q =>
          fetch(
            `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=3&orientation=portrait`,
            { headers: { Authorization: pexelsKey } }
          ).then(r => r.json()).then((d: { videos?: unknown[] }) => d.videos || [])
        )
      );

      // Tomamos el MEJOR clip de cada query (mantiene el orden de los slots)
      brollResults = settled
        .map((result, idx) => {
          if (result.status !== 'fulfilled') return null;
          const videos = result.value as Record<string, unknown>[];
          const v = videos[0]; // primer resultado = más relevante
          if (!v) return null;
          const files = (v.video_files as { quality: string; width: number; link: string }[]) || [];
          const f = files
            .filter(f => f.quality === 'hd' || f.quality === 'sd')
            .sort((a, b) => b.width - a.width)[0];
          if (!f?.link) return null;
          return {
            id: v.id,
            thumbnail: v.image,
            url: f.link,
            duration: v.duration,
            query: brollQueries[idx], // guardamos la query para referencia visual
          };
        })
        .filter(Boolean);
    } catch { /* Pexels failed */ }
  }

  const videoDuration = segments[segments.length - 1]?.end || 0;
  const finalTrimEnd  =
    trimEndSec > 0 && videoDuration > 0
      ? videoDuration - trimEndSec
      : videoDuration;

  return Response.json({
    transcript,
    segments,
    words,          // ← word-level timestamps for karaoke mode
    cuts: deduped,
    hookNatural:  hookNatural.toUpperCase(),
    hookEnhanced: hookEnhanced.toUpperCase(),
    brollResults,
    musicMood,
    trimStartSec,
    trimEndSec: finalTrimEnd,
    videoDuration,
  });
}
