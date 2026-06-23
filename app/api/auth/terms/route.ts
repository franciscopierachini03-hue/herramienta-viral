import { createClient, createServiceClient } from '@/lib/supabase/server';

// Estado y registro de aceptación de Términos/Privacidad/Reembolsos.
// Se guarda en user_metadata.terms_accepted_at (no requiere DDL) → evidencia
// con fecha/hora + versión para responder disputas en Stripe.
//   GET  → { authed, accepted }
//   POST → marca aceptado (now) para el usuario logueado.

export const dynamic = 'force-dynamic';

const TERMS_VERSION = 'v1';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return Response.json({
    authed: !!user,
    accepted: !!user?.user_metadata?.terms_accepted_at,
  });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'No autorizado.' }, { status: 401 });

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata || {}),
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
    },
  });
  if (error) {
    console.error('[auth/terms] accept:', error);
    return Response.json({ error: 'No se pudo registrar la aceptación.' }, { status: 500 });
  }
  return Response.json({ ok: true });
}
