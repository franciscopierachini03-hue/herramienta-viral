'use client';

// 🛠️ Cartel de mantenimiento de TOPCUT.
//
// El servidor que hacía los renders se perdió el 24 de agosto de 2026 (Hetzner
// bloqueó el servicio por un cobro rebotado y canceló el contrato). Hasta que
// el motor esté de vuelta, quien entra a /editor ve esto en lugar de un editor
// que nunca termina de responder.
//
// Para volver a encenderlo: NEXT_PUBLIC_TOPCUT_MANTENIMIENTO=0 en Vercel.
// No hace falta tocar código ni volver a desplegar.

import Link from 'next/link';
import ProductNav from '../_components/ProductNav';
import SessionGuard from '../_components/SessionGuard';

export default function Mantenimiento() {
  return (
    <main className="min-h-screen text-white" style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #0a1f28 0%, #080808 55%)' }}>
      <div className="px-6 pt-10 pb-2 max-w-6xl mx-auto w-full">
        <SessionGuard />
        <ProductNav active="topcut" />
      </div>

      <div className="px-6 pb-24 pt-6 max-w-3xl mx-auto">
        <div className="rounded-3xl px-6 py-12 sm:px-12 sm:py-16 text-center"
          style={{ background: 'linear-gradient(160deg, #0d1a21, #0a0a0f)', border: '1px solid #164e5e' }}>

          <div className="text-6xl sm:text-7xl mb-5" aria-hidden="true">🛠️</div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 text-xs font-bold tracking-wide"
            style={{ background: '#1a1206', border: '1px solid #8a6a1a', color: '#fcd34d' }}>
            ● EN MANTENIMIENTO
          </div>

          <h1 className="font-extrabold leading-tight mb-4"
            style={{ fontSize: 'clamp(32px, 7vw, 56px)', letterSpacing: '-0.02em' }}>
            TOPCUT está<br />en mantenimiento
          </h1>

          <p className="mx-auto mb-8 text-base sm:text-lg leading-relaxed" style={{ color: '#b4c4cc', maxWidth: '44ch' }}>
            Estamos reconstruyendo el motor de edición para que vuelva más rápido
            y con mejores cortes. Mientras tanto, <b style={{ color: '#fff' }}>no subas videos
            aquí</b>: no se van a procesar.
          </p>

          <div className="rounded-2xl px-5 py-4 mb-8 text-left mx-auto"
            style={{ background: '#0a0a12', border: '1px solid #1f2d33', maxWidth: '38rem' }}>
            <p className="text-sm mb-2" style={{ color: '#9fb3bb' }}>
              <b style={{ color: '#fff' }}>Tus demás herramientas siguen funcionando normal:</b>
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#9fb3bb' }}>
              el buscador de virales, las transcripciones, los guiones, la calculadora,
              analizar perfiles y las clases en vivo.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/app" className="px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
              Ir a ViralADN →
            </Link>
            <Link href="/inicio" className="px-6 py-3 rounded-xl font-bold text-sm"
              style={{ background: '#14141f', border: '1px solid #2a2a36', color: '#d4d4dc' }}>
              🏠 Volver al inicio
            </Link>
          </div>

          <p className="mt-8 text-xs" style={{ color: '#5d6b72' }}>
            ¿Dudas con tu plan o tu cuenta? Escríbenos desde el{' '}
            <Link href="/ayuda" style={{ color: '#67e8f9' }}>Centro de Ayuda</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
