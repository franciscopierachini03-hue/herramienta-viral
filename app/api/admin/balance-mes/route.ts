import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { cobrosRango, type CobroRango } from '@/lib/ventas-stripe';

// GET /api/admin/balance-mes?mes=YYYY-MM — BALANCE DE VERDAD de un mes calendario.
// Suma LAS DOS cuentas (2CLICKS clasificada + Elevation completa) + pagos únicos,
// en USD liquidado y NETO de reembolsos. Es la misma base del CSV de ventas, así
// que los números cuadran entre el panel, el export y Stripe.
// Sin ?mes= = mes actual (hora CDMX).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const q = (req.nextUrl.searchParams.get('mes') || '').trim();
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' }).format(new Date());
  const mes = /^\d{4}-\d{2}$/.test(q) ? q : hoy;
  const [y, m] = mes.split('-').map(Number);
  const desde = Math.floor(Date.UTC(y, m - 1, 1, 6, 0, 0) / 1000);   // 1° 00:00 CDMX
  const hasta = Math.floor(Date.UTC(y, m, 1, 6, 0, 0) / 1000);       // 1° del siguiente

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
    const mas_grandes = [...mios]
      .sort((a, b) => (b.monto - b.refund) - (a.monto - a.refund))
      .slice(0, 12)
      .map(c => ({
        fecha: c.fecha, email: c.email, nombre: c.nombre,
        neto: r2(c.monto - c.refund), producto: c.producto,
        cuenta: c.cuenta, motivo: c.motivo,
        moneda: c.monedaOriginal !== 'USD' ? `${c.montoOriginal} ${c.monedaOriginal}` : '',
        recibo: c.recibo,
      }));

    return Response.json({
      mes,
      ventana: `del 1 al último día de ${mes} (hora CDMX)`,
      moneda: 'USD liquidado (los cobros en otra moneda entran convertidos)',
      tuyo: {
        cobros: mios.length,
        bruto, reembolsado: devuelto, neto,
        por_cuenta: { clicks: deCuenta('2CLICKS'), elevation: { ...deCuenta('Elevation'), configurada: elevationConfigurada } },
        por_producto: porProducto,
        de_donde_sale,
        mas_grandes,
      },
      otros_negocios: { cobros: otros.length, neto: r2(sum(otros, c => c.monto) - sum(otros, c => c.refund)) },
      csv: `/api/admin/export?type=ventas&mes=${mes}`,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
