'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Producto = 'viraladn' | 'topcut' | 'combo';
type Ciclo = 'monthly' | 'quarterly' | 'yearly';

const FEATURES: Record<Producto, string[]> = {
  viraladn: [
    '🔥 Búsqueda viral en YouTube + TikTok + Instagram',
    '🧠 Chat de ideas: 3 preguntas → 15 palabras para buscar',
    '🤖 Filtro IA multilingüe (ES/EN/PT)',
    '🔍 Analizador de perfiles con engagement',
    '⚡ Transcripción con Whisper Large V3',
    '🌍 Traducción automática a 4 idiomas',
    '📚 Biblioteca de guiones ilimitada',
  ],
  topcut: [
    '✂️ Subes tu video y se edita solo con IA',
    '🎯 Recorte por trozos: saca errores del medio, inicio o final',
    '💬 Subtítulos animados (gancho + palabra por palabra)',
    '🎬 B-roll automático que acompaña lo que dices',
    '🎵 Música de fondo elegida por el cerebro',
    '📁 Historial de tus videos por 30 días',
    '🚀 Hasta 40 videos por mes',
  ],
  combo: [
    '🧬 TODO ViralADN: búsqueda viral + guiones + ideas',
    '✂️ TODO TOPCUT: editor con IA, 40 videos/mes',
    '⚡ Encuentra el contenido y edítalo en un solo lugar',
    '💸 Más barato que pagar los dos por separado',
    '🚀 Acceso a todo lo nuevo de las dos plataformas',
  ],
};

// Banner contextual según por qué llegó el usuario a /precios.
function ContextBanner() {
  const params = useSearchParams();
  const need = params.get('need') || (params.get('cancelled') === '1' ? 'cancelled' : '');
  if (!need) return null;

  if (need === 'trial-expirado') {
    return (
      <div className="max-w-2xl mx-auto px-6 mb-6">
        <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, #7c3aed22, #c1358422)', border: '1px solid #7c3aed66' }}>
          <div className="text-3xl mb-2">⏰</div>
          <h3 className="text-lg font-bold mb-1">Tu prueba gratuita terminó</h3>
          <p className="text-sm" style={{ color: '#c4b5fd' }}>Elige tu plan abajo y sigue encontrando (y editando) contenido viral todos los días.</p>
        </div>
      </div>
    );
  }
  if (need === 'pago') {
    return (
      <div className="max-w-2xl mx-auto px-6 mb-6">
        <div className="rounded-2xl p-4 text-center text-sm" style={{ background: '#92400e22', border: '1px solid #92400e44', color: '#fde68a' }}>
          🔒 Para entrar necesitas suscribirte primero. Elige tu plan abajo.
        </div>
      </div>
    );
  }
  if (need === 'cancelled') {
    return (
      <div className="max-w-2xl mx-auto px-6 mb-6">
        <div className="rounded-2xl p-4 text-center text-sm" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#fca5a5' }}>
          Cancelaste el pago. Cuando quieras volver, estamos aquí.
        </div>
      </div>
    );
  }
  return null;
}

export default function Pricing() {
  return (
    <Suspense fallback={null}>
      <PricingInner />
    </Suspense>
  );
}

function PricingInner() {
  const params = useSearchParams();
  const focus = (params.get('producto') as Producto) || null;

  const [loading, setLoading] = useState<string | null>(null);
  // Ciclo global: un solo toggle arriba cambia las 3 tarjetas a la vez.
  const [ciclo, setCiclo] = useState<Ciclo>('monthly');
  // Acceso del usuario logueado → para marcar el plan que YA tiene (no "Empezar").
  const [access, setAccess] = useState<{ ok: boolean; viraladn: boolean; topcut: boolean } | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch('/api/access', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancel && d) setAccess({ ok: !!d.ok, viraladn: !!d.viraladn, topcut: !!d.topcut }); })
      .catch(() => {});
    return () => { cancel = true; };
  }, []);

  // Resetear loading si el usuario vuelve con "atrás" (bfcache congela el estado).
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => { if (e.persisted) setLoading(null); };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  async function handleCheckout(producto: Producto, ciclo: Ciclo = 'monthly') {
    const key = `${producto}-${ciclo}`;
    setLoading(key);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto, ciclo }),
      });
      const data = await res.json();
      if (res.status === 401) { window.location.assign('/login?signup=1&next=/precios'); return; }
      if (data.url) { window.location.assign(data.url); return; }
      alert(data.error || 'No se pudo crear la sesión de pago. Prueba de nuevo.');
      setLoading(null);
    } catch {
      alert('Error de conexión. Intenta de nuevo.');
      setLoading(null);
    }
  }

  const cards: {
    key: Producto; icon: string; name: string; tagline: string;
    grad: string; ring: string;
    prices: Record<Ciclo, { price: string; period: string; was?: string; note?: string }>;
    badge?: string; badgeBg?: string; badgeColor?: string;
  }[] = [
    {
      key: 'viraladn', icon: '🧬', name: 'ViralADN', tagline: 'Encuentra el contenido que explota.',
      grad: 'linear-gradient(135deg, #7c3aed, #c13584)', ring: '#7c3aed',
      prices: {
        monthly:   { price: '$47', period: '/mes' },
        quarterly: { price: '$127', period: '/3 meses', was: '$141', note: '🎉 ahorras $14 · $42/mes' },
        yearly:    { price: '$451', period: '/año', was: '$564', note: '🎉 ahorras $113 · $38/mes' },
      },
    },
    {
      key: 'topcut', icon: '✂️', name: 'TOPCUT', tagline: 'Edita tus videos solo con IA.',
      grad: 'linear-gradient(135deg, #a855f7, #ec4899)', ring: '#a855f7',
      prices: {
        monthly:   { price: '$67', period: '/mes' },
        quarterly: { price: '$181', period: '/3 meses', was: '$201', note: '🎉 ahorras $20 · $60/mes' },
        yearly:    { price: '$643', period: '/año', was: '$804', note: '🎉 ahorras $161 · $54/mes' },
      },
    },
    {
      key: 'combo', icon: '⚡', name: 'ViralADN ✕ TOPCUT', tagline: 'Las dos plataformas, un solo plan.',
      grad: 'linear-gradient(135deg, #7c3aed, #a855f7, #ec4899)', ring: '#a855f7',
      prices: {
        monthly:   { price: '$97', period: '/mes' },
        quarterly: { price: '$262', period: '/3 meses', was: '$291', note: '🎉 ahorras $29 · $87/mes' },
        yearly:    { price: '$931', period: '/año', was: '$1164', note: '🎉 ahorras $233 · $78/mes' },
      },
      badge: '✨ Más elegido', badgeBg: 'linear-gradient(135deg, #a855f7, #ec4899)', badgeColor: '#fff',
    },
  ];

  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link href="/inicio" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="ViralADN" width={36} height={36} style={{ filter: 'drop-shadow(0 0 14px #7c3aed55)' }} />
          <span className="text-lg font-bold">ViralADN</span>
        </Link>
        <Link href="/login" className="text-sm" style={{ color: '#888' }}>¿Ya tienes cuenta? Entra →</Link>
      </nav>

      <div className="pt-10"><ContextBanner /></div>

      {/* HEADER */}
      <section className="text-center px-6 pt-2 pb-10 max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Elige tu{' '}
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>herramienta.</span>
        </h1>
        <p className="text-base" style={{ color: '#888' }}>Busca lo viral, edita con IA, o llévate las dos. Cancelas cuando quieras.</p>
      </section>

      {/* TOGGLE GLOBAL Mensual / Trimestral / Anual — cambia las 3 tarjetas a la vez */}
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

      {/* 3 CARDS */}
      <section className="px-6 pb-12 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {cards.map(c => {
            const focused = focus === c.key;
            const isCombo = c.key === 'combo';
            const plan = c.prices[ciclo];
            const loadKey = `${c.key}-${ciclo}`;
            // ¿Qué tiene el usuario? 'current' = es su plan · 'included' = lo tiene
            // incluido (el combo incluye ViralADN y TOPCUT) · 'available' = puede comprarlo.
            const both = !!access?.viraladn && !!access?.topcut;
            const owned = c.key === 'combo' ? both : c.key === 'viraladn' ? !!access?.viraladn : !!access?.topcut;
            const status: 'current' | 'included' | 'available' =
              !access?.ok || !owned ? 'available' : (c.key !== 'combo' && both) ? 'included' : 'current';
            return (
              <div key={c.key} className="rounded-3xl p-7 relative flex flex-col"
                style={{
                  background: 'linear-gradient(145deg, #141414, #0d0d0d)',
                  border: `1px solid ${focused || isCombo ? c.ring + '88' : '#222'}`,
                  boxShadow: focused || isCombo ? `0 0 50px ${c.ring}33` : 'none',
                }}>
                {status === 'current' ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
                    style={{ background: '#22c55e', color: '#04210f' }}>✓ Tu plan actual</div>
                ) : status === 'included' ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
                    style={{ background: '#16271c', border: '1px solid #22c55e55', color: '#86efac' }}>Incluido en tu plan</div>
                ) : c.badge ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
                    style={{ background: c.badgeBg, color: c.badgeColor }}>{c.badge}</div>
                ) : focused ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
                    style={{ background: c.ring, color: '#fff' }}>← lo que buscas</div>
                ) : null}

                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: c.grad, boxShadow: `0 0 24px ${c.ring}44` }}>{c.icon}</div>
                <h2 className="text-xl font-bold mb-0.5">{c.name}</h2>
                <p className="text-sm mb-4" style={{ color: '#999' }}>{c.tagline}</p>

                {plan.was && (
                  <div className="flex items-baseline gap-1 mb-0.5" style={{ color: '#555' }}>
                    <span className="text-lg line-through">{plan.was}</span>
                    <span className="text-xs">{plan.period}</span>
                  </div>
                )}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-5xl font-bold">{plan.price}</span>
                  <span className="text-sm" style={{ color: '#888' }}>{plan.period}</span>
                </div>
                {plan.note
                  ? <p className="text-xs mb-5" style={{ color: '#22c55e' }}>{plan.note}</p>
                  : <p className="text-xs mb-5" style={{ color: '#666' }}>cancelas cuando quieras</p>}

                <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                  {FEATURES[c.key].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#ddd' }}>
                      <span className="shrink-0">{f.split(' ')[0]}</span>
                      <span>{f.split(' ').slice(1).join(' ')}</span>
                    </li>
                  ))}
                </ul>

                {status === 'available' ? (
                  <>
                    <button
                      onClick={() => handleCheckout(c.key, ciclo)}
                      disabled={loading !== null}
                      className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-60"
                      style={{ background: c.grad, color: '#fff', boxShadow: `0 0 24px ${c.ring}44` }}>
                      {loading === loadKey ? 'Redirigiendo...' : `Empezar · ${plan.price}${plan.period}`}
                    </button>
                    <p className="text-xs text-center mt-3" style={{ color: '#555' }}>Pago seguro con Stripe</p>
                  </>
                ) : status === 'current' ? (
                  <>
                    <Link href="/cuenta"
                      className="w-full py-3.5 rounded-2xl text-sm font-bold text-center block transition-all"
                      style={{ background: '#0e2a1a', border: '1px solid #22c55e66', color: '#86efac' }}>
                      ✓ Tu plan actual · gestionar
                    </Link>
                    <p className="text-xs text-center mt-3" style={{ color: '#555' }}>Lo cambias o cancelas en Mi cuenta</p>
                  </>
                ) : (
                  <>
                    <div className="w-full py-3.5 rounded-2xl text-sm font-bold text-center"
                      style={{ background: '#101010', border: '1px solid #222', color: '#666' }}>
                      ✓ Incluido en tu plan
                    </div>
                    <p className="text-xs text-center mt-3" style={{ color: '#555' }}>Ya lo tienes con tu combo</p>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Nota fundadores */}
        <p className="text-center text-xs mt-8" style={{ color: '#666' }}>
          ¿Eras <b style={{ color: '#c4b5fd' }}>miembro fundador</b> del plan original? Mantienes acceso a las dos plataformas sin pagar de más.
        </p>

        {/* FAQ */}
        <div className="mt-8 flex flex-col gap-3 max-w-2xl mx-auto">
          {[
            { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Cancelas desde tu cuenta en un click. El acceso sigue activo hasta el final del período pagado.' },
            { q: '¿Qué incluye el combo?', a: 'Las dos plataformas completas: ViralADN (búsqueda viral + guiones) y TOPCUT (editor con IA, 40 videos/mes). Sale más barato que pagar los dos por separado.' },
            { q: '¿Cuántos videos puedo editar en TOPCUT?', a: 'Hasta 40 videos por mes. De sobra para publicar todos los días.' },
            { q: '¿Y si era miembro fundador del plan original?', a: 'Mantienes acceso a ViralADN y a TOPCUT sin cambiar nada.' },
          ].map((f, i) => (
            <details key={i} className="rounded-2xl p-4 cursor-pointer" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
              <summary className="text-sm font-semibold list-none flex justify-between items-center">{f.q}<span style={{ color: '#666' }}>+</span></summary>
              <p className="text-xs mt-3 leading-relaxed" style={{ color: '#888' }}>{f.a}</p>
            </details>
          ))}
        </div>

        {/* Aviso de facturación + footer legal (consentimiento claro = anti-disputa) */}
        <p className="text-center text-xs mt-10" style={{ color: '#777' }}>
          Todos los planes se renuevan automáticamente al precio vigente. Cancelas cuando quieras desde tu cuenta.
          Garantía de reembolso de 7 días en tu primer mes (sea gratis o de pago, desde tu primer cobro).
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
