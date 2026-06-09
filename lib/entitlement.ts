// Permisos por producto (a qué plataforma tiene acceso cada usuario).
// Se deriva de la SUSCRIPCIÓN de Stripe del cliente, por el PRICE ID:
//   STRIPE_PRICE_VIRALADN ($27)  → ViralADN
//   STRIPE_PRICE_TOPCUT   ($57)  → TOPCUT
//   STRIPE_PRICE_COMBO    ($67)  → las dos
//   STRIPE_PRICE_MONTHLY  (viejo $47) → ViralADN (continuidad de los que ya pagaban)
//
// Setear esos price IDs en Vercel cuando se creen los productos en Stripe.

export type Entitlement = { viraladn: boolean; topcut: boolean };

const ids = () => ({
  viraladn: (process.env.STRIPE_PRICE_VIRALADN || '').trim(),
  topcut: (process.env.STRIPE_PRICE_TOPCUT || '').trim(),
  combo: (process.env.STRIPE_PRICE_COMBO || '').trim(),
  legacy: (process.env.STRIPE_PRICE_MONTHLY || '').trim(), // viejo plan único → ViralADN
});

// Mapea un price id → qué desbloquea.
// Los que pagaban el viejo $47 (STRIPE_PRICE_MONTHLY) son "miembros fundadores":
// su plan les da acceso a LAS DOS plataformas (lo mismo que el combo de $67).
export function entitlementFromPriceId(priceId: string | null | undefined): Entitlement {
  const out = { viraladn: false, topcut: false };
  if (!priceId) return out;
  const p = ids();
  if (priceId === p.combo || (p.legacy && priceId === p.legacy)) { out.viraladn = true; out.topcut = true; }
  else if (priceId === p.viraladn) out.viraladn = true;
  else if (priceId === p.topcut) out.topcut = true;
  return out;
}

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
        const e = entitlementFromPriceId(it.price?.id);
        if (e.viraladn) out.viraladn = true;
        if (e.topcut) out.topcut = true;
      }
    }
  } catch {
    /* noop — sin permisos si Stripe falla */
  }
  return out;
}
