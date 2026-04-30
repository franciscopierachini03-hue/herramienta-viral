import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// API de la biblioteca personal de guiones del usuario.
//
// GET    /api/biblioteca         → lista los guiones del usuario actual
// POST   /api/biblioteca         → guarda un nuevo guion { id, name, url, platform, transcript }
// PATCH  /api/biblioteca         → renombra { id, name }
// DELETE /api/biblioteca?id=xxx  → elimina UN guion
// DELETE /api/biblioteca?all=1   → elimina TODOS los guiones del usuario
//
// Todos los endpoints requieren usuario logueado. Usamos service client
// para bypassear RLS y filtramos por email del user actual.

async function getUserEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export async function GET() {
  const email = await getUserEmail();
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const admin = createServiceClient();
  const { data, error } = await admin
    .from('guiones')
    .select('id, name, url, platform, transcript, saved_at')
    .eq('user_email', email)
    .order('saved_at', { ascending: false });

  if (error) {
    console.error('[biblioteca/get]', error);
    return Response.json({ error: 'Error al cargar' }, { status: 500 });
  }

  // Convertir saved_at → savedAt (camelCase para el frontend)
  const guiones = (data || []).map(g => ({
    id: g.id,
    name: g.name,
    url: g.url,
    platform: g.platform,
    transcript: g.transcript,
    savedAt: g.saved_at,
  }));
  return Response.json({ guiones });
}

export async function POST(req: NextRequest) {
  const email = await getUserEmail();
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();

  // Soporte para insertar 1 o varios (migración desde localStorage)
  const items = Array.isArray(body.items) ? body.items : [body];
  const rows = items
    .filter((g: Record<string, unknown>) => g.id && g.transcript)
    .map((g: Record<string, unknown>) => ({
      id: String(g.id),
      user_email: email,
      name: String(g.name || 'Sin título'),
      url: String(g.url || ''),
      platform: String(g.platform || 'unknown'),
      transcript: String(g.transcript),
      saved_at: g.savedAt ? new Date(String(g.savedAt)).toISOString() : new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return Response.json({ error: 'Faltan datos del guion' }, { status: 400 });
  }

  const admin = createServiceClient();
  const { error } = await admin
    .from('guiones')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('[biblioteca/post]', error);
    return Response.json({ error: 'Error al guardar' }, { status: 500 });
  }
  return Response.json({ ok: true, saved: rows.length });
}

export async function PATCH(req: NextRequest) {
  const email = await getUserEmail();
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const { id, name } = await req.json();
  if (!id || !name) {
    return Response.json({ error: 'Falta id o name' }, { status: 400 });
  }

  const admin = createServiceClient();
  const { error } = await admin
    .from('guiones')
    .update({ name: String(name) })
    .eq('id', String(id))
    .eq('user_email', email); // Defensa: solo puede editar los suyos

  if (error) {
    console.error('[biblioteca/patch]', error);
    return Response.json({ error: 'Error al renombrar' }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const email = await getUserEmail();
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const deleteAll = url.searchParams.get('all') === '1';

  const admin = createServiceClient();
  if (deleteAll) {
    const { error } = await admin
      .from('guiones')
      .delete()
      .eq('user_email', email);
    if (error) return Response.json({ error: 'Error al borrar todo' }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (!id) return Response.json({ error: 'Falta id' }, { status: 400 });

  const { error } = await admin
    .from('guiones')
    .delete()
    .eq('id', String(id))
    .eq('user_email', email);

  if (error) return Response.json({ error: 'Error al borrar' }, { status: 500 });
  return Response.json({ ok: true });
}
