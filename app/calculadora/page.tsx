'use client';

// 🧮 /calculadora — pegas tu guion y te dice cuánto puntúa, con el método de
// Francisco. Lo importante no es la nota: es QUÉ le falta y CÓMO arreglarlo
// antes de gastar una grabación.

import { useState } from 'react';
import Link from 'next/link';
import ProductNav from '../_components/ProductNav';
import SessionGuard from '../_components/SessionGuard';
import ProductGate from '../_components/ProductGate';
import { CRITERIOS } from '@/lib/calculadora-viral';

type Crit = { key: string; pregunta: string; peso: number; cumple: boolean; porque: string; arreglo: string };
type Res = {
  puntos: number; total: number;
  veredicto: { nivel: string; color: string; frase: string };
  criterios: Crit[]; pierdePor: number; prioridad: string[];
  loMejor: string; elProblema: string; reescritura: string;
};

const card = { background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #23232e' } as const;

export default function Calculadora() {
  const [guion, setGuion] = useState('');
  const [res, setRes] = useState<Res | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);

  async function medir() {
    if (guion.trim().length < 40) { setError('Pega el guion completo — así no hay nada que medir.'); return; }
    setCargando(true); setError(''); setRes(null);
    try {
      const r = await fetch('/api/calculadora', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guion }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setError(d.error || 'No se pudo evaluar.'); return; }
      setRes(d);
    } catch { setError('Error de conexión.'); }
    finally { setCargando(false); }
  }

  const pct = res ? (res.puntos / res.total) * 100 : 0;

  return (
    <main className="min-h-screen text-white pb-16" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <SessionGuard />
        <ProductGate product="viraladn" />
        <ProductNav active="viral" />
        <Link href="/app" className="inline-block text-[13px] font-bold mb-1 mt-1" style={{ color: '#c4b5fd' }}>← Volver a ViralADN</Link>

        <div className="text-center mb-5 mt-2">
          <h1 className="text-2xl md:text-3xl font-extrabold mb-2">🧮 Calculadora viral</h1>
          <p className="text-sm max-w-lg mx-auto" style={{ color: '#b4b4c0' }}>
            Pega tu guion antes de grabarlo. Te decimos <b style={{ color: '#fff' }}>cuánto puntúa del 1 al 10</b>,
            qué le falta y cómo arreglarlo.
          </p>
        </div>

        {/* Qué se mide — para que el número no sea una caja negra */}
        <details className="rounded-2xl mb-5 overflow-hidden" style={card}>
          <summary className="px-4 py-3 cursor-pointer text-[13px] font-bold" style={{ color: '#c9c9d4' }}>
            ¿Cómo se calcula? · 6 criterios, 10 puntos
          </summary>
          <div className="px-4 pb-4" style={{ borderTop: '1px solid #23232e' }}>
            {CRITERIOS.map(c => (
              <div key={c.key} className="flex items-start gap-3 pt-3">
                <span className="text-[13px] font-extrabold shrink-0 px-2 py-0.5 rounded"
                  style={{ background: '#12101f', color: '#c4b5fd', minWidth: 38, textAlign: 'center' }}>
                  {c.peso}
                </span>
                <div>
                  <p className="text-[13px] font-bold">{c.pregunta}</p>
                  <p className="text-[11px] leading-snug" style={{ color: '#8b8b96' }}>{c.significa}</p>
                </div>
              </div>
            ))}
            <p className="text-[11px] mt-4 leading-relaxed" style={{ color: '#6f6f7b' }}>
              💡 Que se entienda fácil y que se apoye en algo conocido pesan <b style={{ color: '#9a9aa6' }}>4.5 de los 10</b>.
              La controversia, que es lo que todos persiguen, es lo que menos pesa.
            </p>
          </div>
        </details>

        {/* El guion */}
        <div className="rounded-3xl p-5 mb-5" style={card}>
          <p className="text-[11px] font-extrabold mb-2 tracking-widest" style={{ color: '#8b8b96' }}>TU GUION</p>
          <textarea value={guion} onChange={e => setGuion(e.target.value)} maxLength={6000}
            placeholder={'Pega aquí el guion completo, tal cual lo vas a decir.\n\nSi tienes solo el gancho, pégalo igual — se puede medir.'}
            className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
            style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff', minHeight: 170, resize: 'vertical' }} />
          <div className="flex items-center justify-between mt-1 mb-3">
            <span className="text-[11px]" style={{ color: '#5f5f6b' }}>{guion.length} / 6000</span>
          </div>

          {error && <p className="text-sm mb-3 font-bold" style={{ color: '#fca5a5' }}>{error}</p>}

          <button onClick={medir} disabled={cargando || guion.trim().length < 40}
            className="w-full py-4 rounded-2xl text-base font-extrabold transition-transform hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(90deg, #7c3aed, #ec4899)', color: '#fff',
                     opacity: (cargando || guion.trim().length < 40) ? 0.5 : 1, boxShadow: '0 0 30px #7c3aed44' }}>
            {cargando ? 'Midiendo…' : '🧮 Calcular puntaje'}
          </button>
        </div>

        {/* Resultado */}
        {res && (
          <>
            <div className="rounded-3xl p-6 mb-4 text-center" style={{ ...card, border: `1px solid ${res.veredicto.color}66` }}>
              <div className="text-6xl font-extrabold leading-none mb-1" style={{ color: res.veredicto.color }}>
                {res.puntos}<span className="text-2xl" style={{ color: '#5f5f6b' }}>/{res.total}</span>
              </div>
              <p className="text-base font-bold mb-1" style={{ color: res.veredicto.color }}>{res.veredicto.nivel}</p>
              <p className="text-[13px] mb-4" style={{ color: '#9a9aa6' }}>{res.veredicto.frase}</p>
              <div className="w-full rounded-full" style={{ height: 10, background: '#1a1a24' }}>
                <div className="rounded-full transition-all" style={{ width: `${pct}%`, height: 10, background: res.veredicto.color }} />
              </div>
              {res.pierdePor > 0 && (
                <p className="text-[12px] mt-3" style={{ color: '#fcd34d' }}>
                  Está dejando <b>{res.pierdePor} puntos</b> en la mesa. Abajo está cómo recuperarlos.
                </p>
              )}
            </div>

            {res.elProblema && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: '#1a0d0d', border: '1px solid #ef444455' }}>
                <p className="text-[10px] font-extrabold mb-1 tracking-widest" style={{ color: '#fca5a5' }}>EL PROBLEMA</p>
                <p className="text-[15px] leading-relaxed">{res.elProblema}</p>
              </div>
            )}

            {res.loMejor && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: '#0a1a12', border: '1px solid #22c55e55' }}>
                <p className="text-[10px] font-extrabold mb-1 tracking-widest" style={{ color: '#86efac' }}>LO QUE SÍ FUNCIONA — NO LO TOQUES</p>
                <p className="text-[15px] leading-relaxed" style={{ color: '#cbead6' }}>&ldquo;{res.loMejor}&rdquo;</p>
              </div>
            )}

            {/* Los 6 criterios */}
            <div className="grid gap-2 mb-4">
              {res.criterios.map(c => (
                <div key={c.key} className="rounded-2xl p-4"
                  style={{ background: '#0a0a12', border: `1px solid ${c.cumple ? '#22c55e44' : '#ef444444'}` }}>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-[14px] font-bold">
                      {c.cumple ? '✅' : '❌'} {c.pregunta}
                    </p>
                    <span className="text-[12px] font-extrabold shrink-0"
                      style={{ color: c.cumple ? '#86efac' : '#6f6f7b' }}>
                      {c.cumple ? `+${c.peso}` : `0 / ${c.peso}`}
                    </span>
                  </div>
                  {c.porque && <p className="text-[12px] leading-relaxed" style={{ color: '#9a9aa6' }}>{c.porque}</p>}
                  {!c.cumple && c.arreglo && (
                    <p className="text-[12px] leading-relaxed mt-2 px-3 py-2 rounded-lg"
                      style={{ background: '#1a1206', color: '#fcd34d' }}>
                      🔧 {c.arreglo}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {res.reescritura && (
              <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg,#12101f,#0d0d0d)', border: '1px solid #7c3aed66' }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[10px] font-extrabold tracking-widest" style={{ color: '#c4b5fd' }}>EL GANCHO, REESCRITO PARA SUBIR</p>
                  <button onClick={() => { navigator.clipboard?.writeText(res.reescritura); setCopiado(true); setTimeout(() => setCopiado(false), 1800); }}
                    className="text-[11px] font-bold px-2 py-1 rounded-lg"
                    style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#c4b5fd' }}>
                    {copiado ? '✅ copiado' : '📋 copiar'}
                  </button>
                </div>
                <p className="text-[16px] font-bold leading-snug">{res.reescritura}</p>
                <p className="text-[11px] mt-3" style={{ color: '#6f6f7b' }}>
                  Cámbialo, vuelve a medir y mira cuánto sube. Eso es lo que te dice si vas bien.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
