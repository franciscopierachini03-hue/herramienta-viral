'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// /unete — página de pago PARALELA (para comunidades nuevas).
//
// Igual que /precios pero con PRUEBA GRATIS de 7 días: la persona pone su
// tarjeta hoy, paga $0, prueba todo, y al día 8 Stripe le cobra sola. Si
// cancela antes, no paga nada. Cada venta queda etiquetada con el canal
// (?canal=nombre-comunidad) → en Stripe sabés de qué comunidad vino.
//
// Compartir: viraladn.com/unete            (canal 'comunidad')
//            viraladn.com/unete?canal=xyz  (etiqueta esa comunidad)
//
// Sin useSearchParams a propósito: el canal se lee al hacer clic → la página
// se sirve completa desde el servidor (SEO + verificable).

type Producto = 'viraladn' | 'topcut' | 'combo';
type Ciclo = 'monthly' | 'quarterly' | 'yearly';

const FEATURES: Record<Producto, string[]> = {
  viraladn: [
    '🔥 Búsqueda viral en YouTube + TikTok + Instagram',
    '🧠 Chat de ideas: 3 preguntas → 15 palabras para buscar',
    '🔍 Analizador de perfiles con engagement',
    '⚡ Transcripción con Whisper Large V3',
    '📚 Biblioteca de guiones ilimitada',
  ],
  topcut: [
    '✂️ Subes tu video y se edita solo con IA',
    '💬 Subtítulos animados (gancho + palabra por palabra)',
    '🎬 B-roll automático que acompaña lo que dices',
    '🎵 Música de fondo elegida por el cerebro',
    '🚀 Hasta 40 videos por mes',
  ],
  combo: [
    '🧬 TODO ViralADN: búsqueda viral + guiones + ideas',
    '✂️ TODO TOPCUT: editor con IA, 40 videos/mes',
    '⚡ Encuentra el contenido y edítalo en un solo lugar',
    '💸 Más barato que pagar los dos por separado',
  ],
};

function canalActual(): string {
  try {
    const c = new URLSearchParams(window.location.search).get('canal') || 'comunidad';
    return c.toLowerCase().slice(0, 40);
  } catch { return 'comunidad'; }
}

export default function Unete() {
  const [loading, setLoading] = useState<string | null>(null);
  const [ciclo, setCiclo] = useState<Ciclo>('monthly');
  const [cancelled, setCancelled] = useState(false);
  useEffect(() => {
    try { setCancelled(new URLSearchParams(window.location.search).get('cancelled') === '1'); } catch { /* noop */ }
  }, []);
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => { if (e.persisted) setLoading(null); };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  async function empezar(producto: Producto, ciclo: Ciclo) {
    const key = `${producto}-${ciclo}`;
    setLoading(key);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto, ciclo, trial: true, canal: canalActual(), origen: 'unete' }),
      });
      const data = await res.json();
      if (data.url) { window.location.assign(data.url); return; }
      alert(data.error || 'No se pudo iniciar. Prueba de nuevo.');
      setLoading(null);
    } catch {
      alert('Error de conexión. Intenta de nuevo.');
      setLoading(null);
    }
  }

  const cards: {
    key: Producto; icon: string; name: string; tagline: string;
    grad: string; ring: string;
    prices: Record<Ciclo, { price: string; period: string; num: string }>;
    badge?: string;
  }[] = [
    {
      key: 'viraladn', icon: '🧬', name: 'ViralADN', tagline: 'Encuentra el contenido que explota.',
      grad: 'linear-gradient(135deg, #7c3aed, #c13584)', ring: '#7c3aed',
      prices: {
        monthly:   { price: '$47', period: '/mes', num: '$47/mes' },
        quarterly: { price: '$127', period: '/3 meses', num: '$127 cada 3 meses' },
        yearly:    { price: '$451', period: '/año', num: '$451/año' },
      },
    },
    {
      key: 'topcut', icon: '✂️', name: 'TOPCUT', tagline: 'Edita tus videos solo con IA.',
      grad: 'linear-gradient(135deg, #a855f7, #ec4899)', ring: '#a855f7',
      prices: {
        monthly:   { price: '$67', period: '/mes', num: '$67/mes' },
        quarterly: { price: '$181', period: '/3 meses', num: '$181 cada 3 meses' },
        yearly:    { price: '$643', period: '/año', num: '$643/año' },
      },
    },
    {
      key: 'combo', icon: '⚡', name: 'ViralADN ✕ TOPCUT', tagline: 'Las dos plataformas, un solo plan.',
      grad: 'linear-gradient(135deg, #7c3aed, #a855f7, #ec4899)', ring: '#a855f7',
      prices: {
        monthly:   { price: '$97', period: '/mes', num: '$97/mes' },
        quarterly: { price: '$262', period: '/3 meses', num: '$262 cada 3 meses' },
        yearly:    { price: '$931', period: '/año', num: '$931/año' },
      },
      badge: '✨ Más elegido',
    },
  ];

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
        <div className="max-w-2xl mx-auto px-6 mt-4">
          <div className="rounded-2xl p-4 text-center text-sm" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#fca5a5' }}>
            Cancelaste el proceso. Tu prueba de 7 días sigue disponible cuando quieras 👇
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="text-center px-6 pt-8 pb-8 max-w-2xl mx-auto">
        <span className="inline-block text-xs font-extrabold tracking-widest uppercase px-4 py-2 rounded-full mb-5"
          style={{ background: '#0b1512', border: '1px solid #22c55e55', color: '#86efac' }}>
          🎁 7 días gratis · sin compromiso
        </span>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Pruébalo TODO,{' '}
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #34d399, #a855f7)' }}>7 días gratis.</span>
        </h1>
        <p className="text-base" style={{ color: '#999' }}>
          Hoy pagas <b style={{ color: '#fff' }}>$0</b>. Usas la plataforma completa una semana.
          Si te sirve, no haces nada y sigue solo. Si no, cancelas antes del día 7 y no pagas nada.
        </p>
      </section>

      {/* TOGGLE Mensual / Trimestral / Anual */}
      <div className="flex justify-center mb-9 px-6">
        <div className="inline-flex rounded-full p-1 gap-1" style={{ background: '#141414', border: '1px solid #2b2b2b' }}>
          {([
            ['monthly', 'Mensual', ''],
            ['quarterly', 'Trimestral', '−10%'],
            ['yearly', 'Anual', '−20%'],
          ] as const).map(([val, label, badge]) => {
            const on = ciclo === val;
            return (
              <button key={val} onClick={() => setCiclo(val)} aria-pressed={on}
                className="px-4 sm:px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap"
                style={on
                  ? { background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }
                  : { background: 'transparent', color: '#888' }}>
                {label}
                {badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={on ? { background: '#ffffff33', color: '#fff' } : { background: '#a855f722', color: '#c4b5fd' }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CARDS */}
      <section className="px-6 pb-12 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {cards.map(c => {
            const plan = c.prices[ciclo];
            const loadKey = `${c.key}-${ciclo}`;
            const isCombo = c.key === 'combo';
            return (
              <div key={c.key} className="rounded-3xl p-7 relative flex flex-col"
                style={{
                  background: 'linear-gradient(145deg, #141414, #0d0d0d)',
                  border: `1px solid ${isCombo ? c.ring + '88' : '#222'}`,
                  boxShadow: isCombo ? `0 0 50px ${c.ring}33` : 'none',
                }}>
                {c.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>{c.badge}</div>
                )}
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: c.grad, boxShadow: `0 0 24px ${c.ring}44` }}>{c.icon}</div>
                <h2 className="text-xl font-bold mb-0.5">{c.name}</h2>
                <p className="text-sm mb-4" style={{ color: '#999' }}>{c.tagline}</p>

                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-5xl font-bold" style={{ color: '#34d399' }}>$0</span>
                  <span className="text-sm" style={{ color: '#888' }}>hoy</span>
                </div>
                <p className="text-xs mb-5" style={{ color: '#888' }}>
                  luego <b style={{ color: '#ddd' }}>{plan.num}</b> · empieza el día 8
                </p>

                <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                  {FEATURES[c.key].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#ddd' }}>
                      <span className="shrink-0">{f.split(' ')[0]}</span>
                      <span>{f.split(' ').slice(1).join(' ')}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => empezar(c.key, ciclo)}
                  disabled={loading !== null}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-60"
                  style={{ background: c.grad, color: '#fff', boxShadow: `0 0 24px ${c.ring}44` }}>
                  {loading === loadKey ? 'Abriendo...' : '🎁 Empezar 7 días gratis →'}
                </button>
                <p className="text-xs text-center mt-3" style={{ color: '#555' }}>
                  Pago seguro con Stripe · cancelas antes del día 7 y no pagas nada
                </p>
              </div>
            );
          })}
        </div>

        {/* Cómo funciona la prueba */}
        <div className="mt-10 max-w-2xl mx-auto rounded-2xl p-5" style={{ background: '#0b0b14', border: '1px solid #23232f' }}>
          <p className="text-xs font-extrabold tracking-widest uppercase mb-3" style={{ color: '#86efac' }}>Cómo funciona</p>
          <div className="flex flex-col gap-2 text-sm" style={{ color: '#c9c9d4' }}>
            <p>1️⃣ Eliges tu plan y registras tu tarjeta — <b style={{ color: '#fff' }}>hoy se te cobra $0</b>.</p>
            <p>2️⃣ Entras al instante y usas todo durante 7 días.</p>
            <p>3️⃣ El día 8 se activa tu plan y se cobra solo. ¿No te convenció? Cancela antes desde tu cuenta y <b style={{ color: '#fff' }}>no pagas nada</b>.</p>
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
