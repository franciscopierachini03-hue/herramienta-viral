import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { hacerXlsx } from '@/lib/xlsx';

// GET /api/admin/a-quien-reembolsar — A QUIÉN HAY QUE DEVOLVERLE DINERO.
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// Al pausar ViralADN (23-oct-2026) hay que devolverle el dinero a quien pagó
// un período que ya no va a poder usar. El criterio que fijó Francisco: si le
// quedan MÁS DE DOS SEMANAS de suscripción pagada, se le devuelve.
//
// Ese dato no estaba en ningún panel: `quien-paga` dice quién tiene una
// suscripción viva, pero no hasta cuándo la tiene pagada. Acá se consulta
// `current_period_end` de cada suscripción en LAS TRES cuentas de Stripe.
//
// ── ESTE ENDPOINT NO DEVUELVE NINGÚN DINERO ────────────────────────────────
// Solo LEE y arma la lista. El reembolso se hace a mano en Stripe, con el
// `charge` que esta lista te da. Es a propósito: mover dinero no se
// automatiza desde acá.
//
//   ?dias=14        → corte (default 14: "más de dos semanas")
//   ?todos=1        → no filtra, lista TODAS las suscripciones vivas
//   ?formato=xlsx   → baja la planilla
// Solo admin.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Cuenta = { id: string; label: string; key: string | undefined };

function cuentas(): Cuenta[] {
  return [
    { id: '2clicks',   label: '2CLICKS / ViralADN', key: process.env.STRIPE_SECRET_KEY },
    { id: 'elevation', label: 'Elevation',          key: process.env.STRIPE_SECRET_KEY_ELEVATION },
    { id: 'legacy',    label: 'Legacy',             key: process.env.STRIPE_SECRET_KEY_LEGACY },
  ].filter(c => !!c.key) as Cuenta[];
}

type Sub = {
  id: string;
  status: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  customer?: { id?: string; email?: string | null; name?: string | null } | string;
  items?: { data?: Array<{ price?: { unit_amount?: number | null; nickname?: string | null; recurring?: { interval?: string } } }> };
  latest_invoice?: { id?: string; charge?: string | null; amount_paid?: number; created?: number } | string | null;
};

type Fila = {
  cuenta: string; email: string; nombre: string;
  subscriptionId: string; chargeId: string;
  montoUltimoPago: number; moneda: string;
  finPeriodo: string; diasRestantes: number;
  estado: string; cancelaAlFinal: boolean; plan: string;
};

async function subsDeCuenta(c: Cuenta): Promise<Sub[]> {
  const out: Sub[] = [];
  for (const status of ['active', 'trialing', 'past_due']) {
    let after: string | null = null;
    // 5 páginas × 100 = hasta 500 por estado; de sobra para este tamaño.
    for (let i = 0; i < 5; i++) {
      const q = `subscriptions?status=${status}&limit=100`
        + `&expand[]=data.customer&expand[]=data.latest_invoice`
        + (after ? `&starting_after=${after}` : '');
      const r = await fetch(`https://api.stripe.com/v1/${q}`, {
        headers: { Authorization: `Bearer ${c.key}` }, cache: 'no-store',
      });
      if (!r.ok) {
        console.error(`[a-quien-reembolsar] ${c.id} ${status}: HTTP ${r.status}`);
        break;
      }
      const d = await r.json() as { data?: Sub[]; has_more?: boolean };
      const lote = d.data || [];
      out.push(...lote);
      if (!d.has_more || !lote.length) break;
      after = lote[lote.length - 1].id;
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const cs = cuentas();
  if (!cs.length) return Response.json({ error: 'No hay ninguna llave de Stripe configurada.' }, { status: 503 });

  const sp = req.nextUrl.searchParams;
  const dias = Number(sp.get('dias') || 14);
  const todos = sp.get('todos') === '1';
  const ahora = Math.floor(Date.now() / 1000);

  try {
    const filas: Fila[] = [];
    for (const c of cs) {
      for (const s of await subsDeCuenta(c)) {
        const fin = s.current_period_end || 0;
        const restantes = fin ? Math.round((fin - ahora) / 86400) : 0;
        const cust = typeof s.customer === 'object' && s.customer ? s.customer : null;
        const inv = typeof s.latest_invoice === 'object' && s.latest_invoice ? s.latest_invoice : null;
        const precio = s.items?.data?.[0]?.price;
        filas.push({
          cuenta: c.label,
          email: String(cust?.email || '').toLowerCase(),
          nombre: String(cust?.name || ''),
          subscriptionId: s.id,
          // Este es el id que se usa para devolver el dinero en Stripe.
          chargeId: String(inv?.charge || ''),
          montoUltimoPago: (inv?.amount_paid ?? precio?.unit_amount ?? 0) / 100,
          moneda: 'USD',
          finPeriodo: fin ? new Date(fin * 1000).toISOString().slice(0, 10) : '',
          diasRestantes: restantes,
          estado: s.status,
          cancelaAlFinal: !!s.cancel_at_period_end,
          plan: String(precio?.nickname || ''),
        });
      }
    }

    // El criterio: le quedan MÁS de `dias` días pagados.
    const aDevolver = todos ? filas : filas.filter(f => f.diasRestantes > dias);
    aDevolver.sort((a, b) => b.diasRestantes - a.diasRestantes);

    const total = Math.round(aDevolver.reduce((s, f) => s + f.montoUltimoPago, 0) * 100) / 100;
    const sinCargo = aDevolver.filter(f => !f.chargeId).map(f => f.email);

    if (sp.get('formato') === 'xlsx') {
      const buf = await hacerXlsx({
        hoja: 'A quien reembolsar',
        encabezados: ['Correo', 'Nombre', 'Cuenta', 'Monto último pago USD', 'Días que le quedan', 'Fin del período', 'Estado', 'Charge (para el reembolso)', 'Suscripción', 'Plan'],
        filas: aDevolver.map(f => [f.email, f.nombre, f.cuenta, f.montoUltimoPago, f.diasRestantes, f.finPeriodo, f.estado, f.chargeId, f.subscriptionId, f.plan]),
        anchos: [32, 24, 20, 20, 18, 16, 12, 30, 30, 16],
      });
      return new Response(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="viraladn-a-quien-reembolsar.xlsx"',
        },
      });
    }

    return Response.json({
      criterio: todos ? 'TODAS las suscripciones vivas' : `les quedan más de ${dias} días pagados`,
      cuentas_leidas: cs.map(c => c.label),
      suscripciones_vivas: filas.length,
      a_reembolsar: aDevolver.length,
      total_a_devolver_usd: total,
      // ⚠️ Esta lista NO reembolsa nada: el reembolso se hace en Stripe.
      correos: aDevolver.map(f => f.email),
      sin_charge_identificado: sinCargo,
      detalle: aDevolver,
      planilla: `/api/admin/a-quien-reembolsar?formato=xlsx${todos ? '&todos=1' : `&dias=${dias}`}`,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
