import { createClient } from '@/lib/supabase/server';

// GET /api/auth/is-admin
// Devuelve { isAdmin: boolean } según el email del user logueado.
// Lo usa la nav para mostrar el botón "Admin" solo a quienes corresponde.

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ isAdmin: false });

  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = list.includes(user.email.toLowerCase());
  return Response.json({ isAdmin });
}
