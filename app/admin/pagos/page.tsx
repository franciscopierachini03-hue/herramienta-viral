// /admin/pagos — libro de pagos de ViralADN (lo alimenta el webhook de Stripe).
// Server component, solo admin. Muestra ventas/renovaciones/reembolsos/disputas
// con totales del mes. Si la tabla no existe todavía, muestra cómo crearla.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/access';
import PagosDia from '../PagosDia';

export const dynamic = 'force-dynamic';

type Pago = {
  id: string;
  tipo: string;
  email: string | null;
  producto: string | null;
  monto: number | null;
  estado: string | null;
  detalle: string | null;
  created_at: string;
};

const TIPO_UI: Record<string, { label: string; color: string; bg: string }> = {
  venta: { label: '✅ Venta', color: '#86efac', bg: '#22c55e18' },
  renovacion: { label: '🔄 Renovación', color: '#7dd3fc', bg: '#0ea5e918' },
  reembolso: { label: '↩️ Reembolso', color: '#fda4af', bg: '#ef444418' },
  disputa: { label: '🚨 Disputa', color: '#fca5a5', bg: '#ef444426' },
  disputa_cerrada: { label: '⚖️ Disputa cerrada', color: '#fcd34d', bg: '#eab30818' },
  fallo_pago: { label: '⚠️ Pago fallido', color: '#fcd34d', bg: '#eab30818' },
  cancelacion: { label: '✖️ Cancelación', color: '#9ca3af', bg: '#6b728018' },
};

export default async function Pagos({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login?next=/admin/pagos');
  if (!isAdminEmail(user.email)) redirect('/admin');

  const { tipo } = await searchParams;
  const svc = createServiceClient();

  // ── Suscripciones ACTIVAS en vivo (por producto × ciclo, con MRR) ──────────
  // Lee la cuenta de producción (2CLICKS) y, si existe STRIPE_SECRET_KEY_LEGACY,
  // también la cuenta vieja (fundadores $47). Clasifica por PRODUCT_IDS y por
  // monto (47/470 = legacy fundadores aunque el producto se llame ViralADN).
  // n/mrr = SOLO los que pagan de verdad (última factura > $0, o sea el ingreso
  // REAL con descuentos ya aplicados). bono = suscripciones activas cuya última
  // factura fue $0 (cupón 100% / mes de prueba).
  type GrupoSub = { producto: string; ciclo: 'mensual' | 'anual'; n: number; mrr: number; porCancelar: number; bono: number };
  const NOMBRE_PROD: Record<string, string> = {
    viraladn: '🧬 ViralADN $27', topcut: '✂️ TOPCUT $57', combo: '🔗 Combo $67', legacy47: '⭐ Fundadores $47', otro: '❓ Otro',
  };
  const { PRODUCT_IDS } = await import('@/lib/products');

  // Mapa PRODUCTO → plataforma de ViralADN: los VIEJOS (PRODUCT_IDS) + los
  // NUEVOS del evento, descubiertos desde precios ancla verificados (uno por
  // plataforma). Sin esto, las ventas nuevas del evento caían como "otro".
  const ANCHORS: Array<[string, 'viraladn' | 'topcut' | 'combo']> = [
    ['price_1TrgNwBrwYizao1Ogz3hesBl', 'viraladn'],
    ['price_1TrgQWBrwYizao1Oz8hQaRUf', 'topcut'],
    ['price_1TrgRyBrwYizao1O8H1ANmMd', 'combo'],
  ];
  const platformOf = new Map<string, 'viraladn' | 'topcut' | 'combo'>();
  platformOf.set(PRODUCT_IDS.viraladn, 'viraladn');
  platformOf.set(PRODUCT_IDS.topcut, 'topcut');
  platformOf.set(PRODUCT_IDS.combo, 'combo');
  {
    const k = process.env.STRIPE_SECRET_KEY;
    if (k) await Promise.all(ANCHORS.map(async ([anchor, plat]) => {
      try {
        const r = await fetch(`https://api.stripe.com/v1/prices/${anchor}`, { headers: { Authorization: `Bearer ${k}` }, cache: 'no-store' });
        if (r.ok) { const p = await r.json(); if (p?.product) platformOf.set(p.product as string, plat); }
      } catch { /* noop */ }
    }));
  }

  // 2CLICKS comparte la cuenta con OTROS negocios → clasificamos por ID de
  // producto (viejos + nuevos del evento). Lo que no es producto de ViralADN es
  // "otro" (otro negocio) y se excluye. La cuenta legacy (solo "VIRAL ADN") vale
  // además por monto $47/$470.
  function clasificaSub(productId: string | null, amount: number | null, estricto: boolean): string {
    if (productId && platformOf.has(productId)) return platformOf.get(productId)!;
    if (!estricto) {
      const usd = Math.round((amount || 0) / 100);
      if (usd === 47 || usd === 470) return 'legacy47';
    }
    return 'otro';
  }

  async function resumenSubs(key: string, estricto: boolean): Promise<{ grupos: Map<string, GrupoSub>; otros: number; truncado: boolean } | null> {
    try {
      const grupos = new Map<string, GrupoSub>();
      let otros = 0;
      let truncado = false;
      let url = 'https://api.stripe.com/v1/subscriptions?status=active&limit=100';
      for (let page = 0; page < 20 && url; page++) {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
        if (!r.ok) return null;
        const d = await r.json();
        for (const sub of d.data || []) {
          const it = sub.items?.data?.[0];
          const price = it?.price;
          if (!price) continue;
          const producto = clasificaSub(
            typeof price.product === 'string' ? price.product : price.product?.id,
            price.unit_amount, estricto,
          );
          if (producto === 'otro') { otros += 1; continue; } // otros negocios: fuera de esta vista
          const ciclo: 'mensual' | 'anual' = price.recurring?.interval === 'year' ? 'anual' : 'mensual';
          const k = `${producto}:${ciclo}`;
          const g = grupos.get(k) || { producto, ciclo, n: 0, mrr: 0, porCancelar: 0, bono: 0 };

          // Ingreso recurrente NETO: precio de lista del ítem − descuento ACTIVO.
          // (No usamos latest_invoice: incluye prorrateos, impuestos y meses
          //  cobrados juntos → inflaba el número.)
          const qty = Number(it.quantity) || 1;
          const base = (Number(price.unit_amount) || 0) / 100 * qty; // por período
          const cup = sub.discount?.coupon;
          let neto = base;
          if (cup?.percent_off) neto = base * (1 - Number(cup.percent_off) / 100);
          else if (cup?.amount_off) neto = Math.max(0, base - Number(cup.amount_off) / 100);
          neto = Math.round(neto * 100) / 100;
          const netoMensual = ciclo === 'anual' ? neto / 12 : neto;

          if (neto > 0) {
            g.n += 1;
            g.mrr += netoMensual;
            if (sub.cancel_at_period_end) g.porCancelar += 1;
          } else {
            g.bono += 1; // descuento 100% activo → este ciclo paga $0
          }
          grupos.set(k, g);
        }
        const next = d.has_more && d.data?.length ? `https://api.stripe.com/v1/subscriptions?status=active&limit=100&starting_after=${d.data[d.data.length - 1].id}` : '';
        if (d.has_more && !next) truncado = true;
        if (page === 19 && d.has_more) truncado = true;
        url = next;
      }
      return { grupos, otros, truncado };
    } catch { return null; }
  }

  const keyProd = process.env.STRIPE_SECRET_KEY || '';
  const keyLegacy = process.env.STRIPE_SECRET_KEY_LEGACY || '';
  const [subsProd, subsLegacy] = await Promise.all([
    keyProd ? resumenSubs(keyProd, true) : Promise.resolve(null),   // 2CLICKS: estricto por ID
    keyLegacy && keyLegacy !== keyProd ? resumenSubs(keyLegacy, false) : Promise.resolve(null), // legacy: por monto
  ]);
  // Fusionar ambas cuentas en una sola vista.
  const gruposAll = new Map<string, GrupoSub>();
  for (const res of [subsProd, subsLegacy]) {
    if (!res) continue;
    for (const [k, g] of res.grupos) {
      const acc = gruposAll.get(k) || { ...g, n: 0, mrr: 0, porCancelar: 0, bono: 0 };
      acc.n += g.n; acc.mrr += g.mrr; acc.porCancelar += g.porCancelar; acc.bono += g.bono;
      gruposAll.set(k, acc);
    }
  }
  const filasSubs = [...gruposAll.values()].sort((a, b) => b.mrr - a.mrr);
  const mrrTotal = filasSubs.reduce((n, g) => n + g.mrr, 0);
  const subsTotal = filasSubs.reduce((n, g) => n + g.n, 0);
  const porCancelarTotal = filasSubs.reduce((n, g) => n + g.porCancelar, 0);
  const bonoTotal = filasSubs.reduce((n, g) => n + g.bono, 0);
  const otrosNegocios = (subsProd?.otros || 0) + (subsLegacy?.otros || 0);
  const subsTruncado = !!(subsProd?.truncado || subsLegacy?.truncado);

  // ── Cobros EN VIVO desde Stripe (la cuenta que usa producción = 2CLICKS) ──
  // Independiente del libro: sirve para ver quién pagó y cuánto aunque la
  // tabla todavía no exista o el webhook sea nuevo.
  type Cobro = { fecha: string; email: string; monto: number; estado: string; refunded: boolean; viralAdn: boolean; negocio: string };
  let cobros: Cobro[] = [];
  let stripeError = '';
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) stripeError = 'Sin STRIPE_SECRET_KEY en este entorno.';
    else {
      const r = await fetch('https://api.stripe.com/v1/charges?limit=25&expand[]=data.invoice', {
        headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
      });
      const d = await r.json();
      if (!r.ok) stripeError = d?.error?.message || `Stripe HTTP ${r.status}`;
      else {
        cobros = ((d.data || []) as Array<Record<string, unknown>>).map(c => {
          // Producto del cobro: su factura → líneas → precio → producto. Elige
          // una línea de ViralADN si la hay (evita que una proración despiste).
          const inv = c.invoice as { lines?: { data?: Array<{ price?: { product?: string } }> } } | null;
          let plat: 'viraladn' | 'topcut' | 'combo' | undefined;
          for (const l of inv?.lines?.data || []) {
            const pid = l.price?.product;
            if (pid) { const pf = platformOf.get(pid); if (pf) { plat = pf; break; } }
          }
          return {
            fecha: new Date(Number(c.created) * 1000).toISOString().slice(0, 10),
            email: String((c.billing_details as { email?: string })?.email || c.receipt_email || '—'),
            monto: Number(c.amount || 0) / 100,
            estado: String(c.status || ''),
            refunded: !!c.refunded,
            viralAdn: !!plat,
            negocio: plat === 'viraladn' ? '🧬 ViralADN' : plat === 'topcut' ? '✂️ TOPCUT' : plat === 'combo' ? '🔗 Combo' : '🏢 otro negocio',
          };
        });
      }
    }
  } catch (e) { stripeError = (e as Error).message.slice(0, 120); }
  const cobradoOk = cobros.filter(c => c.estado === 'succeeded' && !c.refunded);
  const tuyos = cobradoOk.filter(c => c.viralAdn);
  const otrosOk = cobradoOk.filter(c => !c.viralAdn);
  const totalTuyo = tuyos.reduce((n, c) => n + c.monto, 0);
  const totalOtros = otrosOk.reduce((n, c) => n + c.monto, 0);

  let filas: Pago[] = [];
  let tablaFalta = false;
  {
    let q = svc.from('pagos_viraladn')
      .select('id,tipo,email,producto,monto,estado,detalle,created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (tipo) q = q.eq('tipo', tipo);
    const { data, error } = await q;
    if (error) tablaFalta = /does not exist|relation/i.test(error.message);
    filas = (data || []) as Pago[];
  }

  // Totales del mes en curso.
  const inicioMes = new Date();
  inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const delMes = filas.filter(f => new Date(f.created_at) >= inicioMes);
  const suma = (t: string) => delMes.filter(f => f.tipo === t).reduce((n, f) => n + (Number(f.monto) || 0), 0);
  const cuenta = (t: string) => delMes.filter(f => f.tipo === t).length;
  const ingresos = suma('venta') + suma('renovacion');
  const disputasAbiertas = filas.filter(f => f.tipo === 'disputa' && f.estado === 'abierta').length;

  const fmtFecha = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const chip = (activo: boolean) => ({
    background: activo ? '#7c3aed' : '#14141f',
    border: `1px solid ${activo ? '#7c3aed' : '#2a2a36'}`,
    color: activo ? '#fff' : '#a1a1aa',
  });

  return (
    <main className="min-h-screen text-white px-6 py-8" style={{ background: '#080808' }}>
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">💳 Pagos de ViralADN</h1>
            <p className="text-xs" style={{ color: '#666' }}>
              Libro alimentado por el webhook de Stripe · reembolsos y disputas avisan por email solos
            </p>
          </div>
          <Link href="/admin" className="text-sm" style={{ color: '#888' }}>← Panel</Link>
        </div>

        {tablaFalta && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: '#1a1408', border: '1px solid #a1620a55' }}>
            <p className="text-sm font-bold mb-1" style={{ color: '#fcd34d' }}>⚙️ Falta crear la tabla (1 minuto, una sola vez)</p>
            <p className="text-xs" style={{ color: '#c9b48a' }}>
              Supabase → SQL Editor → New query → pegá el contenido de <span className="font-mono">supabase/pagos.sql</span> → Run.
              Desde ahí, cada movimiento de Stripe aparece acá solo.
            </p>
          </div>
        )}

        {/* Totales del mes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
            <div className="text-xs mb-1" style={{ color: '#666' }}>Ingresos del mes</div>
            <div className="text-2xl font-extrabold" style={{ color: '#86efac' }}>${ingresos.toFixed(0)}</div>
            <div className="text-[11px] mt-1" style={{ color: '#666' }}>{cuenta('venta')} ventas · {cuenta('renovacion')} renovaciones</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
            <div className="text-xs mb-1" style={{ color: '#666' }}>Reembolsos del mes</div>
            <div className="text-2xl font-extrabold" style={{ color: '#fda4af' }}>${suma('reembolso').toFixed(0)}</div>
            <div className="text-[11px] mt-1" style={{ color: '#666' }}>{cuenta('reembolso')} reembolsos</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: disputasAbiertas ? '1px solid #ef444455' : '1px solid #1f1f1f' }}>
            <div className="text-xs mb-1" style={{ color: '#666' }}>Disputas abiertas</div>
            <div className="text-2xl font-extrabold" style={{ color: disputasAbiertas ? '#fca5a5' : '#fff' }}>{disputasAbiertas}</div>
            <div className="text-[11px] mt-1" style={{ color: '#666' }}>responder a tiempo en Stripe</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
            <div className="text-xs mb-1" style={{ color: '#666' }}>Fallos de cobro (mes)</div>
            <div className="text-2xl font-extrabold" style={{ color: '#fcd34d' }}>{cuenta('fallo_pago')}</div>
            <div className="text-[11px] mt-1" style={{ color: '#666' }}>Stripe reintenta solo</div>
          </div>
        </div>

        {/* 📅 Pagos por día — elegí la fecha y mirá qué entró ese día */}
        <PagosDia />

        {/* Suscripciones activas por producto × ciclo (en vivo de Stripe) */}
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-bold" style={{ color: '#c4b5fd' }}>📈 Suscripciones activas — en vivo desde Stripe</h2>
          <span className="text-xs" style={{ color: '#666' }}>
            💰 {subsTotal} pagando · 🎁 {bonoTotal} en bono{porCancelarTotal ? ` · ⚠️ ${porCancelarTotal} por cancelar` : ''} · ingreso real <b style={{ color: '#86efac' }}>${mrrTotal.toFixed(0)}/mes</b>
          </span>
        </div>
        {filasSubs.length === 0 ? (
          <div className="rounded-2xl p-4 mb-8 text-sm" style={{ background: '#141414', border: '1px solid #1f1f1f', color: '#888' }}>
            No se pudieron leer las suscripciones (¿falta STRIPE_SECRET_KEY?).
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden mb-2" style={{ border: '1px solid #7c3aed33' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#101019', color: '#888' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-bold">Producto</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold">Ciclo</th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold">💰 Pagando</th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold">🎁 En bono ($0)</th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold">Por cancelar</th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold">Ingreso real/mes</th>
                </tr>
              </thead>
              <tbody>
                {filasSubs.map((g, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #161620' }}>
                    <td className="px-4 py-2.5 text-xs font-bold">{NOMBRE_PROD[g.producto] || g.producto}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: g.ciclo === 'anual' ? '#7dd3fc' : '#aaa' }}>
                      {g.ciclo === 'anual' ? '📅 Anual' : '🔄 Mensual'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right font-bold">{g.n}</td>
                    <td className="px-4 py-2.5 text-xs text-right" style={{ color: g.bono ? '#fcd34d' : '#555' }}>{g.bono || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-right" style={{ color: g.porCancelar ? '#fcd34d' : '#555' }}>{g.porCancelar || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-right font-bold" style={{ color: '#86efac' }}>${g.mrr.toFixed(0)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid #2a2a3a', background: '#0e0e16' }}>
                  <td className="px-4 py-2.5 text-xs font-extrabold" colSpan={2}>TOTAL</td>
                  <td className="px-4 py-2.5 text-xs text-right font-extrabold">{subsTotal}</td>
                  <td className="px-4 py-2.5 text-xs text-right font-extrabold" style={{ color: bonoTotal ? '#fcd34d' : '#555' }}>{bonoTotal || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-right" style={{ color: porCancelarTotal ? '#fcd34d' : '#555' }}>{porCancelarTotal || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-right font-extrabold" style={{ color: '#86efac' }}>${mrrTotal.toFixed(0)}/mes</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] mb-8" style={{ color: '#555' }}>
          Solo ViralADN · TOPCUT · Combo · Fundadores (por ID de producto, incluye los productos nuevos del evento).
          {otrosNegocios > 0 && ` Se excluyeron ${otrosNegocios} suscripciones de otros negocios que comparten la cuenta de Stripe.`}
          {' '}💰 Pagando = precio del plan − descuento activo &gt; $0 (ingreso recurrente NETO, anuales ÷12; sin prorrateos ni impuestos).
          {' '}🎁 En bono = descuento 100% activo → este ciclo paga $0.
          {subsTruncado && ' ⚠️ Hay más de 2.000 suscripciones: la lectura quedó parcial.'}
          {!keyLegacy && ' Para incluir a los fundadores $47: agregá STRIPE_SECRET_KEY_LEGACY en Vercel (la key de la cuenta vieja, la tenés en .env.local).'}
        </p>

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Link href="/admin/pagos" className="text-xs font-bold px-3 py-1.5 rounded-xl" style={chip(!tipo)}>Todo</Link>
          {Object.entries(TIPO_UI).map(([k, v]) => (
            <Link key={k} href={`/admin/pagos?tipo=${k}`} className="text-xs font-bold px-3 py-1.5 rounded-xl" style={chip(tipo === k)}>
              {v.label}
            </Link>
          ))}
        </div>

        {/* Tabla */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1f1f1f' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#101010', color: '#888' }}>
                <th className="text-left px-4 py-2.5 text-xs font-bold">Fecha</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold">Cliente</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold">Producto</th>
                <th className="text-right px-4 py-2.5 text-xs font-bold">Monto</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-xs" style={{ color: '#666' }}>
                  {tablaFalta ? 'Creá la tabla y los movimientos empiezan a caer solos.' : 'Todavía no hay movimientos registrados — van a aparecer con el próximo evento de Stripe.'}
                </td></tr>
              )}
              {filas.map(f => {
                const ui = TIPO_UI[f.tipo] || { label: f.tipo, color: '#aaa', bg: '#33333318' };
                return (
                  <tr key={f.id} style={{ borderTop: '1px solid #161616' }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: '#888' }}>{fmtFecha(f.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ color: ui.color, background: ui.bg }}>{ui.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{f.email || '—'}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#aaa' }}>{f.producto || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-right font-bold">{f.monto != null ? `$${Number(f.monto).toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-[11px]" style={{ color: '#777' }}>{[f.estado, f.detalle].filter(Boolean).join(' · ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] mt-3" style={{ color: '#555' }}>
          El libro se llena solo con cada evento nuevo del webhook. Los avisos 🚨 de reembolso, disputa y
          fallo de cobro llegan a {`franciscopierachini03@gmail.com`} al instante.
        </p>

        {/* Cobros en vivo desde Stripe (cuenta de producción) */}
        <div className="mt-10 mb-1">
          <h2 className="text-sm font-bold" style={{ color: '#d4d4dc' }}>🏦 Últimos 25 cobros en Stripe — cuenta 2CLICKS (compartida con otros negocios)</h2>
        </div>
        <div className="flex items-center gap-2.5 mb-3 flex-wrap text-xs">
          <span className="px-3 py-1.5 rounded-xl font-bold" style={{ background: '#0a1a12', border: '1px solid #22c55e55', color: '#86efac' }}>
            🧬 TUYO (ViralADN): {tuyos.length} cobros · ${totalTuyo.toFixed(0)}
          </span>
          <span className="px-3 py-1.5 rounded-xl" style={{ background: '#141414', border: '1px solid #2a2a2a', color: '#888' }}>
            🏢 Otros negocios: {otrosOk.length} · ${totalOtros.toFixed(0)} <span style={{ color: '#555' }}>(no es tuyo)</span>
          </span>
        </div>
        {stripeError ? (
          <div className="rounded-2xl p-4 text-sm" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d55', color: '#fca5a5' }}>
            No se pudo leer Stripe: {stripeError}
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1f1f1f' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#101010', color: '#888' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-bold">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold">Negocio</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold">Cliente</th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold">Monto</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cobros.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-xs" style={{ color: '#666' }}>
                    Sin cobros todavía en esta cuenta.
                  </td></tr>
                )}
                {cobros.map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #161616', opacity: c.viralAdn ? 1 : 0.45 }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: '#888' }}>{c.fecha}</td>
                    <td className="px-4 py-2.5 text-xs font-bold" style={{ color: c.viralAdn ? '#86efac' : '#777' }}>{c.negocio}</td>
                    <td className="px-4 py-2.5 text-xs">{c.email}</td>
                    <td className="px-4 py-2.5 text-xs text-right font-bold">${c.monto.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: c.refunded ? '#fda4af' : c.estado === 'succeeded' ? '#86efac' : '#fcd34d' }}>
                      {c.refunded ? 'reembolsado' : c.estado}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
