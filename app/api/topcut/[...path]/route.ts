// Proxy /api/topcut/*  →  api.viraladn.com/api/*
//
// Reenvía SOLO las llamadas chicas (chat, render, poll de jobs) al backend de
// render, agregando el ticket del lado server. El token nunca toca el browser
// y al ser mismo-origen no hay CORS. La subida del video NO pasa por acá
// (Vercel corta el body); esa va directa con el ticket de /api/topcut/ticket.
//
// No es un proxy abierto: solo se permiten los sub-paths del allowlist.

import { NextRequest } from 'next/server';
import { requireTopcutUser, mintTicket, videoApiBase } from '@/lib/topcut';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PREFIX = '/api/topcut/';
const ALLOW = [
  /^render$/,                 // POST /api/render
  /^plan\/[^/]+\/chat$/,      // POST /api/plan/:id/chat
  /^jobs(\/[^/]+)?$/,         // GET  /api/jobs(/:id)
  /^jobs\/[^/]+\/scenes$/,    // GET/POST /api/jobs/:id/scenes  (panel de escenas)
  /^jobs\/[^/]+\/auto$/,      // POST /api/jobs/:id/auto        (auto B-roll/zoom)
  /^jobs\/[^/]+\/chat$/,      // POST /api/jobs/:id/chat        (chat post-edición + re-render)
];

async function handle(req: NextRequest) {
  const user = await requireTopcutUser();
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const sub = req.nextUrl.pathname.startsWith(PREFIX) ? req.nextUrl.pathname.slice(PREFIX.length) : '';
  if (!ALLOW.some((re) => re.test(sub))) {
    return Response.json({ error: 'Ruta no permitida' }, { status: 404 });
  }

  const target = `${videoApiBase()}/api/${sub}${req.nextUrl.search}`;
  const { token } = mintTicket(user.email);

  const headers: Record<string, string> = {};
  const ct = req.headers.get('content-type');
  if (ct) headers['content-type'] = ct;
  if (token) headers['authorization'] = `Bearer ${token}`;

  const init: RequestInit = { method: req.method, headers, cache: 'no-store' };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text(); // chat/render = JSON chico
  }

  try {
    const r = await fetch(target, init);
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return Response.json({ error: 'No se pudo contactar el servidor de edición' }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
