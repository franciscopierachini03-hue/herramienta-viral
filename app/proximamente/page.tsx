'use client';

// Landing de HYPE / pre-lanzamiento — MISMA línea gráfica de ViralADN
// (negro violáceo, degradado violeta→rosa, logo, tarjetas redondeadas).
// Título: ViralADN ✕ TOPCUT. Cuenta regresiva + captura de correos.
//
// Fecha del lanzamiento: NEXT_PUBLIC_LAUNCH_DATE (ISO) o el default de abajo.

import { useState, useEffect } from 'react';

const LAUNCH = new Date(process.env.NEXT_PUBLIC_LAUNCH_DATE || '2026-06-09T20:00:00').getTime();
const GRAD = 'linear-gradient(135deg, #a855f7, #ec4899)';

export default function Proximamente() {
  const [now, setNow] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

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

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim();
    if (!v || !/.+@.+\..+/.test(v) || busy) { setErr('Poné un correo válido.'); return; }
    setBusy(true); setErr('');
    try {
      await fetch('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: v }) });
      setSent(true);
    } catch { setErr('Reintentá en un momento.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen text-white flex flex-col items-center justify-center px-6 py-16"
      style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="w-full max-w-2xl text-center">

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.svg" alt="ViralADN" width={64} height={64} className="mx-auto mb-6"
          style={{ filter: 'drop-shadow(0 0 22px #7c3aed66)' }} />

        <span className="inline-block text-[11px] font-bold uppercase tracking-[0.25em] mb-5 px-3 py-1 rounded-full"
          style={{ background: '#7c3aed22', border: '1px solid #7c3aed55', color: '#c4b5fd' }}>
          Muy pronto
        </span>

        {/* Título: ViralADN ✕ TOPCUT */}
        <h1 className="font-bold leading-tight mb-4" style={{ fontSize: 'clamp(40px, 9vw, 76px)', letterSpacing: '-1.5px' }}>
          <span style={{ color: '#fff' }}>ViralADN</span>
          <span style={{ color: '#7c3aed', margin: '0 0.18em', fontWeight: 400 }}>✕</span>
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: GRAD }}>TOPCUT</span>
        </h1>

        <p className="text-base sm:text-lg mb-2" style={{ color: '#eaeaea' }}>El juego está por cambiar.</p>
        <p className="text-sm mb-10" style={{ color: '#999', maxWidth: 460, margin: '0 auto 40px' }}>
          Volvemos más grandes — y ahora tu video se edita solo con IA. Estamos puliendo los últimos detalles.
        </p>

        {/* Cuenta regresiva */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 mb-12">
          {boxes.map(([v, l], i) => (
            <div key={l} className="flex items-center gap-3 sm:gap-4">
              <div className="flex flex-col items-center">
                <div className="rounded-2xl flex items-center justify-center tabular-nums"
                  style={{ width: 'clamp(64px,18vw,86px)', height: 'clamp(72px,20vw,94px)', background: 'linear-gradient(145deg, #161616, #0d0d0d)', border: '1px solid #2a2a2a', boxShadow: 'inset 0 1px 0 #ffffff0a' }}>
                  <span className="font-bold" style={{ color: '#fff', fontSize: 'clamp(30px,8vw,46px)' }}>{v}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider mt-2" style={{ color: '#666' }}>{l}</span>
              </div>
              {i < boxes.length - 1 && <span className="font-bold pb-6" style={{ color: '#2a2a2a', fontSize: 28 }}>:</span>}
            </div>
          ))}
        </div>

        {/* Captura de correo */}
        {sent ? (
          <div className="mx-auto max-w-sm rounded-2xl px-5 py-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #22c55e55' }}>
            <div className="font-bold" style={{ color: '#86efac' }}>✓ ¡Estás en la lista!</div>
            <div className="text-xs mt-1" style={{ color: '#888' }}>Vas a ser de los primeros en entrar el día del lanzamiento.</div>
          </div>
        ) : (
          <form onSubmit={join} className="mx-auto max-w-md">
            <p className="text-xs mb-2" style={{ color: '#888' }}>Dejá tu correo y entrá primero el día del lanzamiento.</p>
            <div className="flex gap-2">
              <input value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }}
                placeholder="tu@correo.com" inputMode="email"
                className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: '#0c0c0c', border: '1px solid #2a2a2a', color: '#fff' }} />
              <button type="submit" disabled={busy}
                className="px-6 py-3 rounded-2xl text-sm font-bold disabled:opacity-50"
                style={{ background: GRAD, color: '#fff', boxShadow: '0 0 24px #a855f744' }}>
                {busy ? '…' : 'Quiero entrar'}
              </button>
            </div>
            {err && <div className="text-xs mt-2" style={{ color: '#fca5a5' }}>{err}</div>}
          </form>
        )}

        <div className="text-[11px] mt-12" style={{ color: '#444' }}>ViralADN · 2CLICKS.COM LLC</div>
      </div>
    </main>
  );
}
