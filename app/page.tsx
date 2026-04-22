'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

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
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
            👁 {v.views}
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
            ❤ {v.likes}
          </span>
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
  const [viralView, setViralView] = useState<'unified' | 'platforms'>('unified');

  // Analizar
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState<{ channel: { name: string; thumbnail?: string; platform: string }; videos: Video[] } | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [analyzeSort, setAnalyzeSort] = useState<'viewsRaw' | 'likesRaw' | 'commentsRaw' | 'sharesRaw' | 'savesRaw'>('viewsRaw');

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
  async function buscarVirales() {
    if (!tema) return;
    setLoadingV(true);
    setVirales({ youtube: [], tiktok: [], instagram: [] });
    setErrors({ youtube: '', tiktok: '', instagram: '' });

    const plataformas = ['youtube', 'tiktok', 'instagram'] as const;
    const resultados = await Promise.all(
      plataformas.map(p =>
        fetch('/api/virales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tema, platform: p }),
        }).then(r => r.json())
      )
    );

    const newVirales = { youtube: [] as Video[], tiktok: [] as Video[], instagram: [] as Video[] };
    const newErrors = { youtube: '', tiktok: '', instagram: '' };
    plataformas.forEach((p, i) => {
      if (resultados[i].error) newErrors[p] = resultados[i].error;
      else newVirales[p] = resultados[i].videos || [];
    });

    setVirales(newVirales);
    setErrors(newErrors);
    setLoadingV(false);
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
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', boxShadow: '0 0 20px #7c3aed55' }}>
            🧬
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">ViralADN</h1>
            <p className="text-xs" style={{ color: '#555' }}>Descifra el ADN del contenido viral</p>
          </div>
        </div>

        {/* Product switcher */}
        <div className="flex items-center gap-1 p-1 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
          <div className="px-4 py-2 rounded-xl text-xs font-bold cursor-default"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 12px #7c3aed44' }}>
            🧬 ViralADN
          </div>
          <Link href="/editor"
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200"
            style={{ color: '#555' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            ✂️ TOPCUT
          </Link>
          <Link href="/guiones"
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200"
            style={{ color: '#555' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = '#1a1a1a'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            ✍️ Guiones
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }}></span>
          <span className="text-xs" style={{ color: '#555' }}>En vivo</span>
        </div>
      </div>

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
                        onClick={() => guardarGuion(idx)}
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
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl text-sm" style={{ background: '#111', border: '1px solid #1f1f1f', color: '#666' }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7c3aed' }}></span>
                Buscando en YouTube, TikTok e Instagram...
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

          {/* Toggle de vista */}
          {!loadingV && (virales.youtube.length > 0 || virales.tiktok.length > 0 || virales.instagram.length > 0) && (
            <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
              <button
                onClick={() => setViralView('unified')}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={viralView === 'unified' ? { background: '#7c3aed33', color: '#c4b5fd', border: '1px solid #7c3aed44' } : { color: '#444', border: '1px solid transparent' }}>
                🔀 Unificado
              </button>
              <button
                onClick={() => setViralView('platforms')}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={viralView === 'platforms' ? { background: '#7c3aed33', color: '#c4b5fd', border: '1px solid #7c3aed44' } : { color: '#444', border: '1px solid transparent' }}>
                Por plataforma
              </button>
            </div>
          )}

          {/* Vista UNIFICADA */}
          {!loadingV && viralView === 'unified' && (() => {
            const all = [
              ...virales.youtube,
              ...virales.tiktok,
              ...virales.instagram,
            ]
              .sort((a, b) => (b.viewsRaw ?? parseViewCount(b.views)) - (a.viewsRaw ?? parseViewCount(a.views)))
              .slice(0, 20);

            const platformColor: Record<string, string> = { youtube: '#FF0000', tiktok: '#69C9D0', instagram: '#C13584' };
            const platformLabel: Record<string, string> = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };

            return (
              <div>
                {/* Errores de plataformas */}
                {Object.entries(errors).filter(([, e]) => e).map(([p, e]) => (
                  <div key={p} className="flex items-center gap-2 rounded-xl p-3 mb-3 text-xs" style={{ background: '#111', border: '1px solid #222', color: '#666' }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PLAT_COLOR[p] }}></span>
                    <span style={{ color: PLAT_COLOR[p] }} className="font-semibold shrink-0">{platformLabel[p]}</span>
                    <span>{friendlyError(e)}</span>
                  </div>
                ))}

                {all.length > 0 && (
                  <>
                    <p className="text-xs text-gray-600 mb-3">Top {all.length} videos más virales — ordenados por vistas</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {all.map((v, i) => (
                        <VideoCardVertical key={i} v={v} rank={i + 1} onTranscribir={() => transcribirTodos(v.url)} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Vista POR PLATAFORMA */}
          {!loadingV && viralView === 'platforms' && VIRAL_PLATFORMS.map(p => {
            const videos = virales[p.id as keyof PlatformResults];
            const error = errors[p.id as keyof PlatformErrors];
            if (videos.length === 0 && !error) return (
              <div key={p.id} className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: p.color }}></span>
                  <h2 className="text-sm font-semibold" style={{ color: '#444' }}>{p.label} — Sin resultados</h2>
                </div>
                <div className="flex items-center gap-2 rounded-xl p-3 text-xs" style={{ background: '#111', border: '1px solid #1a1a1a', color: '#555' }}>
                  <span>⚠️</span> No se encontraron videos para este tema en {p.label}.
                </div>
              </div>
            );
            return (
              <div key={p.id} className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: p.color }}></span>
                  <h2 className="text-sm font-semibold">{p.label} — Top {videos.length}</h2>
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
              </div>
            );
          })}
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
            const SORT_OPTIONS = [
              { key: 'viewsRaw',    label: '👁 Vistas',      available: true },
              { key: 'likesRaw',    label: '❤ Likes',        available: true },
              { key: 'commentsRaw', label: '💬 Comentarios', available: true },
              { key: 'sharesRaw',   label: '↗ Compartidos',  available: plat === 'tiktok' },
              { key: 'savesRaw',    label: '🔖 Guardados',   available: plat === 'tiktok' },
            ].filter(o => o.available);

            const sorted = [...analyzeResult.videos]
              .sort((a, b) => ((b[analyzeSort as keyof Video] as number) || 0) - ((a[analyzeSort as keyof Video] as number) || 0));

            return (
              <div>
                {/* Channel header */}
                <div className="flex items-center gap-3 mb-5 p-4 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                  {analyzeResult.channel.thumbnail && (
                    <img src={analyzeResult.channel.thumbnail} alt="" className="w-10 h-10 rounded-full" />
                  )}
                  <div>
                    <p className="text-sm font-bold">{analyzeResult.channel.name}</p>
                    <p className="text-xs" style={{ color: '#555' }}>{analyzeResult.videos.length} videos analizados</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: '#1a1a1a' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: PLAT_COLOR[plat] }}></span>
                    <span className="text-xs" style={{ color: PLAT_COLOR[plat] }}>{PLAT_LABEL[plat]}</span>
                  </div>
                </div>

                {/* Sort selector */}
                <div className="mb-5">
                  <p className="text-xs mb-2" style={{ color: '#444' }}>Ordenar por</p>
                  <div className="flex gap-2 flex-wrap">
                    {SORT_OPTIONS.map(opt => (
                      <button key={opt.key}
                        onClick={() => setAnalyzeSort(opt.key as typeof analyzeSort)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                        style={analyzeSort === opt.key
                          ? { background: '#7c3aed33', border: '1px solid #7c3aed66', color: '#c4b5fd' }
                          : { background: '#111', border: '1px solid #1f1f1f', color: '#555' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid vertical estilo Reels */}
                <div className="grid grid-cols-3 gap-1.5">
                  {sorted.map((v, i) => (
                    <VideoCardVertical key={i} v={v} rank={i + 1} onTranscribir={() => transcribirTodos(v.url)} />
                  ))}
                </div>
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

    </main>
  );
}
