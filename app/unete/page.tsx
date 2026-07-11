'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// /unete — página de pago PARALELA (para comunidades nuevas).
//
// SOLO ViralADN (decisión de Francisco: TOPCUT y Combo no se ofrecen acá) y
// solo el plan mensual $47 — el único precio creado en la cuenta Elevation.
// PRUEBA GRATIS de 7 días: tarjeta hoy, paga $0, y al día 8 Stripe cobra sola.
// Cobra la cuenta ELEVATION (no la principal). Cada venta queda etiquetada con
// el canal (?canal=nombre-comunidad) → en Stripe sabés de qué comunidad vino.
//
// Compartir: viraladn.com/unete            (canal 'comunidad')
//            viraladn.com/unete?canal=xyz  (etiqueta esa comunidad)
//
// Sin useSearchParams a propósito: el canal se lee al hacer clic → la página
// se sirve completa desde el servidor.

const FEATURES = [
  '🔥 Búsqueda viral en YouTube + TikTok + Instagram',
  '🧠 Chat de ideas: 3 preguntas → 15 palabras para buscar',
  '🔍 Analizador de perfiles con engagement',
  '⚡ Transcripción con Whisper Large V3',
  '🌍 Traducción automática a 4 idiomas',
  '📚 Biblioteca de guiones ilimitada',
];

function canalActual(): string {
  try {
    const c = new URLSearchParams(window.location.search).get('canal') || 'comunidad';
    return c.toLowerCase().slice(0, 40);
  } catch { return 'comunidad'; }
}

export default function Unete() {
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  useEffect(() => {
    try { setCancelled(new URLSearchParams(window.location.search).get('cancelled') === '1'); } catch { /* noop */ }
  }, []);
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => { if (e.persisted) setLoading(false); };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  async function empezar() {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // cuenta:'elevation' → cobra Elevation Sales Solutions, con 7 días
        // gratis y el canal de la comunidad etiquetado.
        body: JSON.stringify({ producto: 'viraladn', ciclo: 'monthly', trial: true, canal: canalActual(), origen: 'unete', cuenta: 'elevation' }),
      });
      const data = await res.json();
      if (data.url) { window.location.assign(data.url); return; }
      alert(data.error || 'No se pudo iniciar. Prueba de nuevo.');
      setLoading(false);
    } catch {
      alert('Error de conexión. Intenta de nuevo.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="ViralADN" width={36} height={36} style={{ filter: 'drop-shadow(0 0 14px #7c3aed55)' }} />
          <span className="text-lg font-bold">ViralADN</span>
        </span>
        <Link href="/login" className="text-sm" style={{ color: '#888' }}>¿Ya tienes cuenta? Entra →</Link>
      </nav>

      {cancelled && (
        <div className="max-w-xl mx-auto px-6 mt-4">
          <div className="rounded-2xl p-4 text-center text-sm" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#fca5a5' }}>
            Cancelaste el proceso. Tu prueba de 7 días sigue disponible cuando quieras 👇
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="text-center px-6 pt-8 pb-10 max-w-2xl mx-auto">
        <span className="inline-block text-xs font-extrabold tracking-widest uppercase px-4 py-2 rounded-full mb-5"
          style={{ background: '#0b1512', border: '1px solid #22c55e55', color: '#86efac' }}>
          🎁 7 días gratis · sin compromiso
        </span>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Prueba ViralADN{' '}
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #34d399, #a855f7)' }}>7 días gratis.</span>
        </h1>
        <p className="text-base" style={{ color: '#999' }}>
          Hoy pagas <b style={{ color: '#fff' }}>$0</b>. Encuentras el contenido que explota en tu nicho durante una semana.
          Si te sirve, no haces nada y sigue solo. Si no, cancelas antes del día 7 y no pagas nada.
        </p>
      </section>

      {/* CARD ÚNICA — ViralADN mensual */}
      <section className="px-6 pb-12 max-w-md mx-auto">
        <div className="rounded-3xl p-8 relative flex flex-col"
          style={{
            background: 'linear-gradient(145deg, #141414, #0d0d0d)',
            border: '1px solid #7c3aed88',
            boxShadow: '0 0 50px #7c3aed33',
          }}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg, #34d399, #a855f7)', color: '#fff' }}>
            🎁 7 días gratis
          </div>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', boxShadow: '0 0 24px #7c3aed44' }}>🧬</div>
          <h2 className="text-2xl font-bold mb-0.5">ViralADN</h2>
          <p className="text-sm mb-5" style={{ color: '#999' }}>Encuentra el contenido que explota.</p>

          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-6xl font-bold" style={{ color: '#34d399' }}>$0</span>
            <span className="text-sm" style={{ color: '#888' }}>hoy</span>
          </div>
          <p className="text-xs mb-6" style={{ color: '#888' }}>
            luego <b style={{ color: '#ddd' }}>$47/mes</b> · empieza el día 8 · cancelas cuando quieras
          </p>

          <ul className="flex flex-col gap-2.5 mb-7">
            {FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#ddd' }}>
                <span className="shrink-0">{f.split(' ')[0]}</span>
                <span>{f.split(' ').slice(1).join(' ')}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={empezar}
            disabled={loading}
            className="w-full py-4 rounded-2xl text-base font-bold transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 24px #7c3aed44' }}>
            {loading ? 'Abriendo...' : '🎁 Empezar mis 7 días gratis →'}
          </button>
          <p className="text-xs text-center mt-3" style={{ color: '#555' }}>
            Pago seguro con Stripe · cancelas antes del día 7 y no pagas nada
          </p>
        </div>

        {/* Cómo funciona la prueba */}
        <div className="mt-8 rounded-2xl p-5" style={{ background: '#0b0b14', border: '1px solid #23232f' }}>
          <p className="text-xs font-extrabold tracking-widest uppercase mb-3" style={{ color: '#86efac' }}>Cómo funciona</p>
          <div className="flex flex-col gap-2 text-sm" style={{ color: '#c9c9d4' }}>
            <p>1️⃣ Registras tu tarjeta — <b style={{ color: '#fff' }}>hoy se te cobra $0</b>.</p>
            <p>2️⃣ Entras al instante y usas ViralADN durante 7 días.</p>
            <p>3️⃣ El día 8 se activa tu plan de $47/mes y se cobra solo. ¿No te convenció? Cancela antes desde tu cuenta y <b style={{ color: '#fff' }}>no pagas nada</b>.</p>
          </div>
        </div>

        {/* Footer legal */}
        <p className="text-center text-xs mt-10" style={{ color: '#777' }}>
          Al terminar la prueba, el plan se renueva automáticamente al precio vigente. Cancelas cuando quieras desde tu cuenta.
          Garantía de reembolso de 7 días desde tu primer cobro.
        </p>
        <div className="mt-4 pt-5 text-center text-xs flex flex-wrap gap-x-4 gap-y-2 justify-center" style={{ borderTop: '1px solid #1a1a1a', color: '#666' }}>
          <span>2CLICKS.COM LLC</span>
          <Link href="/terminos" className="underline" style={{ color: '#888' }}>Términos</Link>
          <Link href="/privacidad" className="underline" style={{ color: '#888' }}>Privacidad</Link>
          <Link href="/reembolsos" className="underline" style={{ color: '#888' }}>Reembolsos</Link>
          <a href="mailto:hola@viraladn.com" className="underline" style={{ color: '#888' }}>Contacto</a>
        </div>
      </section>
    </main>
  );
}
