import { createServiceClient } from '@/lib/supabase/server';

// GET /api/founders-count
//
// Devuelve { taken, total, remaining } para el contador de cupos de fundadores.
//
// taken     = clientes pagos reales (active + trialing) + baseline opcional
// total     = process.env.FOUNDER_TOTAL_SPOTS (default 50)
// remaining = total - taken, capeado a [0, total]
//
// El baseline (FOUNDER_BASELINE_TAKEN) sirve para que el contador no arranque
// en "50 disponibles" cuando lanzas — puedes ponerlo en, ej, 18 y el contador
// va a mostrar "Quedan 32 lugares" desde el primer día. Si después se suman
// clientes pagos, baja proporcional.
//
// Cache de 5 min a nivel ISR para no martillar Supabase.

export const revalidate = 300;

export async function GET() {
  const total = parseInt(process.env.FOUNDER_TOTAL_SPOTS || '50', 10);
  const baseline = parseInt(process.env.FOUNDER_BASELINE_TAKEN || '0', 10);

  let paidCount = 0;
  try {
    const admin = createServiceClient();
    const { count, error } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('subscription_status', ['active', 'trialing']);
    if (!error && typeof count === 'number') paidCount = count;
  } catch (e) {
    console.warn('[founders-count]', e);
  }

  const taken = Math.max(0, paidCount + baseline);
  const remaining = Math.max(0, Math.min(total, total - taken));

  return Response.json({
    taken: Math.min(total, taken),
    total,
    remaining,
  }, {
    headers: {
      // CDN cache: 5 min, revalidate stale-while-revalidate 1 min
      'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
    },
  });
}
