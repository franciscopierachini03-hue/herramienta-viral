'use client';

// 📖 /historias — ARMADOR DE HISTORIAS QUE VENDEN (método de Francisco).
// Elegís uno de los 4 formatos, contestás 2-3 preguntas de tu negocio y la IA
// arma la historia lista para publicar, adaptada a tu nicho y cliente ideal.

import { useState } from 'react';
import ProductNav from '../_components/ProductNav';
import SessionGuard from '../_components/SessionGuard';
import ProductGate from '../_components/ProductGate';
import { FORMATOS } from '@/lib/historias-formatos';

type Pregunta = { key: string; label: string; placeholder: string };
type Historia = {
  historia?: { encabezado?: string | null; texto?: string; opciones?: string[]; cta?: string };
  variantes?: { texto: string; cta: string }[];
  comoUsarla?: string[];
  queResponder?: string;
  cuando?: string;
};

export default function Historias() {
  const [sel, setSel] = useState<string>('');
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [resp, setResp] = useState<Record<string, string>>({});
  const [clienteIdeal, setClienteIdeal] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [res, setRes] = useState<Historia | null>(null);
  const [copiado, setCopiado] = useState('');

  const formato = FORMATOS.find(f => f.key === sel);

  async function elegir(key: string) {
    setSel(key); setRes(null); setError(''); setResp({});
    try {
      const r = await fetch('/api/historias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'preguntas', formato: key }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo cargar.'); return; }
      setPreguntas(d.preguntas || []); setClienteIdeal(d.clienteIdeal || '');
    } catch { setError('Error de conexión.'); }
  }

  async function armar() {
    const faltan = preguntas.filter(p => !(resp[p.key] || '').trim());
    if (faltan.length) { setError('Completá todas las preguntas para que quede bien hecha.'); return; }
    setError(''); setCargando(true); setRes(null);
    try {
      const r = await fetch('/api/historias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'armar', formato: sel, respuestas: resp }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'No se pudo armar.'); return; }
      setRes(d);
    } catch { setError('Error de conexión.'); }
    finally { setCargando(false); }
  }

  function copiar(txt: string, id: string) {
    navigator.clipboard?.writeText(txt).then(() => { setCopiado(id); setTimeout(() => setCopiado(''), 1800); });
  }

  const card = { background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #23232e' } as const;
  const input = { background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff' } as const;
  const h = res?.historia;
  const textoCompleto = h ? [h.encabezado, h.texto, ...(h.opciones || []), h.cta].filter(Boolean).join('\n') : '';

  return (
    <main className="min-h-screen text-white pb-16" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <SessionGuard />
        <ProductGate product="viraladn" />
        <ProductNav active="viral" />

        <div className="text-center mb-6 mt-2">
          <h1 className="text-2xl md:text-3xl font-extrabold mb-2">📖 Historias que venden</h1>
          <p className="text-sm" style={{ color: '#b4b4c0' }}>
            Elegí un formato, contame de tu negocio y te armo la historia <b style={{ color: '#fff' }}>lista para publicar</b>.
          </p>
        </div>

        {/* 1. Formatos */}
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {FORMATOS.map(f => (
            <button key={f.key} onClick={() => elegir(f.key)}
              className="text-left rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
              style={{ ...card, border: sel === f.key ? '2px solid #a855f7' : '1px solid #23232e', boxShadow: sel === f.key ? '0 0 30px #7c3aed33' : 'none' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{f.icono}</span>
                <span className="font-extrabold text-base">{f.nombre}</span>
              </div>
              <p className="text-[11px] mb-1.5" style={{ color: '#fcd34d' }}>{f.cuando}</p>
              <p className="text-[12px] leading-relaxed" style={{ color: '#9a9aa6' }}>{f.paraQue}</p>
            </button>
          ))}
        </div>

        {/* 2. Ejemplo + preguntas */}
        {formato && (
          <div className="rounded-3xl p-6 mb-5" style={card}>
            <p className="text-[13px] font-bold mb-2" style={{ color: '#c9c9d4' }}>Cómo funciona</p>
            <p className="text-sm mb-4" style={{ color: '#b4b4c0' }}>{formato.comoFunciona}</p>

            <div className="rounded-2xl p-4 mb-5" style={{ background: '#0a0a12', border: '1px solid #2a2a36' }}>
              <p className="text-[11px] font-extrabold mb-2" style={{ color: '#8b8b96' }}>EJEMPLO DE LA CLASE</p>
              {formato.ejemplo.encabezado && (
                <span className="inline-block text-[11px] font-extrabold px-2 py-1 rounded mb-2" style={{ background: '#fff', color: '#000' }}>{formato.ejemplo.encabezado}</span>
              )}
              <p className="text-sm font-bold mb-2" style={{ color: '#fff' }}>{formato.ejemplo.pregunta}</p>
              {formato.ejemplo.opciones?.map((o, i) => <p key={i} className="text-[13px]" style={{ color: '#c9c9d4' }}>{o}</p>)}
              <p className="text-[13px] mt-2 px-2 py-1.5 rounded" style={{ background: '#dc2626', color: '#fff' }}>{formato.ejemplo.cta}</p>
            </div>

            {clienteIdeal && (
              <p className="text-[12px] mb-4 px-3 py-2 rounded-xl" style={{ background: '#0a1a12', border: '1px solid #22c55e44', color: '#86efac' }}>
                🎯 Se adapta a tu cliente ideal: {clienteIdeal.slice(0, 140)}{clienteIdeal.length > 140 ? '…' : ''}
              </p>
            )}

            {preguntas.map(p => (
              <label key={p.key} className="block mb-3">
                <span className="block text-[13px] font-bold mb-1.5" style={{ color: '#c9c9d4' }}>{p.label}</span>
                <textarea value={resp[p.key] || ''} onChange={e => setResp(v => ({ ...v, [p.key]: e.target.value }))}
                  placeholder={p.placeholder} maxLength={500}
                  className="w-full text-sm rounded-xl px-3 py-2.5 outline-none" style={{ ...input, minHeight: 60, resize: 'vertical' }} />
              </label>
            ))}

            {error && <p className="text-sm mb-3 font-bold" style={{ color: '#fca5a5' }}>{error}</p>}

            <button onClick={armar} disabled={cargando}
              className="w-full py-4 rounded-2xl text-base font-extrabold transition-transform hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(90deg, #7c3aed, #ec4899)', color: '#fff', opacity: cargando ? 0.55 : 1, boxShadow: '0 0 30px #7c3aed44' }}>
              {cargando ? 'Armando tu historia…' : '✨ Armar mi historia'}
            </button>
          </div>
        )}

        {/* 3. Resultado */}
        {h && (
          <div className="rounded-3xl p-6" style={card}>
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <p className="text-xs font-extrabold" style={{ color: '#c4b5fd' }}>📱 Tu historia, lista para publicar</p>
              <button onClick={() => copiar(textoCompleto, 'todo')} className="text-xs font-bold px-3 py-1.5 rounded-xl"
                style={{ background: '#14141f', border: '1px solid #2e2e3e', color: copiado === 'todo' ? '#86efac' : '#c9c9d4' }}>
                {copiado === 'todo' ? '✓ Copiado' : 'Copiar todo'}
              </button>
            </div>

            {/* Vista tipo historia de IG */}
            <div className="rounded-2xl p-5 mb-4" style={{ background: 'linear-gradient(160deg, #1e1b3a, #0d0d16)', border: '1px solid #3a3a5a' }}>
              {h.encabezado && (
                <span className="inline-block text-[11px] font-extrabold px-2.5 py-1 rounded mb-3" style={{ background: '#fff', color: '#000' }}>{h.encabezado}</span>
              )}
              <p className="text-lg font-extrabold mb-3 leading-snug" style={{ color: '#fff' }}>{h.texto}</p>
              {h.opciones?.map((o, i) => (
                <p key={i} className="text-sm mb-1.5 px-3 py-2 rounded-lg" style={{ background: '#ffffff12', color: '#e8e8f0' }}>{o}</p>
              ))}
              {h.cta && <p className="text-sm font-bold mt-3 px-3 py-2.5 rounded-lg" style={{ background: '#dc2626', color: '#fff' }}>{h.cta}</p>}
            </div>

            {res?.cuando && <p className="text-[12px] mb-4" style={{ color: '#fcd34d' }}>📅 Subila: {res.cuando}</p>}

            {!!res?.variantes?.length && (
              <div className="mb-4">
                <p className="text-xs font-extrabold mb-2" style={{ color: '#c9c9d4' }}>🔄 Otras versiones</p>
                {res.variantes.map((v, i) => (
                  <div key={i} className="rounded-2xl p-3.5 mb-2 flex items-start justify-between gap-2" style={{ background: '#0a0a12', border: '1px solid #2a2a36' }}>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#fff' }}>{v.texto}</p>
                      <p className="text-[12px] mt-1" style={{ color: '#9a9aa6' }}>{v.cta}</p>
                    </div>
                    <button onClick={() => copiar(`${v.texto}\n${v.cta}`, `v${i}`)} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg shrink-0"
                      style={{ background: '#14141f', border: '1px solid #2e2e3e', color: copiado === `v${i}` ? '#86efac' : '#c9c9d4' }}>
                      {copiado === `v${i}` ? '✓' : 'Copiar'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!!res?.comoUsarla?.length && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: '#0a0a12', border: '1px solid #2a2a36' }}>
                <p className="text-xs font-extrabold mb-2" style={{ color: '#c4b5fd' }}>💡 Cómo sacarle jugo</p>
                {res.comoUsarla.map((t, i) => <p key={i} className="text-sm mb-1.5" style={{ color: '#c9c9d4' }}>· {t}</p>)}
              </div>
            )}

            {res?.queResponder && (
              <div className="rounded-2xl p-4" style={{ background: '#1a1206', border: '1px solid #f59e0b55' }}>
                <p className="text-xs font-extrabold mb-1.5" style={{ color: '#fcd34d' }}>💬 Qué contestarle a quien te escriba</p>
                <p className="text-sm" style={{ color: '#e8d8b4' }}>{res.queResponder}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
