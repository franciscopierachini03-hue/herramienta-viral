'use client';

// Avatares IA — estilo HeyGen: tu foto/avatar + tu voz clonada + un guion →
// video HABLANDO que mantiene tu cara (Kling AI Avatar). Solo admin.
// Modelo hub & spoke: el header ProductNav vuelve al Home para cambiar de tool.

import { useEffect, useRef, useState } from 'react';
import ProductNav from '../_components/ProductNav';
import AdminGate from '../_components/AdminGate';

const PINK = '#ec4899';
const AMBER = '#f59e0b';
const CREDIT_VOZ = 3;      // costo de clonar la voz (== CREDIT_COST.voz)
const CREDIT_HABLAR = 40;  // costo de un video hablando (== CREDIT_COST.hablar)

type Credits = { configured: boolean; balance: number; grant: number };
type Health = {
  listo: boolean; listoHabla?: boolean;
  tabla: string; gemini: string; fal: string; voz?: string; tablaVoz?: string;
  modeloImagen: string; modeloVideo: string; modeloVoz?: string; pasos: string[];
};
type Formato = '9:16' | '1:1' | '16:9';

// Reduce una imagen a máx 1024px y devuelve { dataUrl, base64, mime }.
function fileToDownscaled(file: File): Promise<{ dataUrl: string; base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = String(reader.result); };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.onload = () => {
      const max = 1024;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas no disponible.'));
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ dataUrl, base64, mime: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('Imagen inválida.'));
    reader.readAsDataURL(file);
  });
}

// Lee un archivo (audio) a base64 SIN el prefijo data: — para el clon de voz.
function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      resolve({ base64: s.split(',')[1] || '', mime: file.type || 'audio/mpeg' });
    };
    reader.onerror = () => reject(new Error('No se pudo leer el audio.'));
    reader.readAsDataURL(file);
  });
}

// Descarga una URL (data URL o link) como archivo.
function descargar(url: string, nombre: string) {
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}

// Duración estimada del guion hablado (~14 caracteres por segundo).
function estSegundos(texto: string): number {
  return Math.max(1, Math.round(texto.trim().length / 14));
}

const GUION_MAX = 900; // ~60s de habla (Kling AI Avatar corta cerca de 1 min)

export default function StudioPage() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [formato, setFormato] = useState<Formato>('9:16'); // vertical por defecto: es para reels
  const [prompt, setPrompt] = useState('');
  const [photo, setPhoto] = useState<{ dataUrl: string; base64: string; mime: string } | null>(null);
  const [image, setImage] = useState<string | null>(null);   // avatar generado con IA (dataUrl)
  const [busyImg, setBusyImg] = useState(false);
  const [genAbierto, setGenAbierto] = useState(false);        // panel "generar avatar con IA"
  const [error, setError] = useState('');

  // ── Voz clonada + video hablando ──
  const [vozTiene, setVozTiene] = useState<boolean | null>(null);
  const [vozNombre, setVozNombre] = useState('');
  const [vozAbierto, setVozAbierto] = useState(false);        // panel clonar/rehacer voz
  const [sample, setSample] = useState<{ base64: string; mime: string; nombreArchivo: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [guion, setGuion] = useState('');
  const [talkVideo, setTalkVideo] = useState<string | null>(null);
  const [busyVoz, setBusyVoz] = useState(false);
  const [busyTalk, setBusyTalk] = useState(false);
  const [noteTalk, setNoteTalk] = useState('');
  const pollTalkRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const avatarSrc = image || photo?.dataUrl || null; // la cara que va a hablar

  function refreshCredits() {
    fetch('/api/studio/credits', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d?.ok) setCredits({ configured: d.configured, balance: d.balance, grant: d.grant }); })
      .catch(() => {});
  }
  function refreshVoz() {
    fetch('/api/studio/voz', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d?.ok) { setVozTiene(!!d.tiene); if (d.nombre) setVozNombre(d.nombre); } })
      .catch(() => {});
  }
  useEffect(() => {
    refreshCredits();
    refreshVoz();
    fetch('/api/studio/health', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d && typeof d.listo === 'boolean') setHealth(d); })
      .catch(() => {});
    return () => { if (pollTalkRef.current) clearInterval(pollTalkRef.current); };
  }, []);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setPhoto(await fileToDownscaled(f)); setImage(null); setError(''); }
    catch (err) { setError((err as Error).message); }
  }

  async function generateImage() {
    if (busyImg) return;
    if (!prompt.trim() && !photo) { setError('Subí una foto o describí el avatar que querés.'); return; }
    setBusyImg(true); setError('');
    try {
      const res = await fetch('/api/studio/image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim() || 'Retrato fotorrealista de esta persona, mirando a cámara, iluminación de estudio, estética de reel.',
          photoBase64: photo?.base64, photoMime: photo?.mime,
          formato,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'No se pudo generar.'); }
      else { setImage(d.image); if (typeof d.balance === 'number') setCredits(c => c ? { ...c, balance: d.balance } : c); }
    } catch { setError('Error de conexión.'); }
    setBusyImg(false);
  }

  function stopTalkPoll() { if (pollTalkRef.current) { clearInterval(pollTalkRef.current); pollTalkRef.current = null; } }

  async function onPickSample(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError('El audio pesa demasiado — subí 1-2 min (máx 10 MB).'); return; }
    try { const s = await fileToBase64(f); setSample({ ...s, nombreArchivo: f.name }); setError(''); }
    catch (err) { setError((err as Error).message); }
  }

  async function crearVoz() {
    if (busyVoz) return;
    if (!sample) { setError('Subí una muestra de tu voz (20-30s hablando claro).'); return; }
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

  async function hablar() {
    if (!avatarSrc) { setError('Primero subí tu foto (o generá un avatar).'); return; }
    if (!vozTiene) { setError('Primero cloná tu voz.'); return; }
    if (!guion.trim()) { setError('Escribí lo que tu avatar va a decir.'); return; }
    if (busyTalk) return;
    setBusyTalk(true); setError(''); setNoteTalk('Generando la voz y armando el video… (1-3 min, no cierres la página)'); setTalkVideo(null);
    try {
      const res = await fetch('/api/studio/hablar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: avatarSrc, texto: guion.trim() }),
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
  const geminiOff = health?.gemini !== 'ok'; // el "generar con IA" necesita Gemini con billing

  return (
    <main className="min-h-screen text-white px-6 py-8"
      style={{ background: 'radial-gradient(ellipse 90% 45% at 25% 0%, #2a0a1e 0%, transparent 60%), radial-gradient(ellipse 70% 35% at 85% 8%, #3a2406 0%, transparent 55%), #070710' }}>
      <AdminGate />
      <div className="max-w-5xl mx-auto">
        <ProductNav active="studio" />

        {/* Encabezado + créditos */}
        <div className="flex items-center justify-between gap-3 mb-6 rounded-2xl px-5 py-3" style={card}>
          <div className="text-sm" style={{ color: '#b4b4c0' }}>
            🎬 <b>Avatares IA</b> — tu cara + tu voz + un guion = video hablando.
          </div>
          {credits === null ? (
            <span className="text-xs" style={{ color: '#8b8b96' }}>cargando…</span>
          ) : !credits.configured ? (
            <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: '#3a2406', border: '1px solid #f59e0b55', color: '#fde68a' }}>⚙️ Falta configurar</span>
          ) : (
            <span className="text-sm font-bold px-3 py-1.5 rounded-full" style={{ background: '#1a0f14', border: `1px solid ${PINK}55`, color: '#fbcfe8' }}>⚡ {credits.balance} créditos</span>
          )}
        </div>

        {/* Semáforo — solo si falta algo */}
        {health && !health.listoHabla && (
          <div className="mb-6 rounded-2xl p-4 text-xs" style={{ background: '#1a1408', border: '1px solid #f59e0b55' }}>
            <p className="font-bold mb-2" style={{ color: '#fde68a' }}>⚙️ Estado:</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ color: '#d6d6de' }}>
              <span>{health.tabla === 'ok' ? '✅' : '❌'} Créditos</span>
              <span>{health.voz === 'ok' ? '✅' : '❌'} Voz (ElevenLabs)</span>
              <span>{health.tablaVoz === 'ok' ? '✅' : '❌'} Tabla de voces</span>
              <span>{health.fal === 'ok' ? '✅' : '❌'} Video (fal)</span>
              <span>{health.gemini === 'ok' ? '✅' : '❌'} Imagen IA (Gemini{health.gemini === 'ok' ? '' : ' — falta billing'})</span>
            </div>
            {health.fal === 'ok' && health.voz === 'ok' && health.tablaVoz === 'ok' && geminiOff && (
              <p className="mt-2" style={{ color: '#86efac' }}>✅ El clon que habla ya funciona subiendo tu foto. (Gemini es solo para “generar avatar con IA”.)</p>
            )}
          </div>
        )}

        <h1 className="text-2xl md:text-3xl font-extrabold mb-1">¿Qué querés que diga tu avatar?</h1>
        <p className="text-sm mb-6" style={{ color: '#9a9aa6' }}>Subí tu foto, cloná tu voz una vez, escribí el guion y listo — video de hasta ~1 min con tu cara real.</p>

        <div className="grid lg:grid-cols-[minmax(0,340px)_1fr] gap-6 items-start">
          {/* ── Izquierda: tu avatar ── */}
          <div className="rounded-3xl p-5" style={card}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">1 · Tu avatar</h2>
              {avatarSrc && (
                <button onClick={() => descargar(avatarSrc, 'avatar.jpg')} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: '#14141f', border: '1px solid #2a2a36', color: '#c9c9d4' }}>⬇️ Descargar</button>
              )}
            </div>

            {/* Preview */}
            <div className="rounded-2xl overflow-hidden mb-3 flex items-center justify-center"
              style={{ background: '#0a0a12', border: `1px solid ${avatarSrc ? PINK + '44' : '#2a2a36'}`, aspectRatio: formato === '9:16' ? '9/16' : formato === '1:1' ? '1/1' : '16/9', maxHeight: 360 }}>
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs p-6 text-center" style={{ color: '#6b6b78' }}>Subí una foto tuya de frente, buena luz.</span>
              )}
            </div>

            <label className="block w-full py-2.5 rounded-2xl text-sm font-bold text-center cursor-pointer mb-3"
              style={{ background: `linear-gradient(135deg, ${PINK}, ${AMBER})`, color: '#fff' }}>
              📁 {avatarSrc ? 'Cambiar foto' : 'Subir mi foto'}
              <input type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
            </label>

            {/* Formato */}
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {([['9:16', '📱 Vertical'], ['1:1', '⬜ Cuadrado'], ['16:9', '🖥 Horizontal']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setFormato(v)}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                  style={formato === v ? { background: '#1a0f14', border: `1px solid ${PINK}77`, color: '#fbcfe8' } : { background: '#0a0a12', border: '1px solid #2a2a36', color: '#8b8b96' }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Generar con IA (opcional, necesita Gemini con billing) */}
            <button onClick={() => setGenAbierto(o => !o)} className="text-xs font-semibold" style={{ color: '#9a9aa6' }}>
              {genAbierto ? '▾' : '▸'} ✨ …o generá un avatar con IA
            </button>
            {genAbierto && (
              <div className="mt-3">
                {geminiOff && (
                  <p className="text-[11px] mb-2" style={{ color: '#fca5a5' }}>⚠️ Necesita activar el billing de Gemini en Google. Mientras, subí tu foto.</p>
                )}
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} maxLength={600}
                  placeholder="Ej: a mí con traje, fondo de oficina, luz de estudio…"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-2" style={input} />
                <button onClick={generateImage} disabled={busyImg}
                  className="w-full py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: '#14141f', border: `1px solid ${PINK}55`, color: '#fbcfe8' }}>
                  {busyImg ? 'Generando…' : '✨ Generar avatar'}
                </button>
              </div>
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
                <p className="text-xs mb-3" style={{ color: '#8b8b96' }}>Subí <b>20-30 seg</b> tuyos hablando claro (mp3, m4a, wav o webm). {CREDIT_VOZ} créditos, una sola vez.</p>
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
              placeholder="Escribí acá lo que tu avatar va a decir a cámara…"
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={input} />
            <div className="flex justify-between text-[11px] mt-1 mb-4" style={{ color: '#6b6b78' }}>
              <span>≈ {estSegundos(guion)}s de video</span>
              <span>{guion.length}/{GUION_MAX}</span>
            </div>

            {/* Generar */}
            <button onClick={hablar} disabled={busyTalk || !avatarSrc || !vozTiene || !guion.trim()}
              className="w-full py-3.5 rounded-2xl text-base font-extrabold transition-all disabled:opacity-40"
              style={{ background: (!avatarSrc || !vozTiene || !guion.trim()) ? '#1a1a24' : `linear-gradient(135deg, ${AMBER}, ${PINK})`, color: '#fff', border: '1px solid #2a2a36' }}>
              {busyTalk ? 'Generando tu video…' : `🎬 Generar video · ${CREDIT_HABLAR} créditos`}
            </button>
            <div className="text-[11px] mt-2 flex flex-col gap-0.5" style={{ color: '#6b6b78' }}>
              {!avatarSrc && <span>· Subí tu foto (columna izquierda).</span>}
              {vozTiene === false && <span>· Cloná tu voz (paso 2).</span>}
              {!guion.trim() && <span>· Escribí el guion (paso 3).</span>}
            </div>

            {noteTalk && <p className="text-xs mt-3" style={{ color: '#fde68a' }}>{noteTalk}</p>}

            {/* Resultado */}
            {talkVideo ? (
              <div className="mt-5">
                <video src={talkVideo} controls autoPlay loop playsInline className="w-full rounded-2xl" style={{ border: `1px solid ${PINK}44` }} />
                <button onClick={() => descargar(talkVideo, 'mi-avatar-hablando.mp4')} className="w-full mt-3 py-2.5 rounded-2xl text-sm font-bold" style={{ background: '#14141f', border: '1px solid #2e2e3e', color: '#c9c9d4' }}>⬇️ Descargar video</button>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl flex items-center justify-center text-center text-xs p-8"
                style={{ background: '#0a0a12', border: '1px dashed #2a2a36', color: '#6b6b78', minHeight: 180 }}>
                {busyTalk ? '🎬 Tu avatar se está grabando… (1-3 min)' : 'Acá va a aparecer tu avatar hablando.'}
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
