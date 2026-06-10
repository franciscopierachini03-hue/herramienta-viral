// Gate server-side de /editor (TOPCUT) — corre ANTES de renderizar la página,
// así que es robusto (no hay flash ni "se cuelga" como el gate client).
//
//   • sin sesión        → /login
//   • admin             → entra
//   • pagó TOPCUT/combo/fundador → entra
//   • pagó otra cosa (ej. solo ViralADN $27) o nada → directo al pago
//     (/precios?producto=topcut) — TOPCUT ya está a la venta, sin "muy pronto".

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function EditorLayout({ children }: { children: ReactNode }) {
  const { email, admin, ent } = await getAccess();
  if (!email) redirect('/login?next=/editor');
  if (!admin && !ent.topcut) redirect('/precios?producto=topcut');
  return <>{children}</>;
}
