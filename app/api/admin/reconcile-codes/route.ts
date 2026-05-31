import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCheckoutInfo } from '@/lib/stripe-checkout-info';

// POST /api/admin/reconcile-codes
//
// Recorre los perfiles que PAGARON por Stripe pero NO tienen redeemed_code
// guardado (típicamente activados por el webhook antes de que capturáramos el
// código). Para cada uno: busca su Checkout Session en Stripe, extrae el cupón
// usado y completa redeemed_code + trial_ends_at en el perfil.
//
// Idempotente y reutilizable: se puede correr las veces que haga falta.
// Solo accesible para admins.

const PERMANENT_OWNERS = ['franciscopierachini03@gmail.com'];

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (PERMANENT_OWNERS.includes(e)) return true;
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(e);
}

type ResultRow = { email: string; status: string; code?: string };

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return Response.json({ error: 'No autorizado' }, { status: 403 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return Response.json({ error: 'Stripe no configurado' }, { status: 500 });
  }

  const admin = createServiceClient();

  // Perfiles con suscripción Stripe pero sin código guardado.
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('email, stripe_customer_id, stripe_subscription_id, redeemed_code')
    .not('stripe_subscription_id', 'is', null)
    .is('redeemed_code', null);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const results: ResultRow[] = [];
  let updated = 0;

  for (const p of profiles || []) {
    if (!p.stripe_customer_id) {
      results.push({ email: p.email, status: 'sin customer_id' });
      continue;
    }
    try {
      // Listar las checkout sessions del customer (sin expand profundo).
      const listRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions?customer=${encodeURIComponent(p.stripe_customer_id)}&limit=10`,
        { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' },
      );
      if (!listRes.ok) {
        results.push({ email: p.email, status: `error stripe (${listRes.status})` });
        continue;
      }
      const list = await listRes.json();
      const sessions: Array<{ id: string; subscription?: string; payment_status?: string; status?: string }> =
        list.data || [];

      // Preferimos la session que matchea la suscripción; si no, cualquier pagada.
      const match =
        sessions.find(s => s.subscription === p.stripe_subscription_id) ||
        sessions.find(s => s.payment_status === 'paid' || s.status === 'complete');

      if (!match) {
        results.push({ email: p.email, status: 'sin checkout session' });
        continue;
      }

      const info = await getCheckoutInfo(match.id, secret);
      if (info.origin) {
        const patch: Record<string, unknown> = { redeemed_code: info.origin };
        if (info.hasDiscount && info.periodEnd) {
          patch.trial_ends_at = new Date(info.periodEnd * 1000).toISOString();
        }
        await admin.from('profiles').update(patch).eq('email', p.email);
        updated++;
        results.push({ email: p.email, status: 'actualizado', code: info.origin });
      } else {
        results.push({ email: p.email, status: 'pagó sin código (precio normal)' });
      }
    } catch (e) {
      results.push({ email: p.email, status: `error: ${(e as Error).message.slice(0, 60)}` });
    }
  }

  return Response.json({
    checked: (profiles || []).length,
    updated,
    results,
  });
}
