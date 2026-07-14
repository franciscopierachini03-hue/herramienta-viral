'use client';

// Avatares IA — crea/usa un avatar (Nano Banana) y conviértelo en video (fal).
// Modelo hub & spoke: el header ProductNav vuelve al Home para cambiar de tool.

import { useEffect, useRef, useState } from 'react';
import ProductNav from '../_components/ProductNav';
import AdminGate from '../_components/AdminGate';

const PINK = '#ec4899';
const AMBER = '#f59e0b';

type Credits = { configured: boolean; balance: number; grant: number };
type Health = { listo: boolean; tabla: string; gemini: string; fal: string; modeloImagen: string; modeloVideo: string; pasos: string[] };
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

export default function StudioPage() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [formato, setFormato] = useState<Formato>('9:16'); // vertical por defecto: es para reels
  const [tierVid, setTierVid] = useState<'fast' | 'pro'>('fast'); // económico por defecto
  const [prompt, setPrompt] = useState('');
  const [photo, setPhoto] = useState<{ dataUrl: string; base64: string; mime: string } | null>(null);
  const [image, setImage] = useState<string | null>(null);      // avatar generado (dataUrl)
  const [video, setVideo] = useState<string | null>(null);      // url del video final
  const [busyImg, setBusyImg] = useState(false);
  const [busyVid, setBusyVid] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function refreshCredits() {
    fetch('/api/studio/credits', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d?.ok) setCredits({ configured: d.configured, balance: d.balance, grant: d.grant }); })
      .catch(() => {});
  }
  useEffect(() => {
    refreshCredits();
    // Semáforo: verifica EN VIVO tabla + Gemini + fal y dice qué falta.
    fetch('/api/studio/health', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d && typeof d.listo === 'boolean') setHealth(d); })
      .catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setPhoto(await fileToDownscaled(f)); setError(''); }
    catch (err) { setError((err as Error).message); }
  }

  async function generateImage() {
    if (busyImg) return;
    if (!prompt.trim() && !photo) { setError('Subí una foto o describí el avatar que quieres.'); return; }
    setBusyImg(true); setError(''); setNote(''); setVideo(null);
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

  async function animate() {
    const source = image || photo?.dataUrl;
    if (!source) { setError('Primero genera un avatar o sube una foto.'); return; }
    if (busyVid) return;
    setBusyVid(true); setError(''); setNote('Encolando el video… (1-3 min)'); setVideo(null);
    try {
      const res = await fetch('/api/studio/video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: source, prompt: prompt.trim() || undefined, duration: 5, tier: tierVid }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'No se pudo encolar.'); setBusyVid(false); setNote(''); return; }
      if (typeof d.balance === 'number') setCredits(c => c ? { ...c, balance: d.balance } : c);
      const jobTier = d.tier === 'pro' ? 'pro' : 'fast'; // el polling va a la cola del mismo modelo
      // Polling del estado.
      pollRef.current = setInterval(async () => {
        try {
          const s = await fetch(`/api/studio/video?id=${encodeURIComponent(d.jobId)}&tier=${jobTier}`, { cache: 'no-store' });
          const sj = await s.json();
          if (sj.status === 'done') { stopPoll(); setVideo(sj.url); setNote(''); setBusyVid(false); }
          else if (sj.status === 'error') { stopPoll(); setError(sj.error || 'El render falló (te devolvimos los créditos).'); setNote(''); setBusyVid(false); refreshCredits(); }
        } catch { /* sigue intentando */ }
      }, 5000);
    } catch { setError('Error de conexión.'); setBusyVid(false); setNote(''); }
  }
  function stopPoll() { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }

  const card = { background: 'linear-gradient(145deg, #14141f, #0d0d16)', border: '1px solid #23232f' } as const;
  const inputStyle = { background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff' } as const;

  return (
    <main className="min-h-screen text-white px-6 py-8"
      style={{ background: 'radial-gradient(ellipse 90% 45% at 25% 0%, #2a0a1e 0%, transparent 60%), radial-gradient(ellipse 70% 35% at 85% 8%, #3a2406 0%, transparent 55%), #070710' }}>
      <AdminGate />
      <div className="max-w-5xl mx-auto">
        <ProductNav active="studio" />

        {/* Saldo de créditos */}
        <div className="flex items-center justify-between gap-3 mb-6 rounded-2xl px-5 py-3" style={card}>
          <div className="text-sm" style={{ color: '#b4b4c0' }}>
            🎭 <b>Avatares IA</b> — tu foto cobra vida para tus reels.
          </div>
          {credits === null ? (
            <span className="text-xs" style={{ color: '#8b8b96' }}>cargando…</span>
          ) : !credits.configured ? (
            <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: '#3a2406', border: '1px solid #f59e0b55', color: '#fde68a' }}>
              ⚙️ Falta configurar (créditos)
            </span>
          ) : (
            <span className="text-sm font-bold px-3 py-1.5 rounded-full" style={{ background: '#1a0f14', border: `1px solid ${PINK}55`, color: '#fbcfe8' }}>
              ⚡ {credits.balance} créditos
            </span>
          )}
        </div>

        {/* Semáforo de configuración: qué pieza falta y cómo se arregla */}
        {health && !health.listo && (
          <div className="mb-6 rounded-2xl p-5" style={{ background: '#1a1408', border: '1px solid #f59e0b55' }}>
            <p className="text-sm font-bold mb-3" style={{ color: '#fde68a' }}>⚙️ Para encender Avatares IA faltan estas piezas:</p>
            <div className="flex flex-col gap-1.5 text-xs" style={{ color: '#d6d6de' }}>
              <span>{health.tabla === 'ok' ? '✅' : '❌'} Tabla de créditos en Supabase {health.tabla === 'ok' ? '' : '(correr supabase/ai_credits.sql)'}</span>
              <span>{health.gemini === 'ok' ? '✅' : '❌'} Imagen · Gemini — {health.gemini === 'ok' ? `listo (${health.modeloImagen})` : health.gemini}</span>
              <span>{health.fal === 'ok' ? '✅' : '❌'} Video · fal.ai — {health.fal === 'ok' ? `listo (${health.modeloVideo})` : health.fal}</span>
            </div>
            {health.pasos.length > 0 && (
              <div className="mt-3 pt-3 text-xs" style={{ borderTop: '1px solid #f59e0b33', color: '#c9b48a' }}>
                {health.pasos.map(p => <p key={p} className="mb-1">→ {p}</p>)}
              </div>
            )}
          </div>
        )}
        {health?.listo && (
          <div className="mb-6 rounded-2xl px-5 py-3 text-xs" style={{ background: '#0d1f12', border: '1px solid #22c55e55', color: '#86efac' }}>
            ✅ Todo configurado: imagen ({health.modeloImagen}) + video ({health.modeloVideo}) + créditos. A crear.
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── Columna izquierda: crear el avatar ── */}
          <div className="rounded-3xl p-6" style={card}>
            <h2 className="text-lg font-bold mb-1">1 · Tu avatar</h2>
            <p className="text-sm mb-4" style={{ color: '#9a9aa6' }}>Sube tu foto (para clonarte) o descríbelo. 1 crédito por imagen.</p>

            <label className="block mb-3">
              <span className="text-xs" style={{ color: '#8b8b96' }}>Tu foto (opcional)</span>
              <input type="file" accept="image/*" onChange={onPickPhoto}
                className="block w-full text-xs mt-1 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:cursor-pointer"
                style={{ color: '#9a9aa6' }} />
            </label>
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.dataUrl} alt="tu foto" className="w-20 h-20 object-cover rounded-xl mb-3" style={{ border: '1px solid #2a2a36' }} />
            )}

            {/* Formato de salida — vertical (reel) por defecto */}
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {([['9:16', '📱 Vertical (reel)'], ['1:1', '⬜ Cuadrado'], ['16:9', '🖥 Horizontal']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setFormato(v)}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                  style={formato === v
                    ? { background: `linear-gradient(135deg, ${PINK}, ${AMBER})`, color: '#fff' }
                    : { background: '#0a0a12', border: '1px solid #2a2a36', color: '#8b8b96' }}>
                  {l}
                </button>
              ))}
            </div>

            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} maxLength={600}
              placeholder="Ej: a mí con traje, fondo de oficina moderna, luz cálida de estudio…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-3" style={inputStyle} />

            <button onClick={generateImage} disabled={busyImg}
              className="w-full py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${PINK}, ${AMBER})`, color: '#fff' }}>
              {busyImg ? 'Generando…' : '✨ Generar avatar'}
            </button>

            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="avatar" className="w-full rounded-2xl mt-4" style={{ border: `1px solid ${PINK}44` }} />
            )}
          </div>

          {/* ── Columna derecha: animar a video ── */}
          <div className="rounded-3xl p-6" style={card}>
            <h2 className="text-lg font-bold mb-1">2 · Foto → video</h2>
            <p className="text-sm mb-4" style={{ color: '#9a9aa6' }}>
              Anima el avatar (o tu foto) a un clip de 5s. {tierVid === 'pro' ? '10' : '3'} créditos por video.
            </p>

            {/* Nivel de calidad/costo — económico por defecto */}
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {([['fast', '⚡ Económico · 3 créditos'], ['pro', '💎 Pro (Kling) · 10 créditos']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setTierVid(v)}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                  style={tierVid === v
                    ? { background: `linear-gradient(135deg, ${AMBER}, ${PINK})`, color: '#fff' }
                    : { background: '#0a0a12', border: '1px solid #2a2a36', color: '#8b8b96' }}>
                  {l}
                </button>
              ))}
            </div>

            <button onClick={animate} disabled={busyVid || (!image && !photo)}
              className="w-full py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-50"
              style={{ background: (!image && !photo) ? '#1a1a24' : `linear-gradient(135deg, ${AMBER}, ${PINK})`, color: '#fff', border: '1px solid #2a2a36' }}>
              {busyVid ? 'Renderizando…' : '🎬 Animar a video'}
            </button>

            {note && <p className="text-xs mt-3" style={{ color: '#fde68a' }}>{note}</p>}

            {video ? (
              <video src={video} controls autoPlay loop className="w-full rounded-2xl mt-4" style={{ border: `1px solid ${AMBER}44` }} />
            ) : (
              <div className="mt-4 rounded-2xl flex items-center justify-center text-center text-xs p-8"
                style={{ background: '#0a0a12', border: '1px dashed #2a2a36', color: '#6b6b78', minHeight: 160 }}>
                {busyVid ? 'Tu video se está generando…' : 'Acá aparecerá tu video.'}
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
