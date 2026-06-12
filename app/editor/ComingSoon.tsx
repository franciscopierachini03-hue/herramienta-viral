'use client';

// Pantalla "muy pronto" de TOPCUT: una cuenta regresiva hasta el lanzamiento.
// Se muestra en /editor mientras NEXT_PUBLIC_TOPCUT_LIVE !== '1'. El editor real
// queda intacto detrás de esa bandera (ver app/editor/page.tsx).
//
// Fecha de lanzamiento: NEXT_PUBLIC_TOPCUT_LAUNCH (ISO local) o el default de abajo.

import { useState, useEffect } from 'react';
import ProductNav from '../_components/ProductNav';
import SessionGuard from '../_components/SessionGuard';

const LAUNCH = new Date(process.env.NEXT_PUBLIC_TOPCUT_LAUNCH || '2026-06-08T20:00:00').getTime();

export default function ComingSoon() {
  // null hasta montar en el cliente → evita desajuste de hidratación con el server.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = now === null ? null : Math.max(0, LAUNCH - now);
  const launched = left === 0 && now !== null;

  const boxes: [string, string][] = left === null
    ? [['––', 'Días'], ['––', 'Horas'], ['––', 'Min'], ['––', 'Seg']]
    : [
        [String(Math.floor(left / 86400000)).padStart(2, '0'), 'Días'],
        [String(Math.floor((left % 86400000) / 3600000)).padStart(2, '0'), 'Horas'],
        [String(Math.floor((left % 3600000) / 60000)).padStart(2, '0'), 'Min'],
        [String(Math.floor((left % 60000) / 1000)).padStart(2, '0'), 'Seg'],
      ];

  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="px-6 pt-10 pb-2 max-w-6xl mx-auto w-full">
        <SessionGuard />
        <ProductNav active="topcut" />
      </div>

      <div className="px-6 pb-24 max-w-2xl mx-auto flex flex-col items-center text-center" style={{ paddingTop: 40 }}>
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6"
          style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', boxShadow: '0 0 50px #a855f766', animation: 'cspulse 2.4s ease-in-out infinite' }}>
          ✂️
        </div>

        <span className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3 px-3 py-1 rounded-full"
          style={{ background: '#7c3aed22', border: '1px solid #7c3aed55', color: '#c4b5fd' }}>
          Muy pronto
        </span>

        <h1 className="text-4xl sm:text-5xl font-bold mb-3">
          TOPCUT se lanza en{' '}
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a855f7, #ec4899)' }}>5 días</span>
        </h1>
        <p className="text-sm mb-10" style={{ color: '#999', maxWidth: 460 }}>
          Subes tu video y la IA lo edita sola: recorte, subtítulos animados, B-roll y música. Estamos afinando los últimos detalles.
        </p>

        {launched ? (
          <div className="rounded-3xl px-8 py-10" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #22c55e55' }}>
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-2xl font-bold mb-1">¡Llegó el día!</h2>
            <p className="text-sm" style={{ color: '#888' }}>Estamos activando TOPCUT. Vuelve a entrar en unos minutos.</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            {boxes.map(([val, label], i) => (
              <div key={label} className="flex items-center gap-3 sm:gap-4">
                <div className="flex flex-col items-center">
                  <div className="rounded-2xl flex items-center justify-center tabular-nums"
                    style={{ width: 84, height: 92, background: 'linear-gradient(145deg, #161616, #0d0d0d)', border: '1px solid #2a2a2a', boxShadow: 'inset 0 1px 0 #ffffff0a' }}>
                    <span className="text-4xl sm:text-5xl font-bold" style={{ color: '#fff' }}>{val}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider mt-2" style={{ color: '#666' }}>{label}</span>
                </div>
                {i < boxes.length - 1 && <span className="text-3xl font-bold pb-6" style={{ color: '#2a2a2a' }}>:</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes cspulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(0.94);opacity:0.85} }`}</style>
    </main>
  );
}
