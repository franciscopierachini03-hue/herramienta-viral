// Historial de videos editados con TOPCUT (por usuario, últimos 30 días).
//   GET  → lista los videos del usuario logueado.
//   POST → guarda un video recién renderizado.
// Usa service role (bypassa RLS); la tabla tiene RLS activada sin policies, así
// que solo el server puede leer/escribir. Resiliente: si la tabla no existe aún
// (falta correr el SQL), devuelve vacío / ok sin romper.

import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RETENTION_DAYS = 30;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ videos: [] });

  try {
    const svc = createServiceClient();
    const since = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
    const { data, error } = await svc
      .from('topcut_videos')
      .select('id, job_id, result_url, title, context, duration, created_at')
      .eq('user_email', user.email)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return Response.json({ videos: [], error: error.message });
    return Response.json({ videos: data || [], retentionDays: RETENTION_DAYS });
  } catch (e) {
    return Response.json({ videos: [], error: (e as Error).message });
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: 'No autorizado' }, { status: 401 });

  let body: { resultUrl?: string; jobId?: string; context?: string; title?: string; duration?: number };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const resultUrl = (body.resultUrl || '').toString().trim();
  if (!resultUrl) return Response.json({ error: 'falta resultUrl' }, { status: 400 });

  try {
    const svc = createServiceClient();
    await svc.from('topcut_videos').insert({
      user_email: user.email,
      job_id: (body.jobId || '').toString().slice(0, 200) || null,
      result_url: resultUrl.slice(0, 2000),
      context: (body.context || '').toString().slice(0, 500) || null,
      title: (body.title || body.context || '').toString().slice(0, 200) || null,
      duration: typeof body.duration === 'number' && isFinite(body.duration) ? Math.round(body.duration) : null,
    });
    return Response.json({ ok: true });
  } catch (e) {
    // No rompemos la experiencia del editor si el guardado falla.
    return Response.json({ ok: false, error: (e as Error).message });
  }
}
