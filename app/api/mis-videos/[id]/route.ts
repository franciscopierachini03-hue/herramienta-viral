// DELETE /api/mis-videos/:id — borra un video del historial del usuario.
// Solo puede borrar los suyos (filtra por user_email).

import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const id = req.nextUrl.pathname.split('/').filter(Boolean).pop() || '';
  if (!id) return Response.json({ error: 'falta id' }, { status: 400 });

  try {
    const svc = createServiceClient();
    await svc.from('topcut_videos').delete().eq('id', id).eq('user_email', user.email);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message });
  }
}
