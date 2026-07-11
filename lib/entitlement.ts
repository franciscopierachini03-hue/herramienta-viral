// Permisos por producto (a qué plataforma tiene acceso cada usuario).
// Se deriva de la SUSCRIPCIÓN de Stripe del cliente. Hoy hay DOS cuentas que
// venden acceso:
//   1. Principal (2CLICKS, STRIPE_SECRET_KEY): clasifica por PRODUCTO+MONTO
//      (classifyPrice en lib/products.ts) — viejos + nuevos del evento.
//   2. Elevation (STRIPE_SECRET_KEY_ELEVATION, ventas de /unete/comunidades):
//      los product ids de esa cuenta son otros → clasifica por MONTO del
//      catálogo del evento (los montos son únicos por producto).
// El customer id dice en qué cuenta vive: se intenta la principal y, si ahí no
// hay nada, Elevation.

import { classifyPrice, EVENT_AMOUNTS, type Entitlement } from '@/lib/products';

export type { Entitlement };

// Clasificación por MONTO (centavos, USD) según el catálogo del evento.
// 47/127/451 → ViralADN · 67/181/643 → TOPCUT · 97/262/931 → las dos.
function classifyByAmount(cents?: number | null): Entitlement {
  const out = { viraladn: false, topcut: false };
  if (!cents) return out;
  for (const [prod, ciclos] of Object.entries(EVENT_AMOUNTS)) {
    if (Object.values(ciclos).includes(cents)) {
      if (prod === 'combo') return { viraladn: true, topcut: true };
      if (prod === 'topcut') return { viraladn: false, topcut: true };
      return { viraladn: true, topcut: false };
    }
  }
  return out;
}

type SubsPage = {
  data?: Array<{
    status?: string;
    items?: { data?: Array<{ price?: { id?: string; unit_amount?: number | null; product?: string | null; recurring?: { interval?: string } | null } }> };
  }>;
};

// Permisos según las subs de UNA cuenta (activas/trial/past_due).
async function entFromAccount(key: string | undefined, customerId: string, porMonto: boolean): Promise<Entitlement> {
  const out = { viraladn: false, topcut: false };
  if (!key) return out;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=20`,
      { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' },
    );
    if (!res.ok) return out; // p. ej. "No such customer": vive en otra cuenta
    const data: SubsPage = await res.json();
    for (const sub of data?.data || []) {
      if (!['active', 'trialing', 'past_due'].includes(sub.status || '')) continue;
      for (const it of sub.items?.data || []) {
        const e = porMonto ? classifyByAmount(it.price?.unit_amount) : classifyPrice(it.price);
        if (e.viraladn) out.viraladn = true;
        if (e.topcut) out.topcut = true;
      }
    }
  } catch {
    /* noop — sin permisos si Stripe falla */
  }
  return out;
}

// Permisos de un cliente Stripe (suma de sus suscripciones activas/trial).
export async function entitlementForCustomer(customerId: string | null | undefined): Promise<Entitlement> {
  const out = { viraladn: false, topcut: false };
  if (!customerId) return out;

  const principal = await entFromAccount(process.env.STRIPE_SECRET_KEY, customerId, false);
  if (principal.viraladn || principal.topcut) return principal;

  // No está (o no tiene nada) en la principal → probar Elevation (/unete).
  return entFromAccount(process.env.STRIPE_SECRET_KEY_ELEVATION, customerId, true);
}
