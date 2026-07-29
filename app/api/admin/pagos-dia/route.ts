import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { cobrosRango, type CobroRango } from '@/lib/ventas-stripe';

// GET /api/admin/pagos-dia?fecha=YYYY-MM-DD — qué pagos (cobros) entraron ese día.
// Fuente única: lib/ventas-stripe (2CLICKS clasificada + Elevation completa,
// USD liquidado, hora CDMX). El export mensual usa la MISMA base → cuadran.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const r2 = (n: number) => Math.round(n * 100) / 100;

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

  const { desde, hasta, dia } = dayWindow((req.nextUrl.searchParams.get('fecha') || '').trim());

  try {
    const { cobros, elevationConfigurada } = await cobrosRango(desde, hasta);

    const ok = cobros.filter(c => c.estado === 'succeeded');
    const tuyos = ok.filter(c => c.viralAdn).sort((a, b) => a.ts - b.ts);
    const otros = ok.filter(c => !c.viralAdn);
    const sumB = (arr: CobroRango[]) => r2(arr.reduce((a, c) => a + c.monto, 0));
    const sumR = (arr: CobroRango[]) => r2(arr.reduce((a, c) => a + c.refund, 0));
    const neto = (arr: CobroRango[]) => r2(sumB(arr) - sumR(arr));
    const deCuenta = (arr: CobroRango[], cta: CobroRango['cuenta']) => arr.filter(c => c.cuenta === cta);

    return Response.json({
      fecha: dia,
      zona: 'hora Ciudad de México',
      tuyo_viraladn: {
        cobros: tuyos.length,
        bruto: sumB(tuyos), reembolsado: sumR(tuyos), neto: neto(tuyos),
        total: neto(tuyos), // compat: total = neto (lo que quedó cobrado)
        detalle: tuyos,
        por_cuenta: {
          clicks: { cobros: deCuenta(tuyos, '2CLICKS').length, neto: neto(deCuenta(tuyos, '2CLICKS')) },
          elevation: { cobros: deCuenta(tuyos, 'Elevation').length, neto: neto(deCuenta(tuyos, 'Elevation')), configurada: elevationConfigurada },
        },
      },
      otros_negocios: { cobros: otros.length, total: neto(otros), bruto: sumB(otros), reembolsado: sumR(otros) },
      reembolsos_del_dia: cobros.filter(c => c.refund > 0).length,
      reembolsado_total: r2(sumR(tuyos)),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
