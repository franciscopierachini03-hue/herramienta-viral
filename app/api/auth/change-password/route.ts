import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/auth/change-password { currentPassword, newPassword }
//
// Cambio de contraseña del usuario LOGUEADO, con doble check de seguridad:
//   1. Verifica la contraseña ACTUAL (re-login con el mismo usuario).
//   2. Recién ahí actualiza a la nueva.
// (El front además exige repetir la nueva — confirmación.)

export async function POST(req: NextRequest) {
  const { currentPassword, newPassword } = await req.json().catch(() => ({}));

  if (!newPassword || String(newPassword).length < 8) {
    return Response.json({ error: 'La nueva contraseña tiene que tener al menos 8 caracteres.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return Response.json({ error: 'Tienes que iniciar sesión.' }, { status: 401 });
  }

  // 1. Verificar la contraseña actual.
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: String(currentPassword || ''),
  });
  if (signErr) {
    return Response.json({ error: 'La contraseña actual no es correcta.' }, { status: 400 });
  }

  // 2. Actualizar a la nueva.
  const { error: updErr } = await supabase.auth.updateUser({ password: String(newPassword) });
  if (updErr) {
    console.error('[change-password]', updErr);
    return Response.json({ error: 'No pudimos cambiar la contraseña. Prueba de nuevo.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
