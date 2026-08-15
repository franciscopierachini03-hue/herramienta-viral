// 💵 DINERO QUE ENTRÓ — una sola pasada por Stripe para TODOS los números de
// plata del panel: cobrado hoy · este mes · mes pasado · acumulado · histórico
// mensual · ingreso diario · historial de pagos.
//
// ── Por qué existe ──────────────────────────────────────────────────────────
// El panel sacaba la plata de las FACTURAS DE SUSCRIPCIÓN de la cuenta 2CLICKS
// (lib/stripe-admin). Eso dejaba afuera, sin avisar:
//   · los pagos ÚNICOS (ligas de pago, checkout en modo pago),
//   · la cuenta Elevation entera,
//   · cualquier suscripción con un precio fuera de la lista de precios nuestra.
// Resultado visible: "Cobrado este mes" marcaba $685 mientras el "Balance del
// mes" (que sí mira todos los cobros) marcaba $819 — faltaba el Combo entero.
//
// Ahora las dos cifras salen de la MISMA función (cobrosRango, lib/ventas-stripe),
// que es también la del CSV de ventas. Panel, balance, export y Stripe cuadran
// por construcción: ya no pueden discrepar.
//
// stripe-admin queda para lo que sí sabe hacer: las SUSCRIPCIONES (MRR, activas,
// lo que falta cobrar este mes, proyección del que viene).

import { cobrosRango, type CobroRango } from '@/lib/ventas-stripe';

// Arranque del negocio. Mismo corte que el export "Histórico completo"
// (app/api/admin/export) → el "Total acumulado" del panel y el total del Excel
// dan el mismo número. Enero para no dejar afuera ventas viejas.
const INICIO = Math.floor(Date.UTC(2026, 0, 1, 6, 0, 0) / 1000);

const r2 = (n: number) => Math.round(n * 100) / 100;
const diaCDMX = (d: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(d);

export type Tramo = {
  neto: number;                        // lo que quedó cobrado (menos reembolsos)
  bruto: number;
  reembolsado: number;
  cobros: number;
  porProducto: Array<[string, number]>; // [['ViralADN', 618], ['Combo', 134]]
};

export type PagoLinea = {
  id: string; email: string; date: string; amount: number; currency: string;
  product: string; refunded: boolean; cuenta: string;
};

export type Dinero = {
  ok: boolean;
  error?: string;
  hoy: Tramo;
  mes: Tramo;
  mesPasado: Tramo;
  acumulado: Tramo;
  meses: Array<{ label: string; neto: number; cobros: number }>; // últimos 6
  diario: number[];        // ingreso por día del mes pedido (índice 0 = día 1)
  ultimos: PagoLinea[];    // historial (los últimos 60 cobros)
  desdeLabel: string;      // "abril de 2026" — desde cuándo mira el acumulado
};

const TRAMO_VACIO: Tramo = { neto: 0, bruto: 0, reembolsado: 0, cobros: 0, porProducto: [] };

function vacio(error?: string): Dinero {
  return {
    ok: !error, error,
    hoy: TRAMO_VACIO, mes: TRAMO_VACIO, mesPasado: TRAMO_VACIO, acumulado: TRAMO_VACIO,
    meses: [], diario: [], ultimos: [], desdeLabel: '',
  };
}

// Nombre corto para el desglose: los pagos únicos y los de Elevation se suman
// a su plataforma (si no, el desglose no suma el total y confunde).
function corto(c: CobroRango): string {
  if (c.plataforma === 'viraladn') return 'ViralADN';
  if (c.plataforma === 'topcut') return 'TOPCUT';
  if (c.plataforma === 'combo') return 'Combo';
  return c.producto || '—';
}

function tramo(cobros: CobroRango[]): Tramo {
  const bruto = r2(cobros.reduce((a, c) => a + c.monto, 0));
  const reembolsado = r2(cobros.reduce((a, c) => a + c.refund, 0));
  const m = new Map<string, number>();
  for (const c of cobros) m.set(corto(c), r2((m.get(corto(c)) || 0) + c.monto - c.refund));
  return {
    neto: r2(bruto - reembolsado), bruto, reembolsado, cobros: cobros.length,
    porProducto: [...m.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// mesSel: 'YYYY-MM' del gráfico diario. Todo lo demás sale del mismo escaneo.
export async function getDinero(mesSel: string): Promise<Dinero> {
  if (!process.env.STRIPE_SECRET_KEY) return vacio('STRIPE_SECRET_KEY no configurado');

  const hoyStr = diaCDMX(new Date());
  const [hy, hm, hd] = hoyStr.split('-').map(Number);
  // Hasta MAÑANA 00:00 CDMX: el tope no cambia durante el día → el caché de
  // cobrosRango (5 min) pega, en vez de escanear Stripe en cada carga.
  const hasta = Math.floor(Date.UTC(hy, hm - 1, hd + 1, 6, 0, 0) / 1000);

  let todos: CobroRango[];
  try {
    ({ cobros: todos } = await cobrosRango(INICIO, hasta));
  } catch (e) {
    return vacio((e as Error).message.slice(0, 160));
  }

  // Solo lo nuestro y solo lo que se cobró de verdad — igual que el Balance.
  const mios = todos.filter(c => c.estado === 'succeeded' && c.viralAdn);

  const mesStr = hoyStr.slice(0, 7);
  const [ay, am] = mesStr.split('-').map(Number);
  const dPasado = new Date(Date.UTC(ay, am - 2, 1));
  const mesPasadoStr = `${dPasado.getUTCFullYear()}-${String(dPasado.getUTCMonth() + 1).padStart(2, '0')}`;

  // Histórico: últimos 6 meses, con la misma etiqueta que ya usa el gráfico.
  const etiqueta = (y: number, m: number) =>
    new Date(Date.UTC(y, m, 1)).toLocaleDateString('es-AR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(ay, am - 1 - (5 - i), 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const t = tramo(mios.filter(c => c.fecha.slice(0, 7) === key));
    return { label: etiqueta(d.getUTCFullYear(), d.getUTCMonth()), neto: t.neto, cobros: t.cobros };
  });

  // Ingreso diario del mes elegido.
  const sel = /^\d{4}-\d{2}$/.test(mesSel) ? mesSel : mesStr;
  const [sy, sm] = sel.split('-').map(Number);
  const diario = Array.from({ length: new Date(Date.UTC(sy, sm, 0)).getUTCDate() }, () => 0);
  for (const c of mios) {
    if (c.fecha.slice(0, 7) !== sel) continue;
    diario[Number(c.fecha.slice(8, 10)) - 1] += c.monto - c.refund;
  }

  const ultimos: PagoLinea[] = [...mios]
    .sort((a, b) => b.ts - a.ts).slice(0, 60)
    .map(c => ({
      id: c.chargeId, email: c.email, date: new Date(c.ts * 1000).toISOString(),
      // Reembolso total → mostramos el monto original + la etiqueta "Reembolsado".
      amount: r2(c.refund >= c.monto && c.monto > 0 ? c.monto : c.monto - c.refund),
      currency: 'USD', product: c.producto, refunded: c.refund >= c.monto && c.monto > 0,
      cuenta: c.cuenta,
    }));

  return {
    ok: true,
    hoy: tramo(mios.filter(c => c.fecha === hoyStr)),
    mes: tramo(mios.filter(c => c.fecha.slice(0, 7) === mesStr)),
    mesPasado: tramo(mios.filter(c => c.fecha.slice(0, 7) === mesPasadoStr)),
    acumulado: tramo(mios),
    meses,
    diario: diario.map(r2),
    ultimos,
    desdeLabel: new Date(INICIO * 1000).toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' }),
  };
}
