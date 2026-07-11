import { getAccess } from '@/lib/access';
import { EVENT_AMOUNTS, type ProductKey, type Ciclo } from '@/lib/products';

// GET /api/admin/elevation-check — radiografía de la cuenta Elevation. Solo admin.
//
// Confirma: (1) a qué cuenta apunta STRIPE_SECRET_KEY_ELEVATION (nombre), y
// (2) cuáles de los 9 planes del catálogo YA existen allá (detección por
// monto+intervalo, la misma que usa el checkout de /unete). Lo que figure
// "falta" es un precio que hay que crear en Elevation con ese monto exacto.

export const dynamic = 'force-dynamic';

export async function GET() {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const key = (process.env.STRIPE_SECRET_KEY_ELEVATION || '').trim();
  if (!key) return Response.json({ error: 'Falta STRIPE_SECRET_KEY_ELEVATION en Vercel.' }, { status: 503 });

  try {
    const auth = { Authorization: `Bearer ${key}` };
    const acct = await (await fetch('https://api.stripe.com/v1/account', { headers: auth, cache: 'no-store' })).json();
    const nombre = acct?.settings?.dashboard?.display_name || acct?.business_profile?.name || acct?.id || '?';

    const pr = await (await fetch('https://api.stripe.com/v1/prices?active=true&type=recurring&limit=100', { headers: auth, cache: 'no-store' })).json();
    const lista = (pr?.data || []) as Array<{ id: string; currency?: string; unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null }>;

    const planes: Array<{ plan: string; monto: string; estado: string }> = [];
    for (const producto of Object.keys(EVENT_AMOUNTS) as ProductKey[]) {
      for (const ciclo of Object.keys(EVENT_AMOUNTS[producto]) as Ciclo[]) {
        const amount = EVENT_AMOUNTS[producto][ciclo];
        const interval = ciclo === 'yearly' ? 'year' : 'month';
        const count = ciclo === 'quarterly' ? 3 : 1;
        const hit = lista.find(p => p.currency === 'usd' && p.unit_amount === amount
          && p.recurring?.interval === interval && (p.recurring?.interval_count || 1) === count);
        planes.push({
          plan: `${producto} ${ciclo === 'monthly' ? 'mensual' : ciclo === 'quarterly' ? 'trimestral' : 'anual'}`,
          monto: `USD $${amount / 100}${ciclo === 'quarterly' ? ' cada 3 meses' : ciclo === 'yearly' ? '/año' : '/mes'}`,
          estado: hit ? `✅ listo (${hit.id})` : '❌ FALTA crearlo en Elevation con ese monto exacto',
        });
      }
    }
    const listos = planes.filter(p => p.estado.startsWith('✅')).length;
    return Response.json({
      cuenta: nombre,
      esElevation: /elevation/i.test(String(nombre)) ? 'sí' : `⚠️ revisá: la key apunta a "${nombre}"`,
      planesListos: `${listos}/9`,
      planes,
      nota: 'Para habilitar un plan que falta: en Elevation creá un precio recurrente USD con ese monto (bajo cualquier producto). Se detecta solo — sin pegar ids.',
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
