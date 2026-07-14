'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Header común a TODAS las herramientas (ViralADN, TOPCUT, Guiones, y lo que venga).
//
// Modelo "hub & spoke": NO se salta directo de una herramienta a otra desde acá.
// Para cambiar de herramienta se vuelve al Home (/inicio) y se elige. Por eso el
// header SIEMPRE trae el botón "🏠 Inicio" (y el logo también vuelve al Home).
//
// 👉 Para una herramienta NUEVA: usá <ProductNav active="..."/> en su página y
//    agregá su card en lib/tools.ts. Así el patrón se mantiene solo.
//
// Props:
//   active: en qué herramienta estás (define el título que se muestra).

type Active = 'viral' | 'topcut' | 'guiones' | 'studio' | 'carruseles' | 'teleprompter' | 'comunidad';

const TITLES: Record<Active, { title: string; sub: string }> = {
  viral:   { title: 'ViralADN', sub: 'Descifra el ADN del contenido viral' },
  topcut:  { title: 'TOPCUT',   sub: 'Tus videos se editan solos con IA' },
  guiones: { title: 'Guiones',  sub: 'Tu biblioteca lista para grabar' },
  studio:  { title: 'Avatares IA', sub: 'Crea tu avatar y conviértelo en video' },
  carruseles: { title: 'Carruseles', sub: 'De una idea a un carrusel listo para publicar' },
  teleprompter: { title: 'Teleprompter', sub: 'Leé tu guion a cámara, la letra baja sola' },
  comunidad: { title: 'Comunidad', sub: 'Tu clase semanal en vivo' },
};

export default function ProductNav({ active }: { active: Active }) {
  const meta = TITLES[active];
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/is-admin', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { isAdmin: false })
      .then(d => { if (!cancelled) setIsAdmin(!!d.isAdmin); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const pill = 'px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all';

  return (
    <div className="flex items-center justify-between mb-10 gap-4 flex-wrap">
      {/* Logo + título — el logo vuelve al Home */}
      <div className="flex items-center gap-3">
        <Link href="/inicio" title="Volver al inicio" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="Inicio" width={40} height={40}
            style={{ filter: 'drop-shadow(0 0 18px #7c3aed55)' }} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{meta.title}</h1>
          <p className="text-xs" style={{ color: '#a1a1aa' }}>{meta.sub}</p>
        </div>
      </div>

      {/* Acciones — Inicio (Home) destacado + Cuenta + Admin + estado */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <Link href="/inicio" className={pill}
          title="Volver al inicio para cambiar de herramienta"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 14px #7c3aed44' }}>
          🏠 Inicio
        </Link>
        <Link href="/cuenta" className={pill} title="Mi cuenta"
          style={{ background: '#101019', border: '1px solid #23232f', color: '#b4b4c0' }}>
          👤 Cuenta
        </Link>
        {isAdmin && (
          <Link href="/admin" className={pill} title="Panel de admin"
            style={{ background: '#101019', border: '1px solid #7c3aed44', color: '#c4b5fd' }}>
            🛡️ Admin
          </Link>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></span>
          <span className="text-xs" style={{ color: '#8b8b96' }}>En vivo</span>
        </div>
      </div>
    </div>
  );
}
