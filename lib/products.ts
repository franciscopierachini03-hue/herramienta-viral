// Catálogo de productos — fuente de verdad de los 3 productos del lanzamiento.
//
// CLAVE: clasificamos y resolvemos por (PRODUCTO + MONTO), NO por un price id
// mapeado a mano. Stripe genera los price id al azar, y este producto ViralADN
// tiene 4 precios mezclados ($47/$470 fundadores + $27/$270 nuevos). Mapear a
// mano es frágil y peligroso (cobrar el anual como mensual). En cambio, los IDs
// de PRODUCTO y los MONTOS los conocemos con certeza, así que con eso alcanza.

export type ProductKey = 'viraladn' | 'topcut' | 'combo';
export type Ciclo = 'monthly' | 'quarterly' | 'yearly';
export type Entitlement = { viraladn: boolean; topcut: boolean };

// IDs de PRODUCTO en Stripe (LIVE) — verificados desde el dashboard.
export const PRODUCT_IDS: Record<ProductKey, string> = {
  viraladn: 'prod_UYuYRAr2wmiVX7', // "ViralADN Pro" (incluye $47/$470 fundadores + $27/$270 nuevos)
  topcut: 'prod_Ufs27ydtVMfrn5',   // "TOPCUT"
  combo: 'prod_UfsmQSVdUE3OTu',    // "ViralADN ✕ TOPCUT — Combo"
};

// Montos esperados, en centavos (USD). Anual = 2 meses gratis (pagas 10 de 12).
export const PLAN_AMOUNTS: Record<ProductKey, Partial<Record<Ciclo, number>>> = {
  viraladn: { monthly: 2700, yearly: 27000 }, // $27/mes · $270/año  (NO el $47/$470 fundador)
  topcut: { monthly: 5700, yearly: 57000 },   // $57/mes · $570/año
  combo: { monthly: 6700, yearly: 67000 },    // $67/mes · $670/año
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

// ── LANZAMIENTO 10-jul-26 (evento de conversión): productos NUEVOS ───────────
// El evento vende bajo productos/precios NUEVOS. El acceso se concede por estos
// mapas, ADEMÁS de la lógica de productos viejos de más abajo — que NO se toca,
// así los suscriptores del producto antiguo siguen entrando exactamente igual.
// Mapear por PRODUCTO (no por monto) cubre cualquier ciclo y evita la colisión
// del $47 fundador (el producto nuevo de ViralADN no es el viejo prod_UYuY...).
const NEW_PRODUCT_ENT: Record<string, Entitlement> = {
  // TODO(10-jul): pegar los 3 product ids NUEVOS de 2CLICKS (prod_...).
  // 'prod_XXXX': { viraladn: true,  topcut: false }, // ViralADN (nuevo)
  // 'prod_YYYY': { viraladn: false, topcut: true  }, // TOPCUT (nuevo)
  // 'prod_ZZZZ': { viraladn: true,  topcut: true  }, // Combo (nuevo)
};
// Respaldo por PRICE ID exacto (los del evento ya creados por Francisco).
const NEW_PRICE_ENT: Record<string, Entitlement> = {
  'price_1TrgNwBrwYizao1Ogz3hesBl': { viraladn: true,  topcut: false }, // ViralADN $47/mes
  'price_1TrgOUBrwYizao1OhEiFZzRA': { viraladn: true,  topcut: false }, // ViralADN $127/3m
  'price_1TrgOtBrwYizao1Olm1t2Bl1': { viraladn: true,  topcut: false }, // ViralADN $451/año
  'price_1TrgQWBrwYizao1Oz8hQaRUf': { viraladn: false, topcut: true  }, // TOPCUT $67/mes
  'price_1TrgQpBrwYizao1OByH7Vqwr': { viraladn: false, topcut: true  }, // TOPCUT $181/3m
  'price_1TrgRDBrwYizao1OOT8W9gPf': { viraladn: false, topcut: true  }, // TOPCUT $643/año
  'price_1TrgRyBrwYizao1O8H1ANmMd': { viraladn: true,  topcut: true  }, // Combo $97/mes
  'price_1TrgSlBrwYizao1O0yBJEtKu': { viraladn: true,  topcut: true  }, // Combo $262/3m
  'price_1TrgSUBrwYizao1OseJagoxo': { viraladn: true,  topcut: true  }, // Combo $931/año
};

// Clasifica el precio de una suscripción → qué desbloquea.
// price.product (id) y price.unit_amount vienen incluidos en el item de la sub.
export function classifyPrice(price: StripePrice | null | undefined): Entitlement {
  // Productos/precios NUEVOS del evento → mapa explícito, va primero (aditivo).
  if (price?.id && NEW_PRICE_ENT[price.id]) return { ...NEW_PRICE_ENT[price.id] };
  if (price?.product && NEW_PRODUCT_ENT[price.product]) return { ...NEW_PRODUCT_ENT[price.product] };

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

// Checkout del EVENTO (10-jul-26): price id NUEVO directo por producto+ciclo.
// Va primero en resolvePriceId → la página cobra estos precios exactos sin
// depender del match por monto (que buscaba en el producto viejo).
export const EVENT_CHECKOUT_PRICE: Record<ProductKey, Partial<Record<Ciclo, string>>> = {
  viraladn: {
    monthly:   'price_1TrgNwBrwYizao1Ogz3hesBl', // $47/mes
    quarterly: 'price_1TrgOUBrwYizao1OhEiFZzRA', // $127/3m
    yearly:    'price_1TrgOtBrwYizao1Olm1t2Bl1', // $451/año
  },
  topcut: {
    monthly:   'price_1TrgQWBrwYizao1Oz8hQaRUf', // $67/mes
    quarterly: 'price_1TrgQpBrwYizao1OByH7Vqwr', // $181/3m
    yearly:    'price_1TrgRDBrwYizao1OOT8W9gPf', // $643/año
  },
  combo: {
    monthly:   'price_1TrgRyBrwYizao1O8H1ANmMd', // $97/mes
    quarterly: 'price_1TrgSlBrwYizao1O0yBJEtKu', // $262/3m
    yearly:    'price_1TrgSUBrwYizao1OseJagoxo', // $931/año
  },
};

// Montos del EVENTO en centavos (USD) — sirven para resolver precios en OTRAS
// cuentas de Stripe (p. ej. Elevation) por monto+intervalo, sin pegar ids:
// en una cuenta nueva alcanza con crear el precio con el monto correcto.
export const EVENT_AMOUNTS: Record<ProductKey, Record<Ciclo, number>> = {
  viraladn: { monthly: 4700, quarterly: 12700, yearly: 45100 },
  topcut:   { monthly: 6700, quarterly: 18100, yearly: 64300 },
  combo:    { monthly: 9700, quarterly: 26200, yearly: 93100 },
};

export async function resolvePriceId(producto: ProductKey, ciclo: Ciclo): Promise<string | null> {
  // Evento: price id nuevo directo, manda sobre env override y match por monto.
  const ev = EVENT_CHECKOUT_PRICE[producto]?.[ciclo];
  if (ev) return ev;

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
