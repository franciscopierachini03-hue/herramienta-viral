import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getBillingOverview } from '@/lib/stripe-admin';
import { cobrosRango } from '@/lib/ventas-stripe';
import { hacerXlsx } from '@/lib/xlsx';

// GET /api/admin/export                       → tabla profiles como CSV (clientes).
// GET /api/admin/export?type=ventas           → histórico de ventas (facturas de subs).
// GET /api/admin/export?type=ventas&mes=YYYY-MM → ventas de ESE mes calendario
//     (del 1 al último día, hora CDMX) sobre la base COMPLETA: 2CLICKS + Elevation
//     + pagos únicos, en USD liquidado y neto de reembolsos (= selector de día).
// Solo: email en ADMIN_EMAILS + cookie admin_pin_ok válida.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PERMANENT_OWNERS = ['franciscopierachini03@gmail.com'];

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (PERMANENT_OWNERS.includes(e)) return true;
  const list = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(e);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvResponse(csv: string, filename: string): Response {
  return new Response('﻿' + csv, { // BOM → Excel/Sheets respetan acentos
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

type Prof = { email: string; name: string | null; redeemed_code: string | null; stripe_customer_id: string | null };

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) return new Response('Forbidden', { status: 403 });

  const cookieStore = await cookies();
  if (cookieStore.get('admin_pin_ok')?.value !== '1') return new Response('PIN required', { status: 403 });

  const admin = createServiceClient();
  const { data, error } = await admin
    .from('profiles')
    .select('email, name, phone, subscription_status, trial_ends_at, activated_at, cancelled_at, redeemed_code, stripe_customer_id, stripe_subscription_id, created_at')
    .order('created_at', { ascending: false });
  if (error) { console.error('[admin/export]', error); return new Response('Error', { status: 500 }); }

  const today = new Date().toISOString().slice(0, 10);

  // ── Reporte de VENTAS de UN MES calendario (base completa, 2 cuentas) ──
  // ?mes=YYYY-MM · ?producto=viraladn|topcut|combo (default: todos)
  // ?formato=csv (default: xlsx, que Google Sheets abre con doble clic)
  const mes = (req.nextUrl.searchParams.get('mes') || '').trim();
  if (req.nextUrl.searchParams.get('type') === 'ventas' && /^\d{4}-\d{2}$/.test(mes)) {
    const prodFiltro = (req.nextUrl.searchParams.get('producto') || '').toLowerCase();
    const soloCsv = req.nextUrl.searchParams.get('formato') === 'csv';
    const [y, m] = mes.split('-').map(Number);
    const desde = Math.floor(Date.UTC(y, m - 1, 1, 6, 0, 0) / 1000);  // 1° del mes 00:00 CDMX
    const hasta = Math.floor(Date.UTC(y, m, 1, 6, 0, 0) / 1000);      // 1° del mes siguiente
    try {
      const { cobros } = await cobrosRango(desde, hasta);
      let ventas = cobros.filter(c => c.viralAdn && c.estado === 'succeeded').sort((a, b) => a.ts - b.ts);
      if (['viraladn', 'topcut', 'combo'].includes(prodFiltro)) {
        ventas = ventas.filter(c => c.plataforma === prodFiltro);
      }
      // Datos de la persona desde profiles (por email).
      const profs = (data || []) as unknown as Prof[];
      const byEmail = new Map<string, Record<string, unknown>>();
      for (const p of profs) if (p.email) byEmail.set(p.email.toLowerCase(), p as unknown as Record<string, unknown>);

      const encabezados = [
        'Fecha', 'Hora (CDMX)', 'Nombre', 'Email', 'Teléfono', 'País', 'Ciudad',
        'Producto', 'Código', 'Cuenta', 'Método de pago',
        'Cobrado USD', 'Reembolsado USD', 'Comisión Stripe USD', 'Neto al banco USD',
        'Pagó en su moneda', 'Moneda', 'Estado cuenta', 'Registrado', 'Renovación',
        'Suscripción', 'ID de pago', 'Recibo',
      ];
      const fechaCorta = (v: unknown) => v ? String(v).slice(0, 10) : '';
      const filas = ventas.map(v => {
        const p = byEmail.get(v.email.toLowerCase()) || {};
        return [
          v.fecha, v.hora, v.nombre || (p.name as string) || '', v.email, (p.phone as string) || '',
          v.pais, v.ciudad, v.producto, (p.redeemed_code as string) || '', v.cuenta, v.metodoPago,
          v.monto, v.refund, v.comision, v.netoBanco,
          v.montoOriginal, v.monedaOriginal,
          (p.subscription_status as string) || '', fechaCorta(p.created_at), fechaCorta(p.trial_ends_at),
          v.suscripcion, v.chargeId, v.recibo,
        ];
      });
      // Fila de totales al final.
      const tot = (f: (c: typeof ventas[number]) => number) => Math.round(ventas.reduce((a, c) => a + f(c), 0) * 100) / 100;
      filas.push([]);
      filas.push(['TOTAL', '', `${ventas.length} ventas`, '', '', '', '', '', '', '', '',
        tot(c => c.monto), tot(c => c.refund), tot(c => c.comision), tot(c => c.netoBanco)]);

      const etiqueta = ['viraladn', 'topcut', 'combo'].includes(prodFiltro) ? `-${prodFiltro}` : '';
      const nombreArch = `viraladn-ventas-${mes}${etiqueta}`;

      if (soloCsv) {
        const lines = [encabezados.join(',')];
        for (const f of filas) lines.push(f.map(csvEscape).join(','));
        return csvResponse(lines.join('\n'), `${nombreArch}.csv`);
      }
      const buf = await hacerXlsx({
        hoja: `Ventas ${mes}`, encabezados, filas,
        anchos: [11, 11, 26, 30, 16, 7, 16, 22, 14, 11, 20, 13, 15, 17, 16, 16, 9, 14, 12, 12, 26, 30, 44],
      });
      return new Response(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${nombreArch}.xlsx"`,
        },
      });
    } catch (e) {
      return new Response(`Error: ${(e as Error).message.slice(0, 200)}`, { status: 502 });
    }
  }

  // ── Reporte de VENTAS histórico (id de pago + cliente + plataforma) ──
  if (req.nextUrl.searchParams.get('type') === 'ventas') {
    const billing = await getBillingOverview();
    const profs = (data || []) as unknown as Prof[];
    const byCust = new Map<string, Prof>();
    const byEmail = new Map<string, Prof>();
    for (const p of profs) {
      if (p.stripe_customer_id) byCust.set(p.stripe_customer_id, p);
      if (p.email) byEmail.set(p.email.toLowerCase(), p);
    }

    const pays = [...billing.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const cols = ['ID de pago', 'Cliente', 'Email', 'Plataforma (código)', 'Monto USD', 'Fecha'];
    const lines = [cols.join(',')];
    for (const pay of pays) {
      const prof = byCust.get(pay.customer) || byEmail.get((pay.email || '').toLowerCase());
      const plataforma = prof?.redeemed_code || 'Directo';
      const cliente = prof?.name || '';
      const fecha = new Date(pay.date).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      lines.push([pay.id, cliente, pay.email, plataforma, pay.amount.toFixed(2), fecha].map(csvEscape).join(','));
    }
    return csvResponse(lines.join('\n'), `viraladn-ventas-${today}.csv`);
  }

  // ── Export de CLIENTES (default) ──
  const cols = ['email', 'name', 'phone', 'subscription_status', 'trial_ends_at', 'activated_at', 'cancelled_at', 'redeemed_code', 'stripe_customer_id', 'stripe_subscription_id', 'created_at'];
  const lines = [cols.join(',')];
  for (const row of (data || [])) {
    lines.push(cols.map(h => csvEscape((row as Record<string, unknown>)[h])).join(','));
  }
  return csvResponse(lines.join('\n'), `viraladn-clientes-${today}.csv`);
}
