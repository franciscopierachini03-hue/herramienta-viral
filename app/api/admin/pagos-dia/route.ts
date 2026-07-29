import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { PRODUCT_IDS } from '@/lib/products';

// GET /api/admin/pagos-dia?fecha=YYYY-MM-DD — qué pagos (cobros) entraron ese día.
//
// Lee LAS DOS cuentas de producción (no corre local):
//   · 2CLICKS (STRIPE_SECRET_KEY): cuenta compartida → cada cobro se etiqueta
//     TUYO (por el producto de su factura, o por metadata.app en pagos únicos
//     de liga/checkout) o de OTRO negocio.
//   · Elevation (STRIPE_SECRET_KEY_ELEVATION): cuenta dedicada → todo es tuyo.
// Montos SIEMPRE en USD liquidado (balance_transaction) — los cobros MXN de
// Elevation (Adaptive Pricing) entran convertidos, no se mezclan monedas.
// Hora CDMX. Default: hoy.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

// Medianoche CDMX (UTC-6) de una fecha YYYY-MM-DD → unix. Sin fecha = hoy CDMX.
function dayWindow(fecha: string): { desde: number; hasta: number; dia: string } {
  let y: number, m: number, d: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    [y, m, d] = fecha.split('-').map(Number);
  } else {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    [y, m, d] = p.split('-').map(Number);
  }
  const desde = Math.floor(Date.UTC(y, m - 1, d, 6, 0, 0) / 1000); // 00:00 CDMX = 06:00 UTC
  return { desde, hasta: desde + 86400, dia: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

type Cobro = {
  hora: string; email: string; monto: number; refund: number;
  producto: string; estado: string; viralAdn: boolean; cuenta: '2CLICKS' | 'Elevation';
};

type ChargeRaw = {
  created?: number; status?: string; amount?: number; amount_refunded?: number; currency?: string;
  receipt_email?: string | null;
  billing_details?: { email?: string | null } | null;
  invoice?: { lines?: { data?: Array<{ price?: { product?: string } }> } } | string | null;
  payment_intent?: { metadata?: Record<string, string> } | string | null;
  balance_transaction?: { amount?: number; currency?: string } | string | null;
  metadata?: Record<string, string> | null;
  id?: string;
};

// Cobros del día de UNA cuenta, con factura + PI + balance_transaction expandidos.
async function cobrosDeCuenta(key: string, desde: number, hasta: number): Promise<ChargeRaw[]> {
  const out: ChargeRaw[] = [];
  let after: string | null = null;
  for (let i = 0; i < 10; i++) {
    const q = `charges?limit=100&created[gte]=${desde}&created[lt]=${hasta}`
      + `&expand[]=data.invoice&expand[]=data.payment_intent&expand[]=data.balance_transaction`
      + (after ? `&starting_after=${after}` : '');
    const d = await sGet(q, key);
    const data: ChargeRaw[] = d?.data || [];
    out.push(...data);
    if (!d?.has_more || !data.length) break;
    after = data[data.length - 1]?.id || null;
  }
  return out;
}

// USD liquidado del cobro/reembolso: usa balance_transaction si vino (convierte
// MXN→USD como lo liquidó Stripe); si no, cae al monto crudo solo si es USD.
function usdDe(c: ChargeRaw): { monto: number; refund: number } {
  const bt = c.balance_transaction;
  const amount = (typeof bt === 'object' && bt?.currency === 'usd') ? (bt.amount ?? 0)
    : (c.currency === 'usd' ? (c.amount ?? 0) : 0);
  // El refund proporcional sobre lo liquidado (para MXN convertimos con la misma tasa).
  const bruto = c.amount ?? 0;
  const refTasa = bruto > 0 ? (c.amount_refunded ?? 0) / bruto : 0;
  return { monto: r2(amount / 100), refund: r2((amount / 100) * refTasa) };
}

const horaCDMX = (ts?: number) => new Date(((ts ?? 0) - 6 * 3600) * 1000).toISOString().slice(11, 16);
const emailDe = (c: ChargeRaw) => String(c.billing_details?.email || c.receipt_email || '—');

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: 'Falta STRIPE_SECRET_KEY (2CLICKS).' }, { status: 503 });
  const keyElev = process.env.STRIPE_SECRET_KEY_ELEVATION;

  const { desde, hasta, dia } = dayWindow((req.nextUrl.searchParams.get('fecha') || '').trim());

  try {
    // Productos de ViralADN en 2CLICKS: viejos + nuevos del evento (vía anchors).
    const platformOf = new Map<string, 'viraladn' | 'topcut' | 'combo'>();
    platformOf.set(PRODUCT_IDS.viraladn, 'viraladn');
    platformOf.set(PRODUCT_IDS.topcut, 'topcut');
    platformOf.set(PRODUCT_IDS.combo, 'combo');
    for (const [a, plat] of ANCHORS) {
      const p = await sGet(`prices/${encodeURIComponent(a)}`, key);
      if (p?.product) platformOf.set(p.product as string, plat);
    }
    const nombre = (plat?: string) => plat === 'viraladn' ? 'ViralADN' : plat === 'topcut' ? 'TOPCUT' : plat === 'combo' ? 'Combo' : 'otro negocio';

    const cobros: Cobro[] = [];

    // ── 2CLICKS (compartida): clasificar tuyo vs otro negocio ────────────────
    for (const c of await cobrosDeCuenta(key, desde, hasta)) {
      let plat: 'viraladn' | 'topcut' | 'combo' | undefined;
      const inv = typeof c.invoice === 'object' ? c.invoice : null;
      for (const l of inv?.lines?.data || []) {
        const pid = l.price?.product;
        if (pid) { const pf = platformOf.get(pid); if (pf) { plat = pf; break; } }
      }
      // Pago único (liga/checkout sin factura): nuestro checkout marca
      // metadata.app=viraladn en el PaymentIntent (y a veces en el charge).
      const pi = typeof c.payment_intent === 'object' ? c.payment_intent : null;
      const metaApp = pi?.metadata?.app || c.metadata?.app;
      const metaProd = (pi?.metadata?.product || c.metadata?.product || '').toLowerCase();
      let esNuestro = !!plat;
      let etiqueta = nombre(plat);
      if (!plat && metaApp === 'viraladn') {
        esNuestro = true;
        etiqueta = metaProd === 'topcut' ? 'TOPCUT (pago único)' : metaProd === 'combo' ? 'Combo (pago único)' : 'ViralADN (pago único)';
      }
      const { monto, refund } = usdDe(c);
      cobros.push({
        hora: horaCDMX(c.created), email: emailDe(c), monto, refund,
        estado: String(c.status || ''), producto: etiqueta, viralAdn: esNuestro, cuenta: '2CLICKS',
      });
    }

    // ── Elevation (dedicada): TODO es tuyo; MXN entra convertido a USD ───────
    if (keyElev) {
      for (const c of await cobrosDeCuenta(keyElev, desde, hasta)) {
        const { monto, refund } = usdDe(c);
        cobros.push({
          hora: horaCDMX(c.created), email: emailDe(c), monto, refund,
          estado: String(c.status || ''), producto: 'ViralADN (Elevation)', viralAdn: true, cuenta: 'Elevation',
        });
      }
    }

    const ok = cobros.filter(c => c.estado === 'succeeded');
    const tuyos = ok.filter(c => c.viralAdn).sort((a, b) => a.hora.localeCompare(b.hora));
    const otros = ok.filter(c => !c.viralAdn);
    const sumB = (arr: Cobro[]) => r2(arr.reduce((a, c) => a + c.monto, 0));
    const sumR = (arr: Cobro[]) => r2(arr.reduce((a, c) => a + c.refund, 0));
    const neto = (arr: Cobro[]) => r2(sumB(arr) - sumR(arr));
    const deCuenta = (arr: Cobro[], cta: Cobro['cuenta']) => arr.filter(c => c.cuenta === cta);

    return Response.json({
      fecha: dia,
      zona: 'hora Ciudad de México',
      tuyo_viraladn: {
        cobros: tuyos.length,
        bruto: sumB(tuyos), reembolsado: sumR(tuyos), neto: neto(tuyos),
        total: neto(tuyos), // compat: total = neto (lo que quedó cobrado)
        detalle: tuyos,
        por_cuenta: {
          clicks: { cobros: deCuenta(tuyos, '2CLICKS').length, neto: neto(deCuenta(tuyos, '2CLICKS')) },
          elevation: { cobros: deCuenta(tuyos, 'Elevation').length, neto: neto(deCuenta(tuyos, 'Elevation')), configurada: !!keyElev },
        },
      },
      otros_negocios: { cobros: otros.length, total: neto(otros), bruto: sumB(otros), reembolsado: sumR(otros) },
      reembolsos_del_dia: cobros.filter(c => c.refund > 0).length,
      reembolsado_total: r2(sumR(tuyos)),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
