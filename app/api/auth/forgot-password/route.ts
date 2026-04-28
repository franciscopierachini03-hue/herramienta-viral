import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/forgot-password { email }
//
// Pide a Supabase que mande un correo con un link mágico para resetear la
// contraseña. El correo redirige a /auth/callback?code=...&next=/reset-password,
// donde el usuario setea su nueva clave.
//
// Por seguridad, devolvemos { ok: true } siempre — incluso si el email no
// existe — para no exponer qué cuentas están registradas.

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Correo inválido.' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  });

  if (error) {
    // Logueamos para nosotros pero al usuario le mentimos: success siempre.
    console.error('[auth/forgot-password]', error);
  }

  return Response.json({ ok: true });
}
