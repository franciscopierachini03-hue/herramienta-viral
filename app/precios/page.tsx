'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Producto = 'viraladn' | 'topcut' | 'combo';
type Ciclo = 'monthly' | 'yearly';

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
    '✂️ Subís tu video y se edita solo con IA',
    '🎯 Recorte por trozos: sacá errores del medio, inicio o final',
    '💬 Subtítulos animados (gancho + palabra por palabra)',
    '🎬 B-roll automático que acompaña lo que decís',
    '🎵 Música de fondo elegida por el cerebro',
    '📁 Historial de tus videos por 30 días',
    '🚀 Hasta 40 videos por mes',
  ],
  combo: [
    '🧬 TODO ViralADN: búsqueda viral + guiones + ideas',
    '✂️ TODO TOPCUT: editor con IA, 40 videos/mes',
    '⚡ Encontrá el contenido y editalo en un solo lugar',
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
          <p className="text-sm" style={{ color: '#c4b5fd' }}>Elegí tu plan abajo y seguí encontrando (y editando) contenido viral todos los días.</p>
        </div>
      </div>
    );
  }
  if (need === 'pago') {
    return (
      <div className="max-w-2xl mx-auto px-6 mb-6">
        <div className="rounded-2xl p-4 text-center text-sm" style={{ background: '#92400e22', border: '1px solid #92400e44', color: '#fde68a' }}>
          🔒 Para entrar necesitás suscribirte primero. Elegí tu plan abajo.
        </div>
      </div>
    );
  }
  if (need === 'cancelled') {
    return (
      <div className="max-w-2xl mx-auto px-6 mb-6">
        <div className="rounded-2xl p-4 text-center text-sm" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#fca5a5' }}>
          Cancelaste el pago. Cuando quieras volver, estamos acá.
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
  // Ciclo (mensual/anual) por producto. Cada card con precio anual muestra el toggle.
  const [ciclos, setCiclos] = useState<Record<Producto, Ciclo>>({ viraladn: 'monthly', topcut: 'monthly', combo: 'monthly' });

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
      alert(data.error || 'No se pudo crear la sesión de pago. Probá de nuevo.');
      setLoading(null);
    } catch {
      alert('Error de conexión. Intentá de nuevo.');
      setLoading(null);
    }
  }

  const cards: {
    key: Producto; icon: string; name: string; tagline: string;
    grad: string; ring: string;
    monthly: { price: string; period: string };
    yearly?: { price: string; period: string; note: string };
    badge?: string; badgeBg?: string; badgeColor?: string;
  }[] = [
    {
      key: 'viraladn', icon: '🧬', name: 'ViralADN', tagline: 'Encontrá el contenido que explota.',
      grad: 'linear-gradient(135deg, #7c3aed, #c13584)', ring: '#7c3aed',
      monthly: { price: '$27', period: '/mes' },
      yearly: { price: '$259', period: '/año', note: '🎉 −20% · ahorrás $65/año' },
    },
    {
      key: 'topcut', icon: '✂️', name: 'TOPCUT', tagline: 'Editá tus videos solo con IA.',
      grad: 'linear-gradient(135deg, #a855f7, #ec4899)', ring: '#a855f7',
      monthly: { price: '$57', period: '/mes' },
      yearly: { price: '$547', period: '/año', note: '🎉 −20% · ahorrás $137/año' },
    },
    {
      key: 'combo', icon: '⚡', name: 'ViralADN ✕ TOPCUT', tagline: 'Las dos plataformas, un solo plan.',
      grad: 'linear-gradient(135deg, #7c3aed, #a855f7, #ec4899)', ring: '#a855f7',
      monthly: { price: '$67', period: '/mes' },
      yearly: { price: '$643', period: '/año', note: '🎉 −20% · ahorrás $161/año' },
      badge: '✨ Mejor valor', badgeBg: 'linear-gradient(135deg, #a855f7, #ec4899)', badgeColor: '#fff',
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
        <Link href="/login" className="text-sm" style={{ color: '#888' }}>¿Ya tenés cuenta? Entrá →</Link>
      </nav>

      <div className="pt-10"><ContextBanner /></div>

      {/* HEADER */}
      <section className="text-center px-6 pt-2 pb-10 max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Elegí tu{' '}
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>herramienta.</span>
        </h1>
        <p className="text-base" style={{ color: '#888' }}>Buscá lo viral, editá con IA, o llevate las dos. Cancelás cuando quieras.</p>
      </section>

      {/* 3 CARDS */}
      <section className="px-6 pb-12 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {cards.map(c => {
            const focused = focus === c.key;
            const isCombo = c.key === 'combo';
            const ciclo = ciclos[c.key];
            const plan = c.yearly && ciclo === 'yearly' ? c.yearly : c.monthly;
            const loadKey = `${c.key}-${ciclo}`;
            return (
              <div key={c.key} className="rounded-3xl p-7 relative flex flex-col"
                style={{
                  background: 'linear-gradient(145deg, #141414, #0d0d0d)',
                  border: `1px solid ${focused || isCombo ? c.ring + '88' : '#222'}`,
                  boxShadow: focused || isCombo ? `0 0 50px ${c.ring}33` : 'none',
                }}>
                {c.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
                    style={{ background: c.badgeBg, color: c.badgeColor }}>{c.badge}</div>
                )}
                {focused && !c.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
                    style={{ background: c.ring, color: '#fff' }}>← lo que buscás</div>
                )}

                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: c.grad, boxShadow: `0 0 24px ${c.ring}44` }}>{c.icon}</div>
                <h2 className="text-xl font-bold mb-0.5">{c.name}</h2>
                <p className="text-sm mb-4" style={{ color: '#999' }}>{c.tagline}</p>

                {/* Toggle mensual/anual: en toda card que tenga precio anual */}
                {c.yearly && (
                  <div className="flex gap-1 p-1 rounded-xl mb-3 text-xs font-semibold" style={{ background: '#0c0c0c', border: '1px solid #222' }}>
                    {(['monthly', 'yearly'] as Ciclo[]).map(ci => (
                      <button key={ci} onClick={() => setCiclos(prev => ({ ...prev, [c.key]: ci }))}
                        className="flex-1 py-1.5 rounded-lg transition-all"
                        style={ciclo === ci
                          ? { background: c.grad, color: '#fff' }
                          : { background: 'transparent', color: '#888' }}>
                        {ci === 'monthly' ? 'Mensual' : 'Anual −20%'}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-5xl font-bold">{plan.price}</span>
                  <span className="text-sm" style={{ color: '#888' }}>{plan.period}</span>
                </div>
                {c.yearly && ciclo === 'yearly'
                  ? <p className="text-xs mb-5" style={{ color: '#22c55e' }}>{c.yearly.note}</p>
                  : <p className="text-xs mb-5" style={{ color: '#666' }}>cancelás cuando quieras</p>}

                <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                  {FEATURES[c.key].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#ddd' }}>
                      <span className="shrink-0">{f.split(' ')[0]}</span>
                      <span>{f.split(' ').slice(1).join(' ')}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(c.key, ciclo)}
                  disabled={loading !== null}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-60"
                  style={{ background: c.grad, color: '#fff', boxShadow: `0 0 24px ${c.ring}44` }}>
                  {loading === loadKey ? 'Redirigiendo...' : `Empezar · ${plan.price}${plan.period}`}
                </button>
                <p className="text-xs text-center mt-3" style={{ color: '#555' }}>Pago seguro con Stripe</p>
              </div>
            );
          })}
        </div>

        {/* Nota fundadores */}
        <p className="text-center text-xs mt-8" style={{ color: '#666' }}>
          ¿Ya pagabas el plan de $47? Sos <b style={{ color: '#c4b5fd' }}>miembro fundador</b> — mantenés acceso a las dos plataformas sin pagar de más.
        </p>

        {/* FAQ */}
        <div className="mt-8 flex flex-col gap-3 max-w-2xl mx-auto">
          {[
            { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Cancelás desde tu cuenta en un click. El acceso sigue activo hasta el final del período pagado.' },
            { q: '¿Qué incluye el combo?', a: 'Las dos plataformas completas: ViralADN (búsqueda viral + guiones) y TOPCUT (editor con IA, 40 videos/mes). Sale más barato que pagar los dos por separado.' },
            { q: '¿Cuántos videos puedo editar en TOPCUT?', a: 'Hasta 40 videos por mes. De sobra para publicar todos los días.' },
            { q: '¿Y si ya pagaba el plan de $47?', a: 'Quedás como miembro fundador: mantenés acceso a ViralADN y a TOPCUT sin cambiar nada.' },
          ].map((f, i) => (
            <details key={i} className="rounded-2xl p-4 cursor-pointer" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
              <summary className="text-sm font-semibold list-none flex justify-between items-center">{f.q}<span style={{ color: '#666' }}>+</span></summary>
              <p className="text-xs mt-3 leading-relaxed" style={{ color: '#888' }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
