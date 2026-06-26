'use client';

// Teleprompter — pegás tu guion y la letra baja sola mientras hablás a cámara.
// Todo pasa en TU navegador: no hay API ni costo. Controlás tamaño y velocidad
// en vivo, podés espejar el texto (para vidrio/beam-splitter) y ponerlo a
// pantalla completa. Guion y ajustes quedan guardados en este equipo.
// Hub & spoke: el header ProductNav vuelve al Home para cambiar de herramienta.

import { useEffect, useRef, useState } from 'react';
import ProductNav from '../_components/ProductNav';

const TOOL = '#f97316';
const TOOL_GRAD = 'linear-gradient(135deg, #f97316, #ef4444)';
const PANEL = { background: '#0d0d16', border: '1px solid #1b1b27', borderRadius: 16 };

const SIZE_MIN = 24, SIZE_MAX = 160;
const VEL_MIN = 10, VEL_MAX = 400; // px por segundo

const EJEMPLO = `Hola, hoy te voy a contar las 3 cosas que cambiaron mi forma de grabar a cámara.

La primera: dejá de improvisar. Un guion claro te hace sonar seguro y te ahorra mil tomas.

La segunda: mirá al lente, no a la pantalla. La conexión se siente del otro lado.

Y la tercera: practicá el primer segundo como si fuera el único. Ese gancho decide si te ven o te saltan.

Si te sirvió, guardalo para volver a verlo cuando vayas a grabar.`;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Junta varios guiones en un solo texto para el teleprompter. El nombre va como
// rótulo entre 〔 〕 (señal visual de "esto no se lee") y los guiones se separan
// con un hueco grande.
const juntarGuiones = (items: { name?: string; transcript: string }[]) =>
  items
    .map(g => {
      const titulo = (g.name || '').trim();
      const cuerpo = (g.transcript || '').trim();
      return titulo ? `〔 ${titulo} 〕\n\n${cuerpo}` : cuerpo;
    })
    .filter(Boolean)
    .join('\n\n\n');

export default function TeleprompterPage() {
  const [texto, setTexto] = useState('');
  const [fontSize, setFontSize] = useState(64);
  const [velocidad, setVelocidad] = useState(70); // px/s
  const [playing, setPlaying] = useState(false);
  const [espejo, setEspejo] = useState(false);
  const [editar, setEditar] = useState(true);
  const [fs, setFs] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef(0);              // posición de scroll (float, suave)
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  // ── Cámara + grabación ──
  const [camara, setCamara] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [pidiendo, setPidiendo] = useState(false);
  const [camError, setCamError] = useState('');
  const [grabando, setGrabando] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState('video/webm');
  const [streamTick, setStreamTick] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tInicioRef = useRef(0);
  const tIntervalRef = useRef<number | null>(null);

  // ── Importar guiones de la biblioteca (ViralADN) ──
  const [importerOpen, setImporterOpen] = useState(false);
  const [bibCargando, setBibCargando] = useState(false);
  const [bibError, setBibError] = useState('');
  const [bibGuiones, setBibGuiones] = useState<{ id: string; name: string; transcript: string; platform: string; savedAt?: string }[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());

  // ── Persistencia (guion + ajustes) ──
  useEffect(() => {
    // Ajustes (tamaño/velocidad/espejo) + texto guardado en este equipo.
    let savedTexto: string | null = null;
    try {
      const raw = localStorage.getItem('teleprompter.v1');
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.fontSize === 'number') setFontSize(clamp(d.fontSize, SIZE_MIN, SIZE_MAX));
        if (typeof d.velocidad === 'number') setVelocidad(clamp(d.velocidad, VEL_MIN, VEL_MAX));
        if (typeof d.espejo === 'boolean') setEspejo(d.espejo);
        if (typeof d.texto === 'string') savedTexto = d.texto;
      }
    } catch { /* ignore */ }

    // ¿Llegaron guiones desde ViralADN? Tienen prioridad sobre lo guardado.
    try {
      const imp = sessionStorage.getItem('teleprompter.import');
      if (imp) {
        sessionStorage.removeItem('teleprompter.import');
        const items = JSON.parse(imp);
        if (Array.isArray(items) && items.length) { setTexto(juntarGuiones(items)); return; }
      }
    } catch { /* ignore */ }

    setTexto(savedTexto != null ? savedTexto : EJEMPLO);
  }, []);
  useEffect(() => {
    try { localStorage.setItem('teleprompter.v1', JSON.stringify({ texto, fontSize, velocidad, espejo })); }
    catch { /* ignore */ }
  }, [texto, fontSize, velocidad, espejo]);

  // ── Loop de scroll (requestAnimationFrame, independiente del framerate) ──
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null; lastRef.current = null;
      return;
    }
    function tick(t: number) {
      const el = scrollRef.current;
      if (!el) { rafRef.current = requestAnimationFrame(tick); return; }
      if (lastRef.current == null) lastRef.current = t;
      const dt = (t - lastRef.current) / 1000;
      lastRef.current = t;
      posRef.current += velocidad * dt;
      const max = el.scrollHeight - el.clientHeight;
      if (posRef.current >= max) {
        el.scrollTop = max;
        posRef.current = max;
        setPlaying(false);          // llegó al final → frena solo
        return;
      }
      el.scrollTop = posRef.current;
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null; lastRef.current = null;
    };
  }, [playing, velocidad]);

  // Si el usuario scrollea a mano (con pausa), respetamos esa posición.
  function onScroll() {
    if (!playing && scrollRef.current) posRef.current = scrollRef.current.scrollTop;
  }

  function reiniciar() {
    posRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setPlaying(false);
  }

  // ── Atajos de teclado: barra = play/pausa, ↑/↓ = velocidad ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(p => !p); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setVelocidad(v => clamp(v + 10, VEL_MIN, VEL_MAX)); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setVelocidad(v => clamp(v - 10, VEL_MIN, VEL_MAX)); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Pantalla completa ──
  function toggleFs() {
    const el = stageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }
  useEffect(() => {
    function onFs() { setFs(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ── Cámara del dispositivo (modo grabación) ──
  async function pedirCamara(face: 'user' | 'environment' = facing) {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCamError('Este navegador no permite usar la cámara.'); return;
    }
    setPidiendo(true); setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face }, audio: true });
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = stream;
      setFacing(face); setCamara(true); setStreamTick(t => t + 1);
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setCamError(
        name === 'NotAllowedError' ? 'Diste que no al permiso. Activá la cámara desde el candado 🔒 de la barra del navegador.'
          : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'No encontramos una cámara en este equipo.'
            : 'No se pudo abrir la cámara. Probá de nuevo.',
      );
    } finally { setPidiendo(false); }
  }

  function cerrarCamara() {
    pararGrabacion();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamara(false);
  }

  function girarCamara() { pedirCamara(facing === 'user' ? 'environment' : 'user'); }

  // Conectar el stream al <video> cuando se prende o cambia la cámara.
  useEffect(() => {
    const v = videoRef.current;
    if (camara && v && streamRef.current) { v.srcObject = streamRef.current; v.play?.().catch(() => {}); }
  }, [camara, streamTick]);

  // ── Grabación (MediaRecorder). El video sale LIMPIO, sin el texto encima. ──
  function mejorMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    const m = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    return m.find(x => MediaRecorder.isTypeSupported?.(x)) || '';
  }

  function grabar() {
    const stream = streamRef.current;
    if (!stream) return;
    if (videoURL) { URL.revokeObjectURL(videoURL); setVideoURL(null); }
    chunksRef.current = [];
    const mime = mejorMime();
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
    catch { rec = new MediaRecorder(stream); }
    rec.ondataavailable = e => { if (e.data?.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const tipo = chunksRef.current[0]?.type || mime || 'video/webm';
      setVideoMime(tipo);
      setVideoURL(URL.createObjectURL(new Blob(chunksRef.current, { type: tipo })));
    };
    rec.start();
    recRef.current = rec;
    setGrabando(true); setTiempo(0);
    tInicioRef.current = performance.now();
    tIntervalRef.current = window.setInterval(
      () => setTiempo(Math.floor((performance.now() - tInicioRef.current) / 1000)), 250);
    setPlaying(true); // arranca a bajar el texto al mismo tiempo
  }

  function pararGrabacion() {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
    recRef.current = null;
    if (tIntervalRef.current) { clearInterval(tIntervalRef.current); tIntervalRef.current = null; }
    setGrabando(false); setPlaying(false);
  }

  // Apagar cámara/timer al salir de la página.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (tIntervalRef.current) clearInterval(tIntervalRef.current);
  }, []);

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const videoExt = videoMime.includes('mp4') ? 'mp4' : 'webm';

  // ── Importar guiones guardados (lee la biblioteca de ViralADN) ──
  async function abrirImportador() {
    setImporterOpen(true); setBibError(''); setSel(new Set()); setBibCargando(true);
    try {
      const res = await fetch('/api/biblioteca', { cache: 'no-store' });
      if (res.status === 401) {
        setBibGuiones([]); setBibError('Iniciá sesión en ViralADN para ver tus guiones guardados.');
      } else {
        const d = await res.json();
        const gs = (d.guiones || []) as typeof bibGuiones;
        setBibGuiones(gs);
        if (!gs.length) setBibError('Todavía no tenés guiones guardados en ViralADN.');
      }
    } catch { setBibError('No se pudieron cargar tus guiones. Probá de nuevo.'); }
    setBibCargando(false);
  }

  function toggleSel(id: string) {
    setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function importarSeleccion(modo: 'reemplazar' | 'agregar') {
    const elegidos = bibGuiones.filter(g => sel.has(g.id));
    if (!elegidos.length) return;
    const txt = juntarGuiones(elegidos);
    setTexto(prev => (modo === 'agregar' && prev.trim() ? `${prev.trim()}\n\n\n${txt}` : txt));
    setImporterOpen(false);
    setEditar(true);
    reiniciar();
  }

  const palabras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  const maskImg = camara
    ? 'linear-gradient(to bottom, transparent 24%, #000 40%, #000 60%, transparent 76%)'
    : 'linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)';

  const iconBtn = 'rounded-xl flex items-center justify-center transition-all select-none';
  const ghost = { background: '#13131d', border: '1px solid #26263400', color: '#e7e7ee' } as const;

  return (
    <main className="min-h-screen text-white px-6 py-8"
      style={{ background: 'radial-gradient(ellipse 90% 45% at 25% 0%, #3a1505 0%, transparent 60%), radial-gradient(ellipse 70% 35% at 85% 8%, #3a0a0a 0%, transparent 55%), #070710' }}>
      <div className="max-w-5xl mx-auto">
        <ProductNav active="teleprompter" />

        <div className="rounded-2xl px-5 py-3 mb-6 text-sm" style={{ ...PANEL, color: '#b4b4c0' }}>
          🎬 <b>Teleprompter</b> — pegá tu guion, dale <b>play</b> y la letra baja sola mientras hablás a cámara.
          Ajustá <b>tamaño</b> y <b>velocidad</b> en vivo, espejá el texto si usás vidrio y poné <b>pantalla completa</b>.
          También podés <b>📷 usar la cámara</b>: te ves a vos con el texto bajando en el centro y grabás ahí mismo.
          <span style={{ color: '#71717a' }}> (barra espaciadora = play/pausa · ↑/↓ = velocidad)</span>
        </div>

        {/* ── Guion ── */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button onClick={() => setEditar(e => !e)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: '#13131d', border: '1px solid #26263a', color: '#c4b5fd' }}>
              {editar ? '▾ Ocultar guion' : '▸ Editar guion'}
            </button>
            <button onClick={abrirImportador}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 12px #7c3aed33' }}>
              📚 Importar mis guiones
            </button>
          </div>
          {editar && (
            <div className="rounded-2xl p-3" style={PANEL}>
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder="Pegá acá tu guion…"
                spellCheck={false}
                className="w-full resize-y rounded-xl px-4 py-3 text-sm outline-none"
                style={{ minHeight: 150, background: '#08080f', border: '1px solid #1f1f2b', color: '#e7e7ee', lineHeight: 1.6 }}
              />
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-xs" style={{ color: '#71717a' }}>{palabras} palabra{palabras === 1 ? '' : 's'}</span>
                <button onClick={() => { setTexto(''); reiniciar(); }}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                  style={{ background: '#13131d', border: '1px solid #26263a', color: '#a1a1aa' }}>
                  Limpiar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Controles (tamaño + velocidad en vivo) ── */}
        <div className="rounded-2xl p-4 mb-4 grid gap-4 sm:grid-cols-2" style={PANEL}>
          <label className="block">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold" style={{ color: '#c4b5fd' }}>🔠 Tamaño de letra</span>
              <span className="text-xs font-mono" style={{ color: '#a1a1aa' }}>{fontSize}px</span>
            </div>
            <input type="range" min={SIZE_MIN} max={SIZE_MAX} step={2} value={fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
              className="w-full" style={{ accentColor: TOOL }} />
          </label>
          <label className="block">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold" style={{ color: '#c4b5fd' }}>⚡ Velocidad</span>
              <span className="text-xs font-mono" style={{ color: '#a1a1aa' }}>{velocidad}px/s</span>
            </div>
            <input type="range" min={VEL_MIN} max={VEL_MAX} step={5} value={velocidad}
              onChange={e => setVelocidad(Number(e.target.value))}
              className="w-full" style={{ accentColor: TOOL }} />
          </label>
        </div>

        {/* ── Cámara ── */}
        <div className="rounded-2xl p-3 mb-4 flex items-center gap-2 flex-wrap" style={PANEL}>
          {!camara ? (
            <button onClick={() => pedirCamara()} disabled={pidiendo}
              className="text-sm font-bold px-3.5 py-2 rounded-xl transition-all"
              style={{ background: TOOL_GRAD, color: '#fff', opacity: pidiendo ? 0.6 : 1, boxShadow: `0 0 14px ${TOOL}44` }}>
              {pidiendo ? '⏳ Abriendo…' : '📷 Usar la cámara'}
            </button>
          ) : (
            <>
              <span className="text-xs font-bold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                style={{ background: '#0c1f14', border: '1px solid #14532d', color: '#86efac' }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} /> Cámara activa
              </span>
              <button onClick={girarCamara}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{ background: '#13131d', border: '1px solid #26263a', color: '#e7e7ee' }}>🔄 Girar</button>
              <button onClick={cerrarCamara}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{ background: '#13131d', border: '1px solid #3a1d1d', color: '#fca5a5' }}>✕ Cerrar cámara</button>
            </>
          )}
          <span className="text-xs" style={{ color: '#71717a' }}>— el video se graba limpio (sin el texto encima).</span>
          {camError && <span className="text-xs w-full" style={{ color: '#fca5a5' }}>⚠️ {camError}</span>}
        </div>

        {/* ── Escenario ── */}
        <div ref={stageRef} className="relative overflow-hidden rounded-2xl"
          style={{ background: '#000', border: '1px solid #1b1b27', height: fs ? '100vh' : '60vh' }}>

          {/* Cámara de fondo (modo grabación) */}
          {camara && (
            <video ref={videoRef} autoPlay muted playsInline
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'cover', transform: 'scaleX(-1)' }} />
          )}

          {/* Oscurecido central para que el texto se lea sobre el video */}
          {camara && (
            <div className="pointer-events-none absolute inset-x-0 z-10"
              style={{ top: '30%', height: '40%', background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.55) 50%, transparent)' }} />
          )}

          {/* Indicador de grabación */}
          {grabando && (
            <div className="absolute top-3 left-3 z-40 flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(10,10,18,0.7)', border: '1px solid #3a1d1d' }}>
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
              <span className="text-xs font-mono font-bold" style={{ color: '#fca5a5' }}>REC {mmss(tiempo)}</span>
            </div>
          )}

          {/* Línea guía de lectura */}
          <div className="pointer-events-none absolute left-0 right-0 z-30" style={{ top: camara ? '50%' : '38%' }}>
            <div style={{ height: 2, background: `${TOOL}55` }} />
            <div className="absolute" style={{ left: 8, top: -5, width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: `9px solid ${TOOL}aa` }} />
            <div className="absolute" style={{ right: 8, top: -5, width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderRight: `9px solid ${TOOL}aa` }} />
          </div>

          {/* Texto que baja */}
          <div ref={scrollRef} onScroll={onScroll}
            className="absolute inset-0 overflow-y-auto z-20"
            style={{ WebkitMaskImage: maskImg, maskImage: maskImg }}>
            <div
              style={{
                paddingTop: '40vh', paddingBottom: '64vh',
                paddingLeft: '6%', paddingRight: '6%',
                fontSize, lineHeight: 1.4, fontWeight: 600, textAlign: 'center',
                color: '#fff', whiteSpace: 'pre-wrap', letterSpacing: '0.3px',
                transform: espejo ? 'scaleX(-1)' : 'none',
                textShadow: camara ? '0 2px 12px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.85)' : 'none',
              }}>
              {texto.trim() ? texto : 'Pegá tu guion arriba y dale play ▶'}
            </div>
          </div>

          {/* Controles flotantes (sirven también en pantalla completa) */}
          <div className="absolute left-1/2 bottom-4 z-40 -translate-x-1/2 flex items-center gap-1.5 rounded-2xl px-2 py-2"
            style={{ background: 'rgba(10,10,18,0.78)', border: '1px solid #2a2a38', backdropFilter: 'blur(8px)' }}>
            <button onClick={reiniciar} title="Volver al inicio" className={iconBtn} style={{ ...ghost, width: 40, height: 40, fontSize: 16 }}>⏮</button>
            <button onClick={() => setPlaying(p => !p)} title="Play / Pausa (barra espaciadora)"
              className={iconBtn} style={{ width: 52, height: 40, background: TOOL_GRAD, color: '#fff', fontSize: 18, boxShadow: `0 0 16px ${TOOL}55` }}>
              {playing ? '⏸' : '▶'}
            </button>
            <span className="mx-1 w-px self-stretch" style={{ background: '#2a2a38' }} />
            <button onClick={() => setFontSize(s => clamp(s - 4, SIZE_MIN, SIZE_MAX))} title="Letra más chica" className={iconBtn} style={{ ...ghost, width: 36, height: 40, fontSize: 13 }}>A−</button>
            <button onClick={() => setFontSize(s => clamp(s + 4, SIZE_MIN, SIZE_MAX))} title="Letra más grande" className={iconBtn} style={{ ...ghost, width: 36, height: 40, fontSize: 17 }}>A+</button>
            <span className="mx-1 w-px self-stretch" style={{ background: '#2a2a38' }} />
            <button onClick={() => setVelocidad(v => clamp(v - 10, VEL_MIN, VEL_MAX))} title="Más lento" className={iconBtn} style={{ ...ghost, width: 40, height: 40, fontSize: 16 }}>🐢</button>
            <button onClick={() => setVelocidad(v => clamp(v + 10, VEL_MIN, VEL_MAX))} title="Más rápido" className={iconBtn} style={{ ...ghost, width: 40, height: 40, fontSize: 16 }}>🐇</button>
            {camara && (
              <>
                <span className="mx-1 w-px self-stretch" style={{ background: '#2a2a38' }} />
                <button onClick={() => (grabando ? pararGrabacion() : grabar())} title={grabando ? 'Frenar grabación' : 'Grabar video'}
                  className={iconBtn}
                  style={{ width: 48, height: 40, fontSize: 15, background: grabando ? '#ef4444' : '#241016', border: '1px solid #ef444455', color: '#fff', boxShadow: grabando ? '0 0 16px #ef444488' : 'none' }}>
                  {grabando ? '⏹' : '⏺'}
                </button>
              </>
            )}
            <span className="mx-1 w-px self-stretch" style={{ background: '#2a2a38' }} />
            <button onClick={() => setEspejo(e => !e)} title="Espejar texto (para vidrio)" className={iconBtn}
              style={{ width: 40, height: 40, fontSize: 16, background: espejo ? TOOL_GRAD : '#13131d', border: '1px solid #26263a', color: '#fff' }}>🪞</button>
            <button onClick={toggleFs} title="Pantalla completa" className={iconBtn} style={{ ...ghost, width: 40, height: 40, fontSize: 16 }}>{fs ? '🗗' : '⛶'}</button>
          </div>
        </div>

        {/* ── Grabación lista ── */}
        {videoURL && (
          <div className="rounded-2xl p-3 mt-4 flex items-center gap-3 flex-wrap" style={PANEL}>
            <span className="text-sm font-bold" style={{ color: '#86efac' }}>✅ Grabación lista</span>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={videoURL} controls className="rounded-xl" style={{ height: 96, background: '#000' }} />
            <a href={videoURL} download={`teleprompter.${videoExt}`}
              className="text-sm font-bold px-3.5 py-2 rounded-xl transition-all"
              style={{ background: TOOL_GRAD, color: '#fff', boxShadow: `0 0 14px ${TOOL}44` }}>⬇ Descargar</a>
            <button onClick={() => { URL.revokeObjectURL(videoURL); setVideoURL(null); }}
              className="text-sm font-semibold px-3 py-2 rounded-xl transition-all"
              style={{ background: '#13131d', border: '1px solid #26263a', color: '#a1a1aa' }}>🗑 Descartar</button>
          </div>
        )}

        {/* ── Importar guiones de mi biblioteca ── */}
        {importerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(4,4,10,0.72)', backdropFilter: 'blur(4px)' }}
            onClick={() => setImporterOpen(false)}>
            <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
              style={{ ...PANEL, maxHeight: '82vh' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 px-4 py-3" style={{ borderBottom: '1px solid #1b1b27' }}>
                <div>
                  <p className="text-sm font-bold">📚 Importar mis guiones</p>
                  <p className="text-xs" style={{ color: '#71717a' }}>Elegí uno o varios y se cargan al teleprompter, listos para leer.</p>
                </div>
                <button onClick={() => setImporterOpen(false)} className="text-2xl leading-none px-1" style={{ color: '#8b8b96' }}>×</button>
              </div>

              <div className="overflow-y-auto px-3 py-3 flex-1">
                {bibCargando ? (
                  <p className="text-sm text-center py-10" style={{ color: '#8b8b96' }}>Cargando tus guiones…</p>
                ) : bibError ? (
                  <div className="text-center py-10">
                    <p className="text-sm" style={{ color: '#fca5a5' }}>{bibError}</p>
                    <a href="/app" className="inline-block mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: '#13131d', border: '1px solid #26263a', color: '#c4b5fd' }}>Ir a ViralADN →</a>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {bibGuiones.map(g => {
                      const on = sel.has(g.id);
                      return (
                        <button key={g.id} onClick={() => toggleSel(g.id)}
                          className="text-left rounded-xl px-3 py-2.5 transition-all flex items-start gap-2.5"
                          style={{ background: on ? '#1a1326' : '#0b0b14', border: `1px solid ${on ? TOOL : '#1f1f2b'}` }}>
                          <span className="mt-0.5 w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0"
                            style={{ background: on ? TOOL_GRAD : 'transparent', border: on ? 'none' : '1px solid #3a3a48', color: '#fff' }}>{on ? '✓' : ''}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold truncate" style={{ color: '#e7e7ee' }}>{g.name || 'Sin título'}</span>
                            <span className="block text-xs truncate" style={{ color: '#71717a' }}>{g.transcript.slice(0, 90)}…</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {!bibCargando && !bibError && (
                <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderTop: '1px solid #1b1b27' }}>
                  <span className="text-xs" style={{ color: '#71717a' }}>{sel.size} elegido{sel.size === 1 ? '' : 's'}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => importarSeleccion('agregar')} disabled={!sel.size}
                      className="text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                      style={{ background: '#13131d', border: '1px solid #26263a', color: sel.size ? '#e7e7ee' : '#52525b', opacity: sel.size ? 1 : 0.6 }}>
                      Agregar al final
                    </button>
                    <button onClick={() => importarSeleccion('reemplazar')} disabled={!sel.size}
                      className="text-sm font-bold px-4 py-2 rounded-xl transition-all"
                      style={{ background: TOOL_GRAD, color: '#fff', opacity: sel.size ? 1 : 0.5, boxShadow: `0 0 14px ${TOOL}44` }}>
                      Importar{sel.size ? ` ${sel.size}` : ''}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
