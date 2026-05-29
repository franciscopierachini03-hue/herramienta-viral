'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RedeemCode from './RedeemCode';
import FoundersCounter from '../_components/FoundersCounter';

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
            Esperamos que la hayas aprovechado. Aprovechá la oferta de
            lanzamiento: en vez de <span className="line-through opacity-60">$397/mes</span>,
            entrás por <strong>$47/mes</strong> y seguí encontrando
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
  const params = useSearchParams();
  // Token del link exclusivo (ej: /precios?vip=<coupon_id>). Si está presente,
  // lo mandamos al checkout y Stripe aplica el descuento automáticamente.
  // Sin este token, el checkout normal NO muestra campo de código.
  const vipToken = params.get('vip') || '';

  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null);

  // Resetear loading si el usuario vuelve con el botón "atrás" del navegador.
  // El bfcache congela el estado React — pageshow con persisted=true lo detecta.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => { if (e.persisted) setLoading(null); };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  async function handleCheckout(plan: 'monthly' | 'yearly') {
    setLoading(plan);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, vip: vipToken }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = '/login?signup=1&next=/precios';
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'No se pudo crear la sesión de pago. Probá de nuevo.');
        setLoading(null);
      }
    } catch {
      alert('Error de conexión. Intentá de nuevo.');
      setLoading(null);
    }
  }

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
      <section className="text-center px-6 pt-2 pb-10 max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Un precio.<br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #c13584)' }}>
            Acceso total.
          </span>
        </h1>
        <p className="text-base" style={{ color: '#888' }}>
          Sin tiers, sin trucos. Todo incluido desde el primer día.
        </p>
      </section>

      {/* DOS CARDS LADO A LADO */}
      <section className="px-6 pb-12 max-w-3xl mx-auto">
        <div className="grid md:grid-cols-2 gap-5 items-start">

          {/* CARD MENSUAL */}
          <div className="rounded-3xl p-7 relative"
            style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed55', boxShadow: '0 0 50px #7c3aed22' }}>

            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
              ✨ Más popular
            </div>

            <p className="text-sm mt-2 mb-1" style={{ color: '#a78bfa' }}>Mensual</p>

            <div className="flex items-baseline gap-1 mb-0.5" style={{ color: '#555' }}>
              <span className="text-sm line-through">$397</span>
              <span className="text-xs">/mes</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-bold">$47</span>
              <span className="text-sm" style={{ color: '#888' }}>/mes</span>
            </div>
            <p className="text-xs mb-5" style={{ color: '#22c55e' }}>
              🎉 -88% lanzamiento · <span style={{ color: '#666' }}>cancelás cuando quieras</span>
            </p>

            <FoundersCounter variant="banner" />

            <ul className="flex flex-col gap-2.5 my-6">
              {FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#ddd' }}>
                  <span className="shrink-0">{f.split(' ')[0]}</span>
                  <span>{f.split(' ').slice(1).join(' ')}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('monthly')}
              disabled={loading !== null}
              className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 24px #7c3aed44' }}>
              {loading === 'monthly' ? 'Redirigiendo...' : 'Empezar por $47/mes →'}
            </button>
            <p className="text-xs text-center mt-3" style={{ color: '#555' }}>
              Pago seguro con Stripe
            </p>
          </div>

          {/* CARD ANUAL */}
          <div className="rounded-3xl p-7 relative"
            style={{ background: 'linear-gradient(145deg, #0f0f0f, #0a0a0a)', border: '1px solid #22c55e44' }}>

            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap"
              style={{ background: '#22c55e', color: '#000' }}>
              💰 Mayor ahorro
            </div>

            <p className="text-sm mt-2 mb-1" style={{ color: '#86efac' }}>Anual</p>

            <div className="flex items-baseline gap-1 mb-0.5" style={{ color: '#555' }}>
              <span className="text-sm line-through">$4,764</span>
              <span className="text-xs">/año</span>
            </div>
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-5xl font-bold">$470</span>
              <span className="text-sm" style={{ color: '#888' }}>/año</span>
            </div>
            <p className="text-xs mb-1" style={{ color: '#86efac' }}>
              Equivale a <strong>$39/mes</strong>
            </p>
            <p className="text-xs mb-5" style={{ color: '#22c55e' }}>
              🎉 -90% lanzamiento · <span style={{ color: '#666' }}>pago único anual</span>
            </p>

            {/* Bloque de ahorro destacado */}
            <div className="rounded-2xl p-4 mb-6 text-center"
              style={{ background: '#22c55e11', border: '1px solid #22c55e33' }}>
              <p className="text-xs mb-1" style={{ color: '#86efac' }}>Ahorrás</p>
              <p className="text-2xl font-bold" style={{ color: '#4ade80' }}>20% off</p>
              <p className="text-xs" style={{ color: '#666' }}>vs pagar mensual todo el año</p>
            </div>

            <ul className="flex flex-col gap-2.5 mb-6">
              {FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#aaa' }}>
                  <span className="shrink-0">{f.split(' ')[0]}</span>
                  <span>{f.split(' ').slice(1).join(' ')}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('yearly')}
              disabled={loading !== null}
              className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #166534, #15803d)', color: '#fff', boxShadow: '0 0 20px #22c55e22' }}>
              {loading === 'yearly' ? 'Redirigiendo...' : 'Empezar por $470/año →'}
            </button>
            <p className="text-xs text-center mt-3" style={{ color: '#555' }}>
              Pago seguro con Stripe
            </p>
          </div>
        </div>

        {/* Redimir código */}
        <div className="mt-8">
          <RedeemCode />
        </div>

        {/* FAQ */}
        <div className="mt-10 flex flex-col gap-3">
          {[
            { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Cancelás desde tu cuenta en un click, sin preguntas. El acceso sigue activo hasta el final del período pagado.' },
            { q: '¿Por qué tan barato si vale $397?', a: 'Estamos en oferta de lanzamiento para conseguir los primeros casos de éxito. Una vez que llenamos el cupo de fundadores, el precio sube al precio normal de $397/mes. Si entrás ahora, tu precio queda bloqueado mientras mantengas la suscripción activa.' },
            { q: '¿Cómo funciona la facturación anual?', a: 'Pagás $470 una vez y tenés acceso 12 meses. Equivale a $39/mes — el mayor descuento disponible.' },
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
