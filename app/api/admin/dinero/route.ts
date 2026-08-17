import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { getDinero } from '@/lib/dinero';

// GET /api/admin/dinero?mes=YYYY-MM — TODA la plata del panel en una llamada:
// cobrado hoy · este mes · mes pasado · acumulado · histórico · ingreso diario ·
// últimos cobros. Fuente única (lib/dinero → cobrosRango): las 2 cuentas, pagos
// únicos incluidos, USD liquidado y neto de reembolsos.
//
// Vive aparte de /admin a propósito: escanear los cobros DENTRO del render de la
// página la tumbaba por timeout (60s) al competir con la lectura de
// suscripciones. Acá el escaneo tiene el presupuesto entero para él solo y el
// panel abre al instante mientras esto carga.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const t0 = Date.now();
  const mes = (req.nextUrl.searchParams.get('mes') || '').trim();
  const d = await getDinero(mes);
  console.log(`[admin/dinero] ${mes || 'mes actual'} · ${Date.now() - t0}ms · ${d.acumulado.cobros} cobros${d.error ? ` · ERROR ${d.error}` : ''}`);
  return Response.json(d);
}
