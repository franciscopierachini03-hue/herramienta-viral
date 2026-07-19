'use client';

// Botón flotante "?" global → lleva al Centro de Ayuda (/ayuda).
// Se oculta en el propio /ayuda y en las landings del evento/proximamente
// (ahí no corresponde). Montado una vez en el layout raíz.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const OCULTAR = ['/ayuda', '/evento', '/proximamente', '/login'];

export default function HelpButton() {
  const pathname = usePathname() || '';
  if (OCULTAR.some(p => pathname === p || pathname.startsWith(p + '/'))) return null;

  return (
    <Link href="/ayuda" aria-label="Centro de Ayuda"
      className="fixed z-50 flex items-center gap-2 rounded-full font-bold text-sm shadow-lg"
      style={{
        right: 20, bottom: 20, padding: '12px 16px',
        background: 'linear-gradient(135deg,#7c3aed,#c13584)', color: '#fff',
        boxShadow: '0 8px 30px rgba(124,58,237,.45)',
      }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>🆘</span>
      <span className="hidden sm:inline">Ayuda</span>
    </Link>
  );
}
