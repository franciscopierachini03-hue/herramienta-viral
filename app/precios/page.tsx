'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RedeemCode from './RedeemCode';

const FEATURES = [
  '🔥 Búsqueda viral ilimitada en YouTube + TikTok + Instagram',
  '🤖 Filtro IA multilingüe (ES/EN/PT)',
  '🔍 Analizador de perfiles con engagement rate',
  '⚡ Transcripción ilimitada con Whisper Large V3',
  '🌍 Traducción automática a 4 idiomas',
  '📚 Biblioteca de guiones ilimitada',
  '🚀 Acceso a todas las features futuras',
];

// Banner contextual según el motivo por el que el usuario llegó a /precios.
// Lo controla el query param `need`:
//   - 'trial-expirado' → terminó su prueba gratis (vino del middleware)
//   - 'pago'           → nunca pagó, llegó por restricción de acceso
//   - 'cancelled'      → canceló el checkout en Stripe a mitad de camino
function ContextBanner() {
  const params = useSearchParams();
  const need = params.get('need') || (params.get('cancelled') === '1' ? 'cancelled' : '');
  if (!need) return null;

  if (need === 'trial-expirado') {
    return (
      <div className="max-w-2xl mx-auto px-6 mb-6">
        <div className="rounded-2xl p-5 text-center"
          style={{ background: 'linear-gradient(135deg, #7c3aed22, #c1358422)', border: '1px solid #7c3aed66' }}>
          <div className="text-3xl mb-2">⏰</div>
          <h3 className="text-lg font-bold mb-1">Tu prueba gratuita terminó</h3>
          <p className="text-sm" style={{ color: '#c4b5fd' }}>
            Esperamos que la hayas aprovechado. Si te gustó la app,
            suscribite por <strong>$47/mes</strong> y seguí encontrando
            contenido viral todos los días.
          </p>
        </div>
      </div>
    );
  }

  if (need === 'pago') {
    return (
      <div className="max-w-2xl mx-auto px-6 mb-6">
        <div className="rounded-2xl p-4 text-center text-sm"
          style={{ background: '#92400e22', border: '1px solid #92400e44', color: '#fde68a' }}>
          🔒 Para acceder a la app necesitás suscribirte primero.
        </div>
      </div>
    );
  }

  if (need === 'cancelled') {
    return (
      <div className="max-w-2xl mx-auto px-6 mb-6">
        <div className="rounded-2xl p-4 text-center text-sm"
          style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#fca5a5' }}>
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
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      // Si no está logueado, /api/checkout devuelve 401 con un redirect.
      // Lo mandamos a /login en modo signup para que cree cuenta y vuelva a pagar.
      if (res.status === 401) {
        window.location.href = '/login?signup=1&next=/precios';
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'No se pudo crear la sesión de pago. Probá de nuevo.');
        setLoading(false);
      }
    } catch {
      alert('Error de conexión. Intentá de nuevo.');
      setLoading(false);
    }
  }

  const price = plan === 'monthly' ? 47 : 470;
  const period = plan === 'monthly' ? '/mes' : '/año';

  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="ViralADN" width={36} height={36}
            style={{ filter: 'drop-shadow(0 0 14px #7c3aed55)' }} />
          <span className="text-lg font-bold">ViralADN</span>
        </Link>
        <Link href="/login" className="text-sm" style={{ color: '#888' }}>
          ¿Ya tenés cuenta? Entrá →
        </Link>
      </nav>

      <div className="pt-10">
        <ContextBanner />
      </div>

      {/* HEADER */}
      <section className="text-center px-6 pt-2 pb-8 max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Un precio.<br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #c13584)' }}>
            Acceso total.
          </span>
        </h1>
        <p className="text-base" style={{ color: '#888' }}>
          Sin tiers, sin trucos. Pagás una vez y desbloqueás todo.
        </p>
      </section>

      {/* TOGGLE Mensual / Anual */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex p-1 rounded-2xl" style={{ background: '#0f0f0f', border: '1px solid #1f1f1f' }}>
          <button
            onClick={() => setPlan('monthly')}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            style={plan === 'monthly'
              ? { background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }
              : { color: '#666' }}>
            Mensual
          </button>
          <button
            onClick={() => setPlan('yearly')}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
            style={plan === 'yearly'
              ? { background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }
              : { color: '#666' }}>
            Anual
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: plan === 'yearly' ? 'rgba(255,255,255,0.25)' : '#22c55e22', color: plan === 'yearly' ? '#fff' : '#4ade80' }}>
              -20%
            </span>
          </button>
        </div>
      </div>

      {/* PRICING CARD */}
      <section className="px-6 pb-20 max-w-md mx-auto">
        <div className="rounded-3xl p-8 relative"
          style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed55', boxShadow: '0 0 60px #7c3aed33' }}>

          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
            ✨ Acceso completo
          </div>

          <p className="text-sm mb-2 mt-2" style={{ color: '#a78bfa' }}>ViralADN Pro</p>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-6xl font-bold">${price}</span>
            <span className="text-base" style={{ color: '#888' }}>USD{period}</span>
          </div>

          {plan === 'yearly' ? (
            <p className="text-xs mb-6" style={{ color: '#22c55e' }}>
              Ahorrás $94 al año vs mensual
            </p>
          ) : (
            <p className="text-xs mb-6" style={{ color: '#666' }}>
              Cancelá cuando quieras, sin compromiso
            </p>
          )}

          <ul className="flex flex-col gap-3 mb-8">
            {FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#ddd' }}>
                <span className="shrink-0">{f.split(' ')[0]}</span>
                <span>{f.split(' ').slice(1).join(' ')}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-4 rounded-2xl text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 30px #7c3aed55' }}>
            {loading ? 'Redirigiendo a Stripe...' : `Pagar ${plan === 'monthly' ? '$47/mes' : '$470/año'} →`}
          </button>

          <p className="text-xs text-center mt-4" style={{ color: '#555' }}>
            Pago seguro con Stripe · Cancelás cuando quieras
          </p>
        </div>

        {/* Redimir código de invitación */}
        <div className="max-w-md mx-auto px-6">
          <RedeemCode />
        </div>

        {/* FAQ rápido */}
        <div className="mt-12 flex flex-col gap-3">
          {[
            { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Cancelás desde tu cuenta en un click, sin preguntas. El acceso sigue activo hasta el final del período pagado.' },
            { q: '¿Cómo funciona la facturación anual?', a: 'Pagás los $470 una vez y tenés acceso 12 meses. Te ahorrás $94 vs pagar mensual.' },
            { q: '¿Cuántas búsquedas puedo hacer?', a: 'Ilimitadas. No hay tope de búsquedas, transcripciones, ni traducciones.' },
          ].map((f, i) => (
            <details key={i} className="rounded-2xl p-4 cursor-pointer"
              style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
              <summary className="text-sm font-semibold list-none flex justify-between items-center">
                {f.q}
                <span style={{ color: '#666' }}>+</span>
              </summary>
              <p className="text-xs mt-3 leading-relaxed" style={{ color: '#888' }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
