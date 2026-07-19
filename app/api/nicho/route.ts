import { createClient } from '@/lib/supabase/server';
import { getNicho, saveNicho } from '@/lib/nicho-store';

// /api/nicho — cliente ideal + palabras clave guardadas del usuario logueado.
//   GET  → { clienteIdeal, palabras, dormido }
//   POST { clienteIdeal, palabras } → guarda el estado completo (upsert).
// "dormido" = la tabla nicho_usuario todavía no existe (falta correr el SQL).

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const { nicho, dormido } = await getNicho(user.id);
  return Response.json({ clienteIdeal: nicho.clienteIdeal, palabras: nicho.palabras, dormido });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

  let body: { clienteIdeal?: string; palabras?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const clienteIdeal = (body.clienteIdeal || '').toString();
  const palabras = Array.isArray(body.palabras) ? body.palabras.filter((x): x is string => typeof x === 'string') : [];

  const { ok, dormido } = await saveNicho(user.id, clienteIdeal, palabras);
  if (dormido) return Response.json({ ok: false, dormido: true });
  if (!ok) return Response.json({ error: 'No se pudo guardar' }, { status: 502 });
  return Response.json({ ok: true });
}
