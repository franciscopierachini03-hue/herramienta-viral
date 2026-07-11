import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { PRODUCT_IDS } from '@/lib/products';

// GET /api/admin/pagos-dia?fecha=YYYY-MM-DD — qué pagos (cobros) entraron ese día.
//
// Lee la cuenta de producción (2CLICKS, STRIPE_SECRET_KEY en Vercel) — no corre
// local. Trae los cobros del día (hora CDMX), y a cada uno lo etiqueta como
// TUYO (ViralADN/TOPCUT/Combo, viejos + nuevos del evento) o de OTRO negocio,
// mirando el producto de su factura. Default: hoy.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ANCHORS: Array<[string, 'viraladn' | 'topcut' | 'combo']> = [
  ['price_1TrgNwBrwYizao1Ogz3hesBl', 'viraladn'],
  ['price_1TrgQWBrwYizao1Oz8hQaRUf', 'topcut'],
  ['price_1TrgRyBrwYizao1O8H1ANmMd', 'combo'],
];

const money = (c?: number | null) => Math.round(c ?? 0) / 100;

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

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: 'Falta STRIPE_SECRET_KEY (2CLICKS).' }, { status: 503 });

  const { desde, hasta, dia } = dayWindow((req.nextUrl.searchParams.get('fecha') || '').trim());

  try {
    // Productos de ViralADN: viejos + nuevos del evento (vía anchors).
    const platformOf = new Map<string, 'viraladn' | 'topcut' | 'combo'>();
    platformOf.set(PRODUCT_IDS.viraladn, 'viraladn');
    platformOf.set(PRODUCT_IDS.topcut, 'topcut');
    platformOf.set(PRODUCT_IDS.combo, 'combo');
    for (const [a, plat] of ANCHORS) {
      const p = await sGet(`prices/${encodeURIComponent(a)}`, key);
      if (p?.product) platformOf.set(p.product as string, plat);
    }
    const nombre = (plat?: string) => plat === 'viraladn' ? 'ViralADN' : plat === 'topcut' ? 'TOPCUT' : plat === 'combo' ? 'Combo' : 'otro negocio';

    // Cobros del día (paginado, con la factura expandida para saber el producto).
    type Cobro = { hora: string; email: string; monto: number; producto: string; estado: string; viralAdn: boolean };
    const cobros: Cobro[] = [];
    let after: string | null = null;
    for (let i = 0; i < 10; i++) {
      const q = `charges?limit=100&created[gte]=${desde}&created[lt]=${hasta}&expand[]=data.invoice`
        + (after ? `&starting_after=${after}` : '');
      const d = await sGet(q, key);
      const data: Array<Record<string, unknown>> = d?.data || [];
      for (const c of data) {
        const inv = c.invoice as { lines?: { data?: Array<{ price?: { product?: string } }> } } | null;
        let plat: 'viraladn' | 'topcut' | 'combo' | undefined;
        for (const l of inv?.lines?.data || []) {
          const pid = l.price?.product;
          if (pid) { const pf = platformOf.get(pid); if (pf) { plat = pf; break; } }
        }
        const bd = (c.billing_details as { email?: string }) || {};
        cobros.push({
          hora: new Date(Number(c.created) * 1000).toISOString().slice(11, 16),
          email: String(bd.email || c.receipt_email || '—'),
          monto: money(c.amount as number),
          producto: nombre(plat),
          estado: c.refunded ? 'reembolsado' : String(c.status || ''),
          viralAdn: !!plat,
        });
      }
      if (!d?.has_more || !data.length) break;
      after = (data[data.length - 1]?.id as string) || null;
    }

    const ok = cobros.filter(c => c.estado === 'succeeded');
    const tuyos = ok.filter(c => c.viralAdn);
    const otros = ok.filter(c => !c.viralAdn);
    const sum = (arr: Cobro[]) => Math.round(arr.reduce((a, c) => a + c.monto, 0) * 100) / 100;

    return Response.json({
      fecha: dia,
      zona: 'hora Ciudad de México',
      tuyo_viraladn: { cobros: tuyos.length, total: sum(tuyos), detalle: tuyos },
      otros_negocios: { cobros: otros.length, total: sum(otros) },
      reembolsos_del_dia: cobros.filter(c => c.estado === 'reembolsado').length,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
