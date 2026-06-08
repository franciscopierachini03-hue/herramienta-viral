'use client';

// Landing de HYPE / pre-lanzamiento — estética "How to Sell Drugs Online (Fast)":
// negro, glitch neón, scanlines, cuenta regresiva y captura de correos.
// Por ahora vive en /proximamente (preview). Cuando se active el modo cerrado,
// el resto de la plataforma cae acá.
//
// Fecha del lanzamiento: NEXT_PUBLIC_LAUNCH_DATE (ISO) o el default de abajo.

import { useState, useEffect } from 'react';

const LAUNCH = new Date(process.env.NEXT_PUBLIC_LAUNCH_DATE || '2026-06-28T20:00:00').getTime();
const GREEN = '#00ff66';

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
    ? [['--', 'DÍAS'], ['--', 'HS'], ['--', 'MIN'], ['--', 'SEG']]
    : [
        [String(Math.floor(left / 86400000)).padStart(2, '0'), 'DÍAS'],
        [String(Math.floor((left % 86400000) / 3600000)).padStart(2, '0'), 'HS'],
        [String(Math.floor((left % 3600000) / 60000)).padStart(2, '0'), 'MIN'],
        [String(Math.floor((left % 60000) / 1000)).padStart(2, '0'), 'SEG'],
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
    <main className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-6"
      style={{ background: '#000', fontFamily: "'Courier New', ui-monospace, monospace" }}>

      {/* scanlines + vignette + flicker */}
      <div className="pl-scan" />
      <div className="pl-vignette" />

      <div className="relative z-10 w-full max-w-2xl text-center">
        <div className="text-xs tracking-[0.5em] mb-6" style={{ color: GREEN, opacity: 0.7 }}>
          ▸ TRANSMISIÓN ENTRANTE<span className="pl-cursor">_</span>
        </div>

        {/* Título glitch */}
        <h1 className="pl-glitch font-extrabold leading-none mb-4" data-text="VIRALADN"
          style={{ color: '#fff', fontSize: 'clamp(48px, 13vw, 120px)', letterSpacing: '-2px' }}>
          VIRALADN
        </h1>

        <p className="text-base sm:text-lg mb-2" style={{ color: '#fff' }}>
          El juego está por cambiar.
        </p>
        <p className="text-sm mb-10" style={{ color: '#7CFC9E' }}>
          Volvemos más grandes — y esta vez tu video se edita solo. <span style={{ color: GREEN, fontWeight: 700 }}>TOPCUT</span> llega.
        </p>

        {/* Cuenta regresiva */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-12">
          {boxes.map(([v, l], i) => (
            <div key={l} className="flex items-center gap-2 sm:gap-4">
              <div className="flex flex-col items-center">
                <div className="pl-num flex items-center justify-center"
                  style={{ width: 'clamp(58px,18vw,88px)', height: 'clamp(64px,20vw,100px)', border: `1px solid ${GREEN}44`, background: '#04140a' }}>
                  <span style={{ color: GREEN, fontSize: 'clamp(30px,9vw,52px)', fontWeight: 800, textShadow: `0 0 14px ${GREEN}99` }}>{v}</span>
                </div>
                <span className="text-[10px] tracking-widest mt-2" style={{ color: '#5a8f6e' }}>{l}</span>
              </div>
              {i < boxes.length - 1 && <span className="pb-5" style={{ color: `${GREEN}66`, fontSize: 28 }}>:</span>}
            </div>
          ))}
        </div>

        {/* Captura de correo */}
        {sent ? (
          <div className="mx-auto max-w-sm rounded-md px-5 py-4" style={{ border: `1px solid ${GREEN}55`, background: '#04140a' }}>
            <div style={{ color: GREEN, fontWeight: 700 }}>✓ ESTÁS EN LA LISTA</div>
            <div className="text-xs mt-1" style={{ color: '#7CFC9E' }}>Vas a ser de los primeros en entrar el día del lanzamiento.</div>
          </div>
        ) : (
          <form onSubmit={join} className="mx-auto max-w-md">
            <div className="text-xs tracking-widest mb-2" style={{ color: '#5a8f6e' }}>&gt;_ DEJÁ TU CORREO PARA ENTRAR PRIMERO</div>
            <div className="flex gap-2">
              <input value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }}
                placeholder="tu@correo.com" inputMode="email"
                className="flex-1 px-4 py-3 text-sm outline-none"
                style={{ background: '#04140a', border: `1px solid ${GREEN}55`, color: '#fff' }} />
              <button type="submit" disabled={busy}
                className="px-5 py-3 text-sm font-extrabold tracking-wider disabled:opacity-50"
                style={{ background: GREEN, color: '#000', textShadow: 'none' }}>
                {busy ? '...' : 'UNIRME'}
              </button>
            </div>
            {err && <div className="text-xs mt-2" style={{ color: '#ff5a5a' }}>{err}</div>}
          </form>
        )}

        <div className="text-[10px] tracking-[0.3em] mt-12" style={{ color: '#2f4a3a' }}>VIRALADN · 2CLICKS.COM LLC</div>
      </div>

      <style>{`
        @keyframes pl-flicker { 0%,100%{opacity:0.97} 50%{opacity:1} 92%{opacity:0.9} }
        .pl-scan{position:fixed;inset:0;pointer-events:none;z-index:5;
          background:repeating-linear-gradient(0deg, rgba(0,255,102,0.05) 0px, rgba(0,255,102,0.05) 1px, transparent 1px, transparent 3px);
          animation:pl-flicker 4s infinite;}
        .pl-vignette{position:fixed;inset:0;pointer-events:none;z-index:5;
          background:radial-gradient(ellipse 70% 60% at 50% 45%, transparent 40%, rgba(0,0,0,0.85) 100%);}
        .pl-cursor{animation:pl-blink 1s steps(2,start) infinite}
        @keyframes pl-blink{0%,50%{opacity:1}50.01%,100%{opacity:0}}
        .pl-glitch{position:relative;display:inline-block}
        .pl-glitch::before,.pl-glitch::after{content:attr(data-text);position:absolute;left:0;top:0;width:100%;overflow:hidden}
        .pl-glitch::before{color:#ff2ed1;animation:pl-g1 2.6s infinite linear alternate-reverse;clip-path:inset(0 0 60% 0)}
        .pl-glitch::after{color:#19e0ff;animation:pl-g2 2.1s infinite linear alternate-reverse;clip-path:inset(55% 0 0 0)}
        @keyframes pl-g1{0%{transform:translate(0,0)}20%{transform:translate(-3px,1px)}40%{transform:translate(2px,-1px)}60%{transform:translate(-2px,0)}100%{transform:translate(1px,1px)}}
        @keyframes pl-g2{0%{transform:translate(0,0)}25%{transform:translate(3px,-1px)}50%{transform:translate(-2px,1px)}75%{transform:translate(2px,1px)}100%{transform:translate(-1px,-1px)}}
        .pl-num{position:relative;box-shadow:0 0 24px rgba(0,255,102,0.15) inset}
      `}</style>
    </main>
  );
}
