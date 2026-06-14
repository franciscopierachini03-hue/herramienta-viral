import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/access';

// /api/admin/fix-access  — SOLO admin.
//
// Repara en masa el backlog de cuentas que quedaron "a medias": gente que pagó
// (o entró por código/trial) pero su email nunca quedó confirmado en Supabase
// (email_confirmed_at = null) y por eso no puede iniciar sesión. Era el efecto
// del webhook viejo (signInWithOtp). Confirmar el email las desbloquea: las que
// ya tienen contraseña entran directo; las que no, usan "¿Olvidaste tu
// contraseña?" (que ahora también confirma) y reciben el código por Resend.
//
//   GET  → previsualiza: lista de cuentas sin confirmar (con su estado de pago).
//   POST → confirma todas las cuentas sin confirmar + marca profiles.email_verified.

type Pending = {
  email: string;
  status: string | null;   // subscription_status del profile
  paid: boolean;           // tiene pinta de pago/acceso legítimo
  created_at: string | null;
};

async function collectPending(): Promise<Pending[]> {
  const admin = createServiceClient();

  // Mapa de profiles para etiquetar estado de pago.
  const profByEmail = new Map<string, { status: string | null; customer: string | null; code: string | null }>();
  const { data: profiles } = await admin
    .from('profiles')
    .select('email, subscription_status, stripe_customer_id, redeemed_code');
  for (const p of profiles || []) {
    const em = String(p.email || '').toLowerCase();
    if (em) profByEmail.set(em, { status: p.subscription_status ?? null, customer: p.stripe_customer_id ?? null, code: p.redeemed_code ?? null });
  }

  const pending: Pending[] = [];
  for (let page = 1; page <= 60; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users || [];
    for (const u of users) {
      if (u.email_confirmed_at) continue;                // ya confirmado → saltar
      const em = String(u.email || '').toLowerCase();
      if (!em) continue;
      const prof = profByEmail.get(em);
      const paid = !!prof && (
        ['active', 'trialing', 'past_due'].includes(String(prof.status)) ||
        !!prof.customer || !!prof.code
      );
      pending.push({ email: em, status: prof?.status ?? null, paid, created_at: u.created_at ?? null });
    }
    if (users.length < 200) break;
  }
  // Pagados primero.
  pending.sort((a, b) => Number(b.paid) - Number(a.paid));
  return pending;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) return Response.json({ error: 'No autorizado.' }, { status: 403 });

  const pending = await collectPending();
  return Response.json({
    ok: true,
    count: pending.length,
    paidCount: pending.filter(p => p.paid).length,
    pending,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) return Response.json({ error: 'No autorizado.' }, { status: 403 });

  // Opcional: { onlyPaid: true } para confirmar solo las que tienen pago/acceso.
  const body = await req.json().catch(() => ({}));
  const onlyPaid = body?.onlyPaid === true;

  const admin = createServiceClient();
  const pending = await collectPending();
  const targets = onlyPaid ? pending.filter(p => p.paid) : pending;

  // Necesitamos el id de auth de cada email. Lo resolvemos paginando una vez.
  const idByEmail = new Map<string, string>();
  for (let page = 1; page <= 60; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users || [];
    for (const u of users) {
      const em = String(u.email || '').toLowerCase();
      if (em) idByEmail.set(em, u.id);
    }
    if (users.length < 200) break;
  }

  const fixed: string[] = [];
  const failed: string[] = [];
  for (const t of targets) {
    const id = idByEmail.get(t.email);
    if (!id) { failed.push(t.email); continue; }
    const { error } = await admin.auth.admin.updateUserById(id, { email_confirm: true });
    if (error) { failed.push(t.email); continue; }
    fixed.push(t.email);
  }

  // Marcar email_verified en los profiles correspondientes (best-effort).
  if (fixed.length) {
    await admin.from('profiles').update({ email_verified: true }).in('email', fixed);
  }

  return Response.json({ ok: true, fixed: fixed.length, failed: failed.length, emails: fixed, failedEmails: failed });
}
