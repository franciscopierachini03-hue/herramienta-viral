// Helpers para leer datos de Stripe y agregar métricas de facturación de ViralADN.
// Solo usar en server components / route handlers — usa STRIPE_SECRET_KEY.
//
// ── Cómo se identifica "SOLO ViralADN" ──────────────────────────────────────
// La cuenta de Stripe está compartida con otros productos (2Clicks, etc.). Para
// contar SOLO ViralADN usamos el PRICE ID del producto (STRIPE_PRICE_MONTHLY /
// STRIPE_PRICE_YEARLY): cualquier suscripción a esos precios ES ViralADN,
// garantizado. Es la firma a prueba de balas (no depende de metadata, que lo
// setea nuestro código y podría faltar). Si no hay price IDs configurados,
// caemos a metadata.app === 'viraladn' como respaldo.
//
//   • Suscripciones → filtradas por price (eficiente: Stripe ya no nos manda las
//     de 2Clicks). De ahí salen: activas, MRR comprometido, mes de prueba.
//   • Cobrado (plata de verdad) → facturas pagadas de ESAS suscripciones.

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;          // 'active', 'past_due', 'canceled', 'trialing'
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: { data: Array<{ price: { id: string; unit_amount: number | null; currency: string; recurring: { interval: string } | null } }> };
  // `discount`/`discounts` mientras un cupón sigue activo (mes gratis). `discount`
  // es el campo viejo, `discounts` el nuevo (array).
  discount?: { coupon?: { id?: string; name?: string } } | null;
  discounts?: unknown[] | null;
  metadata?: Record<string, string>;
};

export type StripeInvoice = {
  id: string;
  amount_paid: number;      // cents
  currency: string;
  status: string;           // 'paid', 'open', 'void', ...
  created: number;          // unix
  customer: string | null;
  customer_email: string | null;
  subscription?: string | null;
  parent?: { subscription_details?: { subscription?: string | null } | null } | null;
};

export type BillingOverview = {
  totalRevenueAllTime: number;     // USD cobrados (facturas pagadas)
  totalRevenueThisMonth: number;
  totalRevenueLastMonth: number;
  activeSubscriptions: number;
  // MRR comprometido: tarifa recurrente (normalizada a mensual) de las subs
  // ACTIVAS de ViralADN. El cupón de una vez NO lo baja. ≠ plata ya cobrada.
  committedMrr: number;
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
  monthlyRevenue: Array<{ month: string; revenue: number; count: number }>;
  trialCustomerIds: string[];
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
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
  if (!res.ok) {
    console.error(`[stripe] ${path} → ${res.status}`, await res.text().catch(() => ''));
    return null;
  }
  return res.json() as Promise<T>;
}

function viralPriceIds(): string[] {
  return [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_YEARLY]
    .map(s => (s || '').trim())
    .filter(Boolean);
}

// Trae TODAS las suscripciones de un price (cualquier estado), paginando.
async function listSubsByPrice(priceId: string, maxPages = 20): Promise<StripeSubscription[]> {
  const all: StripeSubscription[] = [];
  let starting_after: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const params: Record<string, string | number> = { price: priceId, status: 'all', limit: 100 };
    if (starting_after) params.starting_after = starting_after;
    const page = await stripeGet<{ data: StripeSubscription[]; has_more: boolean }>('subscriptions', params);
    if (!page?.data?.length) break;
    all.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return all;
}

// Respaldo cuando no hay price IDs configurados: subs activas + metadata.
async function listActiveSubsByMeta(): Promise<StripeSubscription[]> {
  const data = await stripeGet<{ data: StripeSubscription[] }>('subscriptions', { status: 'active', limit: 100 });
  return (data?.data || []).filter(s => s.metadata?.app === 'viraladn');
}

// Facturas (paginadas, con tope). Filtramos por las subs de ViralADN después.
async function listAllInvoices(maxPages = 12): Promise<StripeInvoice[]> {
  const all: StripeInvoice[] = [];
  let starting_after: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const params: Record<string, string | number> = { limit: 100 };
    if (starting_after) params.starting_after = starting_after;
    const page = await stripeGet<{ data: StripeInvoice[]; has_more: boolean }>('invoices', params);
    if (!page?.data?.length) break;
    all.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return all;
}

function subOfInvoice(i: StripeInvoice): string | null {
  return i.subscription || i.parent?.subscription_details?.subscription || null;
}

// MRR (cents) de una sub: tarifa recurrente normalizada a mensual.
function mrrCents(s: StripeSubscription): number {
  const price = s.items?.data?.[0]?.price;
  if (!price || price.unit_amount == null) return 0;
  const amt = price.unit_amount;
  switch (price.recurring?.interval) {
    case 'year': return amt / 12;
    case 'week': return (amt * 52) / 12;
    case 'day': return (amt * 365) / 12;
    default: return amt; // month (o sin recurrencia → mensual)
  }
}

function zero(configured: boolean, error?: string): BillingOverview {
  return {
    totalRevenueAllTime: 0, totalRevenueThisMonth: 0, totalRevenueLastMonth: 0,
    activeSubscriptions: 0, committedMrr: 0, recentPayments: [], monthlyRevenue: [],
    trialCustomerIds: [], configured, error,
  };
}

export async function getBillingOverview(): Promise<BillingOverview> {
  if (!process.env.STRIPE_SECRET_KEY) return zero(false, 'STRIPE_SECRET_KEY no configurado');

  try {
    const prices = viralPriceIds();

    // 1) Suscripciones de ViralADN (por price id; respaldo por metadata).
    let ourSubs: StripeSubscription[] = [];
    if (prices.length) {
      const lists = await Promise.all(prices.map(p => listSubsByPrice(p)));
      const seen = new Set<string>();
      for (const list of lists) for (const s of list) {
        if (!seen.has(s.id)) { seen.add(s.id); ourSubs.push(s); }
      }
    } else {
      ourSubs = await listActiveSubsByMeta();
    }
    const ourSubIds = new Set(ourSubs.map(s => s.id));

    // 2) Cobrado: facturas PAGADAS de esas suscripciones (plata de verdad).
    const invoices = await listAllInvoices();
    const paid = invoices.filter(i => {
      if (i.status !== 'paid' || (i.amount_paid || 0) <= 0) return false;
      const sub = subOfInvoice(i);
      return !!sub && ourSubIds.has(sub);
    });

    const usd = (cents: number) => Math.max(0, cents / 100);
    const totalRevenueAllTime = paid.reduce((s, i) => s + usd(i.amount_paid), 0);

    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const totalRevenueThisMonth = paid
      .filter(i => i.created * 1000 >= startThisMonth)
      .reduce((s, i) => s + usd(i.amount_paid), 0);
    const totalRevenueLastMonth = paid
      .filter(i => { const t = i.created * 1000; return t >= startLastMonth && t < startThisMonth; })
      .reduce((s, i) => s + usd(i.amount_paid), 0);

    // 3) MRR comprometido (subs activas) + conteo de activas.
    const activeSubs = ourSubs.filter(s => s.status === 'active');
    const committedMrr = activeSubs.reduce((s, sub) => s + mrrCents(sub), 0) / 100;

    // 4) Mes de prueba: subs con cupón activo (mes gratis) o trialing.
    const trialCustomerIds = ourSubs
      .filter(s => s.status === 'trialing' || !!s.discount?.coupon || (s.discounts?.length ?? 0) > 0)
      .map(s => s.customer)
      .filter(Boolean);

    // 5) Gráfico mensual (últimos 6 meses) desde las facturas pagadas.
    const monthlyMap = new Map<string, { revenue: number; count: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap.set(d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }), { revenue: 0, count: 0 });
    }
    for (const i of paid) {
      const key = new Date(i.created * 1000).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
      const slot = monthlyMap.get(key);
      if (slot) { slot.revenue += usd(i.amount_paid); slot.count += 1; }
    }
    const monthlyRevenue = Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, revenue: v.revenue, count: v.count }));

    // 6) Historial de pagos (más reciente primero, top 50).
    const recentPayments = paid
      .sort((a, b) => b.created - a.created)
      .slice(0, 50)
      .map(i => ({
        id: i.id,
        amount: usd(i.amount_paid),
        currency: (i.currency || 'usd').toUpperCase(),
        customer: i.customer || '',
        email: i.customer_email || '',
        date: new Date(i.created * 1000).toISOString(),
        description: 'Suscripción ViralADN',
        refunded: false,
      }));

    return {
      totalRevenueAllTime,
      totalRevenueThisMonth,
      totalRevenueLastMonth,
      activeSubscriptions: activeSubs.length,
      committedMrr,
      recentPayments,
      monthlyRevenue,
      trialCustomerIds,
      configured: true,
    };
  } catch (e) {
    console.error('[stripe-admin]', e);
    return zero(true, (e as Error).message);
  }
}
