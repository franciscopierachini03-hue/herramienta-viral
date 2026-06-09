'use client';

// Cartel de mantenimiento: "La página se volverá a activar en…" + cuenta regresiva.
// Línea gráfica de ViralADN (negro violáceo, degradado violeta→rosa, logo).
// Fecha: NEXT_PUBLIC_LAUNCH_DATE (ISO) o el default de abajo.

import { useState, useEffect } from 'react';

const LAUNCH = new Date(process.env.NEXT_PUBLIC_LAUNCH_DATE || '2026-06-09T20:00:00').getTime();

export default function Proximamente() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = now === null ? null : Math.max(0, LAUNCH - now);
  const boxes: [string, string][] = left === null
    ? [['––', 'Días'], ['––', 'Horas'], ['––', 'Min'], ['––', 'Seg']]
    : [
        [String(Math.floor(left / 86400000)).padStart(2, '0'), 'Días'],
        [String(Math.floor((left % 86400000) / 3600000)).padStart(2, '0'), 'Horas'],
        [String(Math.floor((left % 3600000) / 60000)).padStart(2, '0'), 'Min'],
        [String(Math.floor((left % 60000) / 1000)).padStart(2, '0'), 'Seg'],
      ];

  return (
    <main className="min-h-screen text-white flex items-center justify-center px-6 py-16"
      style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>

      {/* Cartel */}
      <div className="w-full max-w-lg text-center rounded-3xl px-6 sm:px-10 py-10"
        style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed44', boxShadow: '0 0 60px #7c3aed22' }}>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.svg" alt="ViralADN" width={56} height={56} className="mx-auto mb-5"
          style={{ filter: 'drop-shadow(0 0 20px #7c3aed66)' }} />

        {/* Frase de marca */}
        <div className="font-bold mb-6" style={{ fontSize: 'clamp(18px,5vw,26px)', letterSpacing: '-0.5px' }}>
          <span style={{ color: '#fff' }}>ViralADN</span>
          <span style={{ color: '#7c3aed', margin: '0 0.18em', fontWeight: 400 }}>✕</span>
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a855f7, #ec4899)' }}>TOPCUT</span>
        </div>

        <p className="text-sm sm:text-base mb-7" style={{ color: '#999' }}>
          La página se volverá a activar en
        </p>

        {/* Cuenta regresiva */}
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {boxes.map(([v, l], i) => (
            <div key={l} className="flex items-center gap-2 sm:gap-3">
              <div className="flex flex-col items-center">
                <div className="rounded-2xl flex items-center justify-center tabular-nums"
                  style={{ width: 'clamp(60px,17vw,80px)', height: 'clamp(66px,18vw,90px)', background: '#0c0c0c', border: '1px solid #2a2a2a', boxShadow: 'inset 0 1px 0 #ffffff0a' }}>
                  <span className="font-bold" style={{ color: '#fff', fontSize: 'clamp(28px,7vw,42px)' }}>{v}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider mt-2" style={{ color: '#666' }}>{l}</span>
              </div>
              {i < boxes.length - 1 && <span className="font-bold pb-6" style={{ color: '#2a2a2a', fontSize: 26 }}>:</span>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
