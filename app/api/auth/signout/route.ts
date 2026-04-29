import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/signout
//
// Cierra la sesión del usuario actual: invalida la cookie firmada por Supabase
// y borra el refresh token. Lo usa el SessionGuard tanto para idle timeout
// como para cierre de pestaña (vía sendBeacon).
//
// No-op si el usuario ya estaba deslogueado — devuelve { ok: true } igual.

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}
