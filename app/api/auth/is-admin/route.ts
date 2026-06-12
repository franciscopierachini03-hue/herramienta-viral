import { createClient } from '@/lib/supabase/server';

// GET /api/auth/is-admin
// Devuelve { isAdmin: boolean } según el email del user logueado.

// Owner permanente — backup para no quedar afuera por un typo en ADMIN_EMAILS.
// La plantilla pública tiene esta lista vacía. Aquí la tenemos sólo en este repo.
const PERMANENT_OWNERS = ['franciscopierachini03@gmail.com'];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ isAdmin: false });

  const email = user.email.toLowerCase().trim();
  if (PERMANENT_OWNERS.includes(email)) return Response.json({ isAdmin: true });

  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return Response.json({ isAdmin: list.includes(email) });
}
