import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { createServiceClient } from '@/lib/supabase/server';
import { cobrosRango, type CobroRango } from '@/lib/ventas-stripe';
import { PRODUCT_IDS } from '@/lib/products';

// GET /api/admin/auditoria-pagos?mes=YYYY-MM — AUDITORÍA de pagos de un mes:
// cruza cada cobro de Stripe (2 cuentas, base ventas-stripe) contra profiles y
// contra las suscripciones vivas, y devuelve HALLAZGOS clasificados:
//   🔴 pagó y no tiene acceso · 🔴 doble cobro en el mes
//   🟡 tarjeta rebotada (past_due, Stripe reintenta) · 🟡 acceso activo sin sub viva
//   🔵 reembolsos del mes · 🔵 montos fuera de catálogo
// + totales por producto/cuenta. Solo admin. Un mes por llamada (cachea 5 min).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const r2 = (n: number) => Math.round(n * 100) / 100;
const PRECIOS_CONOCIDOS = new Set([47, 67, 97]); // USD de lista (con descuento $20: 27/47/77)

type SubLite = {
  id: string; status: string; cancel_at_period_end?: boolean;
  customer?: string | { email?: string };
  items?: { data?: Array<{ price?: { product?: string; unit_amount?: number | null } }> };
};

async function subsDeCuenta(key: string, status: string): Promise<Array<SubLite & { email?: string }>> {
  const out: Array<SubLite & { email?: string }> = [];
  let after: string | null = null;
  for (let i = 0; i < 5; i++) {
    const q: string = `subscriptions?status=${status}&limit=100&expand[]=data.customer` + (after ? `&starting_after=${after}` : '');
    const r: Response = await fetch(`https://api.stripe.com/v1/${q}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
    if (!r.ok) break;
    const d = await r.json() as { data?: SubLite[]; has_more?: boolean };
    for (const s of (d?.data || [])) {
      const email = typeof s.customer === 'object' ? s.customer?.email : undefined;
      out.push({ ...s, email });
    }
    if (!d?.has_more || !d.data?.length) break;
    after = d.data[d.data.length - 1]?.id || null;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const q = (req.nextUrl.searchParams.get('mes') || '').trim();
  const hoyCDMX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' }).format(new Date());
  const mes = /^\d{4}-\d{2}$/.test(q) ? q : hoyCDMX;
  const [y, m] = mes.split('-').map(Number);
  const desde = Math.floor(Date.UTC(y, m - 1, 1, 6, 0, 0) / 1000);
  const hasta = Math.min(Math.floor(Date.UTC(y, m, 1, 6, 0, 0) / 1000), Math.floor(Date.now() / 1000));

  const key = process.env.STRIPE_SECRET_KEY;
  const keyElev = process.env.STRIPE_SECRET_KEY_ELEVATION;
  if (!key) return Response.json({ error: 'Falta STRIPE_SECRET_KEY.' }, { status: 503 });

  try {
    // 1) Cobros del mes (2 cuentas, clasificados) + perfiles + subs vivas/en problemas.
    const [{ cobros }, profilesRes, subsActivas2C, subsPD2C, subsActivasEl, subsPDEl] = await Promise.all([
      cobrosRango(desde, hasta),
      createServiceClient().from('profiles').select('email, name, subscription_status, redeemed_code, trial_ends_at, stripe_subscription_id, stripe_customer_id'),
      subsDeCuenta(key, 'active'),
      subsDeCuenta(key, 'past_due'),
      keyElev ? subsDeCuenta(keyElev, 'active') : Promise.resolve([]),
      keyElev ? subsDeCuenta(keyElev, 'past_due') : Promise.resolve([]),
    ]);

    const profiles = (profilesRes.data || []) as Array<{ email: string; name: string | null; subscription_status: string | null; redeemed_code: string | null; stripe_subscription_id: string | null }>;
    const perfilPorEmail = new Map(profiles.map(p => [p.email.toLowerCase(), p]));

    // Productos nuestros (para filtrar subs de 2CLICKS que no son nuestras).
    const nuestros = new Set(Object.values(PRODUCT_IDS));
    const esNuestra2C = (s: SubLite) => (s.items?.data || []).some(i => i.price?.product && nuestros.has(i.price.product));
    // Anchors del evento: agregar productos por monto conocido si no están en PRODUCT_IDS
    const subsVivas = [
      ...subsActivas2C.filter(s => esNuestra2C(s) || (s.items?.data?.[0]?.price?.unit_amount || 0) / 100 >= 27),
      ...subsActivasEl,
    ];
    const subsVivasIds = new Set(subsVivas.map(s => s.id));
    const rebotadas = [
      ...subsPD2C.filter(s => esNuestra2C(s) || (s.items?.data?.[0]?.price?.unit_amount || 0) / 100 >= 27).map(s => ({ ...s, cuenta: '2CLICKS' })),
      ...subsPDEl.map(s => ({ ...s, cuenta: 'Elevation' })),
    ];

    const ventas = cobros.filter(c => c.viralAdn && c.estado === 'succeeded');

    // 2) HALLAZGOS ────────────────────────────────────────────────────────────
    const hallazgos: Array<{ nivel: string; tipo: string; detalle: string }> = [];

    // 🔴 Pagó y NO tiene acceso (o el perfil no está activo)
    for (const v of ventas) {
      if (v.monto - v.refund <= 0) continue; // reembolsado completo, ok
      const p = perfilPorEmail.get(v.email.toLowerCase());
      if (!p) {
        hallazgos.push({ nivel: '🔴', tipo: 'pago_sin_cuenta', detalle: `${v.email} pagó $${(v.monto - v.refund).toFixed(2)} (${v.producto}, ${v.fecha}) pero NO tiene cuenta en la plataforma` });
      } else if (!['active', 'trialing'].includes(p.subscription_status || '')) {
        hallazgos.push({ nivel: '🔴', tipo: 'pago_sin_acceso', detalle: `${v.email} pagó $${(v.monto - v.refund).toFixed(2)} (${v.producto}, ${v.fecha}) pero su cuenta está "${p.subscription_status || 'pendiente'}"` });
      }
    }

    // 🔴 Doble cobro en el mes (mismo email, misma plataforma, 2+ cobros netos > 0)
    const porEmailProd = new Map<string, CobroRango[]>();
    for (const v of ventas) {
      if (v.monto - v.refund <= 0) continue;
      const k = `${v.email.toLowerCase()}|${v.plataforma || v.producto}`;
      porEmailProd.set(k, [...(porEmailProd.get(k) || []), v]);
    }
    for (const [k, arr] of porEmailProd) {
      if (arr.length > 1) {
        const [email] = k.split('|');
        hallazgos.push({ nivel: '🔴', tipo: 'doble_cobro', detalle: `${email}: ${arr.length} cobros de ${arr[0].producto} en el mes (${arr.map(a => `$${a.monto.toFixed(2)} el ${a.fecha}`).join(' + ')}) — revisar si es doble cobro` });
      }
    }

    // 🟡 Tarjetas rebotadas (Stripe está reintentando — riesgo de churn involuntario)
    for (const s of rebotadas) {
      const monto = (s.items?.data?.[0]?.price?.unit_amount || 0) / 100;
      hallazgos.push({ nivel: '🟡', tipo: 'tarjeta_rebotada', detalle: `${s.email || s.id} tiene la tarjeta rebotada ($${monto}/mes, ${(s as { cuenta?: string }).cuenta}) — Stripe reintenta solo; si no paga, pierde el acceso` });
    }

    // 🟡 Perfil activo con sub de Stripe que YA NO está viva (acceso fantasma)
    for (const p of profiles) {
      if (p.subscription_status !== 'active' || !p.stripe_subscription_id) continue;
      if (p.redeemed_code && !p.stripe_subscription_id.startsWith('sub_')) continue;
      if (!subsVivasIds.has(p.stripe_subscription_id) && !rebotadas.some(s => s.id === p.stripe_subscription_id)) {
        hallazgos.push({ nivel: '🟡', tipo: 'acceso_sin_sub', detalle: `${p.email} figura activo pero su suscripción ${p.stripe_subscription_id} ya no está viva en Stripe (¿canceló y quedó con acceso?)` });
      }
    }

    // 🔵 Reembolsos del mes
    for (const v of cobros.filter(c => c.viralAdn && c.refund > 0)) {
      hallazgos.push({ nivel: '🔵', tipo: 'reembolso', detalle: `${v.email}: reembolsados $${v.refund.toFixed(2)} de $${v.monto.toFixed(2)} (${v.producto}, cobro del ${v.fecha})` });
    }

    // 🔵 Montos fuera de catálogo (ni 47/67/97 ni sus versiones con $20 off)
    for (const v of ventas) {
      const neto = v.monto - v.refund;
      if (neto > 0 && v.cuenta === '2CLICKS' && v.monedaOriginal === 'USD'
        && !PRECIOS_CONOCIDOS.has(neto) && !PRECIOS_CONOCIDOS.has(neto + 20)) {
        hallazgos.push({ nivel: '🔵', tipo: 'monto_raro', detalle: `${v.email}: $${neto.toFixed(2)} (${v.producto}, ${v.fecha}) no coincide con ningún precio de lista ni descuento conocido` });
      }
    }

    // 3) Totales
    const sum = (arr: CobroRango[], f: (c: CobroRango) => number) => r2(arr.reduce((a, c) => a + f(c), 0));
    const porProducto: Record<string, { cobros: number; neto: number }> = {};
    for (const v of ventas) {
      const k = v.producto;
      porProducto[k] = porProducto[k] || { cobros: 0, neto: 0 };
      porProducto[k].cobros++;
      porProducto[k].neto = r2(porProducto[k].neto + (v.monto - v.refund));
    }

    const orden = { '🔴': 0, '🟡': 1, '🔵': 2 } as Record<string, number>;
    hallazgos.sort((a, b) => (orden[a.nivel] ?? 9) - (orden[b.nivel] ?? 9));

    return Response.json({
      mes,
      totales: {
        cobros: ventas.length,
        bruto: sum(ventas, c => c.monto),
        reembolsado: sum(ventas, c => c.refund),
        comisiones: sum(ventas, c => c.comision),
        neto: r2(sum(ventas, c => c.monto) - sum(ventas, c => c.refund)),
        neto_al_banco: sum(ventas, c => c.netoBanco),
        por_producto: porProducto,
      },
      suscripciones: { vivas: subsVivas.length, con_tarjeta_rebotada: rebotadas.length },
      hallazgos_total: hallazgos.length,
      hallazgos,
      nota: 'Base: cobros de Stripe de las 2 cuentas (USD liquidado) cruzados contra profiles y suscripciones vivas.',
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
