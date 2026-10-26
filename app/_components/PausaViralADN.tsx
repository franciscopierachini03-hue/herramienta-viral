'use client';

// ⏸️ CARTEL DE PAUSA DE VIRALADN.
//
// Francisco decidió pausar ViralADN el 23 de octubre de 2026. Quien entre a
// cualquiera de sus pantallas (/app, /formatos, /calculadora, /metricas,
// /historias) ve esto en lugar de una herramienta que ya no se mantiene.
//
// Para reabrirlo: NEXT_PUBLIC_VIRALADN_PAUSA=0 en Vercel. No hace falta tocar
// código ni volver a desplegar.
//
// Pausado por defecto a propósito: si alguien despliega sin la variable, queda
// pausado, que es el lado seguro mientras dure la pausa.

import Link from 'next/link';
import ProductNav from './ProductNav';
import SessionGuard from './SessionGuard';

export default function PausaViralADN() {
  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="px-6 pt-10 pb-2 max-w-6xl mx-auto w-full">
        <SessionGuard />
        <ProductNav active="viral" />
      </div>

      <div className="px-6 pb-24 pt-6 max-w-3xl mx-auto">
        <div className="rounded-3xl px-6 py-12 sm:px-12 sm:py-16 text-center"
          style={{ background: 'linear-gradient(160deg, #15101f, #0a0a0f)', border: '1px solid #4c1d95' }}>

          <div className="text-6xl sm:text-7xl mb-5" aria-hidden="true">⏸️</div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 text-xs font-bold tracking-wide"
            style={{ background: '#1a1206', border: '1px solid #8a6a1a', color: '#fcd34d' }}>
            ● EN PAUSA
          </div>

          <h1 className="font-extrabold leading-tight mb-4"
            style={{ fontSize: 'clamp(32px, 7vw, 56px)', letterSpacing: '-0.02em' }}>
            ViralADN está<br />en pausa
          </h1>

          <p className="mx-auto mb-8 text-base sm:text-lg leading-relaxed" style={{ color: '#c4b5fd', maxWidth: '46ch' }}>
            Pausamos la herramienta mientras la reconstruimos.
            <b style={{ color: '#fff' }}> Si tenías una suscripción, tu cobro quedó congelado:</b> no se
            te va a cobrar nada mientras dure la pausa, y te avisamos antes de reactivarla.
          </p>

          <div className="rounded-2xl px-5 py-4 mb-8 text-left mx-auto"
            style={{ background: '#0a0a12', border: '1px solid #2a2a36', maxWidth: '38rem' }}>
            <p className="text-sm mb-2" style={{ color: '#b4b4c0' }}>
              <b style={{ color: '#fff' }}>Las clases en vivo siguen igual:</b>
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#9a9aa6' }}>
              domingos 10:00 AM — Domingos de Viralidad con Francisco · lunes 9:00 AM —
              Creación de ofertas y monetización con Rogger. Hora de Ciudad de México.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/comunidad" className="px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff' }}>
              🎓 Ir a las clases →
            </Link>
            <Link href="/inicio" className="px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: '#14141f', border: '1px solid #2a2a36', color: '#d4d4dc' }}>
              🏠 Volver al inicio
            </Link>
          </div>

          <p className="mt-8 text-xs" style={{ color: '#6b6b78' }}>
            ¿Dudas con tu cobro o tu cuenta? Escríbenos desde el{' '}
            <Link href="/ayuda" style={{ color: '#c4b5fd' }}>Centro de Ayuda</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
