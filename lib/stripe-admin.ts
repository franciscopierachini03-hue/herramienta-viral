// Helpers para leer datos de Stripe y agregar métricas de facturación.
// Solo usar en server components / route handlers — usa STRIPE_SECRET_KEY.

export type StripeCharge = {
  id: string;
  amount: number;          // en cents (centavos)
  currency: string;
  status: string;          // 'succeeded', 'failed', etc.
  created: number;         // unix timestamp
  paid: boolean;
  refunded: boolean;
  amount_refunded: number;
  customer: string | null;
  receipt_email: string | null;
  description: string | null;
  billing_details?: { email?: string | null; name?: string | null };
  payment_intent?: string;
  invoice?: string;
};

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;          // 'active', 'past_due', 'canceled', 'trialing'
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: { data: Array<{ price: { unit_amount: number; currency: string; recurring: { interval: string } | null } }> };
  // `discount`/`discounts` presentes mientras un cupón sigue activo en la
  // suscripción. Con un cupón "$47 off una vez", aparece durante el primer mes
  // (gratis) y Stripe lo quita al facturar el segundo. Lo usamos para detectar
  // "mes de prueba". `discount` es el campo viejo, `discounts` el nuevo (array).
  discount?: { coupon?: { id?: string; name?: string } } | null;
  discounts?: unknown[] | null;
};

export type BillingOverview = {
  // Totales
  totalRevenueAllTime: number;     // en USD (no centavos)
  totalRevenueThisMonth: number;
  totalRevenueLastMonth: number;
  // Suscripciones
  activeSubscriptions: number;
  // Lista cronológica de pagos exitosos (más reciente primero)
  recentPayments: Array<{
    id: string;
    amount: number;        // USD
    currency: string;
    customer: string;
    email: string;
    date: string;          // ISO
    description: string;
    refunded: boolean;
  }>;
  // Por mes (últimos 6 meses) para graficar
  monthlyRevenue: Array<{ month: string; revenue: number; count: number }>;
  // Customer IDs que están en su MES DE PRUEBA (suscripción activa con cupón
  // de descuento aplicado = primer mes gratis vía promo). El admin los marca.
  trialCustomerIds: string[];
  // Si Stripe no está configurado
  configured: boolean;
  error?: string;
};

const STRIPE_API = 'https://api.stripe.com/v1';

async function stripeGet<T = unknown>(path: string, params: Record<string, string | number> = {}): Promise<T | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  );
  const url = `${STRIPE_API}/${path}${qs.toString() ? '?' + qs : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(`[stripe] ${path} → ${res.status}`, await res.text().catch(() => ''));
    return null;
  }
  return res.json() as Promise<T>;
}

// Trae hasta `limit` charges (maneja paginación). Stripe devuelve max 100 por request.
async function listAllCharges(limit = 200): Promise<StripeCharge[]> {
  const all: StripeCharge[] = [];
  let starting_after: string | undefined;
  while (all.length < limit) {
    const params: Record<string, string | number> = { limit: 100 };
    if (starting_after) params.starting_after = starting_after;
    const page = await stripeGet<{ data: StripeCharge[]; has_more: boolean }>('charges', params);
    if (!page || !page.data?.length) break;
    all.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return all.slice(0, limit);
}

type StripeSubWithMeta = StripeSubscription & { metadata?: Record<string, string> };

async function listActiveSubscriptions(): Promise<StripeSubWithMeta[]> {
  const data = await stripeGet<{ data: StripeSubWithMeta[] }>('subscriptions', {
    status: 'active',
    limit: 100,
  });
  return data?.data || [];
}

export async function getBillingOverview(
  // Clientes y emails de ViralADN (de la tabla profiles). Se usan para atribuir
  // los cobros, porque los cobros de suscripción NO llevan metadata.app en el
  // charge (ese metadata vive en la suscripción, no en el cobro).
  ourCustomerIds: string[] = [],
  ourEmails: string[] = [],
): Promise<BillingOverview> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      totalRevenueAllTime: 0,
      totalRevenueThisMonth: 0,
      totalRevenueLastMonth: 0,
      activeSubscriptions: 0,
      recentPayments: [],
      monthlyRevenue: [],
      trialCustomerIds: [],
      configured: false,
      error: 'STRIPE_SECRET_KEY no configurado',
    };
  }

  try {
    const [charges, subs] = await Promise.all([
      listAllCharges(500),  // Más profundidad para encontrar TODOS los nuestros
      listActiveSubscriptions(),
    ]);

    // Suscripciones nuestras (metadata.app === 'viraladn', seteado en /api/checkout).
    const ourSubs = subs.filter(s => s.metadata?.app === 'viraladn');

    // Atribución de cobros: los charges de suscripción NO traen metadata.app ni
    // invoice (description genérico "Subscription update"), pero SÍ traen customer
    // y email. Matcheamos por customer (de profiles + de nuestras suscripciones) y,
    // como respaldo, por el email del cobro. Los productos de OTROS dueños de la
    // cuenta Stripe quedan afuera: sus clientes/emails no están en nuestros profiles.
    const ourCustomerSet = new Set<string>(
      [...ourCustomerIds, ...ourSubs.map(s => s.customer)].filter(Boolean),
    );
    const ourEmailSet = new Set<string>(ourEmails.map(e => e.toLowerCase()));
    const isOurs = (c: StripeCharge & { metadata?: Record<string, string> }): boolean => {
      if (c.metadata?.app === 'viraladn') return true;
      if (c.customer && ourCustomerSet.has(c.customer)) return true;
      const email = (c.billing_details?.email || c.receipt_email || '').toLowerCase();
      return !!email && ourEmailSet.has(email);
    };

    // Solo charges exitosos NUESTROS.
    const successCharges = charges
      .filter(c => c.paid && c.status === 'succeeded')
      .filter(c => isOurs(c as StripeCharge & { metadata?: Record<string, string> }));

    // Mes de prueba: suscripciones nuestras que tienen un cupón aplicado
    // (descuento activo) o que Stripe marca como `trialing`. Esos son los que
    // están en su primer mes gratis vía promo.
    const trialCustomerIds = ourSubs
      .filter(s => s.status === 'trialing' || !!s.discount?.coupon || (s.discounts?.length ?? 0) > 0)
      .map(s => s.customer)
      .filter(Boolean);

    // Helper: monto neto en USD (cents → USD, descuenta refund)
    const netUsd = (c: StripeCharge) => Math.max(0, (c.amount - (c.amount_refunded || 0)) / 100);

    // Totales
    const totalRevenueAllTime = successCharges.reduce((sum, c) => sum + netUsd(c), 0);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfThisMonth = startOfMonth.getTime();
    const startOfLastM = startOfLastMonth.getTime();

    const totalRevenueThisMonth = successCharges
      .filter(c => c.created * 1000 >= startOfThisMonth)
      .reduce((sum, c) => sum + netUsd(c), 0);

    const totalRevenueLastMonth = successCharges
      .filter(c => {
        const t = c.created * 1000;
        return t >= startOfLastM && t < startOfThisMonth;
      })
      .reduce((sum, c) => sum + netUsd(c), 0);

    // Mensual (últimos 6 meses)
    const monthlyMap = new Map<string, { revenue: number; count: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
      monthlyMap.set(key, { revenue: 0, count: 0 });
    }
    for (const c of successCharges) {
      const d = new Date(c.created * 1000);
      const key = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
      const slot = monthlyMap.get(key);
      if (slot) {
        slot.revenue += netUsd(c);
        slot.count += 1;
      }
    }
    const monthlyRevenue = Array.from(monthlyMap.entries())
      .map(([month, v]) => ({ month, revenue: v.revenue, count: v.count }));

    // Recent payments (más reciente primero, top 50)
    const recentPayments = successCharges
      .sort((a, b) => b.created - a.created)
      .slice(0, 50)
      .map(c => ({
        id: c.id,
        amount: netUsd(c),
        currency: c.currency.toUpperCase(),
        customer: c.customer || '',
        email: c.receipt_email || c.billing_details?.email || '',
        date: new Date(c.created * 1000).toISOString(),
        description: c.description || '',
        refunded: c.refunded || (c.amount_refunded || 0) > 0,
      }));

    return {
      totalRevenueAllTime,
      totalRevenueThisMonth,
      totalRevenueLastMonth,
      activeSubscriptions: ourSubs.length,
      recentPayments,
      monthlyRevenue,
      trialCustomerIds,
      configured: true,
    };
  } catch (e) {
    console.error('[stripe-admin]', e);
    return {
      totalRevenueAllTime: 0,
      totalRevenueThisMonth: 0,
      totalRevenueLastMonth: 0,
      activeSubscriptions: 0,
      recentPayments: [],
      monthlyRevenue: [],
      trialCustomerIds: [],
      configured: true,
      error: (e as Error).message,
    };
  }
}
