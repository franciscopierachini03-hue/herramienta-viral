// 📖 LIBRO DE COBROS — la fuente de la verdad de cuánta plata entró.
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// Hasta ahora el panel le preguntaba a Stripe EN VIVO "¿cuánto gané?", y Stripe
// no puede contestar eso: la cuenta 2CLICKS es compartida y el 96% del
// movimiento es de otros negocios. Cada carga tenía que adivinar cuál 4% era
// nuestro. Por eso el número se movía, tardaba, y a veces se caía.
//
// Ahora los cobros se ESCRIBEN una vez en `cobros_viraladn` (supabase/cobros.sql)
// y el panel lee de ahí: instantáneo, siempre el mismo número, y con el porqué
// de cada fila anotado.
//
// ── Cómo se llena ──────────────────────────────────────────────────────────
// `sincronizar(desde, hasta)` lee Stripe con la MISMA clasificación ya probada
// (lib/ventas-stripe) y hace upsert por charge_id. Es idempotente: correrlo mil
// veces sobre el mismo rango deja el mismo resultado. Lo llaman:
//   · /api/admin/sincronizar-cobros  → relleno del histórico, a mano
//   · el cron diario                 → últimos 35 días (así entran los reembolsos)
//
// ── La válvula manual ──────────────────────────────────────────────────────
// Si una fila no corresponde, se marca `excluir = true` con una `nota`. La
// sincronización RESPETA esa decisión: nunca la pisa. Es lo que faltaba para
// poder corregir a mano lo que ninguna regla puede saber.

import { createServiceClient } from '@/lib/supabase/server';
import { cobrosRango, type CobroRango } from '@/lib/ventas-stripe';

export type ResultadoSync = {
  leidos: number;      // cobros nuestros encontrados en Stripe
  escritos: number;    // filas insertadas o actualizadas
  respetados: number;  // filas excluidas a mano que NO se tocaron
  // Contexto para entender un mes que da CERO sin tener que abrir Stripe:
  // ¿no hubo movimiento, o hubo pero nada era nuestro?
  enLaCuenta: number;  // cobros exitosos en la cuenta 2CLICKS (todos los negocios)
  ajenos: number;      // de esos, cuántos son de otros negocios
  elevation: number;   // cobros de Elevation (dan acceso, no son tu plata)
  error?: string;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

// El producto tal cual lo guarda el libro (minúscula, estable).
function productoDe(c: CobroRango): string {
  if (c.plataforma === 'viraladn') return 'viraladn';
  if (c.plataforma === 'topcut') return 'topcut';
  if (c.plataforma === 'combo') return 'combo';
  return 'otro';
}

// Con cuánta confianza sabemos que este cobro es nuestro. Queda escrito en la
// fila para poder auditar después sin volver a Stripe.
function certezaDe(c: CobroRango): string {
  return c.motivo === 'producto' ? 'producto' : c.motivo === 'metadata' ? 'metadata' : 'monto';
}

function aFila(c: CobroRango) {
  return {
    charge_id: c.chargeId,
    ts: new Date(c.ts * 1000).toISOString(),
    fecha: c.fecha,                       // ya viene en día CDMX
    email: c.email === '—' ? null : c.email,
    nombre: c.nombre || null,
    customer_id: null as string | null,   // el charge no lo trae; lo llena el webhook
    suscripcion_id: c.suscripcion || null,
    producto: productoDe(c),
    ciclo: null as string | null,         // mejor vacío que adivinado
    bruto_usd: r2(c.monto),
    reembolsado_usd: r2(c.refund),
    comision_usd: r2(c.comision),
    moneda_origen: c.monedaOriginal || null,
    monto_origen: c.montoOriginal ?? null,
    cuenta: c.cuenta,
    origen: 'backfill',
    certeza: certezaDe(c),
    estado: c.refund >= c.monto && c.monto > 0 ? 'refunded' : c.estado,
    actualizado_at: new Date().toISOString(),
  };
}

// Lee Stripe en [desde, hasta) y deja el libro al día. Idempotente.
export async function sincronizar(desde: number, hasta: number): Promise<ResultadoSync> {
  const sb = createServiceClient();
  const vacio = { leidos: 0, escritos: 0, respetados: 0, enLaCuenta: 0, ajenos: 0, elevation: 0 };
  let cobros: CobroRango[];
  try {
    ({ cobros } = await cobrosRango(desde, hasta));
  } catch (e) {
    return { ...vacio, error: (e as Error).message.slice(0, 160) };
  }

  const ok = cobros.filter(c => c.estado === 'succeeded');
  const ctx = {
    enLaCuenta: ok.filter(c => c.cuenta === '2CLICKS').length,
    ajenos: ok.filter(c => c.cuenta === '2CLICKS' && !c.viralAdn).length,
    elevation: ok.filter(c => c.cuenta === 'Elevation').length,
  };

  // Solo lo NUESTRO y solo lo que se cobró de verdad. Elevation queda afuera
  // (cobra en su cuenta: da acceso, no da plata).
  const mios = ok.filter(c => c.viralAdn && c.chargeId);
  if (!mios.length) return { ...vacio, ...ctx };

  // Las filas marcadas a mano no se tocan: esa decisión gana siempre.
  const ids = mios.map(c => c.chargeId);
  const excluidos = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from('cobros_viraladn')
      .select('charge_id').eq('excluir', true).in('charge_id', ids.slice(i, i + 200));
    for (const r of data || []) excluidos.add(r.charge_id as string);
  }

  const filas = mios.filter(c => !excluidos.has(c.chargeId)).map(aFila);
  let escritos = 0;
  for (let i = 0; i < filas.length; i += 200) {
    const tanda = filas.slice(i, i + 200);
    const { error } = await sb.from('cobros_viraladn').upsert(tanda, { onConflict: 'charge_id' });
    if (error) return { leidos: mios.length, escritos, respetados: excluidos.size, ...ctx, error: error.message.slice(0, 160) };
    escritos += tanda.length;
  }

  return { leidos: mios.length, escritos, respetados: excluidos.size, ...ctx };
}

export type CobroLibro = {
  charge_id: string; fecha: string; ts: string; email: string; nombre: string;
  neto: number; producto: string; certeza: string; cuenta: string;
  moneda: string; reembolsado: boolean;
};

export type MesLibro = {
  mes: string;
  neto: number;
  bruto: number;
  reembolsado: number;
  comision: number;
  cobros: number;
  porProducto: Record<string, number>;
  porCerteza: Record<string, { cobros: number; neto: number }>;
  diario: number[];
  masGrandes: CobroLibro[];
  ultimos: CobroLibro[];
  cerrado: boolean;
};

const NOMBRE: Record<string, string> = { viraladn: 'ViralADN', topcut: 'TOPCUT', combo: 'Combo', otro: 'Otro' };

// Lee un mes DEL LIBRO (no de Stripe). Devuelve null si el mes no tiene filas
// todavía — así quien llama puede caer a Stripe y sincronizar.
export async function leerMes(mes: string): Promise<MesLibro | null> {
  const sb = createServiceClient();
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const { data, error } = await sb.from('cobros_viraladn')
    .select('charge_id, fecha, ts, email, nombre, producto, certeza, cuenta, moneda_origen, monto_origen, bruto_usd, reembolsado_usd, comision_usd')
    .gte('fecha', `${mes}-01`).lte('fecha', `${mes}-${String(ultimo).padStart(2, '0')}`)
    .eq('excluir', false);
  if (error || !data || data.length === 0) return null;

  const diario = Array.from({ length: ultimo }, () => 0);
  const porProducto: Record<string, number> = {};
  const porCerteza: Record<string, { cobros: number; neto: number }> = {};
  let bruto = 0, reembolsado = 0, comision = 0;
  const filas: CobroLibro[] = [];

  for (const f of data) {
    const b = Number(f.bruto_usd) || 0, d = Number(f.reembolsado_usd) || 0, k = Number(f.comision_usd) || 0;
    const neto = r2(b - d);
    bruto += b; reembolsado += d; comision += k;
    diario[Number(String(f.fecha).slice(8, 10)) - 1] += neto;

    const p = NOMBRE[String(f.producto)] || 'Otro';
    porProducto[p] = r2((porProducto[p] || 0) + neto);

    const cz = String(f.certeza || 'monto');
    porCerteza[cz] = porCerteza[cz] || { cobros: 0, neto: 0 };
    porCerteza[cz].cobros++;
    porCerteza[cz].neto = r2(porCerteza[cz].neto + neto);

    filas.push({
      charge_id: String(f.charge_id), fecha: String(f.fecha), ts: String(f.ts),
      email: String(f.email || '—'), nombre: String(f.nombre || ''),
      neto, producto: p, certeza: cz, cuenta: String(f.cuenta || '2CLICKS'),
      moneda: f.moneda_origen && f.moneda_origen !== 'USD' ? `${f.monto_origen} ${f.moneda_origen}` : '',
      reembolsado: d >= b && b > 0,
    });
  }

  const { data: cerrado } = await sb.from('meses_cerrados').select('mes').eq('mes', mes).maybeSingle();

  return {
    mes,
    // El titular es lo COBRADO neto de reembolsos (la comisión se muestra aparte
    // para no cambiar el significado del número que ya venía leyendo).
    neto: r2(bruto - reembolsado),
    bruto: r2(bruto), reembolsado: r2(reembolsado), comision: r2(comision),
    cobros: data.length,
    porProducto, porCerteza,
    diario: diario.map(r2),
    masGrandes: [...filas].sort((a, b) => b.neto - a.neto).slice(0, 12),
    ultimos: [...filas].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 60),
    cerrado: !!cerrado,
  };
}
