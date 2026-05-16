import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// API de carpetas para organizar la biblioteca de guiones.
//
// GET    /api/biblioteca/folders            → lista las carpetas del usuario
// POST   /api/biblioteca/folders            → { name } crea una carpeta
// PATCH  /api/biblioteca/folders            → { id, name } renombra
// DELETE /api/biblioteca/folders?id=xxx     → elimina carpeta (los guiones
//                                              quedan como "Sin carpeta")

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
    .from('guion_folders')
    .select('id, name, created_at')
    .eq('user_email', email)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[folders/get]', error);
    return Response.json({ error: 'Error al cargar' }, { status: 500 });
  }

  const folders = (data || []).map(f => ({
    id: f.id,
    name: f.name,
    createdAt: f.created_at,
  }));
  return Response.json({ folders });
}

export async function POST(req: NextRequest) {
  const email = await getUserEmail();
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const { name } = await req.json();
  const cleanName = String(name || '').trim();
  if (!cleanName) return Response.json({ error: 'Falta el nombre' }, { status: 400 });
  if (cleanName.length > 80) {
    return Response.json({ error: 'Nombre muy largo (máx 80).' }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from('guion_folders')
    .insert({ user_email: email, name: cleanName })
    .select('id, name, created_at')
    .single();

  if (error) {
    console.error('[folders/post]', error);
    return Response.json({ error: 'Error al crear' }, { status: 500 });
  }

  return Response.json({
    folder: { id: data.id, name: data.name, createdAt: data.created_at },
  });
}

export async function PATCH(req: NextRequest) {
  const email = await getUserEmail();
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const { id, name } = await req.json();
  const cleanName = String(name || '').trim();
  if (!id || !cleanName) {
    return Response.json({ error: 'Falta id o nombre' }, { status: 400 });
  }
  if (cleanName.length > 80) {
    return Response.json({ error: 'Nombre muy largo (máx 80).' }, { status: 400 });
  }

  const admin = createServiceClient();
  const { error } = await admin
    .from('guion_folders')
    .update({ name: cleanName })
    .eq('id', String(id))
    .eq('user_email', email);

  if (error) {
    console.error('[folders/patch]', error);
    return Response.json({ error: 'Error al renombrar' }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const email = await getUserEmail();
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ error: 'Falta id' }, { status: 400 });

  const admin = createServiceClient();
  // Los guiones con esta folder_id quedan en NULL por ON DELETE SET NULL.
  const { error } = await admin
    .from('guion_folders')
    .delete()
    .eq('id', String(id))
    .eq('user_email', email);

  if (error) {
    console.error('[folders/delete]', error);
    return Response.json({ error: 'Error al borrar' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
