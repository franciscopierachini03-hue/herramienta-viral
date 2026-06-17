import { getAccess } from '@/lib/access';
import { getCredits, monthlyGrantFor } from '@/lib/credits';

// GET /api/studio/credits → saldo de créditos de IA del usuario logueado.

export const dynamic = 'force-dynamic';

export async function GET() {
  const { email, admin, ent } = await getAccess();
  if (!email) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const grant = monthlyGrantFor(ent, admin);
  const st = await getCredits(email, grant);
  return Response.json({ ok: true, ...st });
}
