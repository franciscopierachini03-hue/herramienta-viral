import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { cobrosRango, type CobroRango } from '@/lib/ventas-stripe';
import { leerMes } from '@/lib/libro-cobros';

// GET /api/admin/balance-mes?mes=YYYY-MM — BALANCE DE VERDAD de un mes calendario.
// Suma LAS DOS cuentas (2CLICKS clasificada + Elevation completa) + pagos únicos,
// en USD liquidado y NETO de reembolsos. Es la misma base del CSV de ventas, así
// que los números cuadran entre el panel, el export y Stripe.
// Sin ?mes= = mes actual (hora CDMX).
//
// ── Es UN MES por pedido, a propósito ──────────────────────────────────────
// Antes había un endpoint que escaneaba TODO el historial de una (ene→hoy, las
// 2 cuentas) para llenar el panel: se pasaba de los 60s de Vercel y devolvía
// 504, así que las tarjetas de plata quedaban en "leyendo Stripe…" para
// siempre. Un mes entra holgado. El panel pide los meses que necesita EN
// PARALELO y arma el total — si uno falla, los otros igual se ven.
//
//   &corte=18   → además del mes completo, cuánto había entrado al día 18
//                 (para comparar meses a la misma altura)
//   &detalle=0  → sin la lista de cobros más grandes ni el detalle diario
//                 (para los meses viejos del gráfico, que solo necesitan el total)

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('mes') || '').trim();
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' }).format(new Date());
  const mes = /^\d{4}-\d{2}$/.test(q) ? q : hoy;
  const corte = Math.min(31, Math.max(0, Number(sp.get('corte') || 0)));
  const detalle = sp.get('detalle') !== '0';
  const [y, m] = mes.split('-').map(Number);
  const desde = Math.floor(Date.UTC(y, m - 1, 1, 6, 0, 0) / 1000);   // 1° 00:00 CDMX
  const hasta = Math.floor(Date.UTC(y, m, 1, 6, 0, 0) / 1000);       // 1° del siguiente

  // ── Camino rápido: si el mes ya está en el LIBRO, sale de ahí ────────────
  // Instantáneo y siempre el mismo número. Solo para meses que NO son el actual
  // (el actual sigue vivo: entran cobros y reembolsos durante el día).
  // Se puede forzar la lectura de Stripe con ?fresco=1.
  const esMesActual = mes === hoy;
  if (!esMesActual && sp.get('fresco') !== '1') {
    try {
      const L = await leerMes(mes);
      if (L) {
        // El corte al día N sale del detalle diario que ya tenemos.
        const hasta_dia = corte > 0
          ? { dia: corte, cobros: 0, neto: r2(L.diario.slice(0, corte).reduce((a, b) => a + b, 0)) }
          : null;
        const cz = (k: string) => L.porCerteza[k] || { cobros: 0, neto: 0 };
        return Response.json({
          mes, dias_del_mes: L.diario.length,
          fuente: L.cerrado ? 'libro · mes cerrado' : 'libro',
          ventana: `del 1 al último día de ${mes} (hora CDMX)`,
          moneda: 'USD liquidado (los cobros en otra moneda entran convertidos)',
          tuyo: {
            cobros: L.cobros, bruto: L.bruto, reembolsado: L.reembolsado, neto: L.neto,
            comision: L.comision,
            por_cuenta: { clicks: { cobros: L.cobros, neto: L.neto }, elevation: { cobros: 0, neto: 0, configurada: true } },
            por_producto: Object.fromEntries(Object.entries(L.porProducto).map(([k, v]) => [k, { cobros: 0, neto: v }])),
            por_plataforma: L.porProducto,
            de_donde_sale: { producto: cz('producto'), metadata: cz('metadata'), elevation: cz('monto') },
            mas_grandes: detalle ? L.masGrandes.map(c => ({
              fecha: c.fecha, email: c.email, nombre: c.nombre, neto: c.neto,
              producto: c.producto, cuenta: c.cuenta,
              motivo: c.certeza === 'producto' ? 'producto' : c.certeza === 'metadata' ? 'metadata' : 'elevation',
              moneda: c.moneda, recibo: '',
            })) : [],
            ultimos: detalle ? L.ultimos.map(c => ({
              id: c.charge_id, email: c.email, fecha: c.fecha,
              hora: c.ts.slice(11, 16), neto: c.neto, reembolsado: c.reembolsado,
              producto: c.producto, cuenta: c.cuenta,
            })) : [],
            diario: L.diario,
            hasta_dia,
          },
          otros_negocios: { cobros: 0, neto: 0 },
          csv: `/api/admin/export?type=ventas&mes=${mes}`,
        });
      }
    } catch { /* si el libro falla, seguimos contra Stripe */ }
  }

  try {
    const { cobros, elevationConfigurada } = await cobrosRango(desde, hasta);
    const ok = cobros.filter(c => c.estado === 'succeeded');
    const mios = ok.filter(c => c.viralAdn);
    const otros = ok.filter(c => !c.viralAdn);

    const sum = (arr: CobroRango[], f: (c: CobroRango) => number) => r2(arr.reduce((a, c) => a + f(c), 0));
    const bruto = sum(mios, c => c.monto);
    const devuelto = sum(mios, c => c.refund);
    const neto = r2(bruto - devuelto);

    // Desglose por producto y por cuenta.
    const porProducto: Record<string, { cobros: number; neto: number }> = {};
    for (const c of mios) {
      const k = c.producto || '—';
      porProducto[k] = porProducto[k] || { cobros: 0, neto: 0 };
      porProducto[k].cobros++;
      porProducto[k].neto = r2(porProducto[k].neto + (c.monto - c.refund));
    }
    const deCuenta = (cta: CobroRango['cuenta']) => {
      const a = mios.filter(c => c.cuenta === cta);
      return { cobros: a.length, neto: r2(sum(a, c => c.monto) - sum(a, c => c.refund)) };
    };

    // Elevation vende ViralADN pero cobra en SU cuenta: la plata es de ellos.
    // Se muestra aparte, a modo informativo — nunca suma al ingreso.
    const elev = ok.filter(c => c.cuenta === 'Elevation');
    const elevation_ajeno = {
      cobros: elev.length,
      neto: r2(sum(elev, c => c.monto) - sum(elev, c => c.refund)),
      configurada: elevationConfigurada,
    };

    // 🔍 DE DÓNDE SALE el número: por qué se contó cada cobro como nuestro.
    // Un mes que "da mucho" casi siempre es plata que entró por la puerta
    // floja (metadata suelta o la cuenta Elevation entera), no por producto.
    const deMotivo = (m: CobroRango['motivo']) => {
      const a = mios.filter(c => c.motivo === m);
      return { cobros: a.length, neto: r2(sum(a, c => c.monto) - sum(a, c => c.refund)) };
    };
    const de_donde_sale = {
      producto: deMotivo('producto'),    // prueba dura: la factura es de un producto nuestro
      metadata: deMotivo('metadata'),    // pagos sueltos etiquetados app=viraladn
      elevation: deMotivo('elevation'),  // TODA la cuenta Elevation cuenta como nuestra
    };

    // Los cobros más grandes del mes — para ver de un vistazo si hay uno que
    // no debería estar (un ajeno colado, un anual que no es tuyo, etc.).
    const mas_grandes = !detalle ? [] : [...mios]
      .sort((a, b) => (b.monto - b.refund) - (a.monto - a.refund))
      .slice(0, 12)
      .map(c => ({
        fecha: c.fecha, email: c.email, nombre: c.nombre,
        neto: r2(c.monto - c.refund), producto: c.producto,
        cuenta: c.cuenta, motivo: c.motivo,
        moneda: c.monedaOriginal !== 'USD' ? `${c.montoOriginal} ${c.monedaOriginal}` : '',
        recibo: c.recibo,
      }));

    // Detalle día por día + últimos cobros: con esto el panel dibuja el gráfico
    // diario y el historial sin volver a pedirle nada a Stripe.
    const diasDelMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const diario = Array.from({ length: diasDelMes }, () => 0);
    for (const c of mios) diario[Number(c.fecha.slice(8, 10)) - 1] += c.monto - c.refund;

    const ultimos = !detalle ? [] : [...mios]
      .sort((a, b) => b.ts - a.ts).slice(0, 60)
      .map(c => ({
        id: c.chargeId, email: c.email, fecha: c.fecha, hora: c.hora,
        // Reembolso total → mostramos el monto original + la etiqueta.
        neto: r2(c.refund >= c.monto && c.monto > 0 ? c.monto : c.monto - c.refund),
        reembolsado: c.refund >= c.monto && c.monto > 0,
        producto: c.producto, cuenta: c.cuenta,
      }));

    // Mismo tramo del mes (del 1 al día `corte`) para comparar meses de igual a
    // igual: un mes a medio andar no se compara con meses cerrados.
    const alCorte = corte > 0 ? mios.filter(c => Number(c.fecha.slice(8, 10)) <= corte) : [];
    const hasta_dia = corte > 0
      ? { dia: corte, cobros: alCorte.length, neto: r2(sum(alCorte, c => c.monto) - sum(alCorte, c => c.refund)) }
      : null;

    // Desglose corto (ViralADN / TOPCUT / Combo): los pagos únicos y los de
    // Elevation se suman a SU plataforma, si no el desglose no suma el total.
    const por_plataforma: Record<string, number> = {};
    for (const c of mios) {
      const k = c.plataforma === 'topcut' ? 'TOPCUT' : c.plataforma === 'combo' ? 'Combo' : c.plataforma === 'viraladn' ? 'ViralADN' : (c.producto || '—');
      por_plataforma[k] = r2((por_plataforma[k] || 0) + c.monto - c.refund);
    }

    return Response.json({
      mes,
      dias_del_mes: diasDelMes,
      ventana: `del 1 al último día de ${mes} (hora CDMX)`,
      moneda: 'USD liquidado (los cobros en otra moneda entran convertidos)',
      tuyo: {
        cobros: mios.length,
        bruto, reembolsado: devuelto, neto,
        por_cuenta: { clicks: deCuenta('2CLICKS'), elevation: { ...deCuenta('Elevation'), configurada: elevationConfigurada } },
        por_producto: porProducto,
        por_plataforma,
        de_donde_sale,
        mas_grandes,
        diario: diario.map(r2),
        ultimos,
        hasta_dia,
      },
      elevation_ajeno,
      otros_negocios: {
        cobros: otros.filter(c => c.cuenta === '2CLICKS').length,
        neto: r2(sum(otros.filter(c => c.cuenta === '2CLICKS'), c => c.monto) - sum(otros.filter(c => c.cuenta === '2CLICKS'), c => c.refund)),
      },
      csv: `/api/admin/export?type=ventas&mes=${mes}`,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
