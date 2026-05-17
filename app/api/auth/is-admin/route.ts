import { createClient } from '@/lib/supabase/server';

// GET /api/auth/is-admin
// Devuelve { isAdmin: boolean } según el email del user logueado.

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ isAdmin: false });

  const email = user.email.toLowerCase().trim();
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return Response.json({ isAdmin: list.includes(email) });
}
