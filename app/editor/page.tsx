'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ProductNav from '../_components/ProductNav';

// ── Types ──────────────────────────────────────────────────
type CaptionStyle = 'classic' | 'yellow' | 'neon' | 'minimal';
type CaptionPos   = 'top' | 'chest' | 'center' | 'bottom';
type HookStyle    = 'viral' | 'yellow' | 'minimal';
type HookPos      = 'top' | 'center' | 'bottom';
type AppMode      = 'upload' | 'processing' | 'edit';

type CaptionSegment  = { text: string; start: number; end: number };
type WordSegment     = { word: string; start: number; end: number };
type KaraokeGroup    = { words: WordSegment[]; start: number; end: number };
type CaptionMode     = 'line' | 'karaoke';
type BRollClip      = { uid: string; id: number; thumbnail: string; url: string; duration: number; startAt: number };
type MusicTrack     = { id: number; title: string; preview: string; duration: number; user: string };
type PexelsClip     = { id: number; thumbnail: string; url: string; duration: number };
type CutType    = 'filler' | 'pause' | 'repetition' | 'mistake';
type CutSegment = {
  id: string;
  type: CutType;
  start: number;
  end: number;
  word?: string;
  duration?: number;
  phrase?: string;
  reason?: string;
  enabled: boolean;
};

const CUT_COLORS: Record<CutType, string> = {
  filler:     '#ef4444', // red
  pause:      '#f97316', // orange
  repetition: '#a855f7', // purple
  mistake:    '#3b82f6', // blue
};

const CUT_LABELS: Record<CutType, string> = {
  filler:     'Muletilla',
  pause:      'Pausa',
  repetition: 'Repetición',
  mistake:    'Error',
};

// ── Constants ──────────────────────────────────────────────
const STEPS = [
  { n: 1, icon: '✂️', label: 'Recortar',   desc: 'Cortes automáticos' },
  { n: 2, icon: '💬', label: 'Subtítulos', desc: 'Captions automáticos' },
  { n: 3, icon: '🎬', label: 'B-Roll',     desc: 'Videos de stock' },
  { n: 4, icon: '🔥', label: 'Hook',       desc: 'Texto de enganche' },
  { n: 5, icon: '🎵', label: 'Música',     desc: 'Fondo musical' },
];

const PROCESS_STAGES = [
  { label: 'Subiendo video',                    icon: '📤' },
  { label: 'Transcribiendo audio con Whisper',  icon: '🎙️' },
  { label: 'Detectando errores y muletillas',   icon: '🔍' },
  { label: 'Generando hook y análisis con IA',  icon: '🧠' },
  { label: 'Buscando B-Roll en Pexels',         icon: '🎬' },
  { label: '¡Todo listo!',                       icon: '✨' },
];

// 8-point outline helper — gives a clean, uniform stroke without gaps at corners
const outline8 = (px: number, color = '#000') =>
  [[-px,-px],[0,-px],[px,-px],[px,0],[px,px],[0,px],[-px,px],[-px,0]]
    .map(([x,y]) => `${x}px ${y}px 0 ${color}`).join(', ');

// textShadow is intentionally omitted here — applied dynamically from captionShadow state
const CAPTION_PRESETS: Record<CaptionStyle, { label: string; color: string; fontWeight: number; textTransform?: 'uppercase'; background?: string; padding?: string; borderRadius?: number; backdropFilter?: string }> = {
  classic:  { label: 'Blanco',   color: '#ffffff', fontWeight: 800, textTransform: 'uppercase' },
  yellow:   { label: 'Amarillo', color: '#FFE600', fontWeight: 800, textTransform: 'uppercase' },
  neon:     { label: 'Neón',     color: '#00ff88', fontWeight: 700 },
  minimal:  { label: 'Minimal',  color: '#ffffff', fontWeight: 500, background: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: 6, backdropFilter: 'blur(4px)' },
};

// Hook visual presets
const HOOK_PRESETS: Record<HookStyle, { label: string; color: string; shadow: string; bg: string; family: string; weight: number }> = {
  viral:   { label: 'Viral',    color: '#ffffff', shadow: '4px 4px 3px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.5)', bg: 'transparent', family: 'Arial Black, Impact, sans-serif', weight: 900 },
  yellow:  { label: 'Amarillo', color: '#FFE600', shadow: '4px 4px 3px rgba(0,0,0,0.9)',                            bg: 'transparent', family: 'Impact, sans-serif',               weight: 900 },
  minimal: { label: 'Minimal',  color: '#ffffff', shadow: '2px 2px 3px rgba(0,0,0,0.9)',                            bg: 'rgba(0,0,0,0.6)', family: 'system-ui, sans-serif',       weight: 700 },
};

const CAPTION_FONTS = [
  { label: 'Sequel Sans', value: '"Sequel Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Inter',       value: 'var(--font-inter), "Inter", "Helvetica Neue", sans-serif' },
  { label: 'Helvetica',   value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Impact',      value: 'Impact, sans-serif' },
];

type ShadowStyle = 'none' | 'soft' | 'outline' | 'glow' | 'drop';

const SHADOW_PRESETS: Record<ShadowStyle, { label: string; value: string }> = {
  none:    { label: 'Sin sombra', value: 'none' },
  soft:    { label: 'Suave',      value: '0px 0px 3px rgba(0,0,0,0.7), 0px 0px 3px rgba(0,0,0,0.7)' }, // doble capa pegada a los glifos
  outline: { label: 'Contorno',   value: outline8(2.5) },                            // trazo puro sin sombra
  glow:    { label: 'Glow',       value: '0 0 18px rgba(255,255,255,0.75), 0 0 36px rgba(255,255,255,0.35)' },
  drop:    { label: 'Drop',       value: '6px 6px 4px rgba(0,0,0,0.95)' },          // drop más marcado
};

const MUSIC_GENRES = ['motivacional', 'épico', 'chill', 'upbeat', 'corporate', 'cinematic'];

// ── Audio extraction (for Whisper — audio << video size) ───
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numCh  = 1; // mono is enough for transcription
  const sr     = 16000; // 16kHz — Whisper's preferred rate
  const len    = buffer.length;
  // Resample if needed (simple linear)
  const srcSr  = buffer.sampleRate;
  const ratio  = srcSr / sr;
  const outLen = Math.ceil(len / ratio);
  const bytes  = 44 + outLen * 2;
  const ab     = new ArrayBuffer(bytes);
  const view   = new DataView(ab);
  const src    = buffer.getChannelData(0); // mono: take ch 0

  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); view.setUint32(4, 36 + outLen * 2, true);
  ws(8, 'WAVE'); ws(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ws(36, 'data'); view.setUint32(40, outLen * 2, true);

  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, src[Math.round(i * ratio)] ?? 0));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return ab;
}

async function extractAudio(videoFile: File): Promise<File> {
  const ctx = new AudioContext();
  const ab  = await videoFile.arrayBuffer();
  const buf = await ctx.decodeAudioData(ab);
  ctx.close();
  const wav  = audioBufferToWav(buf);
  const blob = new Blob([wav], { type: 'audio/wav' });
  const name = videoFile.name.replace(/\.[^.]+$/, '') + '_audio.wav';
  return new File([blob], name, { type: 'audio/wav' });
}

// ── Helpers ────────────────────────────────────────────────
function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

// Split text into short chunks: max 3 words AND max 22 chars per line
function splitIntoShortLines(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    // Break if too many chars OR would be 4th word
    if (candidate.length > 22 || current.split(' ').length >= 3) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function estimateSegments(text: string, duration: number): CaptionSegment[] {
  if (!text.trim() || !duration) return [];
  const lines = splitIntoShortLines(text);
  const totalWords = text.trim().split(/\s+/).length;
  let wordCount = 0;
  return lines.map(line => {
    const wc = line.split(/\s+/).length;
    const start = (wordCount / totalWords) * duration;
    wordCount += wc;
    const end = (wordCount / totalWords) * duration;
    return { text: line, start, end };
  });
}

// ── Export helpers ─────────────────────────────────────────

/** Given trim bounds + active cuts, return the list of [start,end] segments to KEEP */
function computeKeptSegments(
  trimStart: number, trimEnd: number,
  cuts: { start: number; end: number }[],
): { start: number; end: number }[] {
  // Sort cuts and clamp to trim window
  const sorted = [...cuts]
    .map(c => ({ start: Math.max(c.start, trimStart), end: Math.min(c.end, trimEnd) }))
    .filter(c => c.end > c.start)
    .sort((a, b) => a.start - b.start);

  const segments: { start: number; end: number }[] = [];
  let cursor = trimStart;
  for (const cut of sorted) {
    if (cut.start > cursor) segments.push({ start: cursor, end: cut.start });
    cursor = Math.max(cursor, cut.end);
  }
  if (cursor < trimEnd) segments.push({ start: cursor, end: trimEnd });
  return segments;
}

/** Map an original timestamp to an output timestamp after cuts are applied.
 *  Example: if there's a cut from 5–7s and trimStart=0, then t=10 → 8 (subtract 2s cut). */
function adjustTime(
  t: number,
  trimStart: number,
  cuts: { start: number; end: number }[],
): number {
  // Work in time relative to trimStart
  let out = t - trimStart;
  for (const cut of cuts) {
    const cs = Math.max(cut.start, trimStart) - trimStart; // cut start relative to trim
    const ce = Math.max(cut.end,   trimStart) - trimStart; // cut end relative to trim
    const relT = t - trimStart;
    if (ce <= relT) {
      // Cut is entirely before t → subtract full cut duration
      out -= (ce - cs);
    } else if (cs < relT) {
      // t is inside the cut → push it to the cut start
      out -= (relT - cs);
    }
    // cs >= relT → cut is after t, no effect
  }
  return Math.max(0, out);
}

/** Escape text for ffmpeg drawtext filter */
function ffEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\\\''")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

// ── Export Modal ───────────────────────────────────────────
type ExportStage = 'idle' | 'loading-ffmpeg' | 'reading-video' | 'encoding' | 'done' | 'error';

interface ExportModalProps {
  open: boolean;
  stage: ExportStage;
  progress: string;
  error: string;
  outputUrl: string;
  onClose: () => void;
}

function ExportModal({ open, stage, progress, error, outputUrl, onClose }: ExportModalProps) {
  if (!open) return null;

  const stages: { key: ExportStage; icon: string; label: string }[] = [
    { key: 'loading-ffmpeg', icon: '⚙️',  label: 'Cargando motor de video' },
    { key: 'reading-video',  icon: '📂',  label: 'Leyendo archivo' },
    { key: 'encoding',       icon: '🎬',  label: 'Procesando y exportando' },
    { key: 'done',           icon: '✅',  label: '¡Listo para descargar!' },
  ];
  const currentIdx = stages.findIndex(s => s.key === stage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md mx-4 p-6 rounded-2xl flex flex-col gap-5"
        style={{ background: '#0d0d0d', border: '1px solid #222' }}>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold" style={{ color: '#fff' }}>✂️ Exportando con TOPCUT</h2>
          {(stage === 'done' || stage === 'error') && (
            <button onClick={onClose} className="text-xs px-3 py-1 rounded-lg" style={{ background: '#1a1a1a', color: '#888' }}>
              Cerrar
            </button>
          )}
        </div>

        {/* Stage list */}
        <div className="flex flex-col gap-2">
          {stages.map((s, i) => {
            const isDone = currentIdx > i;
            const isActive = currentIdx === i;
            return (
              <div key={s.key} className="flex items-center gap-3 py-2 px-3 rounded-xl"
                style={{ background: isActive ? '#7c3aed22' : isDone ? '#0a2a0a' : '#0a0a0a', border: `1px solid ${isActive ? '#7c3aed44' : isDone ? '#1a3a1a' : '#161616'}` }}>
                <span className="text-base shrink-0">{isDone ? '✅' : isActive ? '⏳' : s.icon}</span>
                <p className="text-xs" style={{ color: isActive ? '#c4b5fd' : isDone ? '#4ade80' : '#333' }}>{s.label}</p>
                {isActive && stage !== 'done' && (
                  <div className="ml-auto flex gap-0.5">
                    {[0,1,2].map(j => (
                      <div key={j} className="w-1 h-1 rounded-full" style={{ background: '#7c3aed', animation: `pulse 1.2s ease-in-out ${j * 0.3}s infinite` }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* FFmpeg log line */}
        {progress && stage === 'encoding' && (
          <div className="px-3 py-2 rounded-xl text-[10px] font-mono overflow-hidden"
            style={{ background: '#050505', border: '1px solid #1a1a1a', color: '#555', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {progress.slice(-80)}
          </div>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div className="px-3 py-2 rounded-xl text-xs" style={{ background: '#2a0a0a', border: '1px solid #5a1a1a', color: '#f87171' }}>
            {error || 'Ocurrió un error inesperado. Intentá con un video más corto.'}
          </div>
        )}

        {/* Download button */}
        {stage === 'done' && outputUrl && (
          <a href={outputUrl} download="topcut_export.mp4"
            className="w-full py-3 rounded-xl text-sm font-bold text-center block"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#c13584)', color: '#fff', boxShadow: '0 0 20px #7c3aed44' }}>
            ⬇️ Descargar MP4
          </a>
        )}
      </div>
    </div>
  );
}

// ── Header (compartido con /app y /guiones) ─────────────────
function Header({ onExport }: { onExport?: () => void }) {
  return (
    <header className="px-6 pt-10 pb-2 max-w-6xl mx-auto w-full">
      <ProductNav active="topcut" />
      {onExport && (
        <div className="flex justify-end -mt-6 mb-4">
          <button className="px-4 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#c13584)', color: '#fff', boxShadow: '0 0 16px #7c3aed44' }}
            onClick={onExport}>
            Exportar →
          </button>
        </div>
      )}
    </header>
  );
}

// ── Component ──────────────────────────────────────────────
export default function Editor() {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const audioRef     = useRef<HTMLAudioElement>(null);   // preview de tracks
  const bgMusicRef   = useRef<HTMLAudioElement>(null);   // música de fondo durante playback
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoEndedRef = useRef(false);                  // saber si el video terminó (para reiniciar)
  // Mode
  const [mode,          setMode]         = useState<AppMode>('upload');
  const [processStage,  setProcessStage] = useState(0);
  const [processError,  setProcessError] = useState('');
  const [isDragging,    setIsDragging]   = useState(false);

  // Video
  const [videoUrl, setVideoUrl] = useState('');

  // Core playback
  const [step,        setStep]        = useState(1);
  const [duration,    setDuration]    = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing,     setPlaying]     = useState(false);

  // Auto-detected cuts
  const [cuts, setCuts] = useState<CutSegment[]>([]);

  // Step 1 — Trim
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd,   setTrimEnd]   = useState(100);

  // Step 2 — Captions
  const [captionText,       setCaptionText]       = useState('');
  const [captionStyle,      setCaptionStyle]      = useState<CaptionStyle>('classic');
  const [captionPos,        setCaptionPos]        = useState<CaptionPos>('chest');
  const [captionFontFamily, setCaptionFontFamily] = useState('"Sequel Sans", "Helvetica Neue", Helvetica, Arial, sans-serif');
  const [captionShadow,     setCaptionShadow]     = useState<ShadowStyle>('soft');
  const [captionFontSize,   setCaptionFontSize]   = useState(20);
  const [segments,          setSegments]          = useState<CaptionSegment[]>([]);
  const [wordSegments,      setWordSegments]      = useState<WordSegment[]>([]);
  const [captionMode,       setCaptionMode]       = useState<CaptionMode>('karaoke');
  const [captionUppercase,  setCaptionUppercase]  = useState(false);
  const [autoCaption,       setAutoCaption]       = useState(false);

  // Step 3 — B-Roll
  const [brollQ,       setBrollQ]       = useState('');
  const [brollResults, setBrollResults] = useState<PexelsClip[]>([]);
  const [loadingBroll, setLoadingBroll] = useState(false);
  const [assigned,     setAssigned]     = useState<BRollClip[]>([]);

  // Step 4 — Hook
  const [hookText,     setHookText]     = useState('');
  const [hookNatural,  setHookNatural]  = useState('');   // lo que dice el video
  const [hookEnhanced, setHookEnhanced] = useState('');   // versión mejorada por IA
  const [hookMode,     setHookMode]     = useState<'natural' | 'enhanced' | 'custom'>('enhanced');
  const [hookDur,      setHookDur]      = useState(3);
  const [hookStyle,    setHookStyle]    = useState<HookStyle>('viral');
  const [hookPos,      setHookPos]      = useState<HookPos>('center');
  const [hookFontSize, setHookFontSize] = useState(28);
  const [autoHook,     setAutoHook]     = useState(false);

  // Step 5 — Music
  const [musicQ,        setMusicQ]        = useState('');
  const [musicResults,  setMusicResults]  = useState<MusicTrack[]>([]);
  const [loadingMusic,  setLoadingMusic]  = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [volume,        setVolume]        = useState(30);
  const [previewing,    setPreviewing]    = useState<number | null>(null);

  // Export
  const [exportOpen,    setExportOpen]    = useState(false);
  const [exportStage,   setExportStage]   = useState<ExportStage>('idle');
  const [exportProgress,setExportProgress]= useState('');
  const [exportError,   setExportError]   = useState('');
  const [exportUrl,     setExportUrl]     = useState('');

  // ── Derived ──────────────────────────────────────────────
  const trimStartSec = (trimStart / 100) * duration;
  const trimEndSec   = (trimEnd   / 100) * duration;
  const clipDuration = trimEndSec - trimStartSec;

  const activeCuts     = cuts.filter(c => c.enabled);
  const currentSegment = segments.find(s => currentTime >= s.start && currentTime < s.end);
  const currentBroll   = assigned.find(c => currentTime >= c.startAt && currentTime < c.startAt + c.duration);

  // ── Karaoke: pacing por puntuación + máx 3 palabras ─────────────────────────
  const karaokeGroups: KaraokeGroup[] = (() => {
    if (wordSegments.length === 0) return [];

    const PUNCT       = /[,;.?!¿¡]$/;           // fin de frase = corte obligatorio
    const STRONG_PUNCT = /[.?!]$/;               // punto/pregunta = pausa fuerte (permite 1 palabra)
    const MAX_WORDS   = 3;
    const MAX_CHARS   = 18;

    // ── Paso 1: agrupar con reglas de puntuación ──────────────────────────────
    const raw: WordSegment[][] = [];
    let current: WordSegment[] = [];

    for (let i = 0; i < wordSegments.length; i++) {
      const word = wordSegments[i];
      const next = wordSegments[i + 1];
      const gap  = next ? next.start - word.end : Infinity;
      current.push(word);

      const text         = current.map(w => w.word).join(' ');
      const hasPunct     = PUNCT.test(word.word);        // coma, punto, ?, !
      const hasStrongPunct = STRONG_PUNCT.test(word.word); // solo punto, ?, !
      const tooLong      = current.length >= MAX_WORDS || text.length >= MAX_CHARS;
      const longSilence  = gap > 0.4;                    // silencio real largo

      if (hasPunct || tooLong || longSilence || !next) {
        raw.push(current);
        current = [];
      }
    }

    // ── Paso 2: fusionar grupos de 1 sola palabra cuando NO es dramático ──────
    // Un grupo de 1 palabra es OK si:
    // - La palabra anterior terminó con punto/pregunta/exclamación (pausa dramática)
    // - O hay un silencio > 0.4s antes
    const merged: WordSegment[][] = [];

    for (let i = 0; i < raw.length; i++) {
      const group    = raw[i];
      const prevGroup = raw[i - 1];
      const next     = raw[i + 1];

      // ¿Es una palabra sola?
      if (group.length === 1) {
        const prevLastWord = prevGroup?.[prevGroup.length - 1];
        const afterStrongPunct = prevLastWord ? STRONG_PUNCT.test(prevLastWord.word) : false;
        const gapBefore = prevLastWord ? group[0].start - prevLastWord.end : Infinity;
        const isDramatic = afterStrongPunct || gapBefore > 0.4;

        if (!isDramatic && next) {
          // Fusionar con el siguiente grupo
          const combined     = [...group, ...next];
          const combinedText = combined.map(w => w.word).join(' ');
          if (combined.length <= MAX_WORDS + 1 && combinedText.length <= MAX_CHARS + 4) {
            merged.push(combined);
            i++; // saltar el siguiente
            continue;
          }
        }
        if (!isDramatic && merged.length > 0) {
          // Fusionar con el anterior
          const prev     = merged[merged.length - 1];
          const withPrev = [...prev, ...group];
          if (withPrev.length <= MAX_WORDS + 1) {
            merged[merged.length - 1] = withPrev;
            continue;
          }
        }
      }

      merged.push(group);
    }

    return merged.map(words => ({
      words,
      start: words[0].start,
      end:   words[words.length - 1].end,
    }));
  })();

  const currentKaraokeGroup = karaokeGroups.find(g => currentTime >= g.start && currentTime <= g.end + 0.3);
  // Hook: visible durante los primeros hookDur segundos del clip (mientras el video corre)
  // También se muestra en el preview estático cuando el video no está reproduciéndose
  const relTime = currentTime - trimStartSec;
  const showHook = !!hookText && (relTime >= 0 && relTime < hookDur || (!playing && currentTime <= trimStartSec + 0.5));

  // ── Effects ───────────────────────────────────────────────
  useEffect(() => {
    if (captionText && duration && !autoCaption) setSegments(estimateSegments(captionText, duration));
  }, [captionText, duration, autoCaption]);

  useEffect(() => {
    if (audioRef.current)   audioRef.current.volume   = volume / 100;
    if (bgMusicRef.current) bgMusicRef.current.volume = volume / 100;
  }, [volume]);

  // ── Handlers ─────────────────────────────────────────────
  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;

    // Skip enabled cuts
    const cut = activeCuts.find(c => t >= c.start && t < c.end);
    if (cut) {
      v.currentTime = cut.end;
      return;
    }

    setCurrentTime(t);
    if (trimEndSec > 0 && t >= trimEndSec) {
      v.pause();
      bgMusicRef.current?.pause();
      setPlaying(false);
      videoEndedRef.current = true;
    }
  }

  function onMetadata() {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;

    if (playing) {
      v.pause();
      bgMusicRef.current?.pause();
      setPlaying(false);
      return;
    }

    // Reinicia solo si el video terminó o nunca se movió del inicio
    if (videoEndedRef.current || v.currentTime >= (trimEndSec || v.duration) - 0.3) {
      v.currentTime = trimStartSec;
      setCurrentTime(trimStartSec);
      videoEndedRef.current = false;
    }

    v.play().catch(err => {
      // Si falla (ej: video no listo), espera un frame y reintenta
      console.warn('play() falló:', err);
      requestAnimationFrame(() => v.play().catch(() => {}));
    });

    // Música de fondo
    if (selectedTrack && bgMusicRef.current) {
      bgMusicRef.current.src = selectedTrack.preview;
      bgMusicRef.current.volume = volume / 100;
      bgMusicRef.current.currentTime = 0;
      bgMusicRef.current.play().catch(() => {});
    }
  }

  function seekTo(t: number) {
    const v = videoRef.current;
    if (!v || !duration) return;
    const clamped = Math.max(trimStartSec, Math.min(trimEndSec || duration, t));
    v.currentTime = clamped;
    setCurrentTime(clamped);
  }

  // ── Export ───────────────────────────────────────────────
  async function handleExport() {
    if (!videoUrl) return;
    setExportOpen(true);
    setExportStage('loading-ffmpeg');
    setExportProgress('');
    setExportError('');
    setExportUrl('');

    try {
      // Dynamic import — don't bundle FFmpeg in the main chunk
      const { FFmpeg }                       = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL }         = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();
      ffmpeg.on('log', ({ message }: { message: string }) => setExportProgress(message));

      // Load single-threaded core (no SharedArrayBuffer requirement)
      const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`,   'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      // ── Read video ─────────────────────────────────────────
      setExportStage('reading-video');
      const videoBlob = await fetch(videoUrl).then(r => r.blob());
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoBlob));

      // ── Compute kept segments ───────────────────────────────
      setExportStage('encoding');
      const kept = computeKeptSegments(trimStartSec, trimEndSec || duration, activeCuts);

      // ── Build filter_complex ────────────────────────────────
      const filterParts: string[] = [];
      const vLabels: string[] = [];
      const aLabels: string[] = [];

      if (kept.length === 0) throw new Error('No hay contenido para exportar.');

      kept.forEach((seg, i) => {
        filterParts.push(`[0:v]trim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},setpts=PTS-STARTPTS[sv${i}]`);
        filterParts.push(`[0:a]atrim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(3)},asetpts=PTS-STARTPTS[sa${i}]`);
        vLabels.push(`[sv${i}]`);
        aLabels.push(`[sa${i}]`);
      });

      let vFinal: string;
      let aFinal: string;

      if (kept.length === 1) {
        vFinal = 'sv0';
        aFinal = 'sa0';
      } else {
        const n = kept.length;
        filterParts.push(`${vLabels.join('')}${aLabels.join('')}concat=n=${n}:v=1:a=1[vccat][accat]`);
        vFinal = 'vccat';
        aFinal = 'accat';
      }

      // ── Subtitles (drawtext per segment, up to 40) ─────────
      const subsToRender = segments.slice(0, 40);
      if (subsToRender.length > 0) {
        const preset = CAPTION_PRESETS[captionStyle];
        const color = (preset.color || '#ffffff').replace('#', '');
        const fontSize = Math.round(captionFontSize * 1.5); // scale up for export resolution
        const yExpr = captionPos === 'top'    ? `h*0.12`
                    : captionPos === 'chest'  ? `h*0.68`
                    : captionPos === 'center' ? `(h-th)/2`
                    :                           `h-th-h*0.08`;

        // Calculate cumulative cut durations to remap times
        const sortedCuts = [...activeCuts].sort((a, b) => a.start - b.start);

        subsToRender.forEach((seg, i) => {
          const adjStart = adjustTime(seg.start, trimStartSec, sortedCuts);
          const adjEnd   = adjustTime(seg.end,   trimStartSec, sortedCuts);
          if (adjEnd <= adjStart) return;
          const text = captionUppercase ? seg.text.toUpperCase() : seg.text;
          const escaped = ffEscape(text);
          const shadow = captionShadow === 'none' ? '0x00000000' : '0x000000ff';
          const borderw = captionShadow === 'outline' ? 3 : captionShadow === 'drop' ? 2 : 0;
          const shx = captionShadow === 'drop' ? 3 : 0;
          const shy = captionShadow === 'drop' ? 3 : 0;
          const vPrev = i === 0 ? vFinal : `vdt${i - 1}`;
          const vNext = `vdt${i}`;
          filterParts.push(
            `[${vPrev}]drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=${color}:x=(w-tw)/2:y=${yExpr}:shadowx=${shx}:shadowy=${shy}:shadowcolor=${shadow}:borderw=${borderw}:bordercolor=black:enable='between(t,${adjStart.toFixed(3)},${adjEnd.toFixed(3)})'[${vNext}]`
          );
          vFinal = vNext;
        });
      }

      // ── Music mixing (if track selected) ───────────────────
      const ffArgs: string[] = ['-i', 'input.mp4'];
      let musicInput = -1;

      if (selectedTrack) {
        try {
          const musicBlob = await fetch(selectedTrack.preview).then(r => r.blob());
          await ffmpeg.writeFile('music.mp3', await fetchFile(musicBlob));
          ffArgs.push('-i', 'music.mp3');
          musicInput = 1;
        } catch { /* music fetch failed — skip */ }
      }

      if (musicInput >= 0) {
        const vol = (volume / 100).toFixed(2);
        filterParts.push(`[${aFinal}][${musicInput}:a]amix=inputs=2:duration=first:weights=1 ${vol}[afinal]`);
        aFinal = 'afinal';
      }

      // ── Run FFmpeg ─────────────────────────────────────────
      const filterComplex = filterParts.join(';');
      ffArgs.push(
        '-filter_complex', filterComplex,
        '-map', `[${vFinal}]`,
        '-map', `[${aFinal}]`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        'output.mp4',
      );

      await ffmpeg.exec(ffArgs);

      // ── Read output and create download URL ────────────────
      const data = await ffmpeg.readFile('output.mp4') as Uint8Array;
      const blob = new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });
      const url  = URL.createObjectURL(blob);
      setExportUrl(url);
      setExportStage('done');

    } catch (e) {
      console.error('[TOPCUT export]', e);
      setExportError((e as Error).message || 'Error desconocido');
      setExportStage('error');
    }
  }

  async function searchBroll() {
    if (!brollQ.trim()) return;
    setLoadingBroll(true);
    const data = await fetch(`/api/pexels?q=${encodeURIComponent(brollQ)}`).then(r => r.json());
    setBrollResults(data.videos || []);
    setLoadingBroll(false);
  }

  async function searchMusic() {
    if (!musicQ.trim()) return;
    setLoadingMusic(true);
    const data = await fetch(`/api/pixabay-music?q=${encodeURIComponent(musicQ)}`).then(r => r.json());
    setMusicResults(data.tracks || []);
    setLoadingMusic(false);
  }

  const BROLL_MAX_SEC = 6;

  function addBroll(clip: PexelsClip) {
    setAssigned(prev => {
      // Find a free start time — avoid overlapping existing clips
      const clipDur = 5;
      let start = currentTime;

      // Sort existing clips by startAt
      const sorted = [...prev].sort((a, b) => a.startAt - b.startAt);

      // Check if proposed start overlaps any existing clip
      const overlaps = (t: number) =>
        sorted.some(c => t < c.startAt + c.duration && t + clipDur > c.startAt);

      // If overlap, try to find a free gap (iterate in 1s steps)
      if (overlaps(start)) {
        let found = false;
        for (let t = 0; t <= duration - clipDur; t += 1) {
          if (!overlaps(t)) { start = t; found = true; break; }
        }
        if (!found) start = currentTime; // fallback
      }

      const startAt = Math.max(0, Math.min(start, duration - clipDur));
      return [...prev, { ...clip, uid: `${clip.id}-${startAt}-${Date.now()}`, duration: clipDur, startAt }];
    });
  }

  function togglePreview(track: MusicTrack) {
    const a = audioRef.current;
    if (!a) return;
    if (previewing === track.id) { a.pause(); setPreviewing(null); }
    else { a.src = track.preview; a.play(); setPreviewing(track.id); }
  }

  async function handleFile(file: File) {
    // No hard size limit — we extract audio before sending so Whisper gets a tiny file

    // Reset state
    setCuts([]); setSegments([]); setWordSegments([]); setCaptionText(''); setHookText('');
    setBrollResults([]); setAssigned([]); setMusicResults([]); setSelectedTrack(null);
    setTrimStart(0); setTrimEnd(100); setAutoCaption(false); setAutoHook(false);

    const objectUrl = URL.createObjectURL(file);
    setVideoUrl(objectUrl);
    videoEndedRef.current = false;
    setMode('processing');
    setProcessStage(0);
    setProcessError('');

    // Fake progress — advance a stage every ~5s
    let stage = 0;
    const timer = setInterval(() => {
      stage = Math.min(stage + 1, 4);
      setProcessStage(stage);
    }, 5000);

    try {
      // ── Extract audio for Whisper (audio is much smaller than video) ──
      let uploadFile: File = file;
      try {
        uploadFile = await extractAudio(file);
      } catch {
        // If audio extraction fails, fall back to original file (may hit Whisper limit)
      }

      const formData = new FormData();
      formData.append('video', uploadFile);
      const res  = await fetch('/api/process-video', { method: 'POST', body: formData });
      const data = await res.json();

      clearInterval(timer);

      if (!res.ok || data.error) throw new Error(data.error || 'Error desconocido');

      // ── Populate all steps ──
      // Cuts
      // Fillers desactivados por default — solo errores, repeticiones y pausas largas se cortan
      setCuts((data.cuts || []).map((c: Omit<CutSegment, 'enabled'>) => ({
        ...c,
        enabled: c.type !== 'filler',
      })));

      // Word-level timestamps for karaoke mode
      if (data.words?.length > 0) setWordSegments(data.words as WordSegment[]);

      // Captions: split Whisper segments into short lines (max 3 words / 22 chars)
      if (data.segments?.length > 0) {
        const shortSegs: CaptionSegment[] = [];
        for (const seg of data.segments as CaptionSegment[]) {
          const lines = splitIntoShortLines(seg.text);
          const segDur = seg.end - seg.start;
          lines.forEach((line, i) => {
            shortSegs.push({
              text:  line,
              start: seg.start + (i / lines.length) * segDur,
              end:   seg.start + ((i + 1) / lines.length) * segDur,
            });
          });
        }
        setSegments(shortSegs);
        setAutoCaption(true);
      }
      setCaptionText(data.transcript || '');

      // Hook — tres fuentes
      if (data.hookNatural)  setHookNatural(data.hookNatural);
      if (data.hookEnhanced) setHookEnhanced(data.hookEnhanced);
      // default: usar la versión mejorada
      const defaultHook = data.hookEnhanced || data.hookNatural || '';
      if (defaultHook) { setHookText(defaultHook); setAutoHook(true); setHookMode('enhanced'); }

      // B-Roll — patrón alternado con timing orgánico basado en pausas del habla
      if (data.brollResults?.length > 0) {
        setBrollResults(data.brollResults);

        const dur      = data.videoDuration || 0;
        const wordList = (data.words || []) as WordSegment[];
        const clips    = data.brollResults as PexelsClip[];

        // ── Detectar puntos de pausa natural en el habla ──────────────────
        // Una "pausa" es un gap > 0.25s entre palabras — punto ideal para cortar
        type PausePoint = { time: number; gap: number };
        const pauses: PausePoint[] = [];
        for (let i = 1; i < wordList.length; i++) {
          const gap = wordList[i].start - wordList[i - 1].end;
          if (gap > 0.25) pauses.push({ time: wordList[i - 1].end, gap });
        }
        // Ordenar por gap descendente para usar los silencios más largos primero
        pauses.sort((a, b) => b.gap - a.gap);

        // ── Planificar slots de B-Roll ────────────────────────────────────
        const HOOK_FREE    = 4;        // primeros 4s siempre libres
        const BROLL_MIN    = 4;        // duración mínima de un clip
        const BROLL_MAX    = 6;        // duración máxima de un clip
        const ORIGINAL_MIN = 3;        // mínimo de video original entre clips
        const ORIGINAL_MAX = 6;        // máximo de video original entre clips
        const jitter = () => (Math.random() - 0.5) * 1.5; // ±0.75s de variación

        // Función para buscar la pausa más cercana a un tiempo dado (dentro de ±2s)
        const snapToPause = (t: number): number => {
          const WINDOW = 2;
          const nearby = pauses.filter(p => p.time >= t - WINDOW && p.time <= t + WINDOW);
          if (nearby.length === 0) return t;
          // La pausa más larga dentro de la ventana es el mejor punto de corte
          return nearby.sort((a, b) => b.gap - a.gap)[0].time;
        };

        const newAssigned: BRollClip[] = [];
        let t = HOOK_FREE; // primer B-Roll arranca justo al terminar el hook
        let slotIdx = 0;

        while (t + BROLL_MIN <= dur && slotIdx < clips.length) {
          // Duración variable del clip + jitter
          const brollDur = Math.min(
            BROLL_MAX,
            Math.max(BROLL_MIN, BROLL_MIN + Math.random() * (BROLL_MAX - BROLL_MIN) + jitter())
          );

          // Snap al silencio más cercano para corte limpio
          const startAt = Math.max(HOOK_FREE, Math.min(dur - brollDur, snapToPause(t)));

          if (startAt + brollDur > dur) break;

          newAssigned.push({
            ...clips[slotIdx],
            uid:      `${clips[slotIdx].id}-${startAt}-${slotIdx}`,
            duration: parseFloat(brollDur.toFixed(2)),
            startAt:  parseFloat(startAt.toFixed(2)),
          });

          // Siguiente slot: gap variable de video original
          const nextGap = ORIGINAL_MIN + Math.random() * (ORIGINAL_MAX - ORIGINAL_MIN);
          t = startAt + brollDur + nextGap;
          slotIdx++;
        }

        setAssigned(newAssigned);
      }

      // Music: auto-load genre
      const mood = data.musicMood || 'upbeat';
      setMusicQ(mood);
      fetch(`/api/pixabay-music?q=${encodeURIComponent(mood)}`).then(r => r.json()).then(d => setMusicResults(d.tracks || []));

      // Trim
      if (data.videoDuration > 0) {
        if (data.trimStartSec > 0)
          setTrimStart((data.trimStartSec / data.videoDuration) * 100);
        if (data.trimEndSec > 0 && data.trimEndSec < data.videoDuration)
          setTrimEnd((data.trimEndSec   / data.videoDuration) * 100);
      }

      setProcessStage(5);
      await new Promise(r => setTimeout(r, 1200));
      setMode('edit');
      setStep(1);

    } catch (err) {
      clearInterval(timer);
      setProcessError((err as Error).message);
    }
  }

  // ── UPLOAD SCREEN ─────────────────────────────────────────
  if (mode === 'upload') {
    return (
      <div className="flex flex-col" style={{ height: '100dvh', background: '#080808', color: '#fff' }}>
        <Header />
        <div className="flex-1 flex items-center justify-center p-8"
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault(); setIsDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}>
          <div className="w-full max-w-lg text-center">
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            <div onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-3xl p-16 cursor-pointer transition-all duration-300"
              style={isDragging
                ? { borderColor: '#7c3aed', background: '#7c3aed0d', boxShadow: '0 0 40px #7c3aed22' }
                : { borderColor: '#222', background: '#0a0a0a' }}
              onMouseEnter={e => { if (!isDragging) { (e.currentTarget as HTMLElement).style.borderColor = '#333'; (e.currentTarget as HTMLElement).style.background = '#0f0f0f'; }}}
              onMouseLeave={e => { if (!isDragging) { (e.currentTarget as HTMLElement).style.borderColor = '#222'; (e.currentTarget as HTMLElement).style.background = '#0a0a0a'; }}}>

              <div className="text-6xl mb-5">{isDragging ? '📂' : '🎬'}</div>
              <h2 className="text-xl font-bold mb-2">Soltá tu video acá</h2>
              <p className="text-sm mb-5" style={{ color: '#555' }}>o hacé clic para seleccionar</p>
              <div className="flex items-center justify-center gap-2 flex-wrap mb-4">
                {['MP4', 'MOV', 'AVI', 'MKV'].map(f => (
                  <span key={f} className="text-[10px] px-2.5 py-1 rounded-full"
                    style={{ background: '#111', border: '1px solid #222', color: '#444' }}>{f}</span>
                ))}
              </div>
              <p className="text-[11px]" style={{ color: '#333' }}>Sin límite de tamaño · La IA extrae el audio y procesa todo automáticamente</p>
            </div>

            {/* What the AI does */}
            <div className="grid grid-cols-5 gap-2 mt-8">
              {[
                { icon: '✂️', label: 'Corta errores' },
                { icon: '💬', label: 'Subtítulos' },
                { icon: '🎬', label: 'B-Roll' },
                { icon: '🔥', label: 'Hook viral' },
                { icon: '🎵', label: 'Música' },
              ].map(f => (
                <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl"
                  style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                  <span className="text-xl">{f.icon}</span>
                  <span className="text-[10px] text-center" style={{ color: '#555' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PROCESSING SCREEN ─────────────────────────────────────
  if (mode === 'processing') {
    return (
      <div className="flex flex-col" style={{ height: '100dvh', background: '#080808', color: '#fff' }}>
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">

          {/* Animated logo */}
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shrink-0"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#c13584)', boxShadow: '0 0 50px #7c3aed55',
              animation: processStage < 5 ? 'pulse 2s ease-in-out infinite' : 'none' }}>
            {processStage >= 5 ? '✨' : '✂️'}
          </div>

          <div className="text-center">
            <h2 className="text-xl font-bold mb-1">
              {processStage >= 5 ? '¡Video procesado!' : 'Editando con IA...'}
            </h2>
            <p className="text-sm" style={{ color: '#555' }}>
              {processStage >= 5 ? 'Abriendo el editor...' : 'Esto puede tardar hasta 1 minuto'}
            </p>
          </div>

          {/* Stage list */}
          <div className="space-y-2 w-full max-w-sm">
            {PROCESS_STAGES.map((stage, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500"
                style={processStage === i && !processError
                  ? { background: '#7c3aed22', border: '1px solid #7c3aed44' }
                  : processStage > i
                  ? { background: '#0f0f0f', border: '1px solid #1a1a1a' }
                  : { opacity: 0.25, border: '1px solid transparent' }}>
                <span className="text-lg w-6 text-center shrink-0">
                  {processStage > i ? '✅' : processStage === i ? stage.icon : '⏳'}
                </span>
                <span className="text-sm flex-1" style={{ color: processStage >= i ? '#ddd' : '#333' }}>
                  {stage.label}
                </span>
                {processStage === i && !processError && (
                  <div className="flex gap-1 shrink-0">
                    {[0, 1, 2].map(d => (
                      <div key={d} className="w-1.5 h-1.5 rounded-full"
                        style={{ background: '#7c3aed', animation: `bounce 1.2s ${d * 0.2}s ease-in-out infinite` }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-sm h-1 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
            <div className="h-full rounded-full transition-all duration-1000"
              style={{
                background: 'linear-gradient(90deg,#7c3aed,#c13584)',
                width: `${(processStage / (PROCESS_STAGES.length - 1)) * 100}%`,
              }} />
          </div>

          {/* Error state */}
          {processError && (
            <div className="w-full max-w-sm rounded-2xl p-4" style={{ background: '#ef444415', border: '1px solid #ef444433' }}>
              <p className="text-sm text-red-400 mb-3">⚠️ {processError}</p>
              <button onClick={() => { setMode('upload'); setProcessError(''); }}
                className="w-full py-2 rounded-xl text-xs font-bold"
                style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333' }}>
                Volver e intentar de nuevo
              </button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.8;transform:scale(0.95)} }
          @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        `}</style>
      </div>
    );
  }

  // ── EDIT SCREEN ───────────────────────────────────────────
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#080808', color: '#fff' }}>

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #161616' }}>
        <div className="flex items-center gap-1 p-1 rounded-2xl shrink-0" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
          <Link href="/app"
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200"
            style={{ color: '#555' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            🧬 ViralADN
          </Link>
          <div className="px-4 py-2 rounded-xl text-xs font-bold cursor-default"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 12px #7c3aed44' }}>
            ✂️ TOPCUT
          </div>
        </div>
        <div className="w-px h-4 mx-1 shrink-0" style={{ background: '#222' }} />
        <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
          style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#a78bfa' }}>BETA</span>

        {/* Step pills */}
        <div className="hidden md:flex items-center gap-1 mx-auto">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-1">
              <button onClick={() => setStep(s.n)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                style={step === s.n
                  ? { background: '#7c3aed', color: '#fff' }
                  : step > s.n
                  ? { background: '#1a1a1a', color: '#7c3aed', border: '1px solid #7c3aed33' }
                  : { background: 'transparent', color: '#444', border: '1px solid #1a1a1a' }}>
                <span>{step > s.n ? '✓' : s.icon}</span>
                <span>{s.label}</span>
                {/* Red dot for cuts on step 1 */}
                {s.n === 1 && activeCuts.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-black flex items-center justify-center"
                    style={{ background: '#ef4444', color: '#fff' }}>
                    {activeCuts.length}
                  </span>
                )}
              </button>
              {i < STEPS.length - 1 && <div className="w-4 h-px" style={{ background: step > s.n ? '#7c3aed44' : '#1a1a1a' }} />}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => { setMode('upload'); }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: '#111', border: '1px solid #222', color: '#555' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}>
            + Nuevo video
          </button>
          <button onClick={handleExport}
            className="px-4 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#c13584)', color: '#fff', boxShadow: '0 0 16px #7c3aed44' }}>
            Exportar →
          </button>
        </div>
      </header>

      {/* ── Export Modal ── */}
      <ExportModal
        open={exportOpen}
        stage={exportStage}
        progress={exportProgress}
        error={exportError}
        outputUrl={exportUrl}
        onClose={() => { setExportOpen(false); setExportStage('idle'); }}
      />

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ── */}
        <aside className="w-48 shrink-0 flex flex-col gap-1 p-3" style={{ borderRight: '1px solid #161616' }}>
          <p className="text-[9px] uppercase tracking-widest px-2 mb-1" style={{ color: '#333' }}>Pasos</p>
          {STEPS.map(s => (
            <button key={s.n} onClick={() => setStep(s.n)}
              className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
              style={step === s.n
                ? { background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#c4b5fd' }
                : { background: 'transparent', border: '1px solid transparent', color: '#444' }}>
              <span className="text-base w-5 text-center shrink-0">{s.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{s.label}</p>
                <p className="text-[9px] truncate" style={{ color: step === s.n ? '#7c3aed99' : '#2a2a2a' }}>{s.desc}</p>
              </div>
              {s.n === 1 && activeCuts.length > 0 && (
                <span className="w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center shrink-0"
                  style={{ background: '#ef4444', color: '#fff' }}>
                  {activeCuts.length}
                </span>
              )}
            </button>
          ))}

          {/* Nuevo video at bottom */}
          <div className="mt-auto pt-3" style={{ borderTop: '1px solid #161616' }}>
            <button onClick={() => setMode('upload')}
              className="w-full py-2 rounded-xl text-[10px] font-semibold transition-all"
              style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#555' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; }}>
              + Cambiar video
            </button>
          </div>
        </aside>

        {/* ── Center: Preview ── */}
        <div className="flex flex-col items-center justify-center flex-1 gap-3 py-4" style={{ background: '#050505' }}>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={{ aspectRatio: '9/16', height: 'min(calc(100vh - 160px), 520px)', background: '#000', border: '1px solid #1a1a1a' }}>

            {/* Main video */}
            {videoUrl && (
              <video ref={videoRef} src={videoUrl}
                className="absolute inset-0 w-full h-full object-cover"
                onTimeUpdate={onTimeUpdate} onLoadedMetadata={onMetadata}
                onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
            )}

            {!videoUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ color: '#2a2a2a' }}>
                <span className="text-5xl">🎬</span>
                <p className="text-xs">Sin video</p>
              </div>
            )}

            {/* B-Roll overlay — key fuerza remount cuando cambia el clip */}
            {currentBroll && (
              <video key={currentBroll.id + '-' + currentBroll.startAt}
                src={currentBroll.url} autoPlay muted playsInline
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  zIndex: 10,
                  opacity: 1,
                }} />
            )}

            {/* Hook overlay — aparece encima del video MIENTRAS la persona habla */}
            {showHook && (() => {
              const hp = HOOK_PRESETS[hookStyle];
              const posStyle: React.CSSProperties =
                hookPos === 'top'    ? { top: 32 } :
                hookPos === 'bottom' ? { bottom: 64 } :
                                       { top: '40%', transform: 'translateY(-50%)' };
              return (
                <div className="absolute left-0 right-0 z-20 flex flex-col items-center px-5 gap-2"
                  style={{ position: 'absolute', ...posStyle }}>
                  <p className="text-center leading-snug"
                    style={{
                      fontSize:      hookFontSize,
                      color:         hp.color,
                      textShadow:    hp.shadow,
                      fontFamily:    hp.family,
                      fontWeight:    hp.weight,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      background:    hp.bg !== 'transparent' ? hp.bg : undefined,
                      padding:       hp.bg !== 'transparent' ? '8px 16px' : undefined,
                      borderRadius:  hp.bg !== 'transparent' ? 8 : undefined,
                      maxWidth:      '100%',
                    }}>
                    {hookText}
                  </p>
                </div>
              );
            })()}

            {/* Caption overlay */}
            {!showHook && (() => {
              const posStyle: React.CSSProperties =
                captionPos === 'top'    ? { top: 40 } :
                captionPos === 'chest'  ? { top: '68%' } :
                captionPos === 'center' ? { top: '50%', transform: 'translateY(-50%)' } :
                                          { bottom: 48 };
              const shadow = captionShadow === 'none' ? 'none' : SHADOW_PRESETS[captionShadow].value;
              const preset = CAPTION_PRESETS[captionStyle];

              // ── Karaoke mode: palabras exactas de Whisper, resaltado por palabra ──
              if (captionMode === 'karaoke' && currentKaraokeGroup) {
                const line = currentKaraokeGroup.words.map(w => w.word).join(' ');
                return (
                  <div className="absolute left-0 right-0 px-3 z-20 flex justify-center"
                    style={{ position: 'absolute', ...posStyle }}>
                    <p style={{
                      fontFamily:    captionFontFamily,
                      fontSize:      captionFontSize,
                      fontWeight:    preset.fontWeight,
                      color:         preset.color,
                      textShadow:    shadow,
                      textTransform: captionUppercase ? 'uppercase' : 'none',
                      letterSpacing: 0.5,
                      lineHeight:    1.15,
                      whiteSpace:    'nowrap',
                      overflow:      'hidden',
                      maxWidth:      '100%',
                    }}>
                      {line}
                    </p>
                  </div>
                );
              }

              // ── Line mode: 3 palabras a la vez ──
              if (captionMode === 'line' && currentSegment) {
                return (
                  <div className="absolute left-0 right-0 px-4 z-20 flex justify-center"
                    style={{ position: 'absolute', ...posStyle }}>
                    <p className="text-center"
                      style={{
                        color:          preset.color,
                        fontWeight:     preset.fontWeight,
                        textTransform:  captionUppercase ? 'uppercase' : 'none',
                        background:     preset.background,
                        padding:        preset.padding,
                        borderRadius:   preset.borderRadius,
                        backdropFilter: preset.backdropFilter,
                        textShadow:     shadow,
                        fontSize:       captionFontSize,
                        fontFamily:     captionFontFamily,
                        whiteSpace:     'nowrap',
                        maxWidth:       '100%',
                        letterSpacing:  0.3,
                      }}>
                      {currentSegment.text}
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Trim region overlay on video */}
            {duration > 0 && (
              <>
                <div className="absolute top-0 bottom-0 z-30 pointer-events-none"
                  style={{ background: 'rgba(0,0,0,0.6)', left: 0, width: `${trimStart}%` }} />
                <div className="absolute top-0 bottom-0 z-30 pointer-events-none"
                  style={{ background: 'rgba(0,0,0,0.6)', right: 0, width: `${100 - trimEnd}%` }} />
              </>
            )}
          </div>

          {/* ── Timeline ── */}
          <div className="w-full px-4 flex flex-col gap-2" style={{ maxWidth: 520 }}>

            {/* Controles + tiempo */}
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} disabled={!videoUrl}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-20"
                style={{ background: playing ? '#c13584' : '#7c3aed', boxShadow: `0 0 12px ${playing ? '#c1358466' : '#7c3aed55'}` }}>
                <span className="text-xs">{playing ? '⏸' : '▶'}</span>
              </button>
              <span className="text-xs font-mono tabular-nums" style={{ color: '#555', minWidth: 36 }}>{fmtTime(currentTime)}</span>
              <span className="text-xs" style={{ color: '#2a2a2a' }}>/</span>
              <span className="text-xs font-mono tabular-nums" style={{ color: '#333', minWidth: 36 }}>{fmtTime(duration)}</span>
            </div>

            {/* Timeline track — clicable para seek */}
            {duration > 0 && (
              <div className="relative select-none" style={{ height: 48 }}>

                {/* Track base */}
                <div
                  className="absolute left-0 right-0 rounded-full cursor-pointer"
                  style={{ top: 18, height: 6, background: '#1a1a1a' }}
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct  = (e.clientX - rect.left) / rect.width;
                    seekTo(pct * duration);
                  }}
                >
                  {/* Trim zone (active region) */}
                  <div className="absolute top-0 h-full rounded-full"
                    style={{ left: `${trimStart}%`, width: `${trimEnd - trimStart}%`, background: '#2a2a2a' }} />

                  {/* Hook region */}
                  {hookText && hookDur > 0 && (
                    <div className="absolute top-0 h-full rounded-l-full"
                      style={{
                        left:       `${(trimStartSec / duration) * 100}%`,
                        width:      `${(hookDur / duration) * 100}%`,
                        background: '#7c3aed44',
                        border:     '1px solid #7c3aed66',
                      }} />
                  )}

                  {/* B-Roll markers */}
                  {assigned.map((c, i) => (
                    <div key={i} className="absolute top-0 h-full"
                      style={{
                        left:       `${(c.startAt / duration) * 100}%`,
                        width:      `${(c.duration / duration) * 100}%`,
                        background: '#f9731655',
                        minWidth:   2,
                      }} />
                  ))}

                  {/* Cut markers */}
                  {cuts.filter(c => c.enabled).map(cut => (
                    <div key={cut.id} className="absolute top-0 h-full"
                      style={{
                        left:       `${(cut.start / duration) * 100}%`,
                        width:      `max(2px, ${((cut.end - cut.start) / duration) * 100}%)`,
                        background: CUT_COLORS[cut.type],
                        opacity:    0.8,
                      }} />
                  ))}

                  {/* Playhead */}
                  <div className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                      left:        `${(currentTime / duration) * 100}%`,
                      width:       2,
                      height:      18,
                      background:  '#fff',
                      borderRadius: 1,
                      boxShadow:   '0 0 6px rgba(255,255,255,0.6)',
                      transform:   'translateY(-50%) translateX(-1px)',
                    }} />
                </div>

                {/* Playhead handle (draggable) */}
                <div
                  className="absolute top-0 cursor-grab active:cursor-grabbing"
                  style={{
                    left:      `calc(${(currentTime / duration) * 100}% - 6px)`,
                    top:       10,
                    width:     12,
                    height:    22,
                    background: '#fff',
                    borderRadius: 3,
                    boxShadow:  '0 0 8px rgba(0,0,0,0.8)',
                  }}
                  onMouseDown={e => {
                    e.preventDefault();
                    const track = e.currentTarget.parentElement!.querySelector('div')! as HTMLDivElement;
                    const onMove = (me: MouseEvent) => {
                      const rect = track.getBoundingClientRect();
                      const pct  = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width));
                      seekTo(pct * duration);
                    };
                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                />

                {/* Legend */}
                <div className="absolute bottom-0 left-0 flex gap-3">
                  {hookText && <div className="flex items-center gap-1"><div className="w-2 h-1.5 rounded-sm" style={{ background: '#7c3aed' }} /><span className="text-[8px]" style={{ color: '#444' }}>Hook</span></div>}
                  {assigned.length > 0 && <div className="flex items-center gap-1"><div className="w-2 h-1.5 rounded-sm" style={{ background: '#f97316' }} /><span className="text-[8px]" style={{ color: '#444' }}>B-Roll</span></div>}
                  {cuts.some(c => c.enabled) && <div className="flex items-center gap-1"><div className="w-2 h-1.5 rounded-sm" style={{ background: '#ef4444' }} /><span className="text-[8px]" style={{ color: '#444' }}>Cortes</span></div>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Controls ── */}
        <aside className="w-72 shrink-0 overflow-y-auto py-5 px-4" style={{ borderLeft: '1px solid #161616' }}>

          {/* ══ STEP 1: Recortar ══ */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold mb-0.5">✂️ Recortar</h3>
                <p className="text-xs" style={{ color: '#555' }}>La IA eliminó automáticamente errores, pausas y muletillas</p>
              </div>

              {cuts.length > 0 ? (<>

                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-3 text-center" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                    <p className="text-2xl font-black tabular-nums" style={{ color: '#22c55e' }}>{cuts.length}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#444' }}>partes eliminadas</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                    <p className="text-2xl font-black tabular-nums" style={{ color: '#c4b5fd' }}>{fmtTime(clipDuration)}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#444' }}>duración final</p>
                  </div>
                </div>

                {/* Type breakdown */}
                <div className="rounded-xl p-3 space-y-2" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                  {(['filler','pause','repetition','mistake'] as CutType[]).map(type => {
                    const count = cuts.filter(c => c.type === type).length;
                    if (count === 0) return null;
                    const icons: Record<CutType, string> = { filler: '🗣️', pause: '⏸️', repetition: '🔁', mistake: '❌' };
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <span className="text-sm">{icons[type]}</span>
                        <span className="text-xs flex-1" style={{ color: '#888' }}>
                          {count} {CUT_LABELS[type].toLowerCase()}{count !== 1 ? 's' : ''} eliminad{count !== 1 ? 'os' : 'o'}
                        </span>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CUT_COLORS[type] }} />
                      </div>
                    );
                  })}
                </div>

                {/* Timeline visual */}
                {duration > 0 && (
                  <div>
                    <p className="text-[10px] mb-1.5" style={{ color: '#444' }}>Timeline — partes eliminadas marcadas</p>
                    <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                      {cuts.map(cut => (
                        <div key={cut.id} className="absolute top-0 h-full"
                          style={{
                            left:       `${(cut.start / duration) * 100}%`,
                            width:      `max(2px, ${((cut.end - cut.start) / duration) * 100}%)`,
                            background: CUT_COLORS[cut.type],
                            opacity:    cut.enabled ? 1 : 0.2,
                          }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Collapsible detail list — in case user wants to restore something */}
                <details className="group">
                  <summary className="text-[10px] cursor-pointer select-none flex items-center gap-1.5 py-1"
                    style={{ color: '#555', listStyle: 'none' }}>
                    <span className="transition-transform group-open:rotate-90 inline-block">›</span>
                    Ver detalle · restaurar partes si querés
                  </summary>
                  <div className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
                    <div className="max-h-52 overflow-y-auto divide-y" style={{ borderColor: '#111' }}>
                      {cuts.map(cut => (
                        <div key={cut.id}
                          className="flex items-center gap-2 px-3 py-2 transition-all"
                          style={{ background: cut.enabled ? 'transparent' : '#1a1a1a11' }}>
                          <div className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold"
                            style={{
                              background: `${CUT_COLORS[cut.type]}22`,
                              color:       cut.enabled ? CUT_COLORS[cut.type] : '#444',
                              border:     `1px solid ${CUT_COLORS[cut.type]}44`,
                              opacity:    cut.enabled ? 1 : 0.4,
                            }}>
                            {CUT_LABELS[cut.type]}
                          </div>
                          <span className="text-[10px] flex-1 truncate" style={{ color: cut.enabled ? '#888' : '#444' }}>
                            {fmtTime(cut.start)}
                            {cut.type === 'filler'     && cut.word      && ` — "${cut.word}"`}
                            {cut.type === 'pause'      && cut.duration !== undefined && ` — ${cut.duration.toFixed(1)}s`}
                            {cut.type === 'repetition' && cut.phrase    && ` — "${cut.phrase}"`}
                            {cut.type === 'mistake'    && cut.reason    && ` — ${cut.reason}`}
                          </span>
                          {/* Restore / re-cut button */}
                          <button
                            onClick={() => setCuts(p => p.map(c => c.id === cut.id ? { ...c, enabled: !c.enabled } : c))}
                            className="text-[9px] px-2 py-0.5 rounded-lg shrink-0 transition-all"
                            style={cut.enabled
                              ? { background: '#1a1a1a', color: '#555', border: '1px solid #2a2a2a' }
                              : { background: '#22c55e22', color: '#4ade80', border: '1px solid #22c55e44' }}>
                            {cut.enabled ? 'Restaurar' : 'Re-cortar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>

              </>) : (
                <div className="rounded-2xl p-6 text-center" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-sm font-semibold mb-1">Video limpio</p>
                  <p className="text-xs" style={{ color: '#555' }}>No se detectaron errores ni muletillas</p>
                </div>
              )}

              {/* Trim manual */}
              <div className="rounded-xl p-3 space-y-3" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                <p className="text-[10px] font-semibold" style={{ color: '#555' }}>Recorte manual (inicio / fin)</p>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px]" style={{ color: '#555' }}>Inicio</span>
                    <span className="text-[10px] font-mono" style={{ color: '#c4b5fd' }}>{fmtTime(trimStartSec)}</span>
                  </div>
                  <input type="range" min={0} max={100} step={0.1} value={trimStart}
                    onChange={e => setTrimStart(Math.min(+e.target.value, trimEnd - 5))}
                    className="w-full accent-purple-500 h-1.5 cursor-pointer" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px]" style={{ color: '#555' }}>Fin</span>
                    <span className="text-[10px] font-mono" style={{ color: '#c4b5fd' }}>{fmtTime(trimEndSec)}</span>
                  </div>
                  <input type="range" min={0} max={100} step={0.1} value={trimEnd}
                    onChange={e => setTrimEnd(Math.max(+e.target.value, trimStart + 5))}
                    className="w-full accent-purple-500 h-1.5 cursor-pointer" />
                </div>
              </div>

              <button onClick={() => setStep(2)}
                className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#c13584)', color: '#fff' }}>
                Siguiente: Subtítulos →
              </button>
            </div>
          )}

          {/* ══ STEP 2: Subtítulos ══ */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold mb-0.5">💬 Subtítulos</h3>
                  <p className="text-xs" style={{ color: '#555' }}>
                    {autoCaption ? '✅ Whisper sincronizado' : 'Pega el guión para sincronizar'}
                  </p>
                </div>
                {autoCaption && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: '#22c55e22', border: '1px solid #22c55e44', color: '#4ade80' }}>
                    🤖 Auto
                  </span>
                )}
              </div>

              {/* Modo de subtítulos */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['karaoke', '✨ Karaoke', wordSegments.length > 0 ? 'Palabra por palabra' : 'Requiere Whisper'],
                  ['line',    '📄 Línea',   '3 palabras a la vez'],
                ] as [CaptionMode, string, string][]).map(([mode, label, desc]) => (
                  <button key={mode}
                    onClick={() => setCaptionMode(mode)}
                    disabled={mode === 'karaoke' && wordSegments.length === 0}
                    className="p-3 rounded-xl text-left transition-all disabled:opacity-30"
                    style={captionMode === mode
                      ? { background: '#7c3aed33', border: '1px solid #7c3aed66' }
                      : { background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                    <p className="text-xs font-bold" style={{ color: captionMode === mode ? '#c4b5fd' : '#666' }}>{label}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: '#444' }}>{desc}</p>
                  </button>
                ))}
              </div>

              <textarea value={captionText} onChange={e => { setCaptionText(e.target.value); setAutoCaption(false); }}
                placeholder="Pega aquí la transcripción del video..."
                rows={3} className="w-full text-xs rounded-xl px-3 py-2.5 outline-none resize-none"
                style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#ddd', lineHeight: 1.6 }} />

              {segments.length > 0 && (
                <p className="text-[10px]" style={{ color: '#555' }}>
                  {captionMode === 'karaoke' ? `${wordSegments.length} palabras` : `${segments.length} líneas`} · {autoCaption ? 'Whisper sincronizado' : 'estimado'}
                </p>
              )}

              {/* Color + mayúsculas/minúsculas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: '#777' }}>Color</p>
                  {/* Toggle Aa / AA */}
                  <button
                    onClick={() => setCaptionUppercase(p => !p)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all"
                    style={captionUppercase
                      ? { background: '#7c3aed33', border: '1px solid #7c3aed66', color: '#c4b5fd' }
                      : { background: '#0f0f0f',   border: '1px solid #1a1a1a',   color: '#666' }}>
                    {captionUppercase ? 'AA' : 'Aa'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(CAPTION_PRESETS) as [CaptionStyle, typeof CAPTION_PRESETS[CaptionStyle]][]).map(([key, val]) => (
                    <button key={key} onClick={() => setCaptionStyle(key)}
                      className="py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={captionStyle === key
                        ? { background: '#7c3aed33', border: '1px solid #7c3aed66', color: '#c4b5fd' }
                        : { background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#555' }}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipografía */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#777' }}>Tipografía</p>
                <div className="grid grid-cols-2 gap-2">
                  {CAPTION_FONTS.map(f => (
                    <button key={f.value} onClick={() => setCaptionFontFamily(f.value)}
                      className="py-2.5 rounded-xl text-xs transition-all"
                      style={{
                        fontFamily: f.value,
                        background: captionFontFamily === f.value ? '#7c3aed33' : '#0f0f0f',
                        border: `1px solid ${captionFontFamily === f.value ? '#7c3aed66' : '#1a1a1a'}`,
                        color: captionFontFamily === f.value ? '#c4b5fd' : '#555',
                        fontWeight: 700,
                      }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tamaño */}
              {/* Tamaño */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs" style={{ color: '#666' }}>Tamaño</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: '#111', color: '#c4b5fd' }}>{captionFontSize}px</span>
                </div>
                <input type="range" min={12} max={36} value={captionFontSize}
                  onChange={e => setCaptionFontSize(+e.target.value)}
                  className="w-full accent-purple-500 h-1.5 cursor-pointer" />
              </div>

              {/* Sombra */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#777' }}>Sombra</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.entries(SHADOW_PRESETS) as [ShadowStyle, typeof SHADOW_PRESETS[ShadowStyle]][]).map(([key, val]) => (
                    <button key={key} onClick={() => setCaptionShadow(key)}
                      className="py-2 rounded-xl text-[10px] font-semibold transition-all"
                      style={captionShadow === key
                        ? { background: '#7c3aed33', border: '1px solid #7c3aed66', color: '#c4b5fd' }
                        : { background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#555' }}>
                      {val.label}
                    </button>
                  ))}
                </div>
                {/* Live preview text */}
                <div className="mt-2 rounded-xl flex items-center justify-center py-3"
                  style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                  <p style={{
                    color:       CAPTION_PRESETS[captionStyle].color,
                    fontWeight:  CAPTION_PRESETS[captionStyle].fontWeight,
                    fontFamily:  captionFontFamily,
                    fontSize:    captionFontSize,
                    textShadow:  captionShadow === 'none' ? 'none' : SHADOW_PRESETS[captionShadow].value,
                    textTransform: captionUppercase ? 'uppercase' : 'none',
                  }}>
                    Así se ve
                  </p>
                </div>
              </div>

              {/* Posición */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#777' }}>Posición</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['top',    'Arriba',       '⬆️'],
                    ['chest',  'Pecho ✦',      '👕'],
                    ['center', 'Centro',       '➡️'],
                    ['bottom', 'Abajo',        '⬇️'],
                  ] as [CaptionPos, string, string][]).map(([pos, label]) => (
                    <button key={pos} onClick={() => setCaptionPos(pos)}
                      className="py-2 rounded-xl text-xs transition-all"
                      style={captionPos === pos
                        ? { background: '#7c3aed33', border: '1px solid #7c3aed66', color: '#c4b5fd', fontWeight: 700 }
                        : { background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#555' }}>
                      {label}
                    </button>
                  ))}
                </div>
                {captionPos === 'chest' && (
                  <p className="text-[9px] mt-1.5" style={{ color: '#444' }}>
                    ✦ Zona recomendada — los subs quedan en el pecho del presentador sin tapar la cara
                  </p>
                )}
              </div>

              <button onClick={() => setStep(3)}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#c13584)', color: '#fff' }}>
                Siguiente: B-Roll →
              </button>
            </div>
          )}

          {/* ══ STEP 3: B-Roll ══ */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold mb-0.5">🎬 B-Roll</h3>
                  <p className="text-xs" style={{ color: '#555' }}>Stock gratuito de Pexels · 5s por clip</p>
                </div>
                {assigned.length > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: '#22c55e22', border: '1px solid #22c55e44', color: '#4ade80' }}>
                    {assigned.length} clip{assigned.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Search bar */}
              <div className="flex gap-2">
                <input value={brollQ} onChange={e => setBrollQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchBroll()}
                  placeholder="ej: oficina, ciudad, laptop..."
                  className="flex-1 text-xs rounded-xl px-3 py-2 outline-none"
                  style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#ddd' }} />
                <button onClick={searchBroll} disabled={loadingBroll}
                  className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
                  style={{ background: '#7c3aed', color: '#fff' }}>
                  {loadingBroll ? '...' : '🔍'}
                </button>
              </div>

              {/* Assigned clips — timeline + controls */}
              {assigned.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
                  <div className="px-3 py-2 flex items-center justify-between" style={{ background: '#0f0f0f', borderBottom: '1px solid #1a1a1a' }}>
                    <span className="text-[10px] font-bold" style={{ color: '#c4b5fd' }}>Clips asignados</span>
                    <button onClick={() => setAssigned([])}
                      className="text-[9px] px-2 py-0.5 rounded-lg"
                      style={{ background: '#ef444415', color: '#f87171', border: '1px solid #ef444433' }}>
                      Limpiar todo
                    </button>
                  </div>

                  {/* Mini timeline visual */}
                  {duration > 0 && (
                    <div className="px-3 py-2.5" style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
                      <div className="relative h-3 rounded-full" style={{ background: '#1a1a1a' }}>
                        {assigned
                          .slice()
                          .sort((a, b) => a.startAt - b.startAt)
                          .map((c) => (
                            <div key={c.uid}
                              className="absolute top-0 h-full rounded-sm"
                              style={{
                                left:   `${Math.min((c.startAt / duration) * 100, 100)}%`,
                                width:  `${Math.min((c.duration / duration) * 100, 100 - (c.startAt / duration) * 100)}%`,
                                background: '#7c3aed',
                                minWidth: 3,
                              }} />
                          ))}
                        {/* playhead */}
                        <div className="absolute top-0 h-full w-0.5 bg-white/50"
                          style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
                      </div>
                      <p className="text-[9px] mt-1" style={{ color: '#333' }}>
                        Morado = B-Roll · Blanco = posición actual
                      </p>
                    </div>
                  )}

                  {/* Clip list with position slider */}
                  <div className="divide-y" style={{ borderColor: '#111' }}>
                    {assigned
                      .slice()
                      .sort((a, b) => a.startAt - b.startAt)
                      .map((c, i) => (
                        <div key={c.uid} className="p-3" style={{ background: '#0a0a0a' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <img src={c.thumbnail} alt="" className="w-7 h-10 object-cover rounded-lg shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-semibold" style={{ color: '#aaa' }}>
                                Clip {i + 1} · 5s
                              </p>
                              <p className="text-[9px]" style={{ color: '#555' }}>
                                {fmtTime(c.startAt)} → {fmtTime(c.startAt + 5)}
                              </p>
                            </div>
                            <button
                              onClick={() => setAssigned(prev => prev.filter(x => x.uid !== c.uid))}
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-sm shrink-0 transition-colors"
                              style={{ background: '#1a1a1a', color: '#555' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ef444420'; (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; (e.currentTarget as HTMLElement).style.color = '#555'; }}>
                              ×
                            </button>
                          </div>
                          {/* Position slider */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] w-6 text-right shrink-0" style={{ color: '#444' }}>0s</span>
                            <input type="range"
                              min={0} max={Math.max(0, duration - 5)} step={0.5}
                              value={c.startAt}
                              onChange={e => {
                                const val = +e.target.value;
                                setAssigned(prev => prev.map(x => x.uid === c.uid ? { ...x, startAt: val } : x));
                              }}
                              className="flex-1 accent-purple-500 h-1 cursor-pointer" />
                            <span className="text-[9px] w-8 shrink-0" style={{ color: '#444' }}>{fmtTime(duration)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Grid de resultados */}
              {brollResults.length > 0 ? (
                <div>
                  <p className="text-[10px] mb-2" style={{ color: '#444' }}>
                    Clic para agregar en la posición actual ({fmtTime(currentTime)})
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {brollResults.map(clip => {
                      const alreadyUsed = assigned.some(a => a.id === clip.id);
                      return (
                        <div key={clip.id}
                          onClick={() => addBroll(clip)}
                          className="relative rounded-xl overflow-hidden cursor-pointer group"
                          style={{ aspectRatio: '9/16', background: '#111', outline: alreadyUsed ? '2px solid #7c3aed' : 'none' }}>
                          <img src={clip.thumbnail} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-end p-1.5 opacity-0 group-hover:opacity-100 transition-all"
                            style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.85),transparent)' }}>
                            <div className="w-full py-1 rounded-lg text-center text-[9px] font-bold text-white"
                              style={{ background: '#7c3aed' }}>+ 5s</div>
                          </div>
                          {alreadyUsed && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                              style={{ background: '#22c55e', color: '#fff' }}>✓</div>
                          )}
                          {/* Label de duración */}
                          <div className="absolute bottom-1 left-1 text-[8px] px-1 py-0.5 rounded"
                            style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>5s</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: '#2a2a2a' }}>
                  <p className="text-3xl mb-2">🎞️</p>
                  <p className="text-xs">Buscá clips para intercalar</p>
                  {assigned.length > 0 && (
                    <p className="text-[10px] mt-1" style={{ color: '#444' }}>
                      Ya tenés {assigned.length} clip{assigned.length > 1 ? 's' : ''} asignado{assigned.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              <button onClick={() => setStep(4)}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#c13584)', color: '#fff' }}>
                Siguiente: Hook →
              </button>
            </div>
          )}

          {/* ══ STEP 4: Hook ══ */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold mb-0.5">🔥 Hook</h3>
                <p className="text-xs" style={{ color: '#555' }}>El texto que aparece en los primeros segundos</p>
              </div>

              {/* 3 fuentes del hook */}
              {(hookNatural || hookEnhanced) && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: '#444' }}>Fuente del hook</p>

                  {/* Opción: lo que dice el video */}
                  {hookNatural && (
                    <button
                      onClick={() => { setHookMode('natural'); setHookText(hookNatural); }}
                      className="w-full text-left p-3 rounded-xl transition-all"
                      style={hookMode === 'natural'
                        ? { background: '#7c3aed22', border: '1px solid #7c3aed66' }
                        : { background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: '#3b82f622', color: '#60a5fa', border: '1px solid #3b82f644' }}>
                          🎙️ LO QUE DICE
                        </span>
                        {hookMode === 'natural' && <span className="text-[9px] ml-auto" style={{ color: '#7c3aed' }}>● activo</span>}
                      </div>
                      <p className="text-xs font-black uppercase leading-snug"
                        style={{ color: hookMode === 'natural' ? '#FFE600' : '#888', fontFamily: 'Impact, sans-serif', letterSpacing: 0.5 }}>
                        {hookNatural}
                      </p>
                    </button>
                  )}

                  {/* Opción: versión mejorada por IA */}
                  {hookEnhanced && (
                    <button
                      onClick={() => { setHookMode('enhanced'); setHookText(hookEnhanced); }}
                      className="w-full text-left p-3 rounded-xl transition-all"
                      style={hookMode === 'enhanced'
                        ? { background: '#7c3aed22', border: '1px solid #7c3aed66' }
                        : { background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: '#22c55e22', color: '#4ade80', border: '1px solid #22c55e44' }}>
                          🤖 IA MEJORADO
                        </span>
                        {hookMode === 'enhanced' && <span className="text-[9px] ml-auto" style={{ color: '#7c3aed' }}>● activo</span>}
                      </div>
                      <p className="text-xs font-black uppercase leading-snug"
                        style={{ color: hookMode === 'enhanced' ? '#FFE600' : '#888', fontFamily: 'Impact, sans-serif', letterSpacing: 0.5 }}>
                        {hookEnhanced}
                      </p>
                    </button>
                  )}

                  {/* Opción: personalizado */}
                  <button
                    onClick={() => { setHookMode('custom'); }}
                    className="w-full text-left p-3 rounded-xl transition-all"
                    style={hookMode === 'custom'
                      ? { background: '#7c3aed22', border: '1px solid #7c3aed66' }
                      : { background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: '#f9731622', color: '#fb923c', border: '1px solid #f9731644' }}>
                        ✏️ PERSONALIZADO
                      </span>
                      {hookMode === 'custom'
                        ? <span className="text-[9px] ml-auto" style={{ color: '#7c3aed' }}>● activo</span>
                        : <span className="text-xs ml-1" style={{ color: '#444' }}>Escribí el tuyo propio →</span>}
                    </div>
                  </button>

                  {/* Textarea FUERA del botón para que el tipeo funcione */}
                  {hookMode === 'custom' && (
                    <textarea
                      value={hookText}
                      onChange={e => setHookText(e.target.value)}
                      placeholder="Ej: ¿CÓMO GANÉ $10,000 EN 30 DÍAS?"
                      rows={2}
                      autoFocus
                      className="w-full rounded-xl px-3 py-2.5 outline-none resize-none font-black uppercase"
                      style={{ background: '#0f0f0f', border: '1px solid #7c3aed66', color: '#FFE600',
                        fontSize: 13, lineHeight: 1.4, fontFamily: 'Impact, sans-serif', letterSpacing: 0.5 }} />
                  )}
                </div>
              )}

              {/* Si no hay datos de IA (video nuevo sin procesar) */}
              {!hookNatural && !hookEnhanced && (
                <textarea value={hookText} onChange={e => setHookText(e.target.value)}
                  placeholder={'Ej: ¿CÓMO GANÉ $10,000 EN 30 DÍAS?'}
                  rows={3} className="w-full rounded-xl px-3 py-2.5 outline-none resize-none font-black uppercase"
                  style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#FFE600', fontSize: 14,
                    lineHeight: 1.4, fontFamily: 'Impact, sans-serif', letterSpacing: 1 }} />
              )}

              {/* Estilo visual */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#777' }}>Estilo</p>
                <div className="flex gap-2">
                  {(Object.entries(HOOK_PRESETS) as [HookStyle, typeof HOOK_PRESETS[HookStyle]][]).map(([key, val]) => (
                    <button key={key} onClick={() => setHookStyle(key)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={hookStyle === key
                        ? { background: '#7c3aed33', border: '1px solid #7c3aed66', color: '#c4b5fd' }
                        : { background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#555' }}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Posición */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#777' }}>Posición</p>
                <div className="flex gap-2">
                  {([['top', 'Arriba'], ['center', 'Centro'], ['bottom', 'Abajo']] as [HookPos, string][]).map(([pos, label]) => (
                    <button key={pos} onClick={() => setHookPos(pos)}
                      className="flex-1 py-2 rounded-xl text-xs transition-all"
                      style={hookPos === pos
                        ? { background: '#7c3aed33', border: '1px solid #7c3aed66', color: '#c4b5fd' }
                        : { background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#555' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tamaño de fuente */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs" style={{ color: '#666' }}>Tamaño</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: '#111', color: '#c4b5fd' }}>{hookFontSize}px</span>
                </div>
                <input type="range" min={16} max={48} value={hookFontSize}
                  onChange={e => setHookFontSize(+e.target.value)}
                  className="w-full accent-purple-500 h-1.5 cursor-pointer" />
              </div>

              {/* Duración */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs" style={{ color: '#666' }}>Duración</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: '#111', color: '#c4b5fd' }}>{hookDur}s</span>
                </div>
                <input type="range" min={1} max={8} value={hookDur}
                  onChange={e => setHookDur(+e.target.value)}
                  className="w-full accent-purple-500 h-1.5 cursor-pointer" />
              </div>

              {/* Live preview */}
              {hookText && (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a', background: '#111', aspectRatio: '9/16', maxHeight: 160, display: 'flex', alignItems: hookPos === 'top' ? 'flex-start' : hookPos === 'bottom' ? 'flex-end' : 'center', justifyContent: 'center', padding: '16px 12px' }}>
                  <p className="text-center uppercase leading-tight"
                    style={{
                      fontSize: hookFontSize * 0.55,
                      color: HOOK_PRESETS[hookStyle].color,
                      textShadow: HOOK_PRESETS[hookStyle].shadow,
                      fontFamily: HOOK_PRESETS[hookStyle].family,
                      fontWeight: HOOK_PRESETS[hookStyle].weight,
                      background: HOOK_PRESETS[hookStyle].bg,
                      padding: HOOK_PRESETS[hookStyle].bg !== 'transparent' ? '4px 10px' : undefined,
                      borderRadius: HOOK_PRESETS[hookStyle].bg !== 'transparent' ? 6 : undefined,
                    }}>
                    {hookText}
                  </p>
                </div>
              )}

              <button onClick={() => setStep(5)}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#c13584)', color: '#fff' }}>
                Siguiente: Música →
              </button>
            </div>
          )}

          {/* ══ STEP 5: Música ══ */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold mb-0.5">🎵 Música</h3>
                  <p className="text-xs" style={{ color: '#555' }}>Libre de derechos · Pixabay Music</p>
                </div>
                {musicResults.length > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: '#22c55e22', border: '1px solid #22c55e44', color: '#4ade80' }}>
                    🤖 Auto
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {MUSIC_GENRES.map(g => (
                  <button key={g} onClick={() => { setMusicQ(g); setTimeout(searchMusic, 50); }}
                    className="px-2.5 py-1 rounded-full text-[10px] capitalize transition-all"
                    style={musicQ === g
                      ? { background: '#7c3aed33', border: '1px solid #7c3aed66', color: '#c4b5fd' }
                      : { background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#666' }}>
                    {g}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input value={musicQ} onChange={e => setMusicQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchMusic()}
                  placeholder="Busca música..."
                  className="flex-1 text-xs rounded-xl px-3 py-2 outline-none"
                  style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#ddd' }} />
                <button onClick={searchMusic} disabled={loadingMusic}
                  className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
                  style={{ background: '#7c3aed', color: '#fff' }}>
                  {loadingMusic ? '...' : '🔍'}
                </button>
              </div>

              {selectedTrack && (
                <div className="rounded-xl p-3" style={{ background: '#7c3aed11', border: '1px solid #7c3aed33' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">🎵</span>
                    <p className="text-xs font-semibold flex-1 truncate" style={{ color: '#c4b5fd' }}>{selectedTrack.title}</p>
                    <button onClick={() => setSelectedTrack(null)} className="text-xs" style={{ color: '#555' }}>×</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]" style={{ color: '#555' }}>🔈</span>
                    <input type="range" min={0} max={100} value={volume}
                      onChange={e => setVolume(+e.target.value)}
                      className="flex-1 accent-purple-500 h-1.5 cursor-pointer" />
                    <span className="text-[10px] font-mono w-7 text-right" style={{ color: '#666' }}>{volume}%</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                {musicResults.map(track => (
                  <div key={track.id}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                    style={selectedTrack?.id === track.id
                      ? { background: '#7c3aed22', border: '1px solid #7c3aed44' }
                      : { background: '#0f0f0f', border: '1px solid #1a1a1a' }}
                    onClick={() => setSelectedTrack(track)}>
                    <button onClick={e => { e.stopPropagation(); togglePreview(track); }}
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all"
                      style={{ background: previewing === track.id ? '#c13584' : '#1a1a1a' }}>
                      <span className="text-[10px]">{previewing === track.id ? '⏸' : '▶'}</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: '#ddd' }}>{track.title}</p>
                      <p className="text-[10px]" style={{ color: '#444' }}>by {track.user} · {fmtTime(track.duration)}</p>
                    </div>
                    {selectedTrack?.id === track.id && <span className="text-green-500 text-xs shrink-0">✓</span>}
                  </div>
                ))}

                {musicResults.length === 0 && (
                  <div className="text-center py-8" style={{ color: '#2a2a2a' }}>
                    <p className="text-3xl mb-2">🎵</p>
                    <p className="text-xs">Seleccioná un género o buscá</p>
                  </div>
                )}
              </div>

              <button onClick={handleExport}
                className="w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#c13584)', color: '#fff', boxShadow: '0 0 20px #7c3aed44' }}>
                ✨ Exportar video
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Hidden audio: preview de tracks */}
      <audio ref={audioRef} onEnded={() => setPreviewing(null)} />
      {/* Hidden audio: música de fondo durante playback */}
      <audio ref={bgMusicRef} loop />

      <style>{`
        @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.8;transform:scale(0.95)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>
    </div>
  );
}
