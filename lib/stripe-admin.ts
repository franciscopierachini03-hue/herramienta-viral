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

import { PRODUCT_IDS } from '@/lib/products';

// IDs de NUESTROS productos (ViralADN / TOPCUT / Combo). La cuenta de Stripe es
// compartida con 2Clicks (LEGACY USA, etc.) → al buscar pagos por email
// validamos el PRODUCTO de la sesión (definitivo), NO el monto: un producto
// ajeno que cueste lo mismo que uno nuestro ($47/$67/etc.) ya no se cuela.
// Precios ancla VERIFICADOS → para descubrir los productos NUEVOS del evento
// (uno por plataforma). Sin esto, las ventas nuevas caían fuera del panel.
const ANCHORS: Array<[string, 'viraladn' | 'topcut' | 'combo']> = [
  ['price_1TrgNwBrwYizao1Ogz3hesBl', 'viraladn'],
  ['price_1TrgQWBrwYizao1Oz8hQaRUf', 'topcut'],
  ['price_1TrgRyBrwYizao1O8H1ANmMd', 'combo'],
];

// Mapa PRODUCTO → plataforma: los VIEJOS (PRODUCT_IDS) + los NUEVOS del evento.
// Es la fuente de "qué es ViralADN". Cacheado (los IDs no cambian).
let _prodMap: Map<string, 'viraladn' | 'topcut' | 'combo'> | null = null;
async function ourProductMap(): Promise<Map<string, 'viraladn' | 'topcut' | 'combo'>> {
  if (_prodMap) return _prodMap;
  const m = new Map<string, 'viraladn' | 'topcut' | 'combo'>([
    [PRODUCT_IDS.viraladn, 'viraladn'],
    [PRODUCT_IDS.topcut, 'topcut'],
    [PRODUCT_IDS.combo, 'combo'],
  ]);
  await Promise.all(ANCHORS.map(async ([anchor, plat]) => {
    const pr = await stripeGet<{ product?: string }>(`prices/${encodeURIComponent(anchor)}`);
    if (pr?.product) m.set(pr.product, plat);
  }));
  _prodMap = m;
  return m;
}

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;          // 'active', 'past_due', 'canceled', 'trialing'
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: { data: Array<{ price: { id: string; unit_amount: number | null; currency: string; product?: string; recurring: { interval: string } | null } }> };
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
  // Charge expandido (expand[]=data.charge) → acá vive el REEMBOLSO. La factura
  // sigue "paid" aunque se devuelva la plata; sin mirar el charge se contaba
  // como cobro un pago devuelto.
  charge?: string | { id?: string; refunded?: boolean; amount_refunded?: number } | null;
  parent?: { subscription_details?: { subscription?: string | null } | null } | null;
};

// Una fila de "detalle por suscriptor" para que los números cuadren a mano.
export type SubscriberRow = {
  customer: string;
  email: string;
  status: string;           // active / trialing / past_due / canceled
  plan: string;             // 'Mensual' | 'Anual' | '—'
  product: string;          // 'ViralADN' | 'TOPCUT' | 'Combo' | '—'
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
  committedMrr: number;            // MRR comprometido (subs activas a precio de lista, mensual)
  effectiveMrrNow: number;         // lo que se cobra DE VERDAD este mes (bonos/descuentos ya restados)
  bonoMrr: number;                 // lo que está en bono/descuento AHORA → no entra este mes, sí el que viene
  expectedMrrNextMonth: number;    // esperado el MES QUE VIENE = comprometido − por cancelar (bonos ya pagan)
  cancelMrr: number;               // MRR de las subs marcadas "cancelar a fin de período"
  porCancelar: number;             // cuántas subs activas van a cancelar a fin de período
  recentPayments: Array<{
    id: string; amount: number; currency: string; customer: string;
    email: string; date: string; description: string; refunded: boolean; product: string;
  }>;
  monthlyRevenue: Array<{ month: string; revenue: number; count: number }>;
  payments: Array<{ id: string; customer: string; email: string; date: string; amount: number; product: string }>; // TODAS las pagadas (gráfico diario + reporte de ventas)
  trialCustomerIds: string[];
  subscribers: SubscriberRow[];    // detalle por suscriptor (reconciliación)
  configured: boolean;
  error?: string;
};

const STRIPE_API = 'https://api.stripe.com/v1';
// Versión de API pineada para las facturas: garantiza que invoice.charge exista
// y sea expandible (en versiones nuevas de Stripe ese campo cambió de lugar).
const INVOICE_API_VERSION = '2024-06-20';

async function stripeGet<T = unknown>(path: string, params: Record<string, string | number> = {}, version?: string): Promise<T | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
  const url = `${STRIPE_API}/${path}${qs.toString() ? '?' + qs : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, ...(version ? { 'Stripe-Version': version } : {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(`[stripe] ${path} → ${res.status}`, await res.text().catch(() => ''));
    return null;
  }
  return res.json() as Promise<T>;
}

// Todos los price ids de NUESTROS productos (ViralADN, TOPCUT, Combo — viejos Y
// nuevos del evento), sin importar el monto → para contar TODAS nuestras
// suscripciones. Los productos ajenos de la cuenta (2Clicks, etc.) quedan afuera.
async function ourPriceIds(): Promise<string[]> {
  const map = await ourProductMap();
  const ids = new Set<string>();
  // Respaldo: price ids legacy por env (por si el producto fue archivado).
  // VALIDADO: solo se suman si el precio pertenece a un producto NUESTRO.
  for (const e of [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_YEARLY]) {
    const v = (e || '').trim(); if (!v) continue;
    const pr = await stripeGet<{ product?: string }>(`prices/${encodeURIComponent(v)}`);
    if (pr?.product && map.has(pr.product)) ids.add(v);
  }
  // Todos los precios de cada uno de nuestros productos (viejos + nuevos).
  for (const product of map.keys()) {
    const page = await stripeGet<{ data: Array<{ id: string }> }>('prices', { product, limit: 100 });
    for (const p of page?.data || []) if (p.id) ids.add(p.id);
  }
  return [...ids];
}

// Nombre del producto a partir del id de producto del precio de la suscripción.
function productLabel(productId: string | undefined, map: Map<string, 'viraladn' | 'topcut' | 'combo'>): string {
  const p = productId ? map.get(productId) : undefined;
  return p === 'viraladn' ? 'ViralADN' : p === 'topcut' ? 'TOPCUT' : p === 'combo' ? 'Combo' : '—';
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
    const params: Record<string, string | number> = { subscription: subId, status: 'paid', limit: 100, 'expand[]': 'data.charge' };
    if (starting_after) params.starting_after = starting_after;
    const page = await stripeGet<{ data: StripeInvoice[]; has_more: boolean }>('invoices', params, INVOICE_API_VERSION);
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
    activeSubscriptions: 0, committedMrr: 0,
    effectiveMrrNow: 0, bonoMrr: 0, expectedMrrNextMonth: 0, cancelMrr: 0, porCancelar: 0,
    recentPayments: [], monthlyRevenue: [],
    payments: [], trialCustomerIds: [], subscribers: [], configured, error,
  };
}

export async function getBillingOverview(): Promise<BillingOverview> {
  if (!process.env.STRIPE_SECRET_KEY) return zero(false, 'STRIPE_SECRET_KEY no configurado');

  try {
    const prodMap = await ourProductMap();
    const prices = await ourPriceIds();

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
    // Producto de cada sub → cada pago queda etiquetado (ViralADN/TOPCUT/Combo),
    // para poder responder "¿este dinero de qué producto es?" sin abrir Stripe.
    const productBySub = new Map<string, string>();
    for (const s of ourSubs) productBySub.set(s.id, productLabel(s.items?.data?.[0]?.price?.product, prodMap));
    // Reembolso de una factura: vive en su CHARGE (amount_refunded); la factura
    // queda "paid" igual. netPaid = pagado − devuelto; fullRefund = devuelto todo.
    const refundedCents = (inv: StripeInvoice): number => {
      const ch = inv.charge;
      return ch && typeof ch === 'object' ? (ch.amount_refunded || 0) : 0;
    };
    const allPaid: Array<StripeInvoice & { productLabel?: string; netPaid?: number; fullRefund?: boolean }> = [];
    for (const { subId, invs } of perSub) {
      let sum = 0;
      const prodDeSub = productBySub.get(subId) || '—';
      for (const inv of invs) {
        const a = inv.amount_paid || 0;
        if (a <= 0) continue;
        const net = Math.max(0, a - refundedCents(inv));
        allPaid.push(Object.assign(inv, { productLabel: prodDeSub, netPaid: net, fullRefund: net === 0 }));
        sum += net; // total pagado NETO de reembolsos
      }
      paidBySub.set(subId, sum);
      // "lo que paga este ciclo" = monto de la factura más reciente. Si el cupón
      // "$47 off una vez" la cubrió, esa factura es $0 → así detectamos el mes
      // gratis de verdad (el descuento ya no está en la sub, Stripe lo consume).
      const latest = invs.reduce<StripeInvoice | null>((a, b) => (!a || b.created > a.created ? b : a), null);
      lastAmtBySub.set(subId, latest ? (latest.amount_paid || 0) : 0);
    }

    const usd = (cents: number) => Math.max(0, cents / 100);
    const totalRevenueAllTime = allPaid.reduce((s, i) => s + usd(i.netPaid ?? i.amount_paid), 0);

    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const totalRevenueThisMonth = allPaid.filter(i => i.created * 1000 >= startThisMonth).reduce((s, i) => s + usd(i.netPaid ?? i.amount_paid), 0);
    const totalRevenueLastMonth = allPaid.filter(i => { const t = i.created * 1000; return t >= startLastMonth && t < startThisMonth; }).reduce((s, i) => s + usd(i.netPaid ?? i.amount_paid), 0);

    // 3) MRR + activas.
    const activeSubs = ourSubs.filter(s => s.status === 'active');
    const committedMrr = activeSubs.reduce((s, sub) => s + mrrCents(sub), 0) / 100;

    // 3b) Proyección "este mes vs el que viene". El MRR comprometido está a precio
    // de LISTA (no resta bonos ni descuentos) → sobreestima lo que entra ESTE mes.
    //   · effectiveMrrNow = lo que se cobra de verdad este ciclo (la última factura
    //     de cada sub; un mes gratis = $0), normalizado a mensual.
    //   · bonoMrr = comprometido − efectivo = lo que hoy está en bono/descuento →
    //     NO entra este mes, pero SÍ el que viene (cuando el bono se acaba).
    //   · expectedMrrNextMonth = comprometido − lo que está por cancelar (los bonos
    //     ya cuentan como full el mes que viene).
    const perMes = (sub: StripeSubscription, cents: number): number => {
      const iv = sub.items?.data?.[0]?.price?.recurring?.interval;
      return iv === 'year' ? cents / 12 : iv === 'week' ? (cents * 52) / 12 : iv === 'day' ? (cents * 365) / 12 : cents;
    };
    const effectiveMrrNow = activeSubs.reduce((s, sub) => s + perMes(sub, lastAmtBySub.get(sub.id) || 0), 0) / 100;
    const porCancelarSubs = activeSubs.filter(s => s.cancel_at_period_end);
    const cancelMrr = porCancelarSubs.reduce((s, sub) => s + mrrCents(sub), 0) / 100;
    const bonoMrr = Math.max(0, committedMrr - effectiveMrrNow);
    const expectedMrrNextMonth = Math.max(0, committedMrr - cancelMrr);

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
        product: productLabel(s.items?.data?.[0]?.price?.product, prodMap),
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
      if (slot) { const n = usd(i.netPaid ?? i.amount_paid); slot.revenue += n; if (n > 0) slot.count += 1; }
    }
    const monthlyRevenue = Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, revenue: v.revenue, count: v.count }));

    const recentPayments = allPaid.sort((a, b) => b.created - a.created).slice(0, 50).map(i => ({
      // Reembolso total → mostramos el monto original + badge "Reembolsado";
      // parcial → mostramos lo que QUEDÓ cobrado.
      id: i.id, amount: usd(i.fullRefund ? i.amount_paid : (i.netPaid ?? i.amount_paid)), currency: (i.currency || 'usd').toUpperCase(),
      customer: i.customer || '', email: i.customer_email || '',
      date: new Date(i.created * 1000).toISOString(), description: `Suscripción ${i.productLabel || 'ViralADN'}`, refunded: !!i.fullRefund,
      product: i.productLabel || '—',
    }));

    return {
      totalRevenueAllTime, totalRevenueThisMonth, totalRevenueLastMonth,
      activeSubscriptions: activeSubs.length, committedMrr,
      effectiveMrrNow, bonoMrr, expectedMrrNextMonth, cancelMrr, porCancelar: porCancelarSubs.length,
      recentPayments, monthlyRevenue,
      // Solo dinero que QUEDÓ cobrado (neto de reembolsos) → alimenta Cobrado
      // HOY, el gráfico diario y el export de ventas.
      payments: allPaid.filter(i => (i.netPaid ?? i.amount_paid) > 0).map(i => ({ id: i.id, customer: i.customer || '', email: i.customer_email || '', date: new Date(i.created * 1000).toISOString(), amount: usd(i.netPaid ?? i.amount_paid), product: i.productLabel || '—' })),
      trialCustomerIds, subscribers, configured: true,
    };
  } catch (e) {
    console.error('[stripe-admin]', e);
    return zero(true, (e as Error).message);
  }
}

// Busca el pago de cada email en Stripe vía CHECKOUT SESSIONS — para los que
// pagaron por un LINK DE PAGO (pago único) y no tienen suscripción vinculada al
// perfil (customer_id / subscription_id en null). Cada sesión guarda el email
// (customer_details.email) y el monto (amount_total), así que matcheamos por
// email aunque el pago no haya creado cliente. Devuelve email→{monto, fecha}.
//   emails: a buscar · sinceUnix: ventana (los huérfanos son recientes → angosta).
type SessLite = {
  id: string; amount_total?: number | null; created?: number;
  payment_status?: string; status?: string;
  customer_email?: string | null; customer_details?: { email?: string | null } | null;
};

// ¿La sesión de checkout es de un producto NUESTRO? Mira los line_items (el
// price.product) y lo compara con OUR_PRODUCTS. Definitivo: descarta 2Clicks
// aunque el monto coincida. Solo se llama para sesiones cuyo email es huérfano.
async function checkoutIsOurs(sessionId: string): Promise<boolean> {
  const map = await ourProductMap();
  const li = await stripeGet<{ data: Array<{ price?: { product?: string } | null }> }>(
    `checkout/sessions/${encodeURIComponent(sessionId)}/line_items`, { limit: 10 },
  );
  return (li?.data || []).some(it => !!it.price?.product && map.has(it.price.product));
}

export async function findPaidByEmail(emails: string[], sinceUnix?: number): Promise<Map<string, { amount: number; date: string }>> {
  const out = new Map<string, { amount: number; date: string }>();
  if (!process.env.STRIPE_SECRET_KEY) return out;
  const want = new Set(emails.map(e => (e || '').toLowerCase().trim()).filter(Boolean));
  if (!want.size) return out;
  const since = sinceUnix || Math.floor(Date.now() / 1000) - 40 * 24 * 3600;

  let starting_after: string | undefined;
  for (let i = 0; i < 8 && out.size < want.size; i++) {
    const params: Record<string, string | number> = { limit: 100, 'created[gte]': since };
    if (starting_after) params.starting_after = starting_after;
    const page = await stripeGet<{ data: SessLite[]; has_more: boolean }>('checkout/sessions', params);
    if (!page?.data?.length) break;
    for (const s of page.data) {
      const em = (s.customer_details?.email || s.customer_email || '').toLowerCase();
      if (!em || !want.has(em) || out.has(em)) continue;
      const paid = s.payment_status === 'paid' || s.status === 'complete';
      if (!paid) continue;
      // Definitivo: el PRODUCTO de la sesión tiene que ser uno NUESTRO. Así un
      // pago de 2Clicks NO se cuela aunque cueste igual que uno nuestro.
      if (await checkoutIsOurs(s.id)) {
        out.set(em, { amount: (s.amount_total || 0) / 100, date: new Date((s.created || 0) * 1000).toISOString() });
      }
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return out;
}
