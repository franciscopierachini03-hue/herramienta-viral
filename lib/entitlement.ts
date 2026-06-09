// Permisos por producto (a qué plataforma tiene acceso cada usuario).
// Se deriva de la SUSCRIPCIÓN de Stripe del cliente, clasificada por
// (PRODUCTO + MONTO) — ver lib/products.ts (classifyPrice):
//   producto Combo               → las dos
//   producto TOPCUT              → TOPCUT
//   producto ViralADN $47/$470   → las dos (fundadores)
//   producto ViralADN $27/$270   → ViralADN
//
// No depende de price ids mapeados a mano: usa el id de PRODUCTO + el monto,
// que vienen en cada item de la suscripción.

import { classifyPrice, type Entitlement } from '@/lib/products';

export type { Entitlement };

// Permisos de un cliente Stripe (suma de sus suscripciones activas/trial).
export async function entitlementForCustomer(customerId: string | null | undefined): Promise<Entitlement> {
  const out = { viraladn: false, topcut: false };
  const key = process.env.STRIPE_SECRET_KEY;
  if (!customerId || !key) return out;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=20`,
      { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' },
    );
    if (!res.ok) return out;
    const data = await res.json();
    for (const sub of data?.data || []) {
      if (!['active', 'trialing', 'past_due'].includes(sub.status)) continue;
      for (const it of sub.items?.data || []) {
        const e = classifyPrice(it.price);
        if (e.viraladn) out.viraladn = true;
        if (e.topcut) out.topcut = true;
      }
    }
  } catch {
    /* noop — sin permisos si Stripe falla */
  }
  return out;
}
