// Gate server-side de /comunidad (la clase semanal en vivo).
// Es un beneficio de CUALQUIER plan pago (ViralADN o TOPCUT) o admin:
//   • sin sesión → /login
//   • sin plan   → /precios
// El link de Zoom no es público — por eso la puerta va en el server.

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function ComunidadLayout({ children }: { children: ReactNode }) {
  const { email, admin, ent } = await getAccess();
  if (!email) redirect('/login?next=/comunidad');
  if (!admin && !ent.viraladn && !ent.topcut) redirect('/precios');
  return <>{children}</>;
}
