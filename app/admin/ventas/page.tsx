// /admin/ventas — Ventas y dinero de ViralADN, DÍA POR DÍA.
//
// Server component, solo admin. Lee la cuenta de producción (2CLICKS) EN VIVO:
// cada vez que abrís la página muestra el dato al momento (se "actualiza solo").
// "Venta" = suscripción nueva creada ese día bajo un producto de ViralADN
// (viejos + los NUEVOS del evento, descubiertos desde precios ancla). El dinero
// del día = lo que pagaron las ventas nuevas de ese día (monto del período −
// descuento activo). Las que entran con código 100% off cuentan como venta pero
// $0 (bono).

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/access';
import { PRODUCT_IDS } from '@/lib/products';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Precios ancla VERIFICADOS → para descubrir los productos NUEVOS del evento.
const ANCHORS: Array<[string, 'viraladn' | 'topcut' | 'combo']> = [
  ['price_1TrgNwBrwYizao1Ogz3hesBl', 'viraladn'],
  ['price_1TrgQWBrwYizao1Oz8hQaRUf', 'topcut'],
  ['price_1TrgRyBrwYizao1O8H1ANmMd', 'combo'],
];

const TZ = 'America/Mexico_City';
const fmtDia = (unix: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(unix * 1000));
const fmtLindo = (dia: string) => {
  const [y, m, d] = dia.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
};
const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

type Dia = { dia: string; ventas: number; pagando: number; bono: number; ingreso: number; porProd: Record<string, number> };

async function sGet(path: string, key: string) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
  return r.ok ? r.json() : null;
}

export default async function VentasDiarias() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login?next=/admin/ventas');
  if (!isAdminEmail(user.email)) redirect('/admin');

  const key = process.env.STRIPE_SECRET_KEY || '';
  let error = '';
  const dias = new Map<string, Dia>();

  if (!key) {
    error = 'Falta STRIPE_SECRET_KEY (cuenta 2CLICKS) en Vercel.';
  } else {
    try {
      // Mapa producto → plataforma: viejos (PRODUCT_IDS) + nuevos (de los anchors).
      const platformOf = new Map<string, 'viraladn' | 'topcut' | 'combo'>();
      platformOf.set(PRODUCT_IDS.viraladn, 'viraladn');
      platformOf.set(PRODUCT_IDS.topcut, 'topcut');
      platformOf.set(PRODUCT_IDS.combo, 'combo');
      for (const [anchor, plat] of ANCHORS) {
        const p = await sGet(`prices/${encodeURIComponent(anchor)}`, key);
        if (p?.product) platformOf.set(p.product as string, plat);
      }

      // Suscripciones creadas en los últimos 30 días.
      const desde = Math.floor(Date.now() / 1000) - 30 * 86400;
      let after: string | null = null;
      for (let i = 0; i < 15; i++) {
        const q = `subscriptions?status=all&limit=100&created[gte]=${desde}&expand[]=data.discount.coupon`
          + (after ? `&starting_after=${after}` : '');
        const s = await sGet(q, key);
        const data: Array<Record<string, unknown>> = s?.data || [];
        for (const sub of data) {
          const st = sub.status as string;
          if (st !== 'active' && st !== 'trialing') continue; // solo checkout completado
          const it = (sub.items as { data?: Array<{ price?: { unit_amount?: number; product?: string; recurring?: { interval?: string } }; quantity?: number }> })?.data?.[0];
          const price = it?.price;
          const prod = price?.product;
          const plat = prod ? platformOf.get(prod) : undefined;
          if (!plat) continue; // no es ViralADN (otro negocio de la cuenta)

          const dia = fmtDia(sub.created as number);
          const base = ((price?.unit_amount || 0) / 100) * (Number(it?.quantity) || 1);
          const cup = (sub.discount as { coupon?: { percent_off?: number; amount_off?: number } })?.coupon;
          let neto = base;
          if (cup?.percent_off) neto = base * (1 - cup.percent_off / 100);
          else if (cup?.amount_off) neto = Math.max(0, base - cup.amount_off / 100);
          neto = Math.round(neto * 100) / 100;

          const row = dias.get(dia) || { dia, ventas: 0, pagando: 0, bono: 0, ingreso: 0, porProd: {} };
          row.ventas += 1;
          row.porProd[plat] = (row.porProd[plat] || 0) + 1;
          if (neto > 0) { row.pagando += 1; row.ingreso += neto; } else { row.bono += 1; }
          dias.set(dia, row);
        }
        if (!s?.has_more || !data.length) break;
        after = (data[data.length - 1]?.id as string) || null;
      }
    } catch (e) {
      error = (e as Error).message.slice(0, 200);
    }
  }

  const hoy = fmtDia(Math.floor(Date.now() / 1000));
  const mes = hoy.slice(0, 7);
  const lista = [...dias.values()].sort((a, b) => (a.dia < b.dia ? 1 : -1)); // reciente primero
  const filaHoy = dias.get(hoy) || { dia: hoy, ventas: 0, pagando: 0, bono: 0, ingreso: 0, porProd: {} };
  const delMes = lista.filter(d => d.dia.startsWith(mes));
  const totMesVentas = delMes.reduce((a, d) => a + d.ventas, 0);
  const totMesIngreso = delMes.reduce((a, d) => a + d.ingreso, 0);
  const tot30Ventas = lista.reduce((a, d) => a + d.ventas, 0);
  const tot30Ingreso = lista.reduce((a, d) => a + d.ingreso, 0);
  const maxIngreso = Math.max(1, ...lista.map(d => d.ingreso));
  const emoji: Record<string, string> = { viraladn: '🧬', topcut: '✂️', combo: '🔗' };

  const Card = ({ label, big, sub, accent }: { label: string; big: string; sub?: string; accent?: string }) => (
    <div style={{ background: 'linear-gradient(145deg,#141414,#0d0d0d)', border: '1px solid #222', borderRadius: 18, padding: '20px 22px', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 12, color: '#888', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, color: accent || '#fff', marginTop: 6, lineHeight: 1.1 }}>{big}</div>
      {sub && <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)', color: '#fff', fontFamily: '-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>📊 Ventas por día</h1>
          <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
            <Link href="/admin/pagos" style={{ color: '#a78bfa' }}>💳 Pagos</Link>
            <Link href="/admin/costos" style={{ color: '#a78bfa' }}>💸 Costos</Link>
            <Link href="/inicio" style={{ color: '#888' }}>🏠 Inicio</Link>
          </div>
        </div>
        <p style={{ color: '#888', fontSize: 13, marginTop: 0, marginBottom: 22 }}>
          Ventas nuevas de ViralADN (búsqueda + TOPCUT + combo) y el dinero que generaron. Lee Stripe en vivo — se actualiza solo cada vez que abrís esta página. Hora de Ciudad de México.
        </p>

        {error && (
          <div style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d55', borderRadius: 14, padding: 16, color: '#fca5a5', marginBottom: 20, fontSize: 14 }}>
            No pude leer Stripe: {error}
          </div>
        )}

        {/* HOY — grande */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ background: 'linear-gradient(135deg,#7c3aed22,#c1358422)', border: '1px solid #7c3aed66', borderRadius: 18, padding: '22px 24px', flex: 2, minWidth: 240 }}>
            <div style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>Hoy · {fmtLindo(hoy)}</div>
            <div style={{ display: 'flex', gap: 26, alignItems: 'baseline', marginTop: 8, flexWrap: 'wrap' }}>
              <div><span style={{ fontSize: 44, fontWeight: 800 }}>{filaHoy.ventas}</span> <span style={{ color: '#bbb', fontSize: 15 }}>ventas</span></div>
              <div><span style={{ fontSize: 44, fontWeight: 800, color: '#34d399' }}>{usd(filaHoy.ingreso)}</span> <span style={{ color: '#bbb', fontSize: 15 }}>generados</span></div>
            </div>
            <div style={{ fontSize: 13, color: '#9a9aa6', marginTop: 8 }}>
              {filaHoy.pagando} pagando · {filaHoy.bono} con código (bono)
              {Object.keys(filaHoy.porProd).length > 0 && ' · ' + Object.entries(filaHoy.porProd).map(([k, v]) => `${emoji[k] || ''}${v}`).join('  ')}
            </div>
          </div>
        </div>

        {/* Totales mes / 30 días */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 26 }}>
          <Card label="Este mes · ventas" big={String(totMesVentas)} sub={`${delMes.length} días con ventas`} />
          <Card label="Este mes · dinero" big={usd(totMesIngreso)} accent="#34d399" />
          <Card label="Últimos 30 días" big={String(tot30Ventas)} sub={`${usd(tot30Ingreso)} generados`} />
        </div>

        {/* Tabla por día */}
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ccc', margin: '0 0 12px' }}>Día por día</h2>
        {lista.length === 0 && !error ? (
          <div style={{ color: '#888', fontSize: 14, padding: '20px 0' }}>Todavía no hay ventas en los últimos 30 días.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lista.map(d => {
              const esHoy = d.dia === hoy;
              return (
                <div key={d.dia} style={{ display: 'flex', alignItems: 'center', gap: 14, background: esHoy ? '#7c3aed18' : '#0f0f0f', border: `1px solid ${esHoy ? '#7c3aed55' : '#1a1a1a'}`, borderRadius: 12, padding: '11px 16px' }}>
                  <div style={{ width: 96, fontSize: 13, color: esHoy ? '#c4b5fd' : '#bbb', fontWeight: esHoy ? 700 : 500, textTransform: 'capitalize' }}>{fmtLindo(d.dia)}</div>
                  <div style={{ width: 78, fontSize: 15, fontWeight: 700 }}>{d.ventas} <span style={{ color: '#777', fontSize: 12, fontWeight: 400 }}>vta{d.ventas === 1 ? '' : 's'}</span></div>
                  <div style={{ width: 96, fontSize: 15, fontWeight: 700, color: '#34d399' }}>{usd(d.ingreso)}</div>
                  <div style={{ flex: 1, minWidth: 60 }}>
                    <div style={{ height: 7, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((d.ingreso / maxIngreso) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#7c3aed,#34d399)' }} />
                    </div>
                  </div>
                  <div style={{ width: 130, fontSize: 12, color: '#888', textAlign: 'right' }}>
                    {d.pagando > 0 && `💰${d.pagando}`}{d.bono > 0 && `  🎁${d.bono}`}
                    {'  '}{Object.entries(d.porProd).map(([k, v]) => `${emoji[k] || ''}${v}`).join(' ')}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ color: '#666', fontSize: 12, marginTop: 22, lineHeight: 1.6 }}>
          💰 pagando · 🎁 código (bono, $0) · 🧬 ViralADN · ✂️ TOPCUT · 🔗 Combo. El dinero es lo que pagó cada venta nueva ese día (monto del período − descuento). No incluye renovaciones de meses anteriores. Ventana: últimos 30 días.
        </p>
      </div>
    </main>
  );
}
