import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { createServiceClient } from '@/lib/supabase/server';
import { cobrosRango } from '@/lib/ventas-stripe';
import { hacerXlsx } from '@/lib/xlsx';

// GET /api/admin/quien-paga — LA VERDAD sobre cada acceso activo.
// Cruza TODOS los perfiles con acceso (active/trialing) contra:
//   · todos los cobros de las DOS cuentas de Stripe (desde ene-2026)
//   · las suscripciones VIVAS de las dos cuentas
// y clasifica a cada persona:
//   💚 PAGA         → suscripción viva en Stripe (te sigue pagando)
//   💛 PAGÓ ANTES   → hay pagos suyos pero ya no tiene suscripción viva
//   🎁 CORTESÍA     → acceso regalado a propósito (código CORTESIA/COURTESY)
//   🔴 SIN PAGO     → acceso activo SIN ningún pago ni código de cortesía
// ?formato=xlsx (default json) baja la planilla. Solo admin.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const r2 = (n: number) => Math.round(n * 100) / 100;

type SubLite = { id: string; status: string; customer?: string | { id?: string; email?: string }; items?: { data?: Array<{ price?: { unit_amount?: number | null } }> } };

async function subsVivas(key: string): Promise<Array<{ id: string; email: string; monto: number; status: string }>> {
  const out: Array<{ id: string; email: string; monto: number; status: string }> = [];
  for (const status of ['active', 'trialing', 'past_due']) {
    let after: string | null = null;
    for (let i = 0; i < 5; i++) {
      const q: string = `subscriptions?status=${status}&limit=100&expand[]=data.customer` + (after ? `&starting_after=${after}` : '');
      const r: Response = await fetch(`https://api.stripe.com/v1/${q}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
      if (!r.ok) break;
      const d = await r.json() as { data?: SubLite[]; has_more?: boolean };
      for (const s of (d.data || [])) {
        const cust = typeof s.customer === 'object' ? s.customer : null;
        out.push({
          id: s.id,
          email: String(cust?.email || '').toLowerCase(),
          monto: (s.items?.data?.[0]?.price?.unit_amount || 0) / 100,
          status: s.status,
        });
      }
      if (!d.has_more || !d.data?.length) break;
      after = d.data[d.data.length - 1]?.id || null;
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: 'Falta STRIPE_SECRET_KEY.' }, { status: 503 });
  const keyElev = process.env.STRIPE_SECRET_KEY_ELEVATION;

  const desde = Math.floor(Date.UTC(2026, 0, 1, 6, 0, 0) / 1000); // ene-2026
  const hasta = Math.floor(Date.now() / 1000);

  try {
    const [{ cobros }, perfilesRes, vivas2C, vivasEl] = await Promise.all([
      cobrosRango(desde, hasta),
      createServiceClient().from('profiles')
        .select('email, name, phone, subscription_status, redeemed_code, trial_ends_at, activated_at, created_at, stripe_subscription_id')
        .in('subscription_status', ['active', 'trialing']),
      subsVivas(key),
      keyElev ? subsVivas(keyElev) : Promise.resolve([]),
    ]);

    // Pagos por email (solo los nuestros y exitosos).
    const pagos = new Map<string, { veces: number; total: number; ultima: string }>();
    for (const c of cobros) {
      if (!c.viralAdn || c.estado !== 'succeeded') continue;
      const k = c.email.toLowerCase();
      const e = pagos.get(k) || { veces: 0, total: 0, ultima: '' };
      e.veces++; e.total = r2(e.total + c.monto - c.refund);
      if (c.fecha > e.ultima) e.ultima = c.fecha;
      pagos.set(k, e);
    }

    // Suscripciones vivas por email y por id.
    const vivasPorEmail = new Map<string, { monto: number; status: string; id: string }>();
    const vivasPorId = new Map<string, { monto: number; status: string; email: string }>();
    for (const s of [...vivas2C, ...vivasEl]) {
      if (s.email) vivasPorEmail.set(s.email, { monto: s.monto, status: s.status, id: s.id });
      vivasPorId.set(s.id, { monto: s.monto, status: s.status, email: s.email });
    }

    type Fila = { email: string; nombre: string; tel: string; clase: string; detalle: string; pagos: number; total: number; ultima: string; estado: string; codigo: string; activado: string };
    const filas: Fila[] = [];
    const perfiles = (perfilesRes.data || []) as Array<Record<string, string | null>>;

    for (const p of perfiles) {
      const email = String(p.email || '').toLowerCase();
      if (!email.includes('@')) continue;
      const codigo = String(p.redeemed_code || '').trim();
      const subId = String(p.stripe_subscription_id || '');
      const pago = pagos.get(email);
      const viva = vivasPorEmail.get(email) || (subId ? vivasPorId.get(subId) : undefined);
      const esCortesia = /^(CORTESIA|COURTESY)/i.test(codigo);

      let clase: string, detalle: string;
      if (viva) { clase = '💚 PAGA'; detalle = `suscripción ${viva.status} de $${viva.monto}/mes`; }
      else if (pago) { clase = '💛 PAGÓ ANTES'; detalle = `${pago.veces} pago(s), último el ${pago.ultima} — hoy sin suscripción viva`; }
      else if (esCortesia) { clase = '🎁 CORTESÍA'; detalle = `acceso regalado (${codigo})`; }
      else { clase = '🔴 SIN PAGO'; detalle = codigo ? `código "${codigo}" sin pago asociado` : 'sin pago, sin código, sin suscripción'; }

      filas.push({
        email, nombre: String(p.name || ''), tel: String(p.phone || ''),
        clase, detalle,
        pagos: pago?.veces || 0, total: pago?.total || 0, ultima: pago?.ultima || '',
        estado: String(p.subscription_status || ''), codigo,
        activado: String(p.activated_at || p.created_at || '').slice(0, 10),
      });
    }

    const orden: Record<string, number> = { '💚 PAGA': 0, '💛 PAGÓ ANTES': 1, '🎁 CORTESÍA': 2, '🔴 SIN PAGO': 3 };
    filas.sort((a, b) => (orden[a.clase] ?? 9) - (orden[b.clase] ?? 9) || b.total - a.total);

    const resumen = filas.reduce((acc, f) => { acc[f.clase] = (acc[f.clase] || 0) + 1; return acc; }, {} as Record<string, number>);

    if (req.nextUrl.searchParams.get('formato') === 'xlsx') {
      const buf = await hacerXlsx({
        hoja: 'Quien paga',
        encabezados: ['Clasificación', 'Email', 'Nombre', 'Teléfono', 'Detalle', 'Pagos', 'Total pagado USD', 'Último pago', 'Estado en la plataforma', 'Código', 'Con acceso desde'],
        filas: filas.map(f => [f.clase, f.email, f.nombre, f.tel, f.detalle, f.pagos, f.total, f.ultima, f.estado, f.codigo, f.activado]),
        anchos: [16, 32, 26, 16, 46, 8, 17, 13, 22, 16, 17],
      });
      return new Response(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="viraladn-quien-paga.xlsx"',
        },
      });
    }

    return Response.json({
      total_con_acceso: filas.length,
      resumen,
      correos_que_pagan: filas.filter(f => f.clase === '💚 PAGA').map(f => f.email),
      correos_sin_pago: filas.filter(f => f.clase === '🔴 SIN PAGO').map(f => f.email),
      detalle: filas,
      planilla: '/api/admin/quien-paga?formato=xlsx',
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
