import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { sincronizar } from '@/lib/libro-cobros';

// GET /api/admin/sincronizar-cobros — llena el LIBRO desde Stripe.
//
//   ?mes=2026-06        un mes puntual
//   ?desde=2026-01&hasta=2026-08   varios meses (hasta incluido)
//   sin parámetros      el mes en curso
//
// Es idempotente: correrlo mil veces sobre el mismo rango deja el mismo
// resultado (la llave es el charge_id). Y RESPETA las filas que marcaste a mano
// con excluir=true: nunca las pisa.
//
// Va MES POR MES a propósito: un escaneo de todo el historial de una no entra
// en los 60s de Vercel (ya nos pasó). Cada mes entra holgado.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const mesValido = (s: string) => /^\d{4}-\d{2}$/.test(s);
const inicioMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, 1, 6, 0, 0) / 1000);  // 1° 00:00 CDMX
};
const finMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  return Math.floor(Date.UTC(y, m, 1, 6, 0, 0) / 1000);
};
function listaMeses(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const [dy, dm] = desde.split('-').map(Number);
  const [hy, hm] = hasta.split('-').map(Number);
  for (let y = dy, m = dm; (y < hy || (y === hy && m <= hm)) && out.length < 36;) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

// Lo llama el cron diario además del admin logueado.
function esCron(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  return (req.headers.get('user-agent') || '').includes('vercel-cron');
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!esCron(req) && !admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' }).format(new Date());
  const uno = (sp.get('mes') || '').trim();
  const desde = (sp.get('desde') || '').trim();
  const hasta = (sp.get('hasta') || '').trim();

  let meses: string[];
  if (mesValido(uno)) meses = [uno];
  else if (mesValido(desde)) meses = listaMeses(desde, mesValido(hasta) ? hasta : hoy);
  else meses = [hoy];

  // Los meses van EN PARALELO, en tandas. Uno detrás de otro tardaba ~17s por
  // mes (la cuenta 2CLICKS es compartida: hay que barrer cientos de cobros
  // ajenos para encontrar los nuestros) y 3 meses ya se comían los 60s.
  // En tandas de 4 el reloj es el del mes más lento, no la suma.
  const TANDA = 4;
  const detalle: Record<string, unknown> = {};
  let totalEscritos = 0;
  const t0 = Date.now();

  for (let i = 0; i < meses.length; i += TANDA) {
    // Si no alcanza el tiempo para otra tanda, cortamos y decimos QUÉ faltó —
    // nunca en silencio (mejor un parcial declarado que un 504 mudo).
    if (i > 0 && Date.now() - t0 > 35_000) {
      const faltan = meses.slice(i);
      detalle.corte = `Se acabó el tiempo. Faltaron: ${faltan.join(', ')}. Volvé a llamar con ?desde=${faltan[0]}`;
      break;
    }
    const tanda = meses.slice(i, i + TANDA);
    const rs = await Promise.all(tanda.map(m => sincronizar(inicioMes(m), finMes(m))));
    tanda.forEach((mes, j) => {
      const r = rs[j];
      if (r.error) { detalle[mes] = `error: ${r.error}`; return; }
      // Un mes en cero se explica solo: ¿no hubo movimiento, o lo hubo y nada
      // era tuyo? Así no hay que abrir Stripe para entenderlo.
      detalle[mes] = r.escritos > 0
        ? `${r.escritos} cobros tuyos${r.respetados ? ` · ${r.respetados} excluidos a mano, respetados` : ''}`
        : r.enLaCuenta === 0 && r.elevation === 0
          ? 'sin movimiento en Stripe ese mes'
          : `0 tuyos · ${r.ajenos} de otros negocios${r.elevation ? ` · ${r.elevation} de Elevation (no es tu plata)` : ''}`;
      totalEscritos += r.escritos;
    });
  }

  return Response.json({
    ok: true,
    meses: meses.length,
    cobros_en_el_libro: totalEscritos,
    segundos: Math.round((Date.now() - t0) / 1000),
    detalle,
  });
}
