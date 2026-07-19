import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';

// /api/admin/cancelar-suscripcion — cortar el cobro recurrente de una cuenta.
// Solo admin. Busca en LAS DOS cuentas de Stripe (2CLICKS + Elevation) porque
// las suscripciones viven repartidas entre ambas.
//
//   GET                       → { adminEmails }  (para los chips de acceso rápido)
//   GET ?email=persona@x.com  → { email, isAdmin, cuentas:[{cuenta, subs:[...]}] }
//   POST { subscriptionId, cuenta } → cancela ESA suscripción (corte inmediato)
//
// El corte es inmediato (DELETE): deja de facturar desde ya. Para un admin no
// afecta el acceso — eso lo da ADMIN_EMAILS, no la suscripción (ver lib/access).

export const dynamic = 'force-dynamic';

type Cuenta = { id: 'viraladn' | 'elevation'; label: string; key: string | undefined };

function cuentas(): Cuenta[] {
  return [
    { id: 'viraladn', label: '2CLICKS / ViralADN', key: process.env.STRIPE_SECRET_KEY },
    { id: 'elevation', label: 'Elevation', key: process.env.STRIPE_SECRET_KEY_ELEVATION },
  ];
}

function adminEmailList(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

const money = (c?: number | null) => (c == null ? null : Math.round(c) / 100);
const day = (t?: number | null) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : null);

type StripeSub = {
  id: string; status: string; cancel_at_period_end?: boolean;
  current_period_end?: number; trial_end?: number;
  items?: { data?: Array<{ price?: { unit_amount?: number | null; currency?: string; recurring?: { interval?: string } | null; nickname?: string | null } }> };
};

async function subsDeCuenta(c: Cuenta, email: string) {
  if (!c.key) return null;
  const auth = { Authorization: `Bearer ${c.key}` };
  // Puede haber más de un cliente con el mismo email → los recorremos todos.
  const rc = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=100`, { headers: auth, cache: 'no-store' });
  const dc = await rc.json();
  const custs: Array<{ id: string }> = dc?.data || [];
  if (!custs.length) return { cuenta: c.label, id: c.id, subs: [] as unknown[] };

  const subs: Array<Record<string, unknown>> = [];
  for (const cust of custs) {
    const rs = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(cust.id)}&status=all&limit=20`, { headers: auth, cache: 'no-store' });
    const ds = await rs.json();
    for (const s of (ds?.data || []) as StripeSub[]) {
      const price = s.items?.data?.[0]?.price;
      const iv = price?.recurring?.interval;
      subs.push({
        id: s.id,
        cuenta: c.id,
        cuentaLabel: c.label,
        customer: cust.id,
        status: s.status,                                  // active / trialing / past_due / canceled …
        cancelaAlFinal: !!s.cancel_at_period_end,
        monto: money(price?.unit_amount),
        moneda: (price?.currency || '').toUpperCase(),
        ciclo: iv === 'year' ? 'anual' : iv === 'month' ? 'mensual' : (iv || '—'),
        nombre: price?.nickname || null,
        proximoCobro: day(s.current_period_end),
        // ¿se le puede cortar el cobro? (las ya canceladas, no)
        cancelable: ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status),
      });
    }
  }
  return { cuenta: c.label, id: c.id, subs };
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  // Sin email → solo devolvemos los correos admin (para los chips de un toque).
  if (!email) return Response.json({ adminEmails: adminEmailList() });
  if (!email.includes('@')) return Response.json({ error: 'Email inválido.' }, { status: 400 });

  try {
    const porCuenta = await Promise.all(cuentas().map(c => subsDeCuenta(c, email)));
    const activas = cuentas().filter(c => c.key).map(c => c.label);
    return Response.json({
      email,
      isAdmin: adminEmailList().includes(email),
      cuentasConsultadas: activas,
      cuentas: porCuenta.filter(Boolean),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const { admin, email: adminEmail } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const subscriptionId = String(body.subscriptionId || '').trim();
  const cuentaId = String(body.cuenta || '').trim();

  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) {
    return Response.json({ error: 'ID de suscripción inválido.' }, { status: 400 });
  }
  const c = cuentas().find(x => x.id === cuentaId);
  if (!c) return Response.json({ error: 'Cuenta desconocida.' }, { status: 400 });
  if (!c.key) return Response.json({ error: `Falta la llave de Stripe de ${c.label}.` }, { status: 503 });

  try {
    // Corte inmediato del cobro recurrente.
    const r = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${c.key}` },
      cache: 'no-store',
    });
    const d = await r.json();
    if (!r.ok) return Response.json({ error: d?.error?.message || `Stripe HTTP ${r.status}` }, { status: 502 });

    console.log(`[cancelar-suscripcion] ${adminEmail} canceló ${subscriptionId} en ${c.label} → ${d.status}`);
    return Response.json({ ok: true, id: subscriptionId, cuenta: c.label, status: d.status });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
