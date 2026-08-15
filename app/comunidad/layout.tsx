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
  const { email, admin, ent, rebotada } = await getAccess();
  if (!email) redirect('/login?next=/comunidad');
  if (!admin && !ent.viraladn && !ent.topcut) redirect('/precios');
  // Regla de la casa: con el cobro rebotado NO hay clases en vivo hasta
  // regularizar. Las herramientas siguen (Stripe está reintentando el cobro).
  if (!admin && rebotada) redirect('/cuenta?motivo=cobro');
  return <>{children}</>;
}
