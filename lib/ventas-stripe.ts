// Cobros de un RANGO de fechas en LAS DOS cuentas de Stripe, clasificados.
// Única fuente para /api/admin/pagos-dia (día) y /api/admin/export?mes= (mes):
//   · 2CLICKS (STRIPE_SECRET_KEY, compartida): cada cobro se etiqueta NUESTRO
//     (producto de su factura, o metadata.app=viraladn en pagos únicos) u otro.
//   · Elevation (STRIPE_SECRET_KEY_ELEVATION, dedicada): todo es nuestro.
// Montos en USD LIQUIDADO (balance_transaction): los MXN entran convertidos.
// Solo server (usa las keys de Vercel).

import { PRODUCT_IDS } from '@/lib/products';

const ANCHORS: Array<[string, 'viraladn' | 'topcut' | 'combo']> = [
  ['price_1TrgNwBrwYizao1Ogz3hesBl', 'viraladn'],
  ['price_1TrgQWBrwYizao1Oz8hQaRUf', 'topcut'],
  ['price_1TrgRyBrwYizao1O8H1ANmMd', 'combo'],
];

const r2 = (n: number) => Math.round(n * 100) / 100;

async function sGet(path: string, key: string) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
  return r.ok ? r.json() : null;
}

export type CobroRango = {
  ts: number;               // unix del cobro
  fecha: string;            // YYYY-MM-DD en CDMX
  hora: string;             // HH:MM en CDMX
  email: string;
  monto: number;            // USD liquidado (bruto)
  refund: number;           // USD devuelto (prorrateado a la tasa liquidada)
  producto: string;         // ViralADN / TOPCUT / Combo / "(pago único)" / (Elevation) / otro negocio
  plataforma: 'viraladn' | 'topcut' | 'combo' | null; // para filtrar por producto
  estado: string;           // status de Stripe ('succeeded', …)
  viralAdn: boolean;        // ¿es nuestro?
  cuenta: '2CLICKS' | 'Elevation';
  // Datos de la persona y del cobro (para el reporte completo)
  nombre: string;           // billing_details.name
  pais: string;             // billing_details.address.country
  ciudad: string;
  metodoPago: string;       // 'card visa ••4242' | 'link' | …
  montoOriginal: number;    // lo que pagó en SU moneda (ej. COP)
  monedaOriginal: string;   // 'COP', 'USD', 'MXN'…
  comision: number;         // fee de Stripe en USD
  netoBanco: number;        // USD que entran a tu cuenta (monto − comisión − refund)
  suscripcion: string;      // sub_… si vino de una suscripción
  recibo: string;           // link al recibo de Stripe
  chargeId: string;
};

type ChargeRaw = {
  created?: number; status?: string; amount?: number; amount_refunded?: number; currency?: string;
  receipt_email?: string | null; receipt_url?: string | null;
  billing_details?: { email?: string | null; name?: string | null; address?: { country?: string | null; city?: string | null } | null } | null;
  payment_method_details?: { type?: string; card?: { brand?: string; last4?: string } | null } | null;
  invoice?: { subscription?: string | null; lines?: { data?: Array<{ price?: { product?: string } }> } } | string | null;
  payment_intent?: { metadata?: Record<string, string> } | string | null;
  balance_transaction?: { amount?: number; currency?: string; fee?: number; exchange_rate?: number | null } | string | null;
  metadata?: Record<string, string> | null;
  id?: string;
};

async function cobrosDeCuenta(key: string, desde: number, hasta: number): Promise<ChargeRaw[]> {
  const out: ChargeRaw[] = [];
  let after: string | null = null;
  for (let i = 0; i < 40; i++) { // hasta 4.000 cobros por rango (un mes entero entra)
    const q = `charges?limit=100&created[gte]=${desde}&created[lt]=${hasta}`
      + `&expand[]=data.invoice&expand[]=data.payment_intent&expand[]=data.balance_transaction&expand[]=data.payment_method_details`
      + (after ? `&starting_after=${after}` : '');
    const d = await sGet(q, key);
    const data: ChargeRaw[] = d?.data || [];
    out.push(...data);
    if (!d?.has_more || !data.length) break;
    after = data[data.length - 1]?.id || null;
  }
  return out;
}

// USD liquidado del cobro: balance_transaction si vino; crudo solo si ya es USD.
function usdDe(c: ChargeRaw): { monto: number; refund: number; comision: number } {
  const bt = c.balance_transaction;
  const esObj = typeof bt === 'object' && bt;
  const amount = (esObj && bt.currency === 'usd') ? (bt.amount ?? 0)
    : (c.currency === 'usd' ? (c.amount ?? 0) : 0);
  const fee = esObj ? (bt.fee ?? 0) : 0;
  const bruto = c.amount ?? 0;
  const refTasa = bruto > 0 ? (c.amount_refunded ?? 0) / bruto : 0;
  return { monto: r2(amount / 100), refund: r2((amount / 100) * refTasa), comision: r2(fee / 100) };
}

// Datos de la persona/cobro que van al reporte.
function datosDe(c: ChargeRaw) {
  const bd = c.billing_details || {};
  const pm = c.payment_method_details || {};
  const metodo = pm.type === 'card' && pm.card
    ? `tarjeta ${pm.card.brand || ''} ••${pm.card.last4 || ''}`.trim()
    : (pm.type || '—');
  return {
    nombre: String(bd.name || ''),
    pais: String(bd.address?.country || ''),
    ciudad: String(bd.address?.city || ''),
    metodoPago: metodo,
    montoOriginal: r2((c.amount ?? 0) / 100),
    monedaOriginal: String(c.currency || '').toUpperCase(),
    recibo: String(c.receipt_url || ''),
    chargeId: String(c.id || ''),
  };
}

const horaCDMX = (ts?: number) => new Date(((ts ?? 0) - 6 * 3600) * 1000).toISOString().slice(11, 16);
const fechaCDMX = (ts?: number) => new Date(((ts ?? 0) - 6 * 3600) * 1000).toISOString().slice(0, 10);
const emailDe = (c: ChargeRaw) => String(c.billing_details?.email || c.receipt_email || '—');

// Todos los cobros del rango [desde, hasta) en ambas cuentas, clasificados.
export async function cobrosRango(desde: number, hasta: number): Promise<{ cobros: CobroRango[]; elevationConfigurada: boolean }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Falta STRIPE_SECRET_KEY (2CLICKS).');
  const keyElev = process.env.STRIPE_SECRET_KEY_ELEVATION;

  // Productos NUESTROS en 2CLICKS: viejos + nuevos del evento (anchors).
  const platformOf = new Map<string, 'viraladn' | 'topcut' | 'combo'>();
  platformOf.set(PRODUCT_IDS.viraladn, 'viraladn');
  platformOf.set(PRODUCT_IDS.topcut, 'topcut');
  platformOf.set(PRODUCT_IDS.combo, 'combo');
  for (const [a, plat] of ANCHORS) {
    const p = await sGet(`prices/${encodeURIComponent(a)}`, key);
    if (p?.product) platformOf.set(p.product as string, plat);
  }
  const nombre = (plat?: string) => plat === 'viraladn' ? 'ViralADN' : plat === 'topcut' ? 'TOPCUT' : plat === 'combo' ? 'Combo' : 'otro negocio';

  const cobros: CobroRango[] = [];

  for (const c of await cobrosDeCuenta(key, desde, hasta)) {
    let plat: 'viraladn' | 'topcut' | 'combo' | undefined;
    const inv = typeof c.invoice === 'object' ? c.invoice : null;
    for (const l of inv?.lines?.data || []) {
      const pid = l.price?.product;
      if (pid) { const pf = platformOf.get(pid); if (pf) { plat = pf; break; } }
    }
    const pi = typeof c.payment_intent === 'object' ? c.payment_intent : null;
    const metaApp = pi?.metadata?.app || c.metadata?.app;
    const metaProd = (pi?.metadata?.product || c.metadata?.product || '').toLowerCase();
    let esNuestro = !!plat;
    let etiqueta = nombre(plat);
    if (!plat && metaApp === 'viraladn') {
      esNuestro = true;
      etiqueta = metaProd === 'topcut' ? 'TOPCUT (pago único)' : metaProd === 'combo' ? 'Combo (pago único)' : 'ViralADN (pago único)';
    }
    const { monto, refund, comision } = usdDe(c);
    const extra = datosDe(c);
    cobros.push({
      ts: c.created ?? 0, fecha: fechaCDMX(c.created), hora: horaCDMX(c.created), email: emailDe(c),
      monto, refund, comision, netoBanco: r2(monto - refund - comision),
      estado: String(c.status || ''), producto: etiqueta,
      plataforma: plat || (metaApp === 'viraladn' ? ((metaProd === 'topcut' || metaProd === 'combo') ? metaProd as 'topcut' | 'combo' : 'viraladn') : null),
      viralAdn: esNuestro, cuenta: '2CLICKS',
      suscripcion: String(inv?.subscription || ''),
      ...extra,
    });
  }

  if (keyElev) {
    for (const c of await cobrosDeCuenta(keyElev, desde, hasta)) {
      const { monto, refund, comision } = usdDe(c);
      const extra = datosDe(c);
      const invE = typeof c.invoice === 'object' ? c.invoice : null;
      cobros.push({
        ts: c.created ?? 0, fecha: fechaCDMX(c.created), hora: horaCDMX(c.created), email: emailDe(c),
        monto, refund, comision, netoBanco: r2(monto - refund - comision),
        estado: String(c.status || ''), producto: 'ViralADN (Elevation)', plataforma: 'viraladn',
        viralAdn: true, cuenta: 'Elevation', suscripcion: String(invE?.subscription || ''),
        ...extra,
      });
    }
  }

  return { cobros, elevationConfigurada: !!keyElev };
}
