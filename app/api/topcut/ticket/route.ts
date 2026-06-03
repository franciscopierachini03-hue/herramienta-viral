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

async function probe(url: string, ms = 3500): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    return r;
  } catch {
    return null;
  }
}

async function planAvailable(api: string): Promise<boolean> {
  // 1) Señal limpia: GET /api/capabilities → { plan: true } (lo ideal del backend).
  const cap = await probe(`${api}/api/capabilities`);
  if (cap && cap.ok) {
    const j = await cap.json().catch(() => null);
    if (j && typeof j.plan === 'boolean') return j.plan;
  }
  // 2) Heurística: el route existe si GET /api/plan NO da 404 (200/400/405 = existe).
  const p = await probe(`${api}/api/plan`);
  if (p) return p.status !== 404;
  return false; // backend caído / sin endpoint → usamos el flujo actual
}

export async function POST() {
  const user = await requireTopcutUser();
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const api = videoApiBase();
  const { token, exp } = mintTicket(user.email);
  const plan = await planAvailable(api);

  return Response.json({ token, exp, api, planAvailable: plan });
}
