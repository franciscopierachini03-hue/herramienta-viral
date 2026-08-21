// Cobros de un RANGO de fechas en LAS DOS cuentas de Stripe, clasificados.
// Única fuente para /api/admin/pagos-dia (día) y /api/admin/export?mes= (mes):
//   · 2CLICKS (STRIPE_SECRET_KEY, compartida): cada cobro se etiqueta NUESTRO
//     (producto de su factura, o metadata.app=viraladn en pagos únicos) u otro.
//   · Elevation (STRIPE_SECRET_KEY_ELEVATION): NO es plata nuestra.
//
// ── Elevation: da acceso, no da plata (21-ago-2026) ────────────────────────
// Las comunidades (/adama, /unete) venden ViralADN cobrando por SU cuenta de
// Stripe. Esa cuenta es de ellos: el dinero entra a su banco, no al nuestro.
// Antes se contaba el 100% como ingreso propio y eso inflaba los meses
// (Francisco: "hay meses que aparece de 4 mil USD y no se generó eso" ·
//  "elevation no lo usemos, no es mía").
// Ahora sus cobros se leen igual — para saber quién compró y darle acceso
// (lib/entitlement) y para poder mirar el volumen — pero entran como AJENOS:
// no suman a ninguna cifra de ingreso.
//
// Montos en USD LIQUIDADO (balance_transaction): los MXN entran convertidos.
// Solo server (usa las keys de Vercel).

import { PRODUCT_IDS } from '@/lib/products';

const ANCHORS: Array<[string, 'viraladn' | 'topcut' | 'combo']> = [
  ['price_1TrgNwBrwYizao1Ogz3hesBl', 'viraladn'],
  ['price_1TrgQWBrwYizao1Oz8hQaRUf', 'topcut'],
  ['price_1TrgRyBrwYizao1O8H1ANmMd', 'combo'],
];

const r2 = (n: number) => Math.round(n * 100) / 100;

const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Semáforo: cuántas consultas a Stripe pueden ir a la vez ────────────────
// Sin tope, sincronizar varios meses en paralelo disparaba ~60 consultas
// simultáneas y Stripe empezaba a devolver 429. Con 10 no llegamos al límite.
let enVuelo = 0;
const cola: Array<() => void> = [];
async function turno<T>(fn: () => Promise<T>): Promise<T> {
  if (enVuelo >= 10) await new Promise<void>(r => cola.push(r));
  enVuelo++;
  try { return await fn(); }
  finally { enVuelo--; cola.shift()?.(); }
}

// ⚠️ REGLA DE LA CASA: un error de Stripe NUNCA puede parecer "no hay cobros".
//
// Esta función devolvía `null` cuando Stripe fallaba, y quien la llamaba leía
// ese null como una lista vacía. Resultado: un 429 (demasiadas consultas) o un
// 5xx pasajero hacían que un mes entero valiera CERO, sin una sola señal. Era
// la causa de que el panel mostrara plata de menos y de que los números
// cambiaran entre una carga y otra.
//
// Ahora: reintenta con espera creciente (respetando el Retry-After de Stripe)
// y, si aun así no puede, LANZA el error. Preferimos romper fuerte y visible
// antes que devolver un número mentiroso.
async function sGet(path: string, key: string, opcional = false): Promise<Record<string, unknown> | null> {
  const intentos = 4;
  let ultimo = 'sin respuesta';
  for (let i = 0; i < intentos; i++) {
    let r: Response;
    try {
      r = await turno(() => fetch(`https://api.stripe.com/v1/${path}`, {
        headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
      }));
    } catch (e) {
      ultimo = (e as Error).message.slice(0, 80);
      await dormir(400 * 2 ** i);
      continue;
    }
    if (r.ok) return r.json();
    // 429 = pasate de consultas · 5xx = Stripe con problemas → reintentar.
    if (r.status === 429 || r.status >= 500) {
      const espera = Number(r.headers.get('retry-after') || 0);
      ultimo = `HTTP ${r.status}`;
      await dormir(espera > 0 ? espera * 1000 : 500 * 2 ** i);
      continue;
    }
    // Otro 4xx (no existe, sin permiso): reintentar no cambia nada.
    if (opcional) return null;
    throw new Error(`Stripe respondió ${r.status} en ${path.split('?')[0]}`);
  }
  if (opcional) return null;
  throw new Error(`Stripe no respondió tras ${intentos} intentos (${ultimo})`);
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
  // POR QUÉ se contó como nuestro. Sirve para auditar un mes que "da mucho":
  //   producto  → la factura es de un producto NUESTRO. Es prueba dura.
  //   metadata  → pago suelto etiquetado app=viraladn (ligas de pago). Flojo:
  //               si algo ajeno quedó etiquetado así, se cuela.
  //   elevation → viene de la cuenta Elevation, donde TODO cuenta como nuestro.
  //   ajeno     → otro negocio de la cuenta compartida (no suma).
  motivo: 'producto' | 'metadata' | 'elevation' | 'ajeno';
  // Producto de Stripe de la factura (prod_…). Sirve para auditar: si un cobro
  // NUESTRO está cayendo como ajeno, acá se ve con qué producto entró.
  productoId: string;
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

async function paginaCobros(key: string, desde: number, hasta: number): Promise<ChargeRaw[]> {
  const out: ChargeRaw[] = [];
  let after: string | null = null;
  for (let i = 0; i < 20; i++) {
    const q = `charges?limit=100&created[gte]=${desde}&created[lt]=${hasta}`
      + `&expand[]=data.invoice&expand[]=data.payment_intent&expand[]=data.balance_transaction`
      + (after ? `&starting_after=${after}` : '');
    // Si Stripe falla, sGet lanza: NO seguimos como si no hubiera cobros.
    const d = await sGet(q, key) as { data?: ChargeRaw[]; has_more?: boolean } | null;
    const data: ChargeRaw[] = d?.data || [];
    out.push(...data);
    if (!d?.has_more || !data.length) break;
    after = data[data.length - 1]?.id || null;
  }
  return out;
}

// Escanea el rango en VENTANAS paralelas (la paginación de Stripe es secuencial
// por cursor, pero varias ventanas de fechas corren a la vez) → un mes entero
// entra holgado en el límite de 60s de Vercel, incluso en la cuenta compartida
// con miles de cobros de otros negocios.
async function cobrosDeCuenta(key: string, desde: number, hasta: number): Promise<ChargeRaw[]> {
  const total = Math.max(1, hasta - desde);
  const dias = total / 86400;
  // Ventanas en paralelo. Los tramos largos (el histórico completo del negocio)
  // se abren más para que el escaneo entre en los 60s de Vercel.
  const n = dias > 400 ? 26 : dias > 200 ? 20 : dias > 45 ? 14 : dias > 20 ? 8 : dias > 8 ? 4 : dias > 2 ? 2 : 1;
  const paso = Math.ceil(total / n);
  const ventanas: Array<[number, number]> = [];
  for (let t = desde; t < hasta; t += paso) ventanas.push([t, Math.min(t + paso, hasta)]);
  const partes = await Promise.all(ventanas.map(([a, b]) => paginaCobros(key, a, b)));
  return partes.flat();
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

// Caché corto por rango: el panel pide balance y el export pide el detalle del
// mismo mes → la segunda llamada es instantánea (y no re-consulta Stripe).
const cache = new Map<string, { ts: number; data: { cobros: CobroRango[]; elevationConfigurada: boolean } }>();
const CACHE_MS = 5 * 60 * 1000;

// Todos los cobros del rango [desde, hasta) en ambas cuentas, clasificados.
export async function cobrosRango(desde: number, hasta: number): Promise<{ cobros: CobroRango[]; elevationConfigurada: boolean }> {
  const ck = `${desde}-${hasta}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.ts < CACHE_MS) return hit.data;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Falta STRIPE_SECRET_KEY (2CLICKS).');
  const keyElev = process.env.STRIPE_SECRET_KEY_ELEVATION;

  // Productos NUESTROS en 2CLICKS: viejos + nuevos del evento (anchors).
  const platformOf = new Map<string, 'viraladn' | 'topcut' | 'combo'>();
  platformOf.set(PRODUCT_IDS.viraladn, 'viraladn');
  platformOf.set(PRODUCT_IDS.topcut, 'topcut');
  platformOf.set(PRODUCT_IDS.combo, 'combo');
  const nombre = (plat?: string) => plat === 'viraladn' ? 'ViralADN' : plat === 'topcut' ? 'TOPCUT' : plat === 'combo' ? 'Combo' : 'otro negocio';

  // Anchors + las dos cuentas, TODO en paralelo.
  const [anchors, chClicks, chElev] = await Promise.all([
    Promise.all(ANCHORS.map(async ([a, plat]) => {
      // opcional: si un precio ancla fue archivado, seguimos con los demás.
      const p = await sGet(`prices/${encodeURIComponent(a)}`, key, true) as { product?: string } | null;
      return [p?.product as string | undefined, plat] as const;
    })),
    cobrosDeCuenta(key, desde, hasta),
    keyElev ? cobrosDeCuenta(keyElev, desde, hasta) : Promise.resolve([] as ChargeRaw[]),
  ]);
  for (const [prod, plat] of anchors) if (prod) platformOf.set(prod, plat);

  const cobros: CobroRango[] = [];

  for (const c of chClicks) {
    let plat: 'viraladn' | 'topcut' | 'combo' | undefined;
    let prodId = '';
    const inv = typeof c.invoice === 'object' ? c.invoice : null;
    for (const l of inv?.lines?.data || []) {
      const pid = l.price?.product;
      if (pid) { if (!prodId) prodId = pid; const pf = platformOf.get(pid); if (pf) { plat = pf; break; } }
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
      motivo: plat ? 'producto' : esNuestro ? 'metadata' : 'ajeno',
      productoId: prodId,
      suscripcion: String(inv?.subscription || ''),
      ...extra,
    });
  }

  for (const c of chElev) {
    const { monto, refund, comision } = usdDe(c);
    const extra = datosDe(c);
    const invE = typeof c.invoice === 'object' ? c.invoice : null;
    cobros.push({
      ts: c.created ?? 0, fecha: fechaCDMX(c.created), hora: horaCDMX(c.created), email: emailDe(c),
      monto, refund, comision, netoBanco: r2(monto - refund - comision),
      estado: String(c.status || ''), producto: 'Vendido por Elevation (no es tu plata)', plataforma: 'viraladn',
      // viralAdn:false → NO suma a ningún ingreso. Se guarda igual para saber
      // quién compró (acceso) y para poder ver el volumen de la comunidad.
      viralAdn: false, cuenta: 'Elevation', motivo: 'elevation',
      productoId: String(invE?.lines?.data?.[0]?.price?.product || ''),
      suscripcion: String(invE?.subscription || ''),
      ...extra,
    });
  }

  const data = { cobros, elevationConfigurada: !!keyElev };
  cache.set(ck, { ts: Date.now(), data });
  if (cache.size > 24) cache.delete([...cache.keys()][0]); // no crecer sin fin
  return data;
}
