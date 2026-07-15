import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { listarClases, crearClase, editarClase, borrarClase } from '@/lib/clases-store';

// Biblioteca de clases grabadas de /comunidad.
//   GET    → lista las clases (cualquier plan pago o admin).
//   POST   → crea una clase (solo admin).
//   PATCH  → edita una clase (solo admin) — body con id.
//   DELETE → borra una clase (solo admin) — ?id=.
// El video/archivos no son públicos: por eso hasta el GET va gateado.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function miembro() {
  const { email, admin, ent } = await getAccess();
  const puede = !!email && (admin || ent.viraladn || ent.topcut);
  return { email, admin, puede };
}

export async function GET() {
  const { puede, admin } = await miembro();
  if (!puede) return Response.json({ error: 'Solo miembros.' }, { status: 403 });
  const { configurada, clases } = await listarClases();
  return Response.json({ ok: true, configurada, clases, admin });
}

export async function POST(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const r = await crearClase(body);
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ ok: true, id: r.id });
}

export async function PATCH(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || '');
  if (!id) return Response.json({ error: 'Falta el id.' }, { status: 400 });
  const r = await editarClase(id, body);
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return Response.json({ error: 'Falta el id.' }, { status: 400 });
  const r = await borrarClase(id);
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ ok: true });
}
