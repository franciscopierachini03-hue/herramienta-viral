// Helpers para leer datos de Stripe y agregar métricas de facturación de ViralADN.
// Solo usar en server components / route handlers — usa STRIPE_SECRET_KEY.
//
// ── Cómo se identifica "SOLO ViralADN" ──────────────────────────────────────
// La cuenta de Stripe está compartida con otros productos (2Clicks, etc.). Para
// contar SOLO ViralADN usamos el PRICE ID del producto (STRIPE_PRICE_MONTHLY /
// STRIPE_PRICE_YEARLY): cualquier suscripción a esos precios ES ViralADN.
//
// ── Por qué pedimos las facturas POR SUSCRIPCIÓN ────────────────────────────
// La cuenta tiene un volumen enorme de facturas de 2Clicks. Paginar "todas las
// facturas" y filtrar deja afuera las viejas de ViralADN (se pasan del tope).
// En cambio, pedir las facturas de CADA suscripción ViralADN (?subscription=)
// trae el 100% de las nuestras, sin importar el ruido de 2Clicks.

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;          // 'active', 'past_due', 'canceled', 'trialing'
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: { data: Array<{ price: { id: string; unit_amount: number | null; currency: string; recurring: { interval: string } | null } }> };
  discount?: { coupon?: { id?: string; name?: string } } | null;
  discounts?: unknown[] | null;
  metadata?: Record<string, string>;
};

export type StripeInvoice = {
  id: string;
  amount_paid: number;      // cents
  currency: string;
  status: string;           // 'paid', 'open', ...
  created: number;          // unix
  customer: string | null;
  customer_email: string | null;
  subscription?: string | null;
  parent?: { subscription_details?: { subscription?: string | null } | null } | null;
};

// Una fila de "detalle por suscriptor" para que los números cuadren a mano.
export type SubscriberRow = {
  customer: string;
  email: string;
  status: string;           // active / trialing / past_due / canceled
  plan: string;             // 'Mensual' | 'Anual' | '—'
  amountThisCycle: number;  // USD que paga ESTE ciclo: 0 (mes gratis) / 47 / 470
  totalPaid: number;        // USD cobrados históricamente a esta persona
  renewal: string | null;   // ISO de la próxima renovación (current_period_end)
  isFreeMonth: boolean;     // cupón activo → primer mes gratis
};

export type BillingOverview = {
  totalRevenueAllTime: number;     // USD cobrados (facturas pagadas)
  totalRevenueThisMonth: number;
  totalRevenueLastMonth: number;
  activeSubscriptions: number;
  committedMrr: number;            // MRR comprometido (subs activas, normalizado a mensual)
  recentPayments: Array<{
    id: string; amount: number; currency: string; customer: string;
    email: string; date: string; description: string; refunded: boolean;
  }>;
  monthlyRevenue: Array<{ month: string; revenue: number; count: number }>;
  payments: Array<{ date: string; amount: number }>; // TODAS las pagadas (para el gráfico diario)
  trialCustomerIds: string[];
  subscribers: SubscriberRow[];    // detalle por suscriptor (reconciliación)
  configured: boolean;
  error?: string;
};

const STRIPE_API = 'https://api.stripe.com/v1';

async function stripeGet<T = unknown>(path: string, params: Record<string, string | number> = {}): Promise<T | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
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
    .map(s => (s || '').trim()).filter(Boolean);
}

// Corre fn sobre items con concurrencia limitada (no saturar Stripe).
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); } };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, worker));
  return out;
}

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

async function listActiveSubsByMeta(): Promise<StripeSubscription[]> {
  const data = await stripeGet<{ data: StripeSubscription[] }>('subscriptions', { status: 'active', limit: 100 });
  return (data?.data || []).filter(s => s.metadata?.app === 'viraladn');
}

// Facturas PAGADAS de UNA suscripción (completo, sin importar el volumen de 2Clicks).
async function paidInvoicesForSub(subId: string, maxPages = 5): Promise<StripeInvoice[]> {
  const out: StripeInvoice[] = [];
  let starting_after: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const params: Record<string, string | number> = { subscription: subId, status: 'paid', limit: 100 };
    if (starting_after) params.starting_after = starting_after;
    const page = await stripeGet<{ data: StripeInvoice[]; has_more: boolean }>('invoices', params);
    if (!page?.data?.length) break;
    out.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return out;
}

function planOf(s: StripeSubscription): { label: string; unitUsd: number; interval: string } {
  const price = s.items?.data?.[0]?.price;
  const unit = (price?.unit_amount ?? 0) / 100;
  const interval = price?.recurring?.interval || '';
  const label = interval === 'year' ? 'Anual' : interval === 'month' ? 'Mensual' : '—';
  return { label, unitUsd: unit, interval };
}

function mrrCents(s: StripeSubscription): number {
  const price = s.items?.data?.[0]?.price;
  if (!price || price.unit_amount == null) return 0;
  const amt = price.unit_amount;
  switch (price.recurring?.interval) {
    case 'year': return amt / 12;
    case 'week': return (amt * 52) / 12;
    case 'day': return (amt * 365) / 12;
    default: return amt;
  }
}

function isFreeMonth(s: StripeSubscription): boolean {
  return !!s.discount?.coupon || (s.discounts?.length ?? 0) > 0;
}

function zero(configured: boolean, error?: string): BillingOverview {
  return {
    totalRevenueAllTime: 0, totalRevenueThisMonth: 0, totalRevenueLastMonth: 0,
    activeSubscriptions: 0, committedMrr: 0, recentPayments: [], monthlyRevenue: [],
    payments: [], trialCustomerIds: [], subscribers: [], configured, error,
  };
}

export async function getBillingOverview(): Promise<BillingOverview> {
  if (!process.env.STRIPE_SECRET_KEY) return zero(false, 'STRIPE_SECRET_KEY no configurado');

  try {
    const prices = viralPriceIds();

    // 1) Suscripciones ViralADN (por price id; respaldo metadata).
    let ourSubs: StripeSubscription[] = [];
    if (prices.length) {
      const lists = await Promise.all(prices.map(p => listSubsByPrice(p)));
      const seen = new Set<string>();
      for (const list of lists) for (const s of list) if (!seen.has(s.id)) { seen.add(s.id); ourSubs.push(s); }
    } else {
      ourSubs = await listActiveSubsByMeta();
    }

    // 2) Cobrado: facturas pagadas de CADA sub (las que pudieron cobrar — las
    //    puramente 'trialing' no se han facturado, las salteamos).
    const billable = ourSubs.filter(s => s.status !== 'trialing');
    const perSub = await mapLimit(billable, 12, async (s) => ({
      subId: s.id, invs: await paidInvoicesForSub(s.id),
    }));
    const paidBySub = new Map<string, number>();
    const lastAmtBySub = new Map<string, number>(); // monto de la ÚLTIMA factura
    const allPaid: StripeInvoice[] = [];
    for (const { subId, invs } of perSub) {
      let sum = 0;
      for (const inv of invs) { const a = inv.amount_paid || 0; if (a > 0) { allPaid.push(inv); sum += a; } }
      paidBySub.set(subId, sum);
      // "lo que paga este ciclo" = monto de la factura más reciente. Si el cupón
      // "$47 off una vez" la cubrió, esa factura es $0 → así detectamos el mes
      // gratis de verdad (el descuento ya no está en la sub, Stripe lo consume).
      const latest = invs.reduce<StripeInvoice | null>((a, b) => (!a || b.created > a.created ? b : a), null);
      lastAmtBySub.set(subId, latest ? (latest.amount_paid || 0) : 0);
    }

    const usd = (cents: number) => Math.max(0, cents / 100);
    const totalRevenueAllTime = allPaid.reduce((s, i) => s + usd(i.amount_paid), 0);

    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const totalRevenueThisMonth = allPaid.filter(i => i.created * 1000 >= startThisMonth).reduce((s, i) => s + usd(i.amount_paid), 0);
    const totalRevenueLastMonth = allPaid.filter(i => { const t = i.created * 1000; return t >= startLastMonth && t < startThisMonth; }).reduce((s, i) => s + usd(i.amount_paid), 0);

    // 3) MRR + activas.
    const activeSubs = ourSubs.filter(s => s.status === 'active');
    const committedMrr = activeSubs.reduce((s, sub) => s + mrrCents(sub), 0) / 100;

    // 4) Mes de prueba (cupón activo o trialing).
    const trialCustomerIds = ourSubs
      .filter(s => s.status === 'trialing' || isFreeMonth(s))
      .map(s => s.customer).filter(Boolean);

    // 5) Email por customer (desde las facturas que sí trajimos).
    const emailByCustomer = new Map<string, string>();
    for (const i of allPaid) if (i.customer && i.customer_email) emailByCustomer.set(i.customer, i.customer_email);

    // 6) Detalle por suscriptor (para reconciliar a mano).
    const order: Record<string, number> = { active: 0, past_due: 1, trialing: 2, unpaid: 3, canceled: 4 };
    const subscribers: SubscriberRow[] = ourSubs.map(s => {
      const plan = planOf(s);
      const free = isFreeMonth(s);
      // Lo que pagó este ciclo = monto de su última factura (0 si fue mes gratis).
      const amountThisCycle = s.status === 'trialing' ? 0 : usd(lastAmtBySub.get(s.id) || 0);
      return {
        customer: s.customer,
        email: emailByCustomer.get(s.customer) || '',
        status: s.status,
        plan: plan.label,
        amountThisCycle,
        totalPaid: usd(paidBySub.get(s.id) || 0),
        renewal: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null,
        isFreeMonth: free,
      };
    }).sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.totalPaid - a.totalPaid);

    // 7) Gráfico mensual + historial.
    const monthlyMap = new Map<string, { revenue: number; count: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap.set(d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }), { revenue: 0, count: 0 });
    }
    for (const i of allPaid) {
      const key = new Date(i.created * 1000).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
      const slot = monthlyMap.get(key);
      if (slot) { slot.revenue += usd(i.amount_paid); slot.count += 1; }
    }
    const monthlyRevenue = Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, revenue: v.revenue, count: v.count }));

    const recentPayments = allPaid.sort((a, b) => b.created - a.created).slice(0, 50).map(i => ({
      id: i.id, amount: usd(i.amount_paid), currency: (i.currency || 'usd').toUpperCase(),
      customer: i.customer || '', email: i.customer_email || '',
      date: new Date(i.created * 1000).toISOString(), description: 'Suscripción ViralADN', refunded: false,
    }));

    return {
      totalRevenueAllTime, totalRevenueThisMonth, totalRevenueLastMonth,
      activeSubscriptions: activeSubs.length, committedMrr,
      recentPayments, monthlyRevenue,
      payments: allPaid.map(i => ({ date: new Date(i.created * 1000).toISOString(), amount: usd(i.amount_paid) })),
      trialCustomerIds, subscribers, configured: true,
    };
  } catch (e) {
    console.error('[stripe-admin]', e);
    return zero(true, (e as Error).message);
  }
}
