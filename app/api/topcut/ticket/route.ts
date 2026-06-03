// POST /api/topcut/ticket
// Devuelve un ticket corto (HMAC) para que el navegador suba el video DIRECTO
// a Hetzner (la subida no puede pasar por Vercel por el límite de body).
// Solo se emite si el que llama tiene suscripción activa (o es admin).

import { requireTopcutUser, mintTicket, videoApiBase } from '@/lib/topcut';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await requireTopcutUser();
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const { token, exp } = mintTicket(user.email);
  return Response.json({ token, exp, api: videoApiBase() });
}
