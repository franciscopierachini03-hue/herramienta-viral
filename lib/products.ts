// Catálogo de productos — fuente de verdad de los 3 productos del lanzamiento.
//
// CLAVE: clasificamos y resolvemos por (PRODUCTO + MONTO), NO por un price id
// mapeado a mano. Stripe genera los price id al azar, y este producto ViralADN
// tiene 4 precios mezclados ($47/$470 fundadores + $27/$270 nuevos). Mapear a
// mano es frágil y peligroso (cobrar el anual como mensual). En cambio, los IDs
// de PRODUCTO y los MONTOS los conocemos con certeza, así que con eso alcanza.

export type ProductKey = 'viraladn' | 'topcut' | 'combo';
export type Ciclo = 'monthly' | 'yearly';
export type Entitlement = { viraladn: boolean; topcut: boolean };

// IDs de PRODUCTO en Stripe (LIVE) — verificados desde el dashboard.
export const PRODUCT_IDS: Record<ProductKey, string> = {
  viraladn: 'prod_UYuYRAr2wmiVX7', // "ViralADN Pro" (incluye $47/$470 fundadores + $27/$270 nuevos)
  topcut: 'prod_Ufs27ydtVMfrn5',   // "TOPCUT"
  combo: 'prod_UfsmQSVdUE3OTu',    // "ViralADN ✕ TOPCUT — Combo"
};

// Montos esperados, en centavos (USD). Anual = 20% off del total de 12 meses.
export const PLAN_AMOUNTS: Record<ProductKey, Partial<Record<Ciclo, number>>> = {
  viraladn: { monthly: 2700, yearly: 25900 }, // $27/mes · $259/año (−20%)  (NO el $47/$470 fundador)
  topcut: { monthly: 5700, yearly: 54700 },   // $57/mes · $547/año (−20%)
  combo: { monthly: 6700, yearly: 64300 },    // $67/mes · $643/año (−20%)
};

// Planes FUNDADORES (viejo ViralADN único) → desbloquean LAS DOS plataformas.
const FOUNDER_AMOUNTS = new Set<number>([4700, 47000]); // $47/mes, $470/año

type StripePrice = {
  id?: string;
  active?: boolean;
  currency?: string;
  unit_amount?: number | null;
  product?: string | null;
  recurring?: { interval?: string } | null;
};

// Clasifica el precio de una suscripción → qué desbloquea.
// price.product (id) y price.unit_amount vienen incluidos en el item de la sub.
export function classifyPrice(price: StripePrice | null | undefined): Entitlement {
  const out = { viraladn: false, topcut: false };
  const prod = price?.product;
  if (!prod) return out;
  const amt = price?.unit_amount ?? -1;

  if (prod === PRODUCT_IDS.combo) { out.viraladn = true; out.topcut = true; }
  else if (prod === PRODUCT_IDS.topcut) { out.topcut = true; }
  else if (prod === PRODUCT_IDS.viraladn) {
    if (FOUNDER_AMOUNTS.has(amt)) { out.viraladn = true; out.topcut = true; } // fundador
    else { out.viraladn = true; }                                            // ViralADN nuevo
  }
  return out;
}

export function priceEnvName(producto: ProductKey, ciclo: Ciclo): string {
  if (producto === 'viraladn') return ciclo === 'yearly' ? 'STRIPE_PRICE_VIRALADN_YEARLY' : 'STRIPE_PRICE_VIRALADN';
  if (producto === 'topcut') return 'STRIPE_PRICE_TOPCUT';
  return ciclo === 'yearly' ? 'STRIPE_PRICE_COMBO_YEARLY' : 'STRIPE_PRICE_COMBO';
}

// Resuelve el price id para el checkout:
//   1. Override por env (STRIPE_PRICE_*), si está seteado → manda.
//   2. Si no, busca en Stripe el precio del PRODUCTO con el monto + intervalo
//      correctos. Así no hace falta pegar ningún price id a mano.
const _cache = new Map<string, { id: string; t: number }>();
const CACHE_MS = 5 * 60 * 1000;

export async function resolvePriceId(producto: ProductKey, ciclo: Ciclo): Promise<string | null> {
  const envId = (process.env[priceEnvName(producto, ciclo)] || '').trim();
  if (envId) return envId;

  const key = process.env.STRIPE_SECRET_KEY;
  const product = PRODUCT_IDS[producto];
  const amount = PLAN_AMOUNTS[producto]?.[ciclo];
  if (!key || !product || !amount) return null;

  const cacheKey = `${producto}:${ciclo}`;
  const hit = _cache.get(cacheKey);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.id;

  const interval = ciclo === 'yearly' ? 'year' : 'month';
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/prices?product=${encodeURIComponent(product)}&active=true&limit=100`,
      { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const match = (data?.data as StripePrice[] | undefined)?.find(
      p => p.active && p.currency === 'usd' && p.recurring?.interval === interval && p.unit_amount === amount,
    );
    if (match?.id) { _cache.set(cacheKey, { id: match.id, t: Date.now() }); return match.id; }
    return null;
  } catch {
    return null;
  }
}
