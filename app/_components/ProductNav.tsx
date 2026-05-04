'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Header común a las 3 herramientas (ViralADN, TOPCUT, Guiones).
// Usar siempre en /app, /editor, /guiones para que la nav quede idéntica.
//
// Props:
//   active: cuál producto está activo (resaltado en violeta).

type Active = 'viral' | 'topcut' | 'guiones';

type Item = {
  id: Active;
  href: string;
  label: string;
  comingSoon?: boolean;
};

// TOPCUT está oculto del menú principal mientras está en construcción.
// Cuando esté listo: bajar `comingSoon: false`.
const ITEMS: Item[] = [
  { id: 'viral',   href: '/app',     label: '🧬 ViralADN' },
  { id: 'topcut',  href: '/editor',  label: '✂️ TOPCUT', comingSoon: true },
  { id: 'guiones', href: '/guiones', label: '✍️ Guiones' },
];

const TITLES: Record<Active, { title: string; sub: string }> = {
  viral:   { title: 'ViralADN', sub: 'Descifra el ADN del contenido viral' },
  topcut:  { title: 'TOPCUT',   sub: 'Edita y exporta tus mejores cortes' },
  guiones: { title: 'Guiones',  sub: 'Genera scripts virales con IA' },
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

  return (
    <div className="flex items-center justify-between mb-10 gap-4 flex-wrap">
      {/* Logo + título */}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.svg" alt="ViralADN" width={40} height={40}
          style={{ filter: 'drop-shadow(0 0 18px #7c3aed55)' }} />
        <div>
          <h1 className="text-xl font-bold tracking-tight">{meta.title}</h1>
          <p className="text-xs" style={{ color: '#555' }}>{meta.sub}</p>
        </div>
      </div>

      {/* Switcher */}
      <div className="flex items-center gap-1 p-1 rounded-2xl"
        style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
        {ITEMS.map(item => {
          const isActive = item.id === active;

          // ── Activo (resaltado en violeta) ─────────────────────
          if (isActive) {
            return (
              <div key={item.id}
                className="px-4 py-2 rounded-xl text-xs font-bold cursor-default"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 12px #7c3aed44' }}>
                {item.label}
              </div>
            );
          }

          // ── Próximamente (deshabilitado, no clickeable) ───────
          if (item.comingSoon) {
            return (
              <div key={item.id}
                title="Disponible próximamente"
                className="relative px-4 py-2 rounded-xl text-xs font-bold cursor-not-allowed flex items-center gap-1.5"
                style={{ color: '#3a3a3a', opacity: 0.7 }}>
                <span>{item.label}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#a78bfa' }}>
                  Pronto
                </span>
              </div>
            );
          }

          // ── Link normal ───────────────────────────────────────
          return (
            <Link key={item.id} href={item.href}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200"
              style={{ color: '#555' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = '#fff';
                (e.currentTarget as HTMLElement).style.background = '#1a1a1a';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = '#555';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}>
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Status + Cuenta + Admin */}
      <div className="flex items-center gap-3">
        <Link href="/cuenta"
          className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
          title="Mi cuenta"
          style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', color: '#888' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#1a1a1a';
            (e.currentTarget as HTMLElement).style.color = '#fff';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = '#0f0f0f';
            (e.currentTarget as HTMLElement).style.color = '#888';
          }}>
          👤 Cuenta
        </Link>
        {isAdmin && (
          <Link href="/admin"
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Panel de admin"
            style={{ background: '#0f0f0f', border: '1px solid #7c3aed44', color: '#c4b5fd' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#1a1a1a';
              (e.currentTarget as HTMLElement).style.borderColor = '#7c3aed99';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = '#0f0f0f';
              (e.currentTarget as HTMLElement).style.borderColor = '#7c3aed44';
            }}>
            🛡️ Admin
          </Link>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }}></span>
          <span className="text-xs" style={{ color: '#555' }}>En vivo</span>
        </div>
      </div>
    </div>
  );
}
