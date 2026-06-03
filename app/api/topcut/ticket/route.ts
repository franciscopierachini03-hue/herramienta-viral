// POST /api/topcut/ticket
// Devuelve un ticket corto (HMAC) para que el navegador suba el video DIRECTO
// a Hetzner (la subida no puede pasar por Vercel por el límite de body).
// Solo se emite si el que llama tiene suscripción activa (o es admin).
//
// Además sondea (server-to-server, sin CORS) si el backend ya tiene el modo
// previo (/api/plan). Si NO lo tiene, el front evita subir el video al pedo a
// un endpoint inexistente y va directo al flujo que sí funciona (/api/jobs).

import { requireTopcutUser, mintTicket, videoApiBase } from '@/lib/topcut';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function planAvailable(api: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    // GET a un endpoint POST-only → 405 (existe) vs 404 (no existe).
    const r = await fetch(`${api}/api/plan`, { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    return r.status !== 404;
  } catch {
    return false; // backend caído / sin endpoint → usamos el flujo actual
  }
}

export async function POST() {
  const user = await requireTopcutUser();
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const api = videoApiBase();
  const { token, exp } = mintTicket(user.email);
  const plan = await planAvailable(api);

  return Response.json({ token, exp, api, planAvailable: plan });
}
