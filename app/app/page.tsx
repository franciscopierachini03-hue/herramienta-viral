'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProductNav from '../_components/ProductNav';

const VIRAL_PLATFORMS = [
  { id: 'youtube', label: 'YouTube Shorts', color: '#FF0000' },
  { id: 'tiktok', label: 'TikTok', color: '#69C9D0' },
  { id: 'instagram', label: 'Instagram', color: '#C13584' },
];

const SUGGESTIONS = ['fitness', 'dinero', 'motivación', 'recetas', 'negocios', 'éxito'];

type Video = {
  title: string;
  channel: string;
  views: string;
  likes: string;
  comments?: string;
  shares?: string;
  saves?: string;
  viewsRaw?: number;
  likesRaw?: number;
  commentsRaw?: number;
  sharesRaw?: number;
  savesRaw?: number;
  url?: string;
  thumbnail?: string;
  platform?: string;
  flag?: string;
  langLabel?: string;
  enriched?: boolean;
};

function parseViewCount(views: string): number {
  const v = views.replace(/,/g, '').toLowerCase().trim();
  if (v.includes('m')) return parseFloat(v) * 1_000_000;
  if (v.includes('k')) return parseFloat(v) * 1_000;
  return parseFloat(v) || 0;
}

type PlatformResults = { youtube: Video[]; tiktok: Video[]; instagram: Video[]; };
type PlatformErrors = { youtube: string; tiktok: string; instagram: string; };

type TranscriptResult = {
  url: string;
  platform: 'youtube' | 'tiktok' | 'instagram' | null;
  transcript: string;
  loading: boolean;
  isError: boolean;
};

type Guion = {
  id: string;
  name: string;
  url: string;
  platform: string;
  transcript: string;
  savedAt: string;
};

const PLATFORM_INFO = {
  youtube:   { label: 'YouTube',   color: '#FF0000', hint: null },
  tiktok:    { label: 'TikTok',    color: '#69C9D0', hint: 'Abre el video en TikTok → toca Compartir → Copiar enlace' },
  instagram: { label: 'Instagram', color: '#C13584', hint: 'Abre el reel → toca los 3 puntos → Copiar enlace' },
};

function friendlyError(raw: string): string {
  const e = raw.toLowerCase();
  if (e.includes('cupo') || e.includes('agotado') || e.includes('quota') || e.includes('exceeded')) {
    return 'Cupo mensual de la API agotado. Intenta mañana o contacta al soporte.';
  }
  if (e.includes('privado') || e.includes('private') || e.includes('not found') || e.includes('no encontrado') || e.includes('eliminado')) {
    return 'Este video es privado o fue eliminado. Prueba con un video público.';
  }
  if (e.includes('no reconoció') || e.includes('no válido') || e.includes('no se encontró')) {
    return 'No encontramos contenido en este link. Verifica que sea un video público.';
  }
  if (e.includes('conexión') || e.includes('connection') || e.includes('network') || e.includes('fetch')) {
    return 'Problema de conexión. Verifica tu internet e intenta de nuevo.';
  }
  if (e.includes('falta') && e.includes('key')) {
    return 'Error de configuración del servidor. Contacta al administrador.';
  }
  if (e.includes('youtube')) return 'No pudimos obtener este video de YouTube. Intenta con otro.';
  if (e.includes('tiktok')) return 'No pudimos obtener este video de TikTok. Intenta con otro.';
  if (e.includes('instagram')) return 'No pudimos obtener este reel de Instagram. Intenta con otro.';
  // Mostrar el error real para facilitar el diagnóstico
  return raw.replace(/^(tiktok|instagram|youtube):\s*/i, '');
}

function detectPlatform(url: string | undefined): 'youtube' | 'tiktok' | 'instagram' | null {
  if (!url || typeof url !== 'string') return null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  return null;
}

const PLAT_COLOR: Record<string, string> = { youtube: '#FF0000', tiktok: '#69C9D0', instagram: '#C13584' };
const PLAT_LABEL: Record<string, string> = { youtube: 'YouTube Shorts', tiktok: 'TikTok', instagram: 'Instagram' };
const PLAT_ICON: Record<string, string> = { youtube: '▶', tiktok: '♪', instagram: '◎' };

function proxyThumb(url: string | undefined, platform: string): string | undefined {
  if (!url) return undefined;
  if (platform === 'instagram') return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  return url;
}

function VideoCard({ v, rank, onTranscribir }: { v: Video; rank: number; onTranscribir: () => void }) {
  const plat = v.platform || 'youtube';
  const color = PLAT_COLOR[plat];
  const label = PLAT_LABEL[plat];
  const icon = PLAT_ICON[plat];

  return (
    <div
      className="group relative rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 cursor-pointer"
      style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #222' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color + '55')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#222')}
    >
      {/* Thumbnail */}
      <div className="relative w-full bg-gray-900 shrink-0" style={{ aspectRatio: '16/9' }}>
        {v.thumbnail
          ? <img src={proxyThumb(v.thumbnail, v.platform || 'youtube')} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-gray-700 text-4xl">{icon}</div>
        }
        {/* Gradient overlays */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 40%, transparent 100%)' }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${color}15 0%, transparent 60%)` }} />

        {/* Rank badge */}
        <span className="absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {rank}
        </span>

        {/* Platform badge */}
        <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', color, border: `1px solid ${color}40` }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
          {label}
        </span>

        {/* Language badge */}
        {v.flag && (
          <span className="absolute top-9 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', color: '#ccc', border: '1px solid rgba(255,255,255,0.1)' }}>
            {v.flag} {v.langLabel}
          </span>
        )}

        {/* Views bottom-left */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-white/90 flex items-center gap-1">
            <span className="opacity-60">👁</span> {v.views}
          </span>
          <span className="text-xs text-white/50 flex items-center gap-1">
            <span className="opacity-60">❤</span> {v.likes}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <a href={v.url} target="_blank" rel="noopener noreferrer">
          <p className="text-xs font-semibold leading-snug line-clamp-2 text-gray-200 group-hover:text-white transition-colors mb-1.5">
            {v.title}
          </p>
        </a>
        <p className="text-xs mb-3 truncate" style={{ color: '#555' }}>{v.channel}</p>
        <button
          onClick={onTranscribir}
          className="mt-auto w-full py-2 text-xs font-semibold rounded-xl transition-all duration-200"
          style={{ background: '#1a1a1a', border: `1px solid #2a2a2a`, color: '#aaa' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = color;
            (e.currentTarget as HTMLButtonElement).style.borderColor = color;
            (e.currentTarget as HTMLButtonElement).style.color = '#000';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a';
            (e.currentTarget as HTMLButtonElement).style.color = '#aaa';
          }}>
          Transcribir →
        </button>
      </div>
    </div>
  );
}

function VideoCardVertical({ v, rank, onTranscribir }: { v: Video; rank: number; onTranscribir: () => void }) {
  const plat = v.platform || 'youtube';
  const color = PLAT_COLOR[plat];

  return (
    <div className="relative rounded-xl overflow-hidden group transition-all duration-200 hover:scale-[1.02]"
      style={{ aspectRatio: '9/16', background: '#0a0a0a', border: '1px solid #1a1a1a' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color + '66')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a1a')}>

      {/* Click en el card → abrir video original */}
      {v.url && (
        <a href={v.url} target="_blank" rel="noopener noreferrer"
          className="absolute inset-0 z-[5]" aria-label="Ver video original" />
      )}

      {/* Thumbnail */}
      {v.thumbnail
        ? <img src={proxyThumb(v.thumbnail, v.platform || 'youtube')} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ pointerEvents: 'none' }} />
        : <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-3xl" style={{ pointerEvents: 'none' }}>▶</div>
      }

      {/* Icono play al hover */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
        <div className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <span className="text-white text-lg ml-0.5">▶</span>
        </div>
      </div>

      {/* Gradiente bottom */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 50%, rgba(0,0,0,0.92) 100%)' }} />

      {/* Rank badge top-left */}
      <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white z-20"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
        {rank}
      </span>

      {/* Plataforma dot + idioma top-right */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-20">
        {v.flag && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#ccc', backdropFilter: 'blur(4px)' }}>
            {v.flag}
          </span>
        )}
        <span className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-2 z-20">
        {/* Views */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
            👁 {v.views}
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
            ❤ {v.likes}
          </span>
          {plat === 'instagram' && v.enriched === false && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(255,200,0,0.18)', color: '#fbbf24', border: '1px solid rgba(255,200,0,0.3)' }}
              title="Las stats no fueron verificadas — el video se encontró pero no se obtuvo el like count exacto.">
              📊 stats pendientes
            </span>
          )}
        </div>

        {/* Transcribir btn — encima del link del card */}
        <button onClick={e => { e.preventDefault(); e.stopPropagation(); onTranscribir(); }}
          className="w-full py-1.5 rounded-lg text-[10px] font-bold text-white transition-all duration-200 opacity-0 group-hover:opacity-100 relative z-30"
          style={{ background: `${color}bb`, backdropFilter: 'blur(6px)', border: `1px solid ${color}88` }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = color; (e.currentTarget as HTMLButtonElement).style.color = '#000'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}bb`; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}>
          Transcribir →
        </button>
      </div>
    </div>
  );
}

function fmtNum(n: number): string {
  if (!n || isNaN(n)) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return n.toLocaleString('es');
}

function engagementPct(v: Video): number {
  const views = v.viewsRaw || 0;
  const likes = v.likesRaw || 0;
  if (!views) return 0;
  return (likes / views) * 100;
}

// Score compuesto para el sort "Mejores": pondera vistas y engagement.
// log(vistas) evita que un video viejo con muchas vistas pero poco engagement gane todo.
function bestScore(v: Video): number {
  const views = v.viewsRaw || 0;
  const likes = v.likesRaw || 0;
  const comments = v.commentsRaw || 0;
  if (!views) return 0;
  const eng = (likes + comments * 3) / views; // comentarios pesan 3×
  return Math.log10(views + 1) * (1 + eng * 50);
}

function AnalyzeCard({ v, rank, onTranscribir }: { v: Video; rank: number; onTranscribir: () => void }) {
  const plat = v.platform || 'youtube';
  const color = PLAT_COLOR[plat];
  const eng = engagementPct(v);

  return (
    <div
      className="group relative rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-0.5"
      style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color + '66')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1f1f1f')}>
      {/* Thumbnail clickeable */}
      <a href={v.url} target="_blank" rel="noopener noreferrer"
        className="relative block w-full bg-gray-900 shrink-0" style={{ aspectRatio: '9/16' }}>
        {v.thumbnail
          ? <img src={proxyThumb(v.thumbnail, plat)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-3xl">{PLAT_ICON[plat]}</div>
        }
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.85) 100%)' }} />
        {/* Rank */}
        <span className="absolute top-2 left-2 min-w-7 h-7 px-2 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: rank <= 3 ? color : 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', boxShadow: rank <= 3 ? `0 0 10px ${color}88` : 'none' }}>
          #{rank}
        </span>
        {/* Engagement badge top-right */}
        {eng > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{
              background: eng >= 5 ? '#22c55e22' : eng >= 2 ? '#eab30822' : 'rgba(0,0,0,0.7)',
              color: eng >= 5 ? '#4ade80' : eng >= 2 ? '#facc15' : '#aaa',
              border: `1px solid ${eng >= 5 ? '#22c55e44' : eng >= 2 ? '#eab30844' : '#333'}`,
              backdropFilter: 'blur(4px)',
            }}>
            ⚡ {eng.toFixed(1)}%
          </span>
        )}
        {/* Play hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <span className="text-white text-xl ml-0.5">▶</span>
          </div>
        </div>
      </a>

      {/* Stats grid */}
      <div className="p-3 flex flex-col gap-2">
        <p className="text-[11px] font-semibold leading-snug line-clamp-2 text-gray-200" title={v.title}>
          {v.title}
        </p>

        {/* Stats principales */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="rounded-lg py-1.5" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
            <div className="text-[9px]" style={{ color: '#555' }}>VISTAS</div>
            <div className="text-[11px] font-bold text-white">{v.views}</div>
          </div>
          <div className="rounded-lg py-1.5" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
            <div className="text-[9px]" style={{ color: '#555' }}>LIKES</div>
            <div className="text-[11px] font-bold text-white">{v.likes}</div>
          </div>
          <div className="rounded-lg py-1.5" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
            <div className="text-[9px]" style={{ color: '#555' }}>COMENT</div>
            <div className="text-[11px] font-bold text-white">{v.comments || '0'}</div>
          </div>
        </div>

        {/* Stats extra TikTok */}
        {plat === 'tiktok' && (v.shares || v.saves) && (
          <div className="grid grid-cols-2 gap-1 text-center">
            <div className="rounded-lg py-1" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
              <span className="text-[9px]" style={{ color: '#555' }}>↗ </span>
              <span className="text-[10px] font-bold text-white">{v.shares || '0'}</span>
            </div>
            <div className="rounded-lg py-1" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
              <span className="text-[9px]" style={{ color: '#555' }}>🔖 </span>
              <span className="text-[10px] font-bold text-white">{v.saves || '0'}</span>
            </div>
          </div>
        )}

        <button onClick={onTranscribir}
          className="mt-1 w-full py-1.5 text-[10px] font-bold rounded-lg transition-all"
          style={{ background: '#1a1a1a', border: `1px solid #2a2a2a`, color: '#aaa' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = color; (e.currentTarget as HTMLButtonElement).style.color = '#000'; (e.currentTarget as HTMLButtonElement).style.borderColor = color; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'; (e.currentTarget as HTMLButtonElement).style.color = '#aaa'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a'; }}>
          Transcribir →
        </button>
      </div>
    </div>
  );
}

function autoName(url: string, transcript: string): string {
  const words = transcript
    .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ]/gi, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 7)
    .join(' ');
  if (words.length > 15) return words;
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '') + ' — ' + u.pathname.split('/').filter(Boolean).pop()?.slice(0, 30);
  } catch {
    return 'Guión ' + new Date().toLocaleDateString('es-MX');
  }
}

export default function Home() {
  const [tab, setTab] = useState('transcribir');

  // Transcribir
  const [urlsText, setUrlsText] = useState('');
  const [results, setResults] = useState<TranscriptResult[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set());

  // Virales
  const [tema, setTema] = useState('');
  const [virales, setVirales] = useState<PlatformResults>({ youtube: [], tiktok: [], instagram: [] });
  const [loadingV, setLoadingV] = useState(false);
  const [errors, setErrors] = useState<PlatformErrors>({ youtube: '', tiktok: '', instagram: '' });
  const [viralTab, setViralTab] = useState<'all' | 'youtube' | 'tiktok' | 'instagram'>('all');

  // Analizar
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState<{ channel: { name: string; thumbnail?: string; platform: string }; videos: Video[] } | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [analyzeSort, setAnalyzeSort] = useState<'best' | 'viewsRaw' | 'likesRaw' | 'commentsRaw' | 'sharesRaw' | 'savesRaw' | 'engagement'>('best');
  const [analyzeTopN, setAnalyzeTopN] = useState<10 | 25 | 50 | 100 | 0>(25); // 0 = todos
  const [analyzeMinViews, setAnalyzeMinViews] = useState<number>(0);

  async function analizarPerfil() {
    if (!analyzeUrl || loadingA) return;
    setLoadingA(true);
    setAnalyzeResult(null);
    setAnalyzeError('');
    try {
      const res = await fetch('/api/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: analyzeUrl }),
      });
      const data = await res.json();
      if (data.error) setAnalyzeError(data.error);
      else setAnalyzeResult(data);
    } catch {
      setAnalyzeError('Error de conexión');
    }
    setLoadingA(false);
  }

  // Traducir
  const [translateModal, setTranslateModal] = useState<{ text: string } | null>(null);
  const [translateLang, setTranslateLang] = useState('ingles');
  const [translateResult, setTranslateResult] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translateCopied, setTranslateCopied] = useState(false);

  // Guardar con idioma
  const [saveModal, setSaveModal] = useState<{ idx: number } | null>(null);
  const [savingEs, setSavingEs] = useState(false);

  // Biblioteca
  const [guiones, setGuiones] = useState<Guion[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('guiones');
      if (saved) setGuiones(JSON.parse(saved));
    } catch {}
  }, []);

  // ── Transcribir (multi-URL) ──────────────────────────────
  async function transcribirTodos(overrideUrl?: string) {
    const text = overrideUrl ?? urlsText;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    if (lines.length === 0) return;

    if (overrideUrl) {
      setUrlsText(overrideUrl);
      setTab('transcribir');
    }

    setIsTranscribing(true);
    setSavedIdx(new Set());
    setResults(lines.map(url => ({
      url,
      platform: detectPlatform(url),
      transcript: '',
      loading: true,
      isError: false,
    })));

    for (let i = 0; i < lines.length; i++) {
      const url = lines[i];
      const platform = detectPlatform(url);
      if (!platform) {
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, loading: false, isError: true, transcript: 'URL no válida' } : r
        ));
        continue;
      }
      try {
        const res = await fetch('/api/transcribir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, platform }),
        });
        const data = await res.json();
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, loading: false, isError: !!data.error, transcript: data.texto || data.error || 'Sin resultado' } : r
        ));
      } catch {
        setResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, loading: false, isError: true, transcript: 'Error de conexión' } : r
        ));
      }
    }
    setIsTranscribing(false);
  }

  // ── Biblioteca ──────────────────────────────────────────
  function guardarGuion(idx: number) {
    const r = results[idx];
    if (!r?.transcript || r.transcript.startsWith('❌')) return;
    const guion: Guion = {
      id: Date.now().toString(),
      name: autoName(r.url, r.transcript),
      url: r.url,
      platform: r.platform ?? 'unknown',
      transcript: r.transcript,
      savedAt: new Date().toISOString(),
    };
    const updated = [guion, ...guiones];
    setGuiones(updated);
    localStorage.setItem('guiones', JSON.stringify(updated));
    setSavedIdx(prev => new Set([...prev, idx]));
  }

  async function guardarEnEspanol(idx: number) {
    const r = results[idx];
    if (!r?.transcript) return;
    setSavingEs(true);
    try {
      const res = await fetch('/api/traducir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: r.transcript, idioma: 'espanol' }),
      });
      const data = await res.json();
      const textoEs = data.traduccion || r.transcript;
      const guion: Guion = {
        id: Date.now().toString(),
        name: autoName(r.url, textoEs),
        url: r.url,
        platform: r.platform ?? 'unknown',
        transcript: textoEs,
        savedAt: new Date().toISOString(),
      };
      const updated = [guion, ...guiones];
      setGuiones(updated);
      localStorage.setItem('guiones', JSON.stringify(updated));
      setSavedIdx(prev => new Set([...prev, idx]));
    } finally {
      setSavingEs(false);
      setSaveModal(null);
    }
  }

  function eliminarGuion(id: string) {
    const updated = guiones.filter(g => g.id !== id);
    setGuiones(updated);
    localStorage.setItem('guiones', JSON.stringify(updated));
    if (expandedId === id) setExpandedId(null);
  }

  function renameGuion(id: string, name: string) {
    const updated = guiones.map(g => g.id === id ? { ...g, name } : g);
    setGuiones(updated);
    localStorage.setItem('guiones', JSON.stringify(updated));
  }

  async function traducirTexto() {
    if (!translateModal?.text || translating) return;
    setTranslating(true);
    setTranslateResult('');
    setTranslateCopied(false);
    try {
      const res = await fetch('/api/traducir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: translateModal.text, idioma: translateLang }),
      });
      const data = await res.json();
      setTranslateResult(data.traduccion || (data.error ? '🔒' : 'Sin resultado'));
    } catch {
      setTranslateResult('🔒');
    }
    setTranslating(false);
  }

  function borrarTodo() {
    setGuiones([]);
    localStorage.removeItem('guiones');
    setConfirmDeleteAll(false);
  }

  // ── Virales ─────────────────────────────────────────────
  const [loadingMsg, setLoadingMsg] = useState('');

  async function buscarVirales() {
    if (!tema) return;
    setLoadingV(true);
    setLoadingMsg('Analizando el tema con IA...');
    setVirales({ youtube: [], tiktok: [], instagram: [] });
    setErrors({ youtube: '', tiktok: '', instagram: '' });

    const plataformas = ['youtube', 'tiktok', 'instagram'] as const;

    // Mensajes progresivos mientras espera
    const msgs = [
      'Generando keywords con IA...',
      'Buscando en YouTube Shorts...',
      'Buscando en TikTok...',
      'Buscando en Instagram Reels...',
      'Filtrando los más virales...',
      'Casi listo...',
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, msgs.length - 1);
      setLoadingMsg(msgs[msgIdx]);
    }, 4000);

    const resultados = await Promise.all(
      plataformas.map(p =>
        fetch('/api/virales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tema, platform: p }),
        }).then(r => r.json()).catch(() => ({ error: 'Error de conexión' }))
      )
    );

    clearInterval(msgInterval);

    const newVirales = { youtube: [] as Video[], tiktok: [] as Video[], instagram: [] as Video[] };
    const newErrors = { youtube: '', tiktok: '', instagram: '' };
    plataformas.forEach((p, i) => {
      if (resultados[i].error) newErrors[p] = resultados[i].error;
      else newVirales[p] = resultados[i].videos || [];
    });

    setVirales(newVirales);
    setErrors(newErrors);
    setLoadingV(false);
    setLoadingMsg('');
  }

  // ── Helpers UI ───────────────────────────────────────────
  const urlLines = urlsText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  const multiMode = urlLines.length > 1;
  const singlePlatform = urlLines.length === 1 ? detectPlatform(urlLines[0]) : null;
  const doneCount = results.filter(r => !r.loading).length;

  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-20">

      {/* Header */}
      <ProductNav active="viral" />

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
        {[
          { id: 'transcribir', label: '⚡ Transcribir' },
          { id: 'virales',     label: '🔥 Virales' },
          { id: 'analizar',    label: '🔍 Analizar' },
          { id: 'biblioteca',  label: `📚 Guiones${guiones.length > 0 ? ` · ${guiones.length}` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
            style={tab === t.id
              ? { background: 'linear-gradient(135deg, #7c3aed33, #c1358433)', color: '#e2e2e2', border: '1px solid #7c3aed44', boxShadow: '0 0 12px #7c3aed22' }
              : { background: 'transparent', color: '#444', border: '1px solid transparent' }
            }>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TRANSCRIBIR ══════════════════════════════════════ */}
      {tab === 'transcribir' && (
        <div>
          <p className="text-xs text-gray-500 mb-3">
            Pega uno o varios links (uno por línea) — detectamos la plataforma automáticamente
          </p>

          {/* Platform indicator */}
          <div className="flex gap-2 mb-4 min-h-8 items-center flex-wrap">
            {multiMode ? (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-gray-700 text-gray-400">
                {urlLines.length} links — se transcribirán uno por uno
              </span>
            ) : singlePlatform ? (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-white text-white">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: PLATFORM_INFO[singlePlatform].color }}></span>
                {PLATFORM_INFO[singlePlatform].label} detectado ✓
              </span>
            ) : (
              <>
                {(['youtube', 'tiktok', 'instagram'] as const).map(p => (
                  <span key={p} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-gray-800 text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: PLATFORM_INFO[p].color }}></span>
                    {PLATFORM_INFO[p].label}
                  </span>
                ))}
              </>
            )}
          </div>

          {/* Hint */}
          {singlePlatform && PLATFORM_INFO[singlePlatform].hint && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 mb-3 text-xs text-gray-400">
              💡 {PLATFORM_INFO[singlePlatform].hint}
            </div>
          )}

          {/* URL Input */}
          <textarea
            value={urlsText}
            onChange={e => { setUrlsText(e.target.value); setResults([]); setSavedIdx(new Set()); }}
            placeholder={'Pega aquí el link de YouTube, TikTok o Instagram...\n\nPara transcribir varios a la vez, pon un link por línea.'}
            rows={multiMode ? Math.min(urlLines.length + 2, 8) : 3}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-500 resize-none mb-3 font-mono"
          />

          <button
            onClick={() => transcribirTodos()}
            disabled={isTranscribing || urlLines.length === 0}
            className="w-full py-2.5 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors mb-6">
            {isTranscribing
              ? `Procesando ${doneCount}/${results.length}...`
              : urlLines.length > 1
                ? `Transcribir ${urlLines.length} videos`
                : 'Transcribir'}
          </button>

          {/* Results */}
          <div className="flex flex-col gap-4">
            {results.map((r, idx) => {
              const p = r.platform;
              const isSaved = savedIdx.has(idx);
              const isError = r.isError;
              return (
                <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    {p ? (
                      <span className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border"
                        style={{ borderColor: PLATFORM_INFO[p].color + '80', color: PLATFORM_INFO[p].color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: PLATFORM_INFO[p].color }}></span>
                        {PLATFORM_INFO[p].label}
                      </span>
                    ) : (
                      <span className="text-xs text-red-400 shrink-0">Desconocido</span>
                    )}
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-gray-600 truncate hover:text-gray-400 flex-1">
                      {r.url}
                    </a>
                  </div>

                  {/* Transcript */}
                  <div className="min-h-14 text-sm leading-relaxed whitespace-pre-wrap mb-3">
                    {r.loading ? (
                      <span className="animate-pulse" style={{ color: '#555' }}>Transcribiendo...</span>
                    ) : isError ? (
                      <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: '#111', border: '1px solid #2a2a2a' }}>
                        <span className="text-lg shrink-0">🔒</span>
                        <p className="text-xs leading-relaxed" style={{ color: '#888' }}>
                          {friendlyError(r.transcript)}
                        </p>
                      </div>
                    ) : (
                      <span style={{ color: '#d1d5db' }}>{r.transcript || 'Sin resultado'}</span>
                    )}
                  </div>

                  {/* Actions */}
                  {!r.loading && !isError && r.transcript && (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => navigator.clipboard.writeText(r.transcript)}
                        className="px-3 py-1.5 text-xs border border-gray-700 rounded-lg hover:border-gray-500 hover:text-white text-gray-400 transition-all">
                        📋 Copiar
                      </button>
                      <button
                        onClick={() => { setTranslateModal({ text: r.transcript }); setTranslateResult(''); setTranslateCopied(false); }}
                        className="px-3 py-1.5 text-xs border border-gray-700 rounded-lg hover:border-purple-500 hover:text-purple-300 text-gray-400 transition-all">
                        🌍 Traducir
                      </button>
                      <button
                        onClick={() => isSaved ? null : setSaveModal({ idx })}
                        disabled={isSaved}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                          isSaved
                            ? 'border-green-800 text-green-400'
                            : 'border-gray-700 hover:border-white hover:text-white text-gray-400'
                        }`}>
                        {isSaved ? '✅ Guardado' : '📚 Guardar'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ BUSCAR VIRALES ═══════════════════════════════════ */}
      {tab === 'virales' && (
        <div>
          {/* Suggestions */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => setTema(s)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                style={{ background: tema === s ? '#7c3aed33' : '#111', border: tema === s ? '1px solid #7c3aed66' : '1px solid #1f1f1f', color: tema === s ? '#c4b5fd' : '#555' }}>
                {s}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative mb-6">
            <div className="flex gap-2 p-1 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid #1f1f1f' }}>
              <input value={tema} onChange={e => setTema(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarVirales()}
                placeholder="¿Qué tema quieres dominar? (fitness, dinero, negocios...)"
                className="flex-1 bg-transparent px-4 py-3 text-sm outline-none"
                style={{ color: '#e2e2e2' }} />
              <button onClick={buscarVirales} disabled={loadingV}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40"
                style={{ background: loadingV ? '#333' : 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', minWidth: '100px' }}>
                {loadingV ? '...' : '🔍 Buscar'}
              </button>
            </div>
          </div>

          {loadingV && (
            <div className="text-center py-12">
              <div className="inline-flex flex-col items-center gap-3">
                <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl text-sm" style={{ background: '#111', border: '1px solid #7c3aed44', color: '#c4b5fd' }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7c3aed' }}></span>
                  {loadingMsg || 'Analizando el tema con IA...'}
                </div>
                <p className="text-xs" style={{ color: '#444' }}>La búsqueda profunda puede tomar hasta 30 segundos</p>
              </div>
            </div>
          )}

          {!loadingV && virales.youtube.length === 0 && virales.tiktok.length === 0 && virales.instagram.length === 0
            && !errors.youtube && !errors.tiktok && !errors.instagram && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🔥</p>
              <p className="text-sm" style={{ color: '#444' }}>Escribe un tema y descubre qué está arrasando</p>
              <p className="text-xs mt-1" style={{ color: '#333' }}>YouTube Shorts + TikTok + Instagram Reels</p>
            </div>
          )}

          {/* Tabs por plataforma con marca visual */}
          {!loadingV && (virales.youtube.length > 0 || virales.tiktok.length > 0 || virales.instagram.length > 0 || errors.youtube || errors.tiktok || errors.instagram) && (() => {
            const counts = {
              all: virales.youtube.length + virales.tiktok.length + virales.instagram.length,
              youtube: virales.youtube.length,
              tiktok: virales.tiktok.length,
              instagram: virales.instagram.length,
            };
            const tabs = [
              { id: 'all',       label: 'Todos',     icon: '✦', color: '#7c3aed', count: counts.all },
              { id: 'youtube',   label: 'YouTube',   icon: '▶', color: '#FF0000', count: counts.youtube },
              { id: 'tiktok',    label: 'TikTok',    icon: '◆', color: '#69C9D0', count: counts.tiktok },
              { id: 'instagram', label: 'Instagram', icon: '◉', color: '#E1306C', count: counts.instagram },
            ] as const;

            return (
              <div className="flex flex-wrap gap-2 mb-6">
                {tabs.map(t => {
                  const active = viralTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setViralTab(t.id as typeof viralTab)}
                      className="group flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={active
                        ? { background: `${t.color}1f`, color: t.color, border: `1px solid ${t.color}55`, boxShadow: `0 0 0 1px ${t.color}22` }
                        : { background: '#0f0f0f', color: '#666', border: '1px solid #1a1a1a' }}>
                      <span style={{ color: active ? t.color : '#555' }}>{t.icon}</span>
                      <span>{t.label}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                        style={active
                          ? { background: `${t.color}33`, color: t.color }
                          : { background: '#1a1a1a', color: '#555' }}>
                        {t.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Vista TODOS — secciones por plataforma con header branded */}
          {!loadingV && viralTab === 'all' && (
            <div className="flex flex-col gap-10">
              {VIRAL_PLATFORMS.map(p => {
                const videos = virales[p.id as keyof PlatformResults];
                const error  = errors[p.id as keyof PlatformErrors];
                if (videos.length === 0 && !error) return null;

                return (
                  <section key={p.id}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-1 h-7 rounded-full" style={{ background: p.color, boxShadow: `0 0 12px ${p.color}66` }}></span>
                      <h2 className="text-lg font-bold tracking-tight" style={{ color: '#fff' }}>{p.label}</h2>
                      {videos.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: `${p.color}1a`, color: p.color, border: `1px solid ${p.color}33` }}>
                          {videos.length} {videos.length === 1 ? 'video' : 'videos'}
                        </span>
                      )}
                    </div>
                    {error ? (
                      <div className="flex items-center gap-2 rounded-xl p-3 text-xs" style={{ background: '#111', border: '1px solid #222', color: '#666' }}>
                        <span>🔒</span> {friendlyError(error)}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {videos.map((v, i) => (
                          <VideoCardVertical key={i} v={v} rank={i + 1} onTranscribir={() => transcribirTodos(v.url)} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {/* Vista de plataforma única — grid más amplio */}
          {!loadingV && viralTab !== 'all' && (() => {
            const p = VIRAL_PLATFORMS.find(x => x.id === viralTab)!;
            const videos = virales[viralTab];
            const error  = errors[viralTab];
            return (
              <section>
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-1.5 h-9 rounded-full" style={{ background: p.color, boxShadow: `0 0 16px ${p.color}88` }}></span>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight" style={{ color: '#fff' }}>{p.label}</h2>
                    <p className="text-xs mt-0.5" style={{ color: '#555' }}>
                      {videos.length > 0 ? `Top ${videos.length} más virales` : error ? 'Error al cargar' : 'Sin resultados'}
                    </p>
                  </div>
                </div>
                {error ? (
                  <div className="flex items-center gap-2 rounded-xl p-3 text-xs" style={{ background: '#111', border: '1px solid #222', color: '#666' }}>
                    <span>🔒</span> {friendlyError(error)}
                  </div>
                ) : videos.length === 0 ? (
                  <div className="text-center py-12 text-gray-600 text-sm">No se encontraron videos en {p.label} para este tema.</div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {videos.map((v, i) => (
                      <VideoCardVertical key={i} v={v} rank={i + 1} onTranscribir={() => transcribirTodos(v.url)} />
                    ))}
                  </div>
                )}
              </section>
            );
          })()}
        </div>
      )}

      {/* ══ BIBLIOTECA ═══════════════════════════════════════ */}
      {tab === 'biblioteca' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-medium">Mis guiones</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {guiones.length === 0 ? 'Vacía' : `${guiones.length} guion${guiones.length !== 1 ? 'es' : ''} guardado${guiones.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            {guiones.length > 0 && (
              confirmDeleteAll ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">¿Borrar todo?</span>
                  <button onClick={borrarTodo} className="text-xs px-2 py-1 bg-red-900 border border-red-700 rounded text-red-300 hover:bg-red-800">Sí, borrar</button>
                  <button onClick={() => setConfirmDeleteAll(false)} className="text-xs px-2 py-1 border border-gray-700 rounded text-gray-400 hover:text-white">Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteAll(true)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">
                  Borrar todo
                </button>
              )
            )}
          </div>

          {guiones.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <p className="text-5xl mb-4">📚</p>
              <p className="text-sm text-gray-500">Aún no tienes guiones guardados</p>
              <p className="text-xs text-gray-600 mt-2 max-w-xs mx-auto leading-relaxed">
                Transcribe un video y haz clic en <strong className="text-gray-500">&ldquo;Guardar en biblioteca&rdquo;</strong> para verlo aquí
              </p>
              <button onClick={() => setTab('transcribir')} className="mt-5 px-4 py-2 border border-gray-700 rounded-lg text-xs text-gray-400 hover:border-gray-500 hover:text-white transition-all">
                Ir a Transcribir →
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {guiones.map(g => {
                const isExpanded = expandedId === g.id;
                const isEditing = editingId === g.id;
                const info = PLATFORM_INFO[g.platform as keyof typeof PLATFORM_INFO];
                const platColor = info?.color ?? '#888';
                const platLabel = info?.label ?? g.platform;
                const date = new Date(g.savedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

                return (
                  <div key={g.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                    {/* Header row */}
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            autoFocus
                            defaultValue={g.name}
                            onBlur={e => { renameGuion(g.id, e.target.value || g.name); setEditingId(null); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                renameGuion(g.id, (e.target as HTMLInputElement).value || g.name);
                                setEditingId(null);
                              }
                            }}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-sm font-medium outline-none focus:border-gray-400"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingId(g.id)}
                            className="text-sm font-medium text-left hover:text-gray-300 transition-colors group w-full truncate"
                            title="Clic para renombrar">
                            {g.name}
                            <span className="ml-1.5 text-gray-700 group-hover:text-gray-500 text-xs">✎</span>
                          </button>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: platColor }}></span>
                          <span className="text-xs text-gray-600">{platLabel} · {date}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => eliminarGuion(g.id)}
                        className="text-gray-700 hover:text-red-400 transition-colors text-xl leading-none shrink-0 ml-1"
                        title="Eliminar">
                        ×
                      </button>
                    </div>

                    {/* Transcript preview */}
                    <div className="text-xs text-gray-400 leading-relaxed mt-3 mb-3">
                      {isExpanded ? (
                        <p className="text-gray-300 whitespace-pre-wrap text-sm">{g.transcript}</p>
                      ) : (
                        <p>
                          {g.transcript.slice(0, 180)}
                          {g.transcript.length > 180 && <span className="text-gray-600"> …</span>}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : g.id)}
                        className="px-3 py-1.5 text-xs border border-gray-700 rounded-lg hover:border-gray-500 text-gray-400 hover:text-white transition-all">
                        {isExpanded ? 'Ver menos ↑' : 'Ver completo ↓'}
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(g.transcript)}
                        className="px-3 py-1.5 text-xs border border-gray-700 rounded-lg hover:border-gray-500 text-gray-400 hover:text-white transition-all">
                        📋 Copiar guión
                      </button>
                      {g.url && (
                        <a href={g.url} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs border border-gray-700 rounded-lg hover:border-gray-500 text-gray-400 hover:text-white transition-all">
                          Ver video ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      </div>

      {/* ══ ANALIZAR PERFIL ══════════════════════════════════ */}
      {tab === 'analizar' && (
        <div className="max-w-3xl mx-auto px-6 pb-20">
          <p className="text-xs mb-5" style={{ color: '#555' }}>
            Pega el link de cualquier perfil y te mostramos sus videos ordenados por vistas
          </p>

          {/* Input */}
          <div className="flex gap-2 p-1 rounded-2xl mb-6" style={{ background: '#0f0f0f', border: '1px solid #1f1f1f' }}>
            <input
              value={analyzeUrl}
              onChange={e => { setAnalyzeUrl(e.target.value); setAnalyzeResult(null); setAnalyzeError(''); }}
              onKeyDown={e => e.key === 'Enter' && analizarPerfil()}
              placeholder="youtube.com/@MrBeast · tiktok.com/@khaby.lame · instagram.com/cristiano"
              className="flex-1 bg-transparent px-4 py-3 text-sm outline-none"
              style={{ color: '#e2e2e2' }}
            />
            <button onClick={analizarPerfil} disabled={loadingA || !analyzeUrl}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40"
              style={{ background: loadingA ? '#333' : 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', minWidth: '100px' }}>
              {loadingA ? '...' : '🔍 Analizar'}
            </button>
          </div>

          {/* Plataformas soportadas */}
          {!analyzeResult && !loadingA && !analyzeError && (
            <div className="flex gap-3 mb-8">
              {[
                { color: '#FF0000', label: 'YouTube', note: 'Top 100 videos' },
                { color: '#69C9D0', label: 'TikTok', note: 'Top 50 videos' },
                { color: '#C13584', label: 'Instagram', note: 'Top 50 reels' },
              ].map((p, i) => (
                <div key={i} className="flex-1 rounded-2xl p-4 text-center" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                  <span className="w-2 h-2 rounded-full inline-block mb-2" style={{ background: p.color }}></span>
                  <p className="text-xs font-semibold text-white">{p.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#444' }}>{p.note}</p>
                </div>
              ))}
            </div>
          )}

          {/* Loading */}
          {loadingA && (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl text-sm" style={{ background: '#111', border: '1px solid #1f1f1f', color: '#666' }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7c3aed' }}></span>
                Analizando perfil...
              </div>
            </div>
          )}

          {/* Error */}
          {analyzeError && (
            <div className="flex items-center gap-3 rounded-2xl p-4 text-sm" style={{ background: '#111', border: '1px solid #222', color: '#666' }}>
              <span className="text-xl">🔒</span>
              <p className="text-xs leading-relaxed">{friendlyError(analyzeError)}</p>
            </div>
          )}

          {/* Results */}
          {analyzeResult && (() => {
            const plat = analyzeResult.channel.platform;
            const allVideos = analyzeResult.videos;

            // Stats agregadas del perfil
            const totalViews = allVideos.reduce((s, v) => s + (v.viewsRaw || 0), 0);
            const totalLikes = allVideos.reduce((s, v) => s + (v.likesRaw || 0), 0);
            const totalComments = allVideos.reduce((s, v) => s + (v.commentsRaw || 0), 0);
            const avgViews = allVideos.length ? totalViews / allVideos.length : 0;
            const avgEngagement = totalViews ? (totalLikes / totalViews) * 100 : 0;
            const topVideo = [...allVideos].sort((a, b) => (b.viewsRaw || 0) - (a.viewsRaw || 0))[0];
            const maxViewsInSet = Math.max(...allVideos.map(v => v.viewsRaw || 0), 1);

            const SORT_OPTIONS = [
              { key: 'best',        label: '✨ Mejores',      available: true },
              { key: 'viewsRaw',    label: '👁 Vistas',       available: true },
              { key: 'likesRaw',    label: '❤ Likes',         available: true },
              { key: 'commentsRaw', label: '💬 Comentarios',  available: true },
              { key: 'engagement',  label: '⚡ Engagement',   available: true },
              { key: 'sharesRaw',   label: '↗ Compartidos',   available: plat === 'tiktok' },
              { key: 'savesRaw',    label: '🔖 Guardados',    available: plat === 'tiktok' },
            ].filter(o => o.available);

            // Filtrar por mínimo de vistas
            const filtered = allVideos.filter(v => (v.viewsRaw || 0) >= analyzeMinViews);

            // Ordenar
            const sorted = [...filtered].sort((a, b) => {
              if (analyzeSort === 'engagement') return engagementPct(b) - engagementPct(a);
              if (analyzeSort === 'best') return bestScore(b) - bestScore(a);
              return ((b[analyzeSort as keyof Video] as number) || 0) - ((a[analyzeSort as keyof Video] as number) || 0);
            });

            // Top N
            const display = analyzeTopN === 0 ? sorted : sorted.slice(0, analyzeTopN);

            return (
              <div>
                {/* Channel header */}
                <div className="flex items-center gap-3 mb-4 p-4 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                  {analyzeResult.channel.thumbnail && (
                    <img src={analyzeResult.channel.thumbnail} alt="" className="w-12 h-12 rounded-full" />
                  )}
                  <div>
                    <p className="text-base font-bold">{analyzeResult.channel.name}</p>
                    <p className="text-xs" style={{ color: '#555' }}>{allVideos.length} videos analizados</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: '#1a1a1a' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: PLAT_COLOR[plat] }}></span>
                    <span className="text-xs font-semibold" style={{ color: PLAT_COLOR[plat] }}>{PLAT_LABEL[plat]}</span>
                  </div>
                </div>

                {/* Stats panel */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
                  {[
                    { label: 'Vistas totales',   value: fmtNum(totalViews),    icon: '👁', color: '#7c3aed' },
                    { label: 'Likes totales',    value: fmtNum(totalLikes),    icon: '❤', color: '#ef4444' },
                    { label: 'Promedio vistas',  value: fmtNum(avgViews),      icon: '📊', color: '#22c55e' },
                    { label: 'Engagement avg',   value: avgEngagement.toFixed(2) + '%', icon: '⚡', color: '#eab308' },
                  ].map((s, i) => (
                    <div key={i} className="rounded-2xl p-3" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span style={{ color: s.color }}>{s.icon}</span>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: '#555' }}>{s.label}</span>
                      </div>
                      <div className="text-lg font-bold text-white">{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Mejor video destacado */}
                {topVideo && (
                  <div className="mb-5 p-3 rounded-2xl flex items-center gap-3"
                    style={{ background: 'linear-gradient(135deg, #7c3aed11, #c1358411)', border: '1px solid #7c3aed33' }}>
                    {topVideo.thumbnail && (
                      <img src={proxyThumb(topVideo.thumbnail, plat)} alt="" className="w-14 h-14 rounded-xl object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#a78bfa' }}>🏆 Más viral del perfil</div>
                      <p className="text-xs font-semibold truncate text-white">{topVideo.title}</p>
                      <p className="text-[10px]" style={{ color: '#888' }}>
                        {topVideo.views} vistas · {topVideo.likes} likes · {engagementPct(topVideo).toFixed(2)}% engagement
                      </p>
                    </div>
                    {topVideo.url && (
                      <a href={topVideo.url} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0"
                        style={{ background: '#7c3aed', color: '#fff' }}>
                        Ver →
                      </a>
                    )}
                  </div>
                )}

                {/* Filtros: Sort + Top N + Min views */}
                <div className="rounded-2xl p-4 mb-5 flex flex-col gap-4" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                  {/* Sort */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#555' }}>Ordenar por</p>
                    <div className="flex gap-2 flex-wrap">
                      {SORT_OPTIONS.map(opt => (
                        <button key={opt.key}
                          onClick={() => setAnalyzeSort(opt.key as typeof analyzeSort)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                          style={analyzeSort === opt.key
                            ? { background: '#7c3aed33', border: '1px solid #7c3aed66', color: '#c4b5fd' }
                            : { background: '#111', border: '1px solid #1f1f1f', color: '#666' }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Top N */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#555' }}>Mostrar</p>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { n: 10,  label: 'Top 10' },
                        { n: 25,  label: 'Top 25' },
                        { n: 50,  label: 'Top 50' },
                        { n: 100, label: 'Top 100' },
                        { n: 0,   label: 'Todos' },
                      ].map(opt => (
                        <button key={opt.n}
                          onClick={() => setAnalyzeTopN(opt.n as typeof analyzeTopN)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                          style={analyzeTopN === opt.n
                            ? { background: '#22c55e22', border: '1px solid #22c55e55', color: '#86efac' }
                            : { background: '#111', border: '1px solid #1f1f1f', color: '#666' }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Min views slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#555' }}>Vistas mínimas</p>
                      <p className="text-xs font-bold" style={{ color: analyzeMinViews > 0 ? '#facc15' : '#444' }}>
                        {analyzeMinViews === 0 ? 'sin filtro' : '≥ ' + fmtNum(analyzeMinViews)}
                      </p>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={maxViewsInSet}
                      step={Math.max(1, Math.floor(maxViewsInSet / 100))}
                      value={analyzeMinViews}
                      onChange={e => setAnalyzeMinViews(parseInt(e.target.value))}
                      className="w-full"
                      style={{ accentColor: '#7c3aed' }}
                    />
                    <div className="flex justify-between text-[9px] mt-1" style={{ color: '#444' }}>
                      <span>0</span>
                      <span>{fmtNum(maxViewsInSet)}</span>
                    </div>
                  </div>
                </div>

                {/* Resumen del filtro aplicado */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs" style={{ color: '#666' }}>
                    Mostrando <span className="font-bold text-white">{display.length}</span> de <span className="text-gray-500">{allVideos.length}</span> videos
                  </p>
                  {(analyzeMinViews > 0 || analyzeTopN !== 25 || analyzeSort !== 'best') && (
                    <button
                      onClick={() => { setAnalyzeMinViews(0); setAnalyzeTopN(25); setAnalyzeSort('best'); }}
                      className="text-[10px] px-2 py-1 rounded-lg transition-all"
                      style={{ background: '#111', border: '1px solid #222', color: '#888' }}>
                      ↺ Reset filtros
                    </button>
                  )}
                </div>

                {/* Grid de cards con stats completas */}
                {display.length === 0 ? (
                  <div className="text-center py-12 text-sm" style={{ color: '#555' }}>
                    Ningún video pasa el filtro. Bajá el mínimo de vistas o cambiá el sort.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {display.map((v, i) => (
                      <AnalyzeCard key={i} v={v} rank={i + 1} onTranscribir={() => transcribirTodos(v.url)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══ MODAL TRADUCIR ═══════════════════════════════════ */}
      {translateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setTranslateModal(null); }}>
          <div className="w-full max-w-lg rounded-3xl flex flex-col max-h-[85vh]"
            style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #222' }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
              <div>
                <h2 className="text-sm font-bold">🌍 Traducir guión</h2>
                <p className="text-xs mt-0.5" style={{ color: '#555' }}>Selecciona el idioma destino</p>
              </div>
              <button onClick={() => setTranslateModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors hover:bg-white/10"
                style={{ color: '#555' }}>×</button>
            </div>

            {/* Language selector */}
            <div className="px-5 py-4">
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { id: 'ingles',    flag: '🇺🇸', label: 'Inglés' },
                  { id: 'portugues', flag: '🇧🇷', label: 'Portugués' },
                  { id: 'espanol',   flag: '🇲🇽', label: 'Español' },
                  { id: 'frances',   flag: '🇫🇷', label: 'Francés' },
                ].map(lang => (
                  <button key={lang.id}
                    onClick={() => { setTranslateLang(lang.id); setTranslateResult(''); setTranslateCopied(false); }}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all duration-200 text-center"
                    style={translateLang === lang.id
                      ? { background: '#7c3aed33', border: '1px solid #7c3aed66', color: '#c4b5fd' }
                      : { background: '#111', border: '1px solid #1f1f1f', color: '#555' }}>
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="text-xs font-semibold">{lang.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={traducirTexto}
                disabled={translating}
                className="w-full py-3 rounded-2xl text-sm font-bold transition-all duration-200 disabled:opacity-50"
                style={{ background: translating ? '#1a1a1a' : 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', border: 'none' }}>
                {translating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full animate-pulse bg-white/60"></span>
                    Traduciendo...
                  </span>
                ) : '✨ Traducir ahora'}
              </button>
            </div>

            {/* Result */}
            {(translating || translateResult) && (
              <div className="px-5 pb-5 flex-1 overflow-y-auto">
                <div className="rounded-2xl p-4 min-h-24" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                  {translating ? (
                    <p className="text-xs animate-pulse" style={{ color: '#555' }}>Generando traducción...</p>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#d1d5db' }}>
                      {translateResult}
                    </p>
                  )}
                </div>

                {!translating && translateResult && !translateResult.startsWith('❌') && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(translateResult); setTranslateCopied(true); setTimeout(() => setTranslateCopied(false), 2000); }}
                    className="mt-3 w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={translateCopied
                      ? { background: '#16a34a22', border: '1px solid #16a34a44', color: '#4ade80' }
                      : { background: '#111', border: '1px solid #222', color: '#888' }}>
                    {translateCopied ? '✅ Copiado!' : '📋 Copiar traducción'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL GUARDAR ═══════════════════════════════════ */}
      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSaveModal(null); }}>
          <div className="w-full max-w-sm rounded-3xl p-5 flex flex-col gap-4"
            style={{ background: '#0d0d0d', border: '1px solid #222' }}>

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold">📚 Guardar guión</h2>
                <p className="text-xs mt-0.5" style={{ color: '#555' }}>¿En qué idioma lo guardamos?</p>
              </div>
              <button onClick={() => setSaveModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors hover:bg-white/10"
                style={{ color: '#555' }}>×</button>
            </div>

            {/* Options */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { guardarGuion(saveModal.idx); setSaveModal(null); }}
                className="w-full py-3 px-4 rounded-2xl text-sm font-medium text-left flex items-center gap-3 transition-all"
                style={{ background: '#111', border: '1px solid #222', color: '#ccc' }}>
                <span className="text-xl">📄</span>
                <div>
                  <div className="font-semibold text-white text-xs">Idioma original</div>
                  <div className="text-xs" style={{ color: '#555' }}>Guardar tal como está</div>
                </div>
              </button>

              <button
                onClick={() => guardarEnEspanol(saveModal.idx)}
                disabled={savingEs}
                className="w-full py-3 px-4 rounded-2xl text-sm font-medium text-left flex items-center gap-3 transition-all disabled:opacity-50"
                style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#c4b5fd' }}>
                <span className="text-xl">🇲🇽</span>
                <div>
                  <div className="font-semibold text-xs" style={{ color: '#c4b5fd' }}>
                    {savingEs ? 'Traduciendo...' : 'Guardar en español'}
                  </div>
                  <div className="text-xs" style={{ color: '#7c3aed99' }}>Traduce y guarda en español</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
