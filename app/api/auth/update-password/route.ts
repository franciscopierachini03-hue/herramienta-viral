import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/update-password { password }
//
// El usuario llega a /reset-password con sesión recién creada por el callback
// (Supabase intercambió el code del correo por una cookie). Acá actualizamos
// la contraseña del user logueado.

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!password || password.length < 8) {
    return Response.json(
      { error: 'La contraseña tiene que tener al menos 8 caracteres.' },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { error: 'Tu link expiró. Pedí uno nuevo desde "Olvidé mi contraseña".' },
      { status: 401 },
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error('[auth/update-password]', error);
    return Response.json(
      { error: 'No pudimos actualizar la contraseña. Probá de nuevo.' },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
