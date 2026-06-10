import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/access';

// POST /api/admin/reset-password { email, newPassword }  — SOLO admin.
// Restablece la contraseña de cualquier usuario (vía admin API / service role).
// El admin le comunica la nueva contraseña a la persona.

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return Response.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const { email, newPassword } = await req.json().catch(() => ({}));
  const targetEmail = String(email || '').toLowerCase().trim();
  if (!targetEmail) return Response.json({ error: 'Falta el email.' }, { status: 400 });
  if (!newPassword || String(newPassword).length < 8) {
    return Response.json({ error: 'La contraseña tiene que tener al menos 8 caracteres.' }, { status: 400 });
  }

  const admin = createServiceClient();

  // Buscar el usuario por email (paginado).
  let userId: string | null = null;
  for (let page = 1; page <= 50 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const u = data.users.find(x => x.email?.toLowerCase() === targetEmail);
    if (u) userId = u.id;
    if (data.users.length < 200) break;
  }
  if (!userId) return Response.json({ error: `No encontré ningún usuario con el email ${targetEmail}.` }, { status: 404 });

  // password + email_confirm: muchos que "no pueden entrar" tienen el email sin
  // confirmar (nunca lo verificaron). Al resetear desde admin, lo confirmamos.
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: String(newPassword), email_confirm: true });
  if (updErr) {
    console.error('[admin/reset-password]', updErr);
    return Response.json({ error: 'No pudimos cambiar la contraseña.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
