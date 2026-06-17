// Gate server-side de /studio (Avatares IA). Disponible para cualquier plan
// pago (ViralADN o TOPCUT) o admin; el uso se limita por créditos.
//
//   • sin sesión          → /login
//   • admin               → entra
//   • cualquier plan pago → entra
//   • sin plan            → al pago (/precios)

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const { email, admin, ent } = await getAccess();
  if (!email) redirect('/login?next=/studio');
  if (!admin && !ent.viraladn && !ent.topcut) redirect('/precios');
  return <>{children}</>;
}
