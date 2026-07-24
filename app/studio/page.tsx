'use client';

// CLON DE IA (v2 lipsync) — tu VIDEO BASE (selfie de 30-60s, subido una vez) +
// tu voz clonada + un guion → tu clon diciéndolo (LatentSync sincroniza la
// boca sobre tu propia filmación). Solo admin.
// Modelo hub & spoke: el header ProductNav vuelve al Home para cambiar de tool.

import { useEffect, useRef, useState } from 'react';
import ProductNav from '../_components/ProductNav';
import AdminGate from '../_components/AdminGate';
import { createClient } from '@/lib/supabase/client';

const PINK = '#ec4899';
const AMBER = '#f59e0b';
const CREDIT_VOZ = 3;     // costo de clonar la voz (== CREDIT_COST.voz)
const CREDIT_HABLAR = 1;  // costo de un video del clon (== CREDIT_COST.hablar)
const GUION_MAX = 900;
const VIDEO_MAX_MB = 45;  // tope de archivo (plan Free de Supabase: 50 MB)

type Credits = { configured: boolean; balance: number; grant: number };
type Health = {
  listo: boolean; listoHabla?: boolean;
  tabla: string; gemini: string; fal: string; voz?: string; tablaVoz?: string;
  modeloImagen: string; modeloVideo: string; modeloVoz?: string; pasos: string[];
};

// Lee un archivo (audio) a base64 SIN el prefijo data: — para el clon de voz.
function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1] || '';
      if (!base64) { reject(new Error('No pude leer el audio.')); return; }
      resolve({ base64, mime: file.type || 'audio/mpeg' });
    };
    reader.onerror = () => reject(new Error('No pude leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

function descargar(url: string, nombre: string) {
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
}

// Duración estimada del guion hablado (~14 caracteres por segundo).
function estSegundos(texto: string): number {
  return Math.max(1, Math.round(texto.trim().length / 14));
}

export default function StudioPage() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');

  // Paso 1 · video base del clon
  const [clonVideo, setClonVideo] = useState<string | null>(null);
  const [clonCargando, setClonCargando] = useState(true);
  const [clonAbierto, setClonAbierto] = useState(false);   // panel subir/cambiar
  const [videoConsent, setVideoConsent] = useState(false);
  const [busyUpload, setBusyUpload] = useState(false);
  const [baseDur, setBaseDur] = useState<number | null>(null); // duración del video base (s)

  // Paso 2 · voz
  const [vozTiene, setVozTiene] = useState<boolean | null>(null);
  const [vozNombre, setVozNombre] = useState('');
  const [vozAbierto, setVozAbierto] = useState(false);
  const [sample, setSample] = useState<{ base64: string; mime: string; nombreArchivo: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [busyVoz, setBusyVoz] = useState(false);

  // Paso 3 · guion → video
  const [guion, setGuion] = useState('');
  const [talkVideo, setTalkVideo] = useState<string | null>(null);
  const [busyTalk, setBusyTalk] = useState(false);
  const [noteTalk, setNoteTalk] = useState('');
  const pollTalkRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function refreshCredits() {
    fetch('/api/studio/credits', { cache: 'no-store' })
      .then(r => r.json()).then(setCredits).catch(() => {});
  }
  function refreshVoz() {
    fetch('/api/studio/voz', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setVozTiene(!!d.tiene); setVozNombre(d.nombre || ''); })
      .catch(() => setVozTiene(false));
  }
  function refreshClonVideo() {
    fetch('/api/studio/clon-video', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setClonVideo(d.url || null); setClonCargando(false); })
      .catch(() => setClonCargando(false));
  }

  useEffect(() => {
    refreshCredits(); refreshVoz(); refreshClonVideo();
    fetch('/api/studio/health', { cache: 'no-store' })
      .then(r => r.json()).then(setHealth).catch(() => {});
    return () => stopTalkPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTalkPoll() { if (pollTalkRef.current) { clearInterval(pollTalkRef.current); pollTalkRef.current = null; } }

  // ── Paso 1: subir el video base (directo navegador → Storage, URL firmada) ──
  async function onPickClonVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('video/')) { setError('Subí un VIDEO (mp4 o mov).'); return; }
    if (f.size > VIDEO_MAX_MB * 1024 * 1024) {
      setError(`El video pesa demasiado (máx ${VIDEO_MAX_MB} MB). Grabá 30-60s en 720p o 1080p.`); return;
    }
    if (!videoConsent) { setError('Marcá el consentimiento: el video es tuyo y autorizás usarlo para tu clon.'); return; }
    setBusyUpload(true); setError('');
    try {
      // 1) El server firma la subida.
      const r = await fetch('/api/studio/clon-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: f.name }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo preparar la subida.');
      // 2) El navegador sube DIRECTO al Storage (el archivo no pasa por Vercel).
      const supa = createClient();
      const { error: upErr } = await supa.storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, f);
      if (upErr) throw new Error(upErr.message || 'Falló la subida del video.');
      // 3) Guardamos la URL como video base del clon.
      const r2 = await fetch('/api/studio/clon-video', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: d.publicUrl }),
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.error || 'No se pudo guardar el video.');
      setClonVideo(d.publicUrl); setClonAbierto(false); setVideoConsent(false); setBaseDur(null);
    } catch (err) { setError((err as Error).message); }
    setBusyUpload(false);
  }

  // ── Paso 2: clonar la voz ──
  async function onPickSample(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError('El audio pesa demasiado — subí 1-2 min (máx 10 MB).'); return; }
    try { const s = await fileToBase64(f); setSample({ ...s, nombreArchivo: f.name }); setError(''); }
    catch (err) { setError((err as Error).message); }
  }

  async function crearVoz() {
    if (busyVoz) return;
    if (!sample) { setError('Subí una muestra de tu voz (1-2 min hablando claro).'); return; }
    if (!consent) { setError('Marcá el consentimiento: la voz es tuya y autorizás clonarla.'); return; }
    setBusyVoz(true); setError('');
    try {
      const res = await fetch('/api/studio/voz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: sample.base64, mime: sample.mime, nombre: vozNombre.trim() || 'Mi voz' }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'No se pudo crear la voz.'); }
      else {
        setVozTiene(true); setSample(null); setVozAbierto(false); setConsent(false);
        if (typeof d.balance === 'number') setCredits(c => c ? { ...c, balance: d.balance } : c);
      }
    } catch { setError('Error de conexión.'); }
    setBusyVoz(false);
  }

  // ── Paso 3: guion → video del clon ──
  async function hablar() {
    if (!clonVideo) { setError('Primero subí tu video base (paso 1).'); return; }
    if (!vozTiene) { setError('Primero cloná tu voz (paso 2).'); return; }
    if (!guion.trim()) { setError('Escribí lo que tu clon va a decir.'); return; }
    if (busyTalk) return;
    setBusyTalk(true); setError(''); setNoteTalk('Generando la voz y sincronizando los labios… (1-3 min, no cierres la página)'); setTalkVideo(null);
    try {
      const res = await fetch('/api/studio/hablar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: guion.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'No se pudo encolar.'); setBusyTalk(false); setNoteTalk(''); return; }
      if (typeof d.balance === 'number') setCredits(c => c ? { ...c, balance: d.balance } : c);
      pollTalkRef.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/studio/hablar?id=${encodeURIComponent(d.jobId)}`, { cache: 'no-store' });
          const sj = await s.json();
          if (sj.status === 'done') { stopTalkPoll(); setTalkVideo(sj.url); setNoteTalk(''); setBusyTalk(false); }
          else if (sj.status === 'error') { stopTalkPoll(); setError(sj.error || 'El render falló (te devolvimos los créditos).'); setNoteTalk(''); setBusyTalk(false); refreshCredits(); }
        } catch { /* sigue intentando */ }
      }, 5000);
    } catch { setError('Error de conexión.'); setBusyTalk(false); setNoteTalk(''); }
  }

  const card = { background: 'linear-gradient(145deg, #14141f, #0d0d16)', border: '1px solid #23232f' } as const;
  const input = { background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff' } as const;
  const guionSeg = estSegundos(guion);
  const guionMasLargoQueBase = baseDur != null && guion.trim() !== '' && guionSeg > Math.floor(baseDur);

  return (
    <main className="min-h-screen text-white px-6 py-8"
      style={{ background: 'radial-gradient(ellipse 90% 45% at 25% 0%, #2a0a1e 0%, transparent 60%), radial-gradient(ellipse 70% 35% at 85% 8%, #3a2406 0%, transparent 55%), #070710' }}>
      <AdminGate />
      <div className="max-w-5xl mx-auto">
        <ProductNav active="studio" />

        {/* Encabezado + créditos */}
        <div className="flex items-center justify-between gap-3 mb-6 rounded-2xl px-5 py-3" style={card}>
          <div className="text-sm" style={{ color: '#b4b4c0' }}>
            🎬 <b>Tu clon de IA</b> — tu video + tu voz + un guion = tu clon diciéndolo.
          </div>
          {credits === null ? (
            <span className="text-xs" style={{ color: '#8b8b96' }}>cargando…</span>
          ) : !credits.configured ? (
            <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: '#3a2406', border: '1px solid #f59e0b55', color: '#fde68a' }}>⚙️ Falta configurar</span>
          ) : (
            <span className="text-sm font-bold px-3 py-1.5 rounded-full" style={{ background: '#1a0f14', border: `1px solid ${PINK}55`, color: '#fbcfe8' }}>⚡ {credits.balance} créditos</span>
          )}
        </div>

        {/* Semáforo — solo si falta algo del clon */}
        {health && !health.listoHabla && (
          <div className="mb-6 rounded-2xl p-4 text-xs" style={{ background: '#1a1408', border: '1px solid #f59e0b55' }}>
            <p className="font-bold mb-2" style={{ color: '#fde68a' }}>⚙️ Estado:</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ color: '#d6d6de' }}>
              <span>{health.tabla === 'ok' ? '✅' : '❌'} Créditos</span>
              <span>{health.voz === 'ok' ? '✅' : '❌'} Voz (ElevenLabs)</span>
              <span>{health.tablaVoz === 'ok' ? '✅' : '❌'} Tabla de voces</span>
              <span>{health.fal === 'ok' ? '✅' : '❌'} Video (fal)</span>
            </div>
          </div>
        )}

        <h1 className="text-2xl md:text-3xl font-extrabold mb-1">¿Qué querés que diga tu clon?</h1>
        <p className="text-sm mb-6" style={{ color: '#9a9aa6' }}>Subí un video tuyo una sola vez, cloná tu voz, y después cada guion sale con tu cara y tu voz — listo para reels.</p>

        <div className="grid lg:grid-cols-[minmax(0,340px)_1fr] gap-6 items-start">
          {/* ── Izquierda: tu video base ── */}
          <div className="rounded-3xl p-5" style={card}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">1 · Tu video base</h2>
              {clonVideo && !clonAbierto && (
                <button onClick={() => { setClonAbierto(true); setVideoConsent(false); }} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: '#14141f', border: '1px solid #2a2a36', color: '#c9c9d4' }}>✎ Cambiar</button>
              )}
            </div>

            {/* Preview del video base */}
            <div className="rounded-2xl overflow-hidden mb-3 flex items-center justify-center"
              style={{ background: '#0a0a12', border: `1px solid ${clonVideo ? PINK + '44' : '#2a2a36'}`, minHeight: 200 }}>
              {clonCargando ? (
                <span className="text-xs p-6" style={{ color: '#6b6b78' }}>cargando…</span>
              ) : clonVideo ? (
                <video src={clonVideo} controls playsInline className="w-full"
                  onLoadedMetadata={e => setBaseDur((e.target as HTMLVideoElement).duration || null)} />
              ) : (
                <span className="text-xs p-6 text-center" style={{ color: '#6b6b78' }}>
                  Acá va tu video base: <b>30-60 segundos</b> tuyos hablando a cámara.
                </span>
              )}
            </div>

            {(!clonVideo || clonAbierto) && (
              <>
                <div className="rounded-2xl p-3 mb-3 text-[11px] leading-relaxed" style={{ background: '#0a0a12', border: '1px solid #23232f', color: '#8b8b96' }}>
                  📹 <b style={{ color: '#c9c9d4' }}>Cómo grabarlo</b> (se graba UNA vez y sirve para todos tus videos):
                  <br />· 30-60 seg, <b>vertical</b>, de frente y mirando a cámara.
                  <br />· Buena luz, fondo prolijo, la cara bien visible (sin taparte la boca).
                  <br />· Hablá con energía de reel — da igual QUÉ digas: la boca se reemplaza.
                  <br />· 720p o 1080p · máx {VIDEO_MAX_MB} MB.
                </div>
                <label className="flex items-start gap-2 mb-3 cursor-pointer">
                  <input type="checkbox" checked={videoConsent} onChange={e => setVideoConsent(e.target.checked)} className="mt-0.5" />
                  <span className="text-xs" style={{ color: '#8b8b96' }}>Confirmo que el video es mío (o tengo permiso) y autorizo usarlo para mi clon.</span>
                </label>
                <label className="block w-full py-2.5 rounded-2xl text-sm font-bold text-center cursor-pointer"
                  style={{ background: busyUpload ? '#1a1a24' : `linear-gradient(135deg, ${PINK}, ${AMBER})`, color: '#fff', opacity: busyUpload ? 0.6 : 1 }}>
                  {busyUpload ? 'Subiendo tu video…' : (clonVideo ? '📹 Subir otro video' : '📹 Subir mi video')}
                  <input type="file" accept="video/*" onChange={onPickClonVideo} className="hidden" disabled={busyUpload} />
                </label>
                {clonVideo && clonAbierto && (
                  <button onClick={() => { setClonAbierto(false); setVideoConsent(false); }} className="w-full mt-2 text-xs" style={{ color: '#8b8b96' }}>cancelar</button>
                )}
              </>
            )}

            {clonVideo && !clonAbierto && (
              <p className="text-[11px]" style={{ color: '#5a8a6a' }}>
                ✅ Tu clon está listo{baseDur ? ` · ${Math.floor(baseDur)}s de base` : ''} — se usa en todos tus videos.
              </p>
            )}
          </div>

          {/* ── Derecha: voz + guion → video ── */}
          <div className="rounded-3xl p-5 md:p-6" style={card}>
            {/* Voz */}
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <h2 className="text-base font-bold">2 · Tu voz</h2>
              {vozTiene === null ? (
                <span className="text-xs" style={{ color: '#6b6b78' }}>cargando…</span>
              ) : vozTiene && !vozAbierto ? (
                <span className="text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-2" style={{ background: '#0d1f12', border: '1px solid #22c55e55', color: '#86efac' }}>
                  🎤 {vozNombre || 'Mi voz'} ✓
                  <button onClick={() => { setVozAbierto(true); setSample(null); setConsent(false); }} className="underline" style={{ color: '#5a8a6a' }}>cambiar</button>
                </span>
              ) : (
                <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: '#1a1408', border: '1px solid #f59e0b55', color: '#fde68a' }}>Cloná tu voz (1 vez)</span>
              )}
            </div>

            {(vozTiene === false || vozAbierto) && (
              <div className="rounded-2xl p-4 mb-5" style={{ background: '#0a0a12', border: '1px solid #23232f' }}>
                <p className="text-xs mb-3" style={{ color: '#8b8b96' }}>Subí <b>1-2 min</b> tuyos hablando claro, sin música ni ruido (mp3, m4a, wav o webm). {CREDIT_VOZ} créditos, una sola vez. 💡 Podés usar el audio del mismo video base.</p>
                <div className="flex gap-2 items-center mb-3 flex-wrap">
                  <label className="text-xs font-bold px-3 py-2 rounded-lg cursor-pointer" style={{ background: '#14141f', border: '1px solid #2e2e3e', color: '#c9c9d4' }}>
                    📁 Elegir audio
                    <input type="file" accept="audio/*" onChange={onPickSample} className="hidden" />
                  </label>
                  {sample && <span className="text-xs" style={{ color: '#86efac' }}>🎙 {sample.nombreArchivo}</span>}
                </div>
                <input value={vozNombre} onChange={e => setVozNombre(e.target.value)} maxLength={60}
                  placeholder="Nombre de la voz (ej: Fran)"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-3" style={input} />
                <label className="flex items-start gap-2 mb-3 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
                  <span className="text-xs" style={{ color: '#8b8b96' }}>Confirmo que la voz es mía (o tengo permiso) y autorizo clonarla.</span>
                </label>
                <button onClick={crearVoz} disabled={busyVoz || !sample || !consent}
                  className="w-full py-2.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${PINK}, ${AMBER})`, color: '#fff' }}>
                  {busyVoz ? 'Clonando tu voz…' : '🎤 Crear mi voz'}
                </button>
              </div>
            )}

            {/* Guion */}
            <h2 className="text-base font-bold mb-2">3 · El guion</h2>
            <textarea value={guion} onChange={e => setGuion(e.target.value)} rows={6} maxLength={GUION_MAX}
              placeholder="Escribí acá lo que tu clon va a decir a cámara…"
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={input} />
            <div className="flex justify-between text-[11px] mt-1 mb-1" style={{ color: '#6b6b78' }}>
              <span>≈ {guionSeg}s de video</span>
              <span>{guion.length}/{GUION_MAX}</span>
            </div>
            {guionMasLargoQueBase && (
              <p className="text-[11px] mb-3" style={{ color: '#fcd34d' }}>
                ⚠️ El guion (~{guionSeg}s) es más largo que tu video base ({Math.floor(baseDur!)}s) — acortalo o subí un video base más largo.
              </p>
            )}

            {/* Generar */}
            <button onClick={hablar} disabled={busyTalk || !clonVideo || !vozTiene || !guion.trim()}
              className="w-full py-3.5 rounded-2xl text-base font-extrabold transition-all disabled:opacity-40 mt-2"
              style={{ background: (!clonVideo || !vozTiene || !guion.trim()) ? '#1a1a24' : `linear-gradient(135deg, ${AMBER}, ${PINK})`, color: '#fff', border: '1px solid #2a2a36' }}>
              {busyTalk ? 'Generando tu video…' : `🎬 Generar video · ${CREDIT_HABLAR} crédito${CREDIT_HABLAR === 1 ? '' : 's'}`}
            </button>
            <div className="text-[11px] mt-2 flex flex-col gap-0.5" style={{ color: '#6b6b78' }}>
              {!clonVideo && <span>· Subí tu video base (paso 1).</span>}
              {vozTiene === false && <span>· Cloná tu voz (paso 2).</span>}
              {!guion.trim() && <span>· Escribí el guion (paso 3).</span>}
            </div>

            {noteTalk && <p className="text-xs mt-3" style={{ color: '#fde68a' }}>{noteTalk}</p>}

            {/* Resultado */}
            {talkVideo ? (
              <div className="mt-5">
                <video src={talkVideo} controls autoPlay loop playsInline className="w-full rounded-2xl" style={{ border: `1px solid ${PINK}44` }} />
                <button onClick={() => descargar(talkVideo, 'mi-clon.mp4')} className="w-full mt-3 py-2.5 rounded-2xl text-sm font-bold" style={{ background: '#14141f', border: '1px solid #2e2e3e', color: '#c9c9d4' }}>⬇️ Descargar video</button>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl flex items-center justify-center text-center text-xs p-8"
                style={{ background: '#0a0a12', border: '1px dashed #2a2a36', color: '#6b6b78', minHeight: 180 }}>
                {busyTalk ? '🎬 Tu clon se está grabando… (1-3 min)' : 'Acá va a aparecer tu clon hablando.'}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl p-4 text-sm" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d55', color: '#fca5a5' }}>
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
