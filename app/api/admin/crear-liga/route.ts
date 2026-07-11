import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { EVENT_CHECKOUT_PRICE, type ProductKey, type Ciclo } from '@/lib/products';

// GET /api/admin/crear-liga — crea LIGAS DE PAGO (Payment Links) en Stripe
// (cuenta de producción 2CLICKS, key en Vercel). Solo admin.
//
// Cada liga queda con:
//   · prueba gratis opcional (?trial=7): tarjeta hoy, $0; cobra sola al día 8
//   · redirect a /app/welcome (lo que ACTIVA el acceso al terminar el checkout)
//   · códigos promocionales habilitados
//   · metadata canal → sabés de qué comunidad vino cada venta
//
// Uso:
//   ?producto=combo&ciclo=monthly&trial=7&canal=comunidad  → una liga
//   ?todos=1&trial=7&canal=comunidad                       → las 9 (las que existan)
//
// OJO: cada llamada CREA una liga nueva en Stripe — guardá la URL que devuelve.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CICLOS: Ciclo[] = ['monthly', 'quarterly', 'yearly'];
const PRODUCTOS: ProductKey[] = ['viraladn', 'topcut', 'combo'];

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: 'Falta STRIPE_SECRET_KEY (2CLICKS).' }, { status: 503 });

  const sp = req.nextUrl.searchParams;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.viraladn.com').replace(/\/$/, '');
  const trial = Math.max(0, Math.min(30, parseInt(sp.get('trial') || '0', 10) || 0));
  const canal = (sp.get('canal') || 'comunidad').toLowerCase().slice(0, 40).replace(/[^a-z0-9_-]/g, '');
  const todos = sp.get('todos') === '1';

  async function crear(producto: ProductKey, ciclo: Ciclo) {
    const price = EVENT_CHECKOUT_PRICE[producto]?.[ciclo];
    if (!price) return { producto, ciclo, error: 'sin price id configurado' };
    const p = new URLSearchParams();
    p.append('line_items[0][price]', price);
    p.append('line_items[0][quantity]', '1');
    p.append('allow_promotion_codes', 'true');
    p.append('after_completion[type]', 'redirect');
    p.append('after_completion[redirect][url]', `${appUrl}/app/welcome?session_id={CHECKOUT_SESSION_ID}`);
    p.append('metadata[app]', 'viraladn');
    p.append('metadata[canal]', canal);
    p.append('subscription_data[metadata][app]', 'viraladn');
    p.append('subscription_data[metadata][canal]', canal);
    if (trial > 0) p.append('subscription_data[trial_period_days]', String(trial));
    const r = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: p.toString(),
    });
    const d = await r.json();
    if (!r.ok) return { producto, ciclo, error: d?.error?.message || `Stripe HTTP ${r.status}` };
    return { producto, ciclo, trial: trial || 'sin trial', url: d.url as string };
  }

  try {
    if (todos) {
      const out = [];
      for (const prod of PRODUCTOS) for (const cic of CICLOS) out.push(await crear(prod, cic));
      return Response.json({
        canal, trial,
        aviso: 'Ligas NUEVAS creadas en Stripe — guardá las URLs. El redirect a /app/welcome es lo que activa el acceso.',
        ligas: out,
      });
    }
    const producto = sp.get('producto') as ProductKey;
    const ciclo = (sp.get('ciclo') || 'monthly') as Ciclo;
    if (!PRODUCTOS.includes(producto)) {
      return Response.json({ error: 'Pasá ?producto=viraladn|topcut|combo (&ciclo=monthly|quarterly|yearly) o ?todos=1' }, { status: 400 });
    }
    if (!CICLOS.includes(ciclo)) return Response.json({ error: 'ciclo inválido' }, { status: 400 });
    const liga = await crear(producto, ciclo);
    return Response.json({ canal, ...liga, aviso: 'Liga NUEVA creada en Stripe — guardá la URL.' });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
