'use client';

// 🎬 /formatos — GUIONES POR FORMATO.
//
// El generador viejo escribía siempre lo mismo: un párrafo de talking head.
// Acá se elige PRIMERO el formato (el formato define cómo se escribe, no solo
// cómo se filma), después la estructura narrativa, y el gancho se elige entre
// cinco en vez de aceptar el primero que salga.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProductNav from '../_components/ProductNav';
import SessionGuard from '../_components/SessionGuard';
import ProductGate from '../_components/ProductGate';
import { FORMATOS, ESTRUCTURAS } from '@/lib/formatos-video';

type Bloque = {
  etiqueta?: string | null; hablado?: string | null; enPantalla?: string | null;
  acotacion?: string | null; columnaA?: string | null; columnaB?: string | null;
};
type Guion = {
  titulo?: string; textoEnPantalla?: string | null; gancho?: string;
  bloques?: Bloque[]; cta?: string; segundos?: number; comoGrabarlo?: string[];
  salida?: string;
};
type Gancho = { texto: string; porQueFunciona?: string };

const card = { background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #23232e' } as const;
const input = { background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff' } as const;

export default function Formatos() {
  const [formato, setFormato] = useState('');
  const [estructura, setEstructura] = useState('');
  const [tema, setTema] = useState('');
  const [estilo, setEstilo] = useState('');

  const [ganchos, setGanchos] = useState<Gancho[]>([]);
  const [elegido, setElegido] = useState('');
  const [guion, setGuion] = useState<Guion | null>(null);

  const [cargando, setCargando] = useState('');
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState('');

  const F = FORMATOS.find(f => f.key === formato);
  const listoParaGanchos = !!formato && !!estructura && tema.trim().length > 3;

  // Al cambiar de formato o tema, lo de abajo deja de tener sentido.
  useEffect(() => { setGanchos([]); setElegido(''); setGuion(null); }, [formato, estructura]);

  async function pedir(modo: 'ganchos' | 'guion', gancho?: string) {
    setCargando(modo); setError('');
    if (modo === 'ganchos') { setGanchos([]); setElegido(''); setGuion(null); }
    try {
      const r = await fetch('/api/formatos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo, formato, estructura, tema, estilo, gancho }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setError(d.error || 'No se pudo generar.'); return; }
      if (modo === 'ganchos') setGanchos(d.ganchos || []);
      else setGuion(d);
    } catch { setError('Error de conexión.'); }
    finally { setCargando(''); }
  }

  // Texto plano para copiar o mandar al teleprompter.
  function comoTexto(g: Guion): string {
    const p: string[] = [];
    if (g.textoEnPantalla) p.push(`[EN PANTALLA] ${g.textoEnPantalla}`);
    if (g.gancho) p.push(g.gancho);
    for (const b of g.bloques || []) {
      if (b.columnaA || b.columnaB) { p.push(`A — ${b.columnaA || ''}\nB — ${b.columnaB || ''}`); continue; }
      const l: string[] = [];
      if (b.etiqueta) l.push(`(${b.etiqueta})`);
      if (b.hablado) l.push(b.hablado);
      if (b.enPantalla) l.push(`\n   [en pantalla] ${b.enPantalla}`);
      if (b.acotacion) l.push(`\n   [${b.acotacion}]`);
      p.push(l.join(' '));
    }
    if (g.cta) p.push(g.cta);
    return p.join('\n\n');
  }
  function copiar(txt: string, id: string) {
    navigator.clipboard?.writeText(txt).then(() => { setCopiado(id); setTimeout(() => setCopiado(''), 1800); });
  }

  return (
    <main className="min-h-screen text-white pb-16" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <SessionGuard />
        <ProductGate product="viraladn" />
        <ProductNav active="viral" />
        <Link href="/app" className="inline-block text-[13px] font-bold mb-1 mt-1" style={{ color: '#c4b5fd' }}>← Volver a ViralADN</Link>

        <div className="text-center mb-6 mt-2">
          <h1 className="text-2xl md:text-3xl font-extrabold mb-2">🎬 Guiones por formato</h1>
          <p className="text-sm" style={{ color: '#b4b4c0' }}>
            El formato no es solo cómo se filma: <b style={{ color: '#fff' }}>es cómo se escribe</b>. Elegí uno y el guion sale con su forma.
          </p>
        </div>

        {/* 1 · FORMATO */}
        <p className="text-[11px] font-extrabold mb-2 tracking-widest" style={{ color: '#8b8b96' }}>1 · ¿QUÉ FORMATO?</p>
        <div className="grid sm:grid-cols-2 gap-2.5 mb-6">
          {FORMATOS.map(f => (
            <button key={f.key} onClick={() => setFormato(f.key)}
              className="text-left rounded-2xl p-3.5 transition-transform hover:-translate-y-0.5"
              style={{ ...card, border: formato === f.key ? '2px solid #a855f7' : '1px solid #23232e', boxShadow: formato === f.key ? '0 0 30px #7c3aed33' : 'none' }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-extrabold text-[15px]">{f.icono} {f.nombre}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#0a0a12', color: f.dificultad === 1 ? '#86efac' : f.dificultad === 2 ? '#fcd34d' : '#fca5a5' }}>
                  {f.dificultad === 1 ? 'fácil' : f.dificultad === 2 ? 'medio' : 'hay que actuar'}
                </span>
              </div>
              <p className="text-[12px] leading-snug mb-1" style={{ color: '#9a9aa6' }}>{f.cuando}</p>
              <p className="text-[11px] leading-snug" style={{ color: '#5f5f6b' }}>📹 {f.comoSeGraba}</p>
            </button>
          ))}
        </div>

        {/* 2 · ESTRUCTURA */}
        {F && (
          <>
            <p className="text-[11px] font-extrabold mb-2 tracking-widest" style={{ color: '#8b8b96' }}>2 · ¿QUÉ HISTORIA CONTÁS?</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {ESTRUCTURAS.map(e => (
                <button key={e.key} onClick={() => setEstructura(e.key)} title={e.angulo}
                  className="text-left rounded-xl px-3 py-2 transition-all"
                  style={{ background: estructura === e.key ? 'linear-gradient(135deg,#7c3aed,#c13584)' : '#101018',
                           border: estructura === e.key ? '1px solid transparent' : '1px solid #23232e',
                           color: estructura === e.key ? '#fff' : '#9a9aa6' }}>
                  <span className="text-[13px] font-bold">{e.nombre}</span>
                  <span className="block text-[10px]" style={{ color: estructura === e.key ? '#ffffffaa' : '#5f5f6b' }}>{e.peso}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* 3 · TEMA */}
        {F && estructura && (
          <div className="rounded-3xl p-5 mb-6" style={card}>
            <p className="text-[11px] font-extrabold mb-2 tracking-widest" style={{ color: '#8b8b96' }}>3 · ¿DE QUÉ VA?</p>
            <textarea value={tema} onChange={e => setTema(e.target.value)} maxLength={400}
              placeholder="Ej: por qué cobrar por hora te está costando plata"
              className="w-full text-sm rounded-xl px-3 py-2.5 outline-none mb-3" style={{ ...input, minHeight: 64, resize: 'vertical' }} />
            <details>
              <summary className="text-[12px] cursor-pointer" style={{ color: '#8b8b96' }}>+ Pegá algo tuyo para que copie tu forma de hablar (opcional)</summary>
              <textarea value={estilo} onChange={e => setEstilo(e.target.value)} maxLength={900}
                placeholder='Ej: "che, me pasó algo que me cambió la cabeza..."'
                className="w-full text-sm rounded-xl px-3 py-2.5 outline-none mt-2" style={{ ...input, minHeight: 70, resize: 'vertical' }} />
            </details>

            {error && <p className="text-sm mt-3 font-bold" style={{ color: '#fca5a5' }}>{error}</p>}

            <button onClick={() => pedir('ganchos')} disabled={!listoParaGanchos || !!cargando}
              className="w-full mt-4 py-4 rounded-2xl text-base font-extrabold transition-transform hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(90deg, #7c3aed, #ec4899)', color: '#fff', opacity: (!listoParaGanchos || cargando) ? 0.5 : 1, boxShadow: '0 0 30px #7c3aed44' }}>
              {cargando === 'ganchos' ? 'Pensando ganchos…' : '⚡ Dame 5 ganchos'}
            </button>
          </div>
        )}

        {/* 4 · ELEGIR GANCHO */}
        {ganchos.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] font-extrabold mb-1 tracking-widest" style={{ color: '#8b8b96' }}>4 · ELEGÍ EL GANCHO</p>
            <p className="text-[12px] mb-3" style={{ color: '#6f6f7b' }}>Son los 3 segundos que deciden si te ven. Elegí el que más te incomode.</p>
            <div className="grid gap-2.5">
              {ganchos.map((g, i) => (
                <button key={i} onClick={() => { setElegido(g.texto); pedir('guion', g.texto); }}
                  className="text-left rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
                  style={{ ...card, border: elegido === g.texto ? '2px solid #22c55e' : '1px solid #23232e' }}>
                  <p className="text-[15px] font-bold leading-snug mb-1">{g.texto}</p>
                  {g.porQueFunciona && <p className="text-[11px]" style={{ color: '#86efac' }}>↳ {g.porQueFunciona}</p>}
                </button>
              ))}
            </div>
            {cargando === 'guion' && <p className="text-sm mt-3 text-center" style={{ color: '#c4b5fd' }}>Escribiendo el guion…</p>}
          </div>
        )}

        {/* 5 · EL GUION */}
        {guion && (
          <div className="rounded-3xl p-5" style={{ ...card, border: '1px solid #22c55e55' }}>
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div>
                <p className="font-extrabold text-lg">{guion.titulo || 'Tu guion'}</p>
                <p className="text-[11px]" style={{ color: '#6f6f7b' }}>
                  {F?.icono} {F?.nombre}{guion.segundos ? ` · ~${guion.segundos}s` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => copiar(comoTexto(guion), 'todo')}
                  className="text-xs font-bold px-3 py-2 rounded-xl" style={{ background: '#12101f', border: '1px solid #7c3aed66', color: '#c4b5fd' }}>
                  {copiado === 'todo' ? '✅ copiado' : '📋 Copiar'}
                </button>
                <button onClick={() => pedir('guion', elegido)}
                  className="text-xs font-bold px-3 py-2 rounded-xl" style={{ background: '#101018', border: '1px solid #2a2a36', color: '#9a9aa6' }}>
                  🔄 Otra versión
                </button>
              </div>
            </div>

            {guion.textoEnPantalla && (
              <div className="rounded-xl p-3 mb-3" style={{ background: '#1a1206', border: '1px solid #f59e0b55' }}>
                <p className="text-[10px] font-extrabold mb-1 tracking-wider" style={{ color: '#fcd34d' }}>TEXTO FIJO EN PANTALLA</p>
                <p className="text-[15px] font-bold">{guion.textoEnPantalla}</p>
              </div>
            )}

            {guion.gancho && (
              <div className="rounded-xl p-3 mb-3" style={{ background: '#0a1a12', border: '1px solid #22c55e55' }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[10px] font-extrabold tracking-wider" style={{ color: '#86efac' }}>GANCHO · LOS PRIMEROS 3 SEGUNDOS</p>
                  <button onClick={() => copiar(guion.gancho || '', 'g')} className="text-[10px]" style={{ color: '#5a8a6a' }}>
                    {copiado === 'g' ? '✅' : 'copiar'}
                  </button>
                </div>
                <p className="text-[16px] font-bold leading-snug">{guion.gancho}</p>
              </div>
            )}

            <div className="grid gap-2 mb-3">
              {(guion.bloques || []).map((b, i) => (
                b.columnaA || b.columnaB ? (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl p-3" style={{ background: '#0a0a12', border: '1px solid #2a2a36' }}>
                      <p className="text-[10px] font-extrabold mb-1" style={{ color: '#fca5a5' }}>A</p>
                      <p className="text-sm">{b.columnaA}</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: '#0a0a12', border: '1px solid #2a2a36' }}>
                      <p className="text-[10px] font-extrabold mb-1" style={{ color: '#86efac' }}>B</p>
                      <p className="text-sm">{b.columnaB}</p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="rounded-xl p-3" style={{ background: '#0a0a12', border: '1px solid #2a2a36' }}>
                    {b.etiqueta && <p className="text-[10px] font-extrabold mb-1" style={{ color: '#a78bfa' }}>{b.etiqueta}</p>}
                    {b.hablado && <p className="text-[15px] leading-relaxed">{b.hablado}</p>}
                    {b.enPantalla && (
                      <p className="text-[12px] mt-2 px-2 py-1 rounded inline-block" style={{ background: '#1a1206', color: '#fcd34d' }}>
                        📺 {b.enPantalla}
                      </p>
                    )}
                    {b.acotacion && <p className="text-[11px] mt-2 italic" style={{ color: '#6f6f7b' }}>🎬 {b.acotacion}</p>}
                  </div>
                )
              ))}
            </div>

            {guion.cta && (
              <div className="rounded-xl p-3 mb-3" style={{ background: '#12101f', border: '1px solid #7c3aed66' }}>
                <p className="text-[10px] font-extrabold mb-1 tracking-wider" style={{ color: '#c4b5fd' }}>CIERRE</p>
                <p className="text-[15px] font-bold">{guion.cta}</p>
              </div>
            )}

            {guion.comoGrabarlo && guion.comoGrabarlo.length > 0 && (
              <div className="rounded-xl p-3" style={{ background: '#0a0a12', border: '1px solid #23232e' }}>
                <p className="text-[10px] font-extrabold mb-1.5 tracking-wider" style={{ color: '#8b8b96' }}>CÓMO GRABARLO</p>
                {guion.comoGrabarlo.map((c, i) => (
                  <p key={i} className="text-[12px] leading-relaxed" style={{ color: '#9a9aa6' }}>· {c}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
