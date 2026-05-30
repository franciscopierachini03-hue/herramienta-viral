import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/signout
//
// Cierra la sesión del usuario actual: invalida la cookie firmada por Supabase
// y borra el refresh token. Lo usa el SessionGuard al cumplirse los 15 min de
// inactividad. (El cierre por cerrar el navegador lo manejan las session cookies
// del middleware, no este endpoint.)
//
// No-op si el usuario ya estaba deslogueado — devuelve { ok: true } igual.

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}
