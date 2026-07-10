import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { PRODUCT_IDS } from '@/lib/products';

// GET /api/admin/ventas-hoy — cuántas ventas de ViralADN entraron HOY.
//
// Lee la cuenta de producción (2CLICKS, STRIPE_SECRET_KEY en Vercel) — por eso
// no se puede correr local. "Venta" = suscripción nueva creada hoy bajo un
// producto de ViralADN (viejos + los NUEVOS del evento), con estado activo o en
// prueba. Descubre los productos nuevos desde precios ancla verificados, así
// cubre todo sin depender de IDs pegados a mano.
//
// Bonus: devuelve el catálogo de precios por producto (id + monto + ciclo) para
// tener los price ids correctos del evento a mano.
//
// "hoy" = desde medianoche de Ciudad de México (UTC-6). ?desde=unix override.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Precios ancla VERIFICADOS (crean sesión de pago OK) → para descubrir los
// productos NUEVOS del evento (uno por plataforma).
const ANCHORS = [
  'price_1TrgNwBrwYizao1Ogz3hesBl', // ViralADN mensual $47
  'price_1TrgQWBrwYizao1Oz8hQaRUf', // TOPCUT mensual $67
  'price_1TrgRyBrwYizao1O8H1ANmMd', // Combo mensual $97
];

const money = (c?: number | null) => Math.round((c ?? 0)) / 100;

async function sGet(path: string, key: string) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
  });
  return r.json();
}

function midnightCDMX(): number {
  // Fecha de hoy en CDMX, medianoche = 06:00 UTC (CDMX es UTC-6, sin horario de verano).
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [y, m, d] = parts.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d, 6, 0, 0) / 1000);
}

type Sub = {
  id?: string; status?: string; created?: number;
  items?: { data?: Array<{ price?: { unit_amount?: number; product?: string; recurring?: { interval?: string } } }> };
  discount?: { coupon?: { percent_off?: number } };
};

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: 'Falta STRIPE_SECRET_KEY (2CLICKS).' }, { status: 503 });

  const desdeParam = Number(req.nextUrl.searchParams.get('desde'));
  const desde = Number.isFinite(desdeParam) && desdeParam > 0 ? desdeParam : midnightCDMX();

  try {
    // 1) Productos de ViralADN: viejos (PRODUCT_IDS) + nuevos (de los anchors).
    const prodIds = new Set<string>(Object.values(PRODUCT_IDS));
    for (const a of ANCHORS) {
      const p = await sGet(`prices/${encodeURIComponent(a)}`, key);
      if (p?.product) prodIds.add(p.product as string);
    }

    // 2) Catálogo de precios por producto (para tener los price ids correctos).
    const catalogo: Record<string, Array<{ id: string; monto: number; ciclo: string }>> = {};
    for (const pid of prodIds) {
      const pr = await sGet(`prices?product=${encodeURIComponent(pid)}&active=true&limit=100`, key);
      catalogo[pid] = (pr?.data || []).map((x: { id: string; unit_amount?: number; recurring?: { interval?: string; interval_count?: number } }) => {
        const iv = x.recurring?.interval;
        const cnt = x.recurring?.interval_count || 1;
        const ciclo = iv === 'year' ? 'anual' : iv === 'month' && cnt === 3 ? 'trimestral' : iv === 'month' ? 'mensual' : `${cnt}x${iv}`;
        return { id: x.id, monto: money(x.unit_amount), ciclo };
      }).sort((a: { monto: number }, b: { monto: number }) => a.monto - b.monto);
    }

    // 3) Suscripciones creadas HOY con precio en un producto de ViralADN.
    const ventas: Array<{ id: string; monto: number; ciclo: string; producto: string; status: string; bono: boolean }> = [];
    let after: string | null = null;
    for (let i = 0; i < 12; i++) {
      const q = `subscriptions?status=all&limit=100&created[gte]=${desde}&expand[]=data.discount.coupon`
        + (after ? `&starting_after=${after}` : '');
      const s = await sGet(q, key);
      const data: Sub[] = s?.data || [];
      for (const sub of data) {
        const price = sub.items?.data?.[0]?.price;
        const prod = price?.product;
        if (!prod || !prodIds.has(prod)) continue;
        const iv = price?.recurring?.interval;
        const ciclo = iv === 'year' ? 'anual' : iv === 'month' ? 'mensual' : (iv || '?');
        const prodKey =
          prod === PRODUCT_IDS.combo ? 'combo'
          : prod === PRODUCT_IDS.topcut ? 'topcut'
          : prod === PRODUCT_IDS.viraladn ? 'viraladn' : prod;
        ventas.push({
          id: sub.id || '', monto: money(price?.unit_amount), ciclo, producto: prodKey,
          status: sub.status || '?', bono: (sub.discount?.coupon?.percent_off ?? 0) >= 100,
        });
      }
      if (!s?.has_more || !data.length) break;
      after = data[data.length - 1]?.id || null;
    }

    // 4) Resumen. "Ventas" = activas o en prueba (checkout completado). Incompletas
    //    (pago no terminado) y canceladas se cuentan aparte.
    const cerradas = ventas.filter(v => v.status === 'active' || v.status === 'trialing');
    const pagando = cerradas.filter(v => !v.bono);
    const bono = cerradas.filter(v => v.bono);
    const incompletas = ventas.filter(v => v.status.startsWith('incomplete')).length;
    const canceladas = ventas.filter(v => v.status === 'canceled').length;
    const porProducto = (arr: typeof ventas) =>
      arr.reduce((m: Record<string, number>, v) => { m[v.producto] = (m[v.producto] || 0) + 1; return m; }, {});

    return Response.json({
      ventana: `desde ${new Date(desde * 1000).toISOString()} (medianoche CDMX)`,
      ventasHoy: cerradas.length,
      pagando: pagando.length,
      enBono_100off: bono.length,
      montoNominal: Math.round(pagando.reduce((a, v) => a + v.monto, 0) * 100) / 100,
      porProducto: porProducto(cerradas),
      incompletas_pagoNoTerminado: incompletas,
      canceladas_hoy: canceladas,
      detalle: cerradas,
      _catalogoPrecios: catalogo,
      _productosViralADN: [...prodIds],
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
