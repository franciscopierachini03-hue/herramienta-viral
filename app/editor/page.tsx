'use client';

// TOPCUT — edición automática de video, con flujo guiado.
//
// Flujo (lo que pidió el usuario):
//   1. Subir video
//   2. Recortar por TROZOS — la persona corta en cualquier punto y elimina los
//      pedazos que no sirven (errores en el medio, principio o final). El video
//      final = los trozos que quedan, concatenados en orden.
//   3. Contexto ("de qué va tu video") + instrucciones de animación
//   4. PREVIO: el cerebro arma un PLAN (hook, subtítulos, animación, b-roll,
//      música) SIN renderizar todavía → se muestra como storyboard
//   5. Chat: la persona le pide ajustes al cerebro ("animá palabra por palabra",
//      "textos más grandes") → el PLAN se actualiza en vivo
//   6. Editar: con el plan aprobado, recién ahí se renderiza → descargar
//
// El "cerebro" + render viven en el backend (Hetzner, api.viraladn.com).
//
// ───────────────────────────────────────────────────────────────────────────
// CONTRATO con el backend (lo que hay que exponer en api.viraladn.com):
//
//   POST /api/plan                         (multipart/form-data)
//     campos: file, segments (JSON [{start,end}] en segundos — trozos a
//             conservar, en orden), context, instructions
//             (también manda trimStart/trimEnd = límites globales por si el
//              backend solo soporta recorte simple)
//     → 200 { planId, plan:{hook, subtitleStyle, subtitleSize, animation,
//                            brollCount, music, summary, ...}, reply? }
//     (El backend recorta cada trozo y los CONCATENA, después arma el plan.
//      NO renderiza: solo arma el plan. Esto es el "previo".)
//
//   POST /api/plan/{planId}/chat           (application/json)
//     body: { message }
//     → 200 { plan:{...}, reply }          (plan editado por el cerebro)
//
//   POST /api/render                       (application/json)
//     body: { planId }
//     → 200 { jobId }                      (arranca el render del plan aprobado)
//
//   GET  /api/jobs/{jobId}                 (ya existe)
//     → { status:'queued'|'processing'|'done'|'error', stage, result, error }
//
// MIENTRAS el backend no tenga /api/plan|/api/render (responde 404/501), el
// front cae solo al flujo actual: POST /api/jobs?style=default (+segments
// best-effort) → poll → descargar. Así TOPCUT nunca queda roto.
// ───────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useMemo, type PointerEvent as RPointerEvent } from 'react';
import ProductNav from '../_components/ProductNav';
import SessionGuard from '../_components/SessionGuard';
import ComingSoon from './ComingSoon';
import ScenePanel from './ScenePanel';

const API = process.env.NEXT_PUBLIC_VIDEO_API || 'https://api.viraladn.com';

// TOPCUT en "muy pronto": mientras esto no sea '1', /editor muestra la cuenta
// regresiva (ComingSoon) en vez del editor. Para lanzar: NEXT_PUBLIC_TOPCUT_LIVE=1.
const TOPCUT_LIVE = process.env.NEXT_PUBLIC_TOPCUT_LIVE === '1';

// Las llamadas chicas (chat, render, poll) van por el proxy mismo-origen
// /api/topcut/* (el token viaja del lado server). La subida del video va
// DIRECTA a Hetzner con un ticket corto que pedimos acá (Vercel no deja
// proxyear archivos grandes). El ticket solo se emite a usuarios con acceso.
type Ticket = { token: string; api: string; planAvailable: boolean };
async function getTicket(): Promise<Ticket> {
  const r = await fetch('/api/topcut/ticket', { method: 'POST' });
  if (!r.ok) throw new Error('ticket');
  const j = await r.json();
  return { token: j.token || '', api: (j.api || API).replace(/\/+$/, ''), planAvailable: !!j.planAvailable };
}

type Step =
  | 'upload'     // dropzone
  | 'trim'       // recortar por trozos
  | 'brief'      // contexto + instrucciones
  | 'planning'   // generando el previo (POST /api/plan)
  | 'studio'     // previo (storyboard) + chat
  | 'rendering'  // render + poll
  | 'done'
  | 'error';

type Seg = { start: number; end: number };

type Plan = {
  hook?: string; title?: string; intro?: string;
  subtitleStyle?: string; captionStyle?: string;
  subtitleSize?: string;
  animation?: string; textAnimation?: string;
  brollCount?: number; broll?: unknown; bRoll?: unknown;
  music?: string;
  summary?: string;
  [k: string]: unknown;
};

type Msg = { role: 'user' | 'brain'; text: string };

const STAGE_ES: Record<string, string> = {
  uploading:  'Subiendo video',
  queued:     'En cola',
  transcribe: 'Transcribiendo audio',
  plan:       'Diseñando la edición (IA)',
  broll:      'Buscando B-roll',
  music:      'Agregando música',
  render:     'Renderizando video',
  done:       'Listo',
};
const STAGE_ORDER = ['uploading', 'queued', 'transcribe', 'plan', 'broll', 'music', 'render', 'done'];

const STEPS = ['Subir', 'Recortar', 'Previo', 'Editar'];
function stepIndex(s: Step): number {
  if (s === 'upload') return 0;
  if (s === 'trim') return 1;
  if (s === 'brief' || s === 'planning' || s === 'studio') return 2;
  return 3; // rendering / done
}

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function brollLabel(p: Plan): string | undefined {
  if (typeof p.brollCount === 'number') return `${p.brollCount} cortes`;
  if (Array.isArray(p.broll)) return `${p.broll.length} cortes`;
  if (Array.isArray(p.bRoll)) return `${p.bRoll.length} cortes`;
  if (typeof p.broll === 'string') return p.broll;
  return undefined;
}

function r3(n: number) { return Math.round(n * 1000) / 1000; }

export default function Topcut() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState(0);

  // recorte por trozos
  const [segments, setSegments] = useState<Seg[]>([]);
  const [history, setHistory] = useState<Seg[][]>([]);
  const [selSeg, setSelSeg] = useState<number | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [waveLoading, setWaveLoading] = useState(false);

  const [context, setContext] = useState('');
  const [instructions, setInstructions] = useState('');
  const [planId, setPlanId] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [stage, setStage] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [blobUrl, setBlobUrl] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  // Admin puede probar TOPCUT aunque no esté público (el resto ve la cuenta regresiva).
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubbingRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const procStartRef = useRef(0); // inicio del procesamiento (para el cronómetro)

  // Si TOPCUT no está público, vemos si quien entra es admin (para dejarlo probar).
  useEffect(() => {
    if (TOPCUT_LIVE) { setIsAdmin(false); return; }
    let cancel = false;
    fetch('/api/auth/is-admin', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { isAdmin: false }))
      .then(d => { if (!cancel) setIsAdmin(!!d.isAdmin); })
      .catch(() => { if (!cancel) setIsAdmin(false); });
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [videoUrl]);

  // Revoca el blob del resultado al cambiarlo o desmontar.
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  // Cronómetro del procesamiento: arranca cuando deja de subir y corre hasta done.
  useEffect(() => {
    const processing = step === 'rendering' && !!stage && stage !== 'uploading' && stage !== 'done';
    if (!processing) return;
    if (procStartRef.current === 0) procStartRef.current = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - procStartRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [step, stage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatBusy]);

  // ── Subida del archivo ──────────────────────────────
  function onFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith('video/')) { setStep('error'); setError('El archivo no es un video.'); return; }
    const url = URL.createObjectURL(f);
    setFile(f);
    setVideoUrl(url);
    setStep('trim');
    analyzeAudio(f);
  }

  // Decodifica el audio en el navegador y saca el nivel (RMS) por tramo.
  // Picos altos = voz/sonido fuerte; valles = silencio o poco audio.
  // Si el formato no se puede decodificar (algún MOV/AVI), no muestra waveform.
  async function analyzeAudio(f: File) {
    setWaveform([]);
    setWaveLoading(true);
    try {
      const buf = await f.arrayBuffer();
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const audio = await ctx.decodeAudioData(buf);
      const ch = audio.getChannelData(0);
      const BARS = 180;
      const block = Math.floor(ch.length / BARS) || 1;
      const peaks: number[] = [];
      for (let i = 0; i < BARS; i++) {
        const start = i * block;
        const end = Math.min(start + block, ch.length);
        let sum = 0;
        for (let j = start; j < end; j++) sum += ch[j] * ch[j];
        peaks.push(Math.sqrt(sum / Math.max(1, end - start)));
      }
      // Normalizar contra el percentil 95 (un pico aislado no aplasta el resto).
      const sorted = [...peaks].sort((a, b) => a - b);
      const ref = sorted[Math.floor(sorted.length * 0.95)] || Math.max(...peaks) || 1;
      setWaveform(peaks.map((p) => Math.min(1, p / ref)));
      ctx.close().catch(() => {});
    } catch {
      setWaveform([]); // formato sin audio decodificable → seguimos sin onda
    } finally {
      setWaveLoading(false);
    }
  }

  function onMeta() {
    const d = videoRef.current?.duration || 0;
    setDuration(d);
    setSegments([{ start: 0, end: d }]);
    setHistory([]);
    setSelSeg(null);
    setPlayhead(0);
  }

  // ── Recorte por trozos ──────────────────────────────
  function seekTo(t: number) {
    const v = videoRef.current; if (!v) return;
    const clamped = Math.max(0, Math.min(t, duration));
    v.currentTime = clamped;
    setPlayhead(clamped);
  }

  // ── La línea de corte: arrastrable por el timeline Y el waveform ──
  function timeFromEvent(e: RPointerEvent<HTMLDivElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!duration || !rect.width) return 0;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return ratio * duration;
  }
  function onScrubStart(e: RPointerEvent<HTMLDivElement>) {
    if (!duration) return;
    e.preventDefault();
    scrubbingRef.current = true;
    setPreviewing(false);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    seekTo(timeFromEvent(e));
  }
  function onScrubMove(e: RPointerEvent<HTMLDivElement>) {
    if (!scrubbingRef.current) return;
    seekTo(timeFromEvent(e));
  }
  function onScrubEnd(e: RPointerEvent<HTMLDivElement>) {
    scrubbingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }
  function nudge(delta: number) {
    setPreviewing(false);
    seekTo(playhead + delta);
  }

  function splitAtPlayhead() {
    const t = playhead;
    const i = segments.findIndex((s) => t > s.start + 0.15 && t < s.end - 0.15);
    if (i < 0) return; // el cursor no está dentro de un trozo divisible
    setHistory((h) => [...h, segments]);
    const s = segments[i];
    setSegments([...segments.slice(0, i), { start: s.start, end: t }, { start: t, end: s.end }, ...segments.slice(i + 1)]);
    setSelSeg(null);
  }

  function deleteSeg(i: number) {
    if (segments.length <= 1) return;
    setHistory((h) => [...h, segments]);
    setSegments(segments.filter((_, k) => k !== i));
    setSelSeg(null);
  }

  function undo() {
    if (!history.length) return;
    setSegments(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setSelSeg(null);
    setPreviewing(false);
  }

  function playResult() {
    const v = videoRef.current; if (!v || !segments.length) return;
    setPreviewing(true);
    v.currentTime = segments[0].start;
    v.play().catch(() => {});
  }

  function onTimeUpdate() {
    const v = videoRef.current; if (!v) return;
    const t = v.currentTime;
    setPlayhead(t);
    if (!previewing) return;
    // ¿dentro de un trozo que se conserva?
    const inSeg = segments.some((s) => t >= s.start - 0.05 && t < s.end);
    if (inSeg) return;
    // está en un hueco (parte eliminada) → saltar al próximo trozo
    const next = segments.find((s) => s.start >= t - 0.05);
    if (next) { v.currentTime = next.start; }
    else { v.pause(); setPreviewing(false); }
  }

  // ── Generar el PREVIO (POST /api/plan) ──────────────
  async function generatePlan() {
    if (!file) return;
    setStep('planning');
    setUploadPct(0);
    setError(''); setNote('');

    let ticket: Ticket;
    try { ticket = await getTicket(); }
    catch { fail('No pudimos verificar tu acceso. Volvé a iniciar sesión.'); return; }

    // Si el backend todavía no tiene el modo previo, NO subimos el video al pedo
    // a /api/plan: vamos directo al flujo que sí funciona (una sola subida).
    if (!ticket.planAvailable) {
      fallbackRender('Tu backend todavía no tiene el modo previo (/api/plan): edité el video directo. Cuando sumes ese endpoint vas a ver el previo + el chat antes de renderizar.', ticket);
      return;
    }

    const segs = segments.map((s) => ({ start: r3(s.start), end: r3(s.end) }));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('segments', JSON.stringify(segs));
    if (segs.length) {
      fd.append('trimStart', String(segs[0].start));
      fd.append('trimEnd', String(segs[segs.length - 1].end));
    }
    fd.append('context', context);
    fd.append('instructions', instructions);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${ticket.api}/api/plan`);
    if (ticket.token) xhr.setRequestHeader('authorization', `Bearer ${ticket.token}`);
    xhr.timeout = 20 * 60 * 1000;
    xhr.ontimeout = () => fail('La subida tardó demasiado. Probá con un video más corto o revisá tu conexión.');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const j = JSON.parse(xhr.responseText);
          setPlanId(j.planId || j.id || '');
          setPlan(j.plan || j);
          setMessages([{ role: 'brain', text: j.reply || 'Acá tenés el previo de tu edición. Pedime los cambios que quieras (animaciones, tamaño, color, música) y lo ajusto antes de renderizar.' }]);
          setStep('studio');
        } catch { fail('Respuesta inválida del servidor (plan).'); }
      } else if (xhr.status === 404 || xhr.status === 501) {
        fallbackRender('Tu backend todavía no expone el modo previo (/api/plan), así que edité el video directo. Cuando sumes esos endpoints vas a poder ver y ajustar el previo + chatear las animaciones antes de renderizar.');
      } else {
        fail(`Error generando el previo (${xhr.status}).`);
      }
    };
    xhr.onerror = () => fail('No se pudo conectar con el servidor de edición.');
    xhr.send(fd);
  }

  // ── Chat: ajustar el plan (POST /api/plan/:id/chat) ─
  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatBusy || !planId) return;
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setChatInput('');
    setChatBusy(true);
    try {
      const r = await fetch(`/api/topcut/plan/${planId}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (j.plan) setPlan(j.plan);
      setMessages((m) => [...m, { role: 'brain', text: j.reply || 'Listo, actualicé el previo con ese cambio.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'brain', text: 'No pude aplicar ese cambio (el backend todavía no tiene el chat de edición). Igual podés editar el video con el previo actual.' }]);
    } finally {
      setChatBusy(false);
    }
  }

  // ── Render final del plan aprobado (POST /api/render) ─
  async function startRender() {
    if (!planId) { fallbackRender(''); return; }
    setStep('rendering'); setStage('queued'); setError(''); setNote(''); procStartRef.current = 0; setElapsed(0);
    try {
      const r = await fetch(`/api/topcut/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      if (r.status === 404 || r.status === 501) {
        fallbackRender('Tu backend todavía no expone /api/render; lo edité con el flujo actual.');
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const jobId = j.jobId || j.id;
      if (!jobId) throw new Error('no jobId');
      poll(jobId);
    } catch {
      fail('No pude arrancar el render.');
    }
  }

  // ── Fallback: flujo one-shot actual (/api/jobs) ─────
  async function fallbackRender(noteMsg: string, pre?: Ticket) {
    if (!file) { fail('No hay video para editar.'); return; }
    setNote(noteMsg);
    setStep('rendering'); setStage('uploading'); setUploadPct(0); setError(''); procStartRef.current = 0; setElapsed(0);

    let ticket: Ticket;
    if (pre) {
      ticket = pre;
    } else {
      try { ticket = await getTicket(); }
      catch { fail('No pudimos verificar tu acceso. Volvé a iniciar sesión.'); return; }
    }

    const segs = segments.map((s) => ({ start: r3(s.start), end: r3(s.end) }));
    const qs = new URLSearchParams({ style: 'default' });
    if (segs.length) {
      qs.set('segments', JSON.stringify(segs));
      qs.set('trimStart', String(segs[0].start));
      qs.set('trimEnd', String(segs[segs.length - 1].end));
    }
    if (context) qs.set('context', context.slice(0, 500));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${ticket.api}/api/jobs?${qs.toString()}`);
    xhr.setRequestHeader('content-type', file.type || 'video/mp4');
    if (ticket.token) xhr.setRequestHeader('authorization', `Bearer ${ticket.token}`);
    xhr.timeout = 20 * 60 * 1000;
    xhr.ontimeout = () => fail('La subida tardó demasiado. Probá con un video más corto o revisá tu conexión.');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { id } = JSON.parse(xhr.responseText);
          if (!id) throw new Error('no id');
          setStage('queued');
          poll(id);
        } catch { fail('Respuesta inválida del servidor.'); }
      } else { fail(`Error al subir (${xhr.status}).`); }
    };
    xhr.onerror = () => fail('No se pudo conectar con el servidor de edición.');
    xhr.send(file);
  }

  // ── Poll del job de render ──────────────────────────
  async function poll(id: string) {
    try {
      const r = await fetch(`/api/topcut/jobs/${id}`, { cache: 'no-store' });
      const j = await r.json();
      if (j.stage) setStage(j.stage);
      if (j.status === 'done') {
        const abs = typeof j.result === 'string' && j.result.startsWith('http') ? j.result : `${API}${j.result}`;
        setResultUrl(abs);
        setStep('done');
        // Bajamos el resultado como blob: el preview permite adelantar/retroceder
        // (seek) aunque el server no soporte Range, y la descarga es instantánea.
        // Si CORS lo bloquea, queda el src directo (sin seek pero reproduce).
        fetch(abs).then((res) => (res.ok ? res.blob() : Promise.reject(new Error()))).then((b) => {
          setBlobUrl(URL.createObjectURL(b));
        }).catch(() => {});
        return;
      }
      if (j.status === 'error') {
        fail((j.error || '').split('\n')[0] || 'El servidor reportó un error.');
        return;
      }
      pollRef.current = setTimeout(() => poll(id), 2500);
    } catch {
      fail('Se perdió la conexión con el servidor.');
    }
  }

  function fail(msg: string) { setStep('error'); setError(msg); }

  function reset() {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    if (pollRef.current) clearTimeout(pollRef.current);
    procStartRef.current = 0;
    setStep('upload'); setFile(null); setVideoUrl(''); setDuration(0);
    setSegments([]); setHistory([]); setSelSeg(null); setPlayhead(0); setPreviewing(false);
    setWaveform([]); setWaveLoading(false);
    setContext(''); setInstructions('');
    setPlanId(''); setPlan(null); setMessages([]); setChatInput(''); setChatBusy(false);
    setUploadPct(0); setStage(''); setResultUrl(''); setBlobUrl(''); setElapsed(0); setError(''); setNote('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const dur = duration || 1;
  const sIdx = stepIndex(step);
  const keptDur = segments.reduce((a, s) => a + (s.end - s.start), 0);
  const removedDur = Math.max(0, duration - keptDur);
  // Estimado del procesamiento (excluye la subida): base + escala con la duración.
  const estTotal = Math.max(30, Math.round(25 + keptDur * 2.2));
  const remaining = Math.max(0, estTotal - elapsed);
  const canSplit = segments.some((s) => playhead > s.start + 0.15 && playhead < s.end - 0.15);

  // Barras del waveform (memo: no se recrean al mover la línea, solo al cortar).
  const waveBars = useMemo(() => {
    if (!waveform.length || !duration) return null;
    return waveform.map((v, i) => {
      const t = ((i + 0.5) / waveform.length) * duration;
      const kept = segments.some((s) => t >= s.start && t < s.end);
      return <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(3, v * 92)}%`, background: kept ? 'linear-gradient(180deg, #d8b4fe, #7c3aed)' : '#262626' }} />;
    });
  }, [waveform, segments, duration]);

  const planCards = plan ? [
    { icon: '🎬', label: 'Intro / Hook', val: plan.hook || plan.title || plan.intro },
    { icon: '💬', label: 'Subtítulos', val: [plan.subtitleStyle || plan.captionStyle, plan.subtitleSize].filter(Boolean).join(' · ') || undefined },
    { icon: '✨', label: 'Animación de texto', val: plan.animation || plan.textAnimation },
    { icon: '🎞️', label: 'B-roll', val: brollLabel(plan) },
    { icon: '🎵', label: 'Música', val: plan.music },
  ].filter((c) => c.val) : [];

  // Mientras TOPCUT no esté lanzado, mostramos la cuenta regresiva.
  // Público ve la cuenta regresiva; el admin (confirmado) puede entrar a probar.
  if (!TOPCUT_LIVE && isAdmin !== true) return <ComingSoon />;

  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="px-6 pt-10 pb-2 max-w-6xl mx-auto w-full">
        <SessionGuard />
        <ProductNav active="topcut" />
      </div>

      {!TOPCUT_LIVE && (
        <div className="px-6 max-w-2xl mx-auto mb-4">
          <div className="rounded-xl px-4 py-2.5 text-xs flex items-center gap-2"
            style={{ background: '#1a160a', border: '1px solid #5c4a14', color: '#e8d48a' }}>
            🛠️ <span><b>Modo admin</b> — estás probando TOPCUT en preview. El resto de los usuarios ve la cuenta regresiva hasta el lanzamiento.</span>
          </div>
        </div>
      )}

      <div className="px-6 pb-24 max-w-3xl mx-auto">
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

        {/* ── Stepper ─────────────────────────────────── */}
        {step !== 'error' && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={i <= sIdx
                      ? { background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }
                      : { background: '#141414', border: '1px solid #222', color: '#555' }}>
                    {i < sIdx ? '✓' : i + 1}
                  </span>
                  <span className="text-xs hidden sm:inline" style={{ color: i <= sIdx ? '#c4b5fd' : '#555' }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <span className="w-6 h-px" style={{ background: i < sIdx ? '#a855f7' : '#222' }} />}
              </div>
            ))}
          </div>
        )}

        {/* ── 1. UPLOAD ───────────────────────────────── */}
        {step === 'upload' && (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">
                Subí tu video.{' '}
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a855f7, #ec4899)' }}>La IA lo edita.</span>
              </h2>
              <p className="text-sm" style={{ color: '#999' }}>Recortás (sacás los errores), le contás de qué va, y el cerebro arma la edición. Vos aprobás el previo antes de renderizar.</p>
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); onFile(e.dataTransfer.files?.[0]); }}
              className="border-2 border-dashed rounded-3xl p-16 cursor-pointer text-center transition-all"
              style={isDragging
                ? { borderColor: '#a855f7', background: '#a855f70d', boxShadow: '0 0 40px #a855f722' }
                : { borderColor: '#2a2a2a', background: '#0c0c0c' }}>
              <div className="text-6xl mb-4">{isDragging ? '📂' : '🎬'}</div>
              <h3 className="text-lg font-bold mb-1">Soltá tu video acá</h3>
              <p className="text-sm mb-5" style={{ color: '#666' }}>o hacé clic para elegirlo</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {['MP4', 'MOV', 'AVI', 'MKV'].map((f) => (
                  <span key={f} className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: '#141414', border: '1px solid #222', color: '#555' }}>{f}</span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-6">
              {[{ icon: '✂️', label: 'Recortás' }, { icon: '💬', label: 'Das contexto' }, { icon: '🤖', label: 'Chateás' }, { icon: '✨', label: 'Aprobás' }].map((f) => (
                <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
                  <span className="text-xl">{f.icon}</span>
                  <span className="text-[10px]" style={{ color: '#666' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── 2. TRIM (por trozos) ────────────────────── */}
        {step === 'trim' && (
          <div className="rounded-3xl p-6 sm:p-8" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed33' }}>
            <h3 className="text-xl font-bold mb-1">✂️ Recortá y sacá lo que no sirve</h3>
            <p className="text-sm mb-5" style={{ color: '#888' }}>
              Movés el video al punto del error → <b style={{ color: '#c4b5fd' }}>✂️ Cortar acá</b> (antes y después del error) → en la lista de abajo tocás <b style={{ color: '#f87171' }}>🗑️ Quitar</b> en ese trozo. Sacás partes del medio, del principio o del final.
            </p>

            <video ref={videoRef} src={videoUrl} onLoadedMetadata={onMeta} onTimeUpdate={onTimeUpdate}
              controls className="w-full rounded-2xl mb-4 mx-auto" style={{ maxHeight: 360, border: '1px solid #222', background: '#000' }} />

            {/* timeline — arrastrá la línea para elegir dónde cortar */}
            <div
              onPointerDown={onScrubStart} onPointerMove={onScrubMove} onPointerUp={onScrubEnd} onPointerCancel={onScrubEnd}
              className="relative h-12 rounded-xl overflow-hidden mb-1.5 select-none"
              style={{ background: '#0c0c0c', border: '1px solid #1f1f1f', cursor: 'ew-resize', touchAction: 'none' }}>
              {segments.map((s, i) => (
                <div key={i}
                  className="absolute top-0 bottom-0 flex items-center justify-center transition-all pointer-events-none"
                  style={{
                    left: `${(s.start / dur) * 100}%`, width: `${((s.end - s.start) / dur) * 100}%`,
                    background: selSeg === i ? 'linear-gradient(135deg, #c084fc, #f472b6)' : 'linear-gradient(135deg, #7c3aed, #c13584)',
                    borderLeft: '2px solid #080808', borderRight: '2px solid #080808',
                    boxShadow: selSeg === i ? 'inset 0 0 0 2px #fff' : 'none',
                  }}>
                  <span className="text-[10px] font-bold" style={{ color: '#fff' }}>{i + 1}</span>
                </div>
              ))}
              {/* línea de corte (playhead) + handle arrastrable + tiempo */}
              <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${(playhead / dur) * 100}%`, transform: 'translateX(-50%)' }}>
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2" style={{ width: 2, background: '#fff', boxShadow: '0 0 8px #fff' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 18, height: 18, background: '#fff', border: '3px solid #a855f7', boxShadow: '0 0 10px #a855f7' }} />
                <div className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: '#a855f7', color: '#fff', whiteSpace: 'nowrap' }}>{fmt(playhead)}</div>
              </div>
            </div>

            {/* waveform de audio — picos = voz/sonido fuerte; valles = silencio */}
            {(waveLoading || waveform.length > 0) && (
              <div
                onPointerDown={onScrubStart} onPointerMove={onScrubMove} onPointerUp={onScrubEnd} onPointerCancel={onScrubEnd}
                className="relative h-16 rounded-xl overflow-hidden mb-1.5 select-none flex items-end gap-px"
                style={{ background: '#0c0c0c', border: '1px solid #1f1f1f', cursor: 'ew-resize', touchAction: 'none' }}>
                {waveLoading
                  ? <div className="w-full text-center text-[11px] self-center" style={{ color: '#555' }}>Analizando audio…</div>
                  : waveBars}
                {!waveLoading && (
                  <div className="absolute top-0 bottom-0 w-0.5 pointer-events-none" style={{ left: `${(playhead / dur) * 100}%`, background: '#fff', boxShadow: '0 0 6px #fff' }} />
                )}
              </div>
            )}

            <p className="text-[11px] mb-3" style={{ color: '#666' }}>Arrastrá la línea ⚪ por el video (o por la onda de audio) para elegir el punto exacto. Los picos altos son voz fuerte; los valles, silencios.</p>

            {/* controles */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <button onClick={() => nudge(-0.1)} title="Atrás 0.1s"
                className="px-2.5 py-2 rounded-xl text-xs font-bold" style={{ background: '#141414', border: '1px solid #222', color: '#c4b5fd' }}>◀ 0.1s</button>
              <button onClick={splitAtPlayhead} disabled={!canSplit}
                className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-30"
                style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>✂️ Cortar acá ({fmt(playhead)})</button>
              <button onClick={() => nudge(0.1)} title="Adelante 0.1s"
                className="px-2.5 py-2 rounded-xl text-xs font-bold" style={{ background: '#141414', border: '1px solid #222', color: '#c4b5fd' }}>0.1s ▶</button>
              <button onClick={undo} disabled={!history.length}
                className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-30"
                style={{ background: '#141414', border: '1px solid #222', color: '#888' }}>↩ Deshacer</button>
              <button onClick={playResult}
                className="px-3 py-2 rounded-xl text-xs font-bold ml-auto"
                style={{ background: '#141414', border: '1px solid #2a2a2a', color: '#c4b5fd' }}>▶ Ver resultado</button>
            </div>

            {/* lista de trozos — cada uno con su botón Quitar (sin seleccionar antes) */}
            <p className="text-[11px] mb-2" style={{ color: '#888' }}>Estos son los pedazos que QUEDAN en el video. Tocá <b style={{ color: '#f87171' }}>🗑️ Quitar</b> para sacar el que no sirve.</p>
            <div className="flex flex-col gap-1.5 mb-3">
              {segments.map((s, i) => (
                <div key={i}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background: selSeg === i ? '#7c3aed22' : '#0c0c0c', border: `1px solid ${selSeg === i ? '#7c3aed55' : '#1a1a1a'}` }}>
                  <button onClick={() => { setSelSeg(i); setPreviewing(false); seekTo(s.start); }}
                    className="text-left flex-1 truncate" title="Ir a este trozo" style={{ color: '#ccc' }}>
                    <b style={{ color: '#fff' }}>Trozo {i + 1}</b>: {fmt(s.start)} – {fmt(s.end)} <span style={{ color: '#666' }}>({fmt(s.end - s.start)})</span>
                  </button>
                  <button onClick={() => deleteSeg(i)} disabled={segments.length <= 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-30 shrink-0"
                    style={{ background: '#2a0f0f', border: '1px solid #5c1414', color: '#f87171' }}
                    title={segments.length <= 1 ? 'No podés quitar el único trozo' : 'Quitar este trozo del video'}>🗑️ Quitar</button>
                </div>
              ))}
            </div>

            <div className="text-xs mb-6" style={{ color: '#888' }}>
              Quedan <b style={{ color: '#c4b5fd' }}>{segments.length}</b> trozo{segments.length !== 1 ? 's' : ''} · <b style={{ color: '#c4b5fd' }}>{fmt(keptDur)}</b> en total
              {removedDur > 0.05 && <> · sacaste <b style={{ color: '#f472b6' }}>{fmt(removedDur)}</b></>}
            </div>

            <div className="flex gap-3">
              <button onClick={reset} className="px-5 py-3 rounded-2xl text-sm font-bold" style={{ background: '#141414', border: '1px solid #222', color: '#888' }}>Cambiar video</button>
              <button onClick={() => setStep('brief')} className="flex-1 py-3 rounded-2xl text-sm font-bold" style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff', boxShadow: '0 0 24px #a855f744' }}>Continuar →</button>
            </div>
          </div>
        )}

        {/* ── 3. BRIEF ────────────────────────────────── */}
        {step === 'brief' && (
          <div className="rounded-3xl p-6 sm:p-8" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed33' }}>
            <h3 className="text-xl font-bold mb-1">💬 Contanos de tu video</h3>
            <p className="text-sm mb-5" style={{ color: '#888' }}>Cuanto mejor el contexto, mejor le pega el cerebro con el hook, los subtítulos y el b-roll.</p>

            <label className="block text-xs font-bold mb-2" style={{ color: '#c4b5fd' }}>¿De qué va el video?</label>
            <textarea value={context} onChange={(e) => setContext(e.target.value)} maxLength={600} rows={3}
              placeholder="Ej: Reel sobre cómo empezar a invertir con poco dinero. Tono motivacional, directo, para gente joven."
              className="w-full rounded-2xl px-4 py-3 text-sm mb-5 resize-none outline-none"
              style={{ background: '#0c0c0c', border: '1px solid #222', color: '#fff' }} />

            <label className="block text-xs font-bold mb-2" style={{ color: '#c4b5fd' }}>¿Cómo querés las animaciones de texto? <span style={{ color: '#555', fontWeight: 400 }}>(opcional)</span></label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={600} rows={2}
              placeholder="Ej: que los subtítulos aparezcan palabra por palabra, grandes, abajo del centro, blancos con resalte."
              className="w-full rounded-2xl px-4 py-3 text-sm mb-6 resize-none outline-none"
              style={{ background: '#0c0c0c', border: '1px solid #222', color: '#fff' }} />

            <div className="flex gap-3">
              <button onClick={() => setStep('trim')} className="px-5 py-3 rounded-2xl text-sm font-bold" style={{ background: '#141414', border: '1px solid #222', color: '#888' }}>← Volver</button>
              <button onClick={generatePlan} className="flex-1 py-3 rounded-2xl text-sm font-bold" style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff', boxShadow: '0 0 24px #a855f744' }}>Generar previo ✨</button>
            </div>
          </div>
        )}

        {/* ── 3b. PLANNING (spinner) ──────────────────── */}
        {step === 'planning' && (
          <div className="rounded-3xl p-8 text-center" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed44' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 mx-auto"
              style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', boxShadow: '0 0 40px #a855f755', animation: 'tcpulse 2s ease-in-out infinite' }}>🧠</div>
            <h3 className="text-lg font-bold mb-1">Armando tu previo…</h3>
            <p className="text-sm" style={{ color: '#888' }}>{uploadPct < 100 ? `Subiendo video ${uploadPct}%` : 'El cerebro está analizando tu video.'}</p>
            {uploadPct < 100 && (
              <div className="h-2 rounded-full overflow-hidden mt-4" style={{ background: '#1a1a1a' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${uploadPct}%`, background: 'linear-gradient(90deg, #a855f7, #ec4899)' }} />
              </div>
            )}
          </div>
        )}

        {/* ── 4+5. STUDIO: previo + chat ──────────────── */}
        {step === 'studio' && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* PREVIO (storyboard) */}
            <div className="rounded-3xl p-6" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed44' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🎬</span>
                <h3 className="text-base font-bold">Previo de tu edición</h3>
              </div>
              {planCards.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {planCards.map((c) => (
                    <div key={c.label} className="flex items-start gap-3 px-4 py-3 rounded-2xl" style={{ background: '#0c0c0c', border: '1px solid #1a1a1a' }}>
                      <span className="text-base">{c.icon}</span>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#666' }}>{c.label}</div>
                        <div className="text-sm" style={{ color: '#ddd' }}>{String(c.val)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap rounded-2xl p-4" style={{ background: '#0c0c0c', border: '1px solid #1a1a1a', color: '#aaa' }}>
                  {plan?.summary || JSON.stringify(plan, null, 2)?.slice(0, 1200) || 'Sin previo todavía.'}
                </pre>
              )}
              <button onClick={startRender} className="w-full mt-5 py-3.5 rounded-2xl text-sm font-bold" style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff', boxShadow: '0 0 24px #a855f744' }}>
                ✨ Editar video con este plan
              </button>
              <p className="text-[11px] text-center mt-2" style={{ color: '#555' }}>El render recién corre cuando le das acá.</p>
            </div>

            {/* CHAT con el cerebro */}
            <div className="rounded-3xl p-6 flex flex-col" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f', minHeight: 420 }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <h3 className="text-base font-bold">Pedile cambios al cerebro</h3>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 mb-3" style={{ maxHeight: 320 }}>
                {messages.map((m, i) => (
                  <div key={i} className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm ${m.role === 'user' ? 'self-end' : 'self-start'}`}
                    style={m.role === 'user'
                      ? { background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }
                      : { background: '#0c0c0c', border: '1px solid #1f1f1f', color: '#ddd' }}>
                    {m.text}
                  </div>
                ))}
                {chatBusy && (
                  <div className="self-start px-3.5 py-2.5 rounded-2xl text-sm" style={{ background: '#0c0c0c', border: '1px solid #1f1f1f', color: '#888' }}>escribiendo…</div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="flex gap-2">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Ej: animá los textos palabra por palabra"
                  className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: '#0c0c0c', border: '1px solid #222', color: '#fff' }} />
                <button onClick={sendChat} disabled={chatBusy || !chatInput.trim()} className="px-4 rounded-2xl text-sm font-bold disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>↑</button>
              </div>
              <div className="flex gap-1.5 flex-wrap mt-3">
                {['Textos más grandes', 'Palabra por palabra', 'Menos b-roll', 'Música más calmada'].map((q) => (
                  <button key={q} onClick={() => setChatInput(q)} className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: '#141414', border: '1px solid #222', color: '#888' }}>{q}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 5b. PANEL DE ESCENAS (edición manual estilo Submagic) ── */}
        {step === 'studio' && planId && (
          <div className="mt-4 rounded-3xl p-6" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
            <p className="text-[11px] uppercase tracking-wider mb-3" style={{ color: '#666' }}>
              Edición manual — ajustá cada escena (subtítulo, B-roll, zoom) y renderizá
            </p>
            <ScenePanel jobId={planId} />
          </div>
        )}

        {/* ── 6. RENDERING ────────────────────────────── */}
        {step === 'rendering' && (
          <div className="rounded-3xl p-8" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed44' }}>
            {note && (
              <div className="rounded-2xl px-4 py-3 mb-5 text-xs" style={{ background: '#1a160a', border: '1px solid #5c4a14', color: '#e8d48a' }}>ℹ️ {note}</div>
            )}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', boxShadow: '0 0 40px #a855f755', animation: 'tcpulse 2s ease-in-out infinite' }}>✂️</div>
              <h3 className="text-lg font-bold">{stage === 'uploading' ? 'Subiendo tu video…' : 'Editando con IA…'}</h3>
              {stage === 'uploading' ? (
                <p className="text-sm" style={{ color: '#888' }}>{uploadPct}%</p>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold tabular-nums" style={{ color: '#c4b5fd' }}>{fmt(elapsed)}</span>
                  <span className="text-sm" style={{ color: '#888' }}>
                    {remaining > 0 ? `· ≈ ${fmt(remaining)} restante` : '· casi listo…'}
                  </span>
                </div>
              )}
              {stage !== 'uploading' && <p className="text-[11px] mt-1" style={{ color: '#555' }}>Estimado — no cierres esta pestaña.</p>}
            </div>

            {stage === 'uploading' ? (
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${uploadPct}%`, background: 'linear-gradient(90deg, #a855f7, #ec4899)' }} />
              </div>
            ) : (
              <>
                <div className="h-1.5 rounded-full overflow-hidden mb-4" style={{ background: '#1a1a1a' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(98, (elapsed / estTotal) * 100)}%`, background: 'linear-gradient(90deg, #a855f7, #ec4899)', transition: 'width 1s linear' }} />
                </div>
                <div className="flex flex-col gap-2">
                {STAGE_ORDER.filter((s) => s !== 'uploading' && s !== 'done').map((s) => {
                  const idx = STAGE_ORDER.indexOf(s);
                  const cur = STAGE_ORDER.indexOf(stage);
                  const done = cur > idx;
                  const active = stage === s;
                  return (
                    <div key={s} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                      style={active ? { background: '#7c3aed22', border: '1px solid #7c3aed44' } : done ? { background: '#0a1a0a', border: '1px solid #143314' } : { opacity: 0.4, border: '1px solid transparent' }}>
                      <span className="text-base w-5 text-center">{done ? '✅' : active ? '⏳' : '•'}</span>
                      <span className="text-sm" style={{ color: active ? '#c4b5fd' : done ? '#4ade80' : '#555' }}>{STAGE_ES[s] || s}</span>
                    </div>
                  );
                })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 7. DONE ─────────────────────────────────── */}
        {step === 'done' && (
          <div className="rounded-3xl p-8 text-center" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #22c55e55' }}>
            <div className="text-5xl mb-3">✨</div>
            <h3 className="text-xl font-bold mb-1">¡Tu video está listo!</h3>
            <p className="text-sm mb-6" style={{ color: '#888' }}>Editado automáticamente con IA.</p>
            {(blobUrl || resultUrl) && <video src={blobUrl || resultUrl} controls playsInline className="w-full rounded-2xl mb-5 mx-auto" style={{ maxWidth: 320, border: '1px solid #222' }} />}
            <div className="flex flex-col gap-3">
              <a href={blobUrl || resultUrl} download="topcut.mp4" className="w-full py-3.5 rounded-2xl text-sm font-bold" style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff', boxShadow: '0 0 24px #a855f744' }}>⬇️ Descargar video editado</a>
              <button onClick={reset} className="text-xs underline" style={{ color: '#888' }}>Editar otro video</button>
            </div>
          </div>
        )}

        {/* ── ERROR ───────────────────────────────────── */}
        {step === 'error' && (
          <div className="rounded-3xl p-8 text-center" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7f1d1d55' }}>
            <div className="text-5xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold mb-1">Algo salió mal</h3>
            <p className="text-sm mb-6" style={{ color: '#fca5a5' }}>{error}</p>
            <button onClick={() => (planId ? setStep('studio') : reset())} className="px-6 py-3 rounded-2xl text-sm font-bold" style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>
              {planId ? 'Volver al previo' : 'Intentar de nuevo'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes tcpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.85;transform:scale(0.96)} }
      `}</style>
    </main>
  );
}
