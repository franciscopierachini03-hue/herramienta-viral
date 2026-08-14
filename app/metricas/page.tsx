'use client';

// 📊 /metricas — "¿Por qué no funcionó mi reel?"
// La persona sube la captura de sus estadísticas (IG/TikTok) y la IA le dice
// qué falló y qué hacer en el próximo video, adaptado a su cliente ideal.
// Gate: plan ViralADN (ProductGate) · Navegación hub & spoke (ProductNav).

import { useState } from 'react';
import ProductNav from '../_components/ProductNav';
import SessionGuard from '../_components/SessionGuard';
import ProductGate from '../_components/ProductGate';

const MAX_IMG = 3;

// Comprime a JPEG (máx 1600px de lado) para que la subida sea liviana.
function comprimirImagen(file: File, maxLado = 1600, calidad = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('lectura'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('imagen'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxLado || height > maxLado) {
          const f = maxLado / Math.max(width, height);
          width = Math.round(width * f); height = Math.round(height * f);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(file);
  });
}

type Accion = { que: string; porque: string };
type Analisis = {
  metricas?: Record<string, string | number | null>;
  veredicto?: string; nota?: number; loBueno?: string[];
  problema?: string; acciones?: Accion[]; ganchoSugerido?: string;
  conClienteIdeal?: boolean;
};

const ETIQUETAS: Record<string, string> = {
  reproducciones: 'Reproducciones', alcance: 'Alcance', seguidores_pct: 'De seguidores',
  me_gusta: 'Me gusta', comentarios: 'Comentarios', guardados: 'Guardados',
  compartidos: 'Compartidos', tiempo_medio: 'Tiempo medio', retencion_3s: 'Retención 3s',
  seguidores_nuevos: 'Seguidores nuevos',
};

export default function Metricas() {
  const [imgs, setImgs] = useState<string[]>([]);
  const [contexto, setContexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [res, setRes] = useState<Analisis | null>(null);

  async function agregar(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    const nuevas: string[] = [];
    for (const f of Array.from(files).slice(0, MAX_IMG - imgs.length)) {
      if (!f.type.startsWith('image/')) { setError('Solo imágenes (captura de pantalla).'); continue; }
      try { nuevas.push(await comprimirImagen(f)); }
      catch { setError('No pudimos leer esa imagen. Probá con otra.'); }
    }
    setImgs(p => [...p, ...nuevas].slice(0, MAX_IMG));
  }

  async function analizar() {
    if (!imgs.length) { setError('Subí la captura de tus estadísticas.'); return; }
    setError(''); setCargando(true); setRes(null);
    try {
      const r = await fetch('/api/metricas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagenes: imgs, contexto }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo analizar.'); return; }
      setRes(d);
    } catch { setError('Error de conexión. Probá de nuevo.'); }
    finally { setCargando(false); }
  }

  const card = { background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #23232e' } as const;
  const nota = res?.nota ?? null;
  const colorNota = nota === null ? '#c4b5fd' : nota >= 70 ? '#86efac' : nota >= 40 ? '#fcd34d' : '#fca5a5';

  return (
    <main className="min-h-screen text-white pb-16" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
          <div className="max-w-2xl mx-auto px-4 pt-4">
            <SessionGuard />
            <ProductGate product="viraladn" />
            <ProductNav active="viral" />

            <div className="text-center mb-6 mt-2">
              <h1 className="text-2xl md:text-3xl font-extrabold mb-2">📊 ¿Por qué no funcionó mi reel?</h1>
              <p className="text-sm" style={{ color: '#b4b4c0' }}>
                Subí la captura de las estadísticas de tu video y te digo <b style={{ color: '#fff' }}>qué falló y qué hacer en el próximo</b>.
              </p>
            </div>

            <div className="rounded-3xl p-6 mb-5" style={card}>
              <p className="text-[13px] font-bold mb-3" style={{ color: '#c9c9d4' }}>
                1️⃣ Subí tus capturas <span style={{ color: '#8b8b96' }}>(hasta {MAX_IMG}: alcance, interacciones, retención)</span>
              </p>

              <div className="flex flex-wrap gap-3 mb-4">
                {imgs.map((src, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`captura ${i + 1}`} className="rounded-xl object-cover" style={{ width: 92, height: 130, border: '1px solid #2a2a36' }} />
                    <button onClick={() => setImgs(p => p.filter((_, j) => j !== i))}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold"
                      style={{ background: '#7f1d1d', border: '1px solid #ef4444', color: '#fff' }}>✕</button>
                  </div>
                ))}
                {imgs.length < MAX_IMG && (
                  <label className="flex flex-col items-center justify-center rounded-xl cursor-pointer"
                    style={{ width: 92, height: 130, border: '2px dashed #3a3a4a', background: '#0a0a12' }}>
                    <span className="text-2xl">＋</span>
                    <span className="text-[10px] mt-1" style={{ color: '#8b8b96' }}>captura</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => agregar(e.target.files)} />
                  </label>
                )}
              </div>

              <p className="text-[13px] font-bold mb-2" style={{ color: '#c9c9d4' }}>
                2️⃣ Contame del video <span style={{ color: '#8b8b96' }}>(opcional)</span>
              </p>
              <textarea value={contexto} onChange={e => setContexto(e.target.value)} maxLength={600}
                placeholder="Ej.: era un reel de 30s sobre cómo cobrar más caro, empezaba con una pregunta…"
                className="w-full text-sm rounded-xl px-3 py-2.5 outline-none mb-4"
                style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff', minHeight: 70, resize: 'vertical' }} />

              {error && <p className="text-sm mb-3 font-bold" style={{ color: '#fca5a5' }}>{error}</p>}

              <button onClick={analizar} disabled={cargando || !imgs.length}
                className="w-full py-4 rounded-2xl text-base font-extrabold transition-transform hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(90deg, #7c3aed, #ec4899)', color: '#fff', opacity: cargando || !imgs.length ? 0.55 : 1, boxShadow: '0 0 30px #7c3aed44' }}>
                {cargando ? 'Analizando tus números…' : '🔍 Analizar mi reel'}
              </button>
            </div>

            {res && (
              <div className="rounded-3xl p-6" style={card}>
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  <div className="text-center rounded-2xl px-5 py-3" style={{ background: '#0a0a12', border: `1px solid ${colorNota}55` }}>
                    <div className="text-3xl font-extrabold" style={{ color: colorNota }}>{nota ?? '—'}</div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: '#8b8b96' }}>de 100</div>
                  </div>
                  <p className="flex-1 text-base font-bold" style={{ color: '#fff', minWidth: 200 }}>{res.veredicto}</p>
                </div>

                {res.metricas && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {Object.entries(res.metricas).filter(([, v]) => v !== null && v !== '' && v !== undefined).map(([k, v]) => (
                      <span key={k} className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#c9c9d4' }}>
                        {ETIQUETAS[k] || k}: <b style={{ color: '#fff' }}>{String(v)}</b>
                      </span>
                    ))}
                  </div>
                )}

                {!!res.loBueno?.length && (
                  <div className="rounded-2xl p-4 mb-4" style={{ background: '#0a1a12', border: '1px solid #22c55e44' }}>
                    <p className="text-xs font-extrabold mb-2" style={{ color: '#86efac' }}>✅ Lo que SÍ funcionó</p>
                    {res.loBueno.map((b, i) => <p key={i} className="text-sm mb-1" style={{ color: '#cbead6' }}>· {b}</p>)}
                  </div>
                )}

                {res.problema && (
                  <div className="rounded-2xl p-4 mb-4" style={{ background: '#1a0d0d', border: '1px solid #ef444455' }}>
                    <p className="text-xs font-extrabold mb-1.5" style={{ color: '#fca5a5' }}>🎯 El problema principal</p>
                    <p className="text-sm" style={{ color: '#f0d0d0' }}>{res.problema}</p>
                  </div>
                )}

                {!!res.acciones?.length && (
                  <div className="mb-4">
                    <p className="text-xs font-extrabold mb-2" style={{ color: '#c4b5fd' }}>🛠️ Qué hacer en el próximo video</p>
                    {res.acciones.map((a, i) => (
                      <div key={i} className="rounded-2xl p-3.5 mb-2" style={{ background: '#0a0a12', border: '1px solid #2a2a36' }}>
                        <p className="text-sm font-bold mb-1" style={{ color: '#fff' }}>{i + 1}. {a.que}</p>
                        <p className="text-[12px]" style={{ color: '#9a9aa6' }}>{a.porque}</p>
                      </div>
                    ))}
                  </div>
                )}

                {res.ganchoSugerido && (
                  <div className="rounded-2xl p-4" style={{ background: '#1a1206', border: '1px solid #f59e0b55' }}>
                    <p className="text-xs font-extrabold mb-1.5" style={{ color: '#fcd34d' }}>🎬 Gancho listo para grabar</p>
                    <p className="text-base font-bold" style={{ color: '#fff' }}>“{res.ganchoSugerido}”</p>
                  </div>
                )}

                <p className="text-[11px] mt-4" style={{ color: '#6a6a76' }}>
                  {res.conClienteIdeal
                    ? '🎯 Análisis adaptado a tu cliente ideal.'
                    : '💡 Definí tu cliente ideal en ViralADN y el análisis se vuelve más preciso.'}
                </p>
              </div>
            )}
          </div>
    </main>
  );
}
