import { getAccess } from '@/lib/access';

// Devuelve el acceso por producto del usuario logueado.
// Lo usan /app (ViralADN) y /editor (TOPCUT) para redirigir a quien no pagó
// ese producto al hub /inicio.
//   → { ok, email, admin, viraladn, topcut }
export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await getAccess();
  return Response.json({
    ok: !!a.email,
    email: a.email,
    admin: a.admin,
    viraladn: a.ent.viraladn,
    topcut: a.ent.topcut,
  });
}
