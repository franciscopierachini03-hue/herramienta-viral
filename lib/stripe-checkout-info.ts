// Extrae info de descuento + suscripción de una Checkout Session de Stripe.
//
// Lo usan /app/welcome y el webhook de Stripe para capturar:
//   - origin: de qué cupón / promo code vino el pago (ej: "LegacyPanama")
//   - periodEnd: fin del primer período (cuándo se le empieza a cobrar)
//   - subscriptionId: id de la suscripción
//
// IMPORTANTE: Stripe solo permite expandir hasta 4 niveles. Por eso expandimos
// `total_details.breakdown.discounts.discount` (4) y resolvemos el nombre legible
// del promotion_code con una segunda llamada — todo envuelto en try/catch para
// que NUNCA tire la activación del usuario si algo falla.

export type CheckoutInfo = {
  subscriptionId: string | null;
  periodEnd: number | null; // unix seconds
  origin: string | null;    // nombre del promo code o, si no, del cupón
  hasDiscount: boolean;
};

export async function getCheckoutInfo(
  sessionId: string,
  secret: string,
): Promise<CheckoutInfo> {
  const out: CheckoutInfo = {
    subscriptionId: null,
    periodEnd: null,
    origin: null,
    hasDiscount: false,
  };
  if (!sessionId || !secret) return out;

  try {
    const expand =
      'expand[]=subscription&expand[]=total_details.breakdown.discounts.discount';
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?${expand}`,
      { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' },
    );
    if (!res.ok) return out;
    const s = await res.json();

    const sub = typeof s.subscription === 'object' && s.subscription ? s.subscription : null;
    out.subscriptionId = typeof s.subscription === 'string' ? s.subscription : sub?.id ?? null;
    out.periodEnd = sub?.current_period_end ?? null;
    out.hasDiscount = (s.total_details?.amount_discount ?? 0) > 0;

    if (out.hasDiscount) {
      const d = s.total_details?.breakdown?.discounts?.[0]?.discount;
      const couponName: string | null = d?.coupon?.name || d?.coupon?.id || null;

      let promoName: string | null = null;
      const promoRaw = d?.promotion_code;
      const promoId = typeof promoRaw === 'string' ? promoRaw : promoRaw?.id ?? null;
      if (typeof promoRaw === 'object' && promoRaw?.code) {
        promoName = promoRaw.code;
      } else if (promoId) {
        try {
          const pr = await fetch(
            `https://api.stripe.com/v1/promotion_codes/${encodeURIComponent(promoId)}`,
            { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' },
          );
          if (pr.ok) {
            const pd = await pr.json();
            promoName = pd?.code ?? null;
          }
        } catch { /* no bloquea */ }
      }
      out.origin = promoName || couponName;
    }
  } catch { /* no bloquea — devolvemos lo que tengamos */ }

  return out;
}
