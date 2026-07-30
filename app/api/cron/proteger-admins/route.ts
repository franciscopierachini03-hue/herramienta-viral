import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';

// 🛡️ PROTECCIÓN ADMIN — "a los correos admin no se les cobra NADA, nunca".
// Recorre ADMIN_EMAILS en LAS DOS cuentas de Stripe y CANCELA (corte inmediato)
// cualquier suscripción cobrable que encuentre (active/trialing/past_due/unpaid).
// Corre todos los días desde /api/cron/daily; también se puede disparar a mano
// (admin logueado). ?dry=1 = solo mirar, sin cancelar. Avisa por email al dueño
// cuando cancela algo — nada pasa en silencio.
//
// Contexto: Francisco (18 y 30-jul): "a franciscopierachini03@ no le tienes que
// cobrar nada". Las suscripciones de prueba renacían y el corte manual quedaba
// pendiente → regla automática donde viven las llaves (Vercel).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PERMANENT_OWNERS = ['franciscopierachini03@gmail.com'];
const OWNER = 'franciscopierachini03@gmail.com';

function adminEmails(): string[] {
  const env = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return [...new Set([...PERMANENT_OWNERS, ...env])];
}

function esCron(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  return (req.headers.get('user-agent') || '').includes('vercel-cron');
}

type SubLite = {
  id: string; status: string; cancel_at_period_end?: boolean;
  items?: { data?: Array<{ price?: { unit_amount?: number | null; currency?: string; recurring?: { interval?: string } | null } }> };
};

const CANCELABLES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!esCron(req) && !admin) return Response.json({ error: 'No autorizado.' }, { status: 401 });

  const dry = req.nextUrl.searchParams.get('dry') === '1';
  const cuentas = [
    { label: '2CLICKS', key: process.env.STRIPE_SECRET_KEY },
    { label: 'Elevation', key: process.env.STRIPE_SECRET_KEY_ELEVATION },
  ].filter(c => c.key);

  const canceladas: Array<{ email: string; cuenta: string; sub: string; monto: string }> = [];
  const errores: string[] = [];

  for (const cuenta of cuentas) {
    const auth = { Authorization: `Bearer ${cuenta.key}` };
    for (const email of adminEmails()) {
      try {
        const rc = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=100`, { headers: auth, cache: 'no-store' });
        const dc = await rc.json();
        for (const cust of (dc?.data || []) as Array<{ id: string }>) {
          const rs = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(cust.id)}&status=all&limit=20`, { headers: auth, cache: 'no-store' });
          const ds = await rs.json();
          for (const s of (ds?.data || []) as SubLite[]) {
            if (!CANCELABLES.has(s.status)) continue;
            const price = s.items?.data?.[0]?.price;
            const monto = price?.unit_amount != null
              ? `${(price.unit_amount / 100).toFixed(2)} ${(price.currency || '').toUpperCase()}/${price.recurring?.interval || 'mes'}`
              : '—';
            if (!dry) {
              const rd = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(s.id)}`, { method: 'DELETE', headers: auth, cache: 'no-store' });
              if (!rd.ok) {
                const b = await rd.json().catch(() => ({}));
                errores.push(`${cuenta.label} ${s.id}: ${(b as { error?: { message?: string } })?.error?.message || rd.status}`);
                continue;
              }
            }
            canceladas.push({ email, cuenta: cuenta.label, sub: s.id, monto });
            console.log(`[proteger-admins] ${dry ? '(dry) ' : ''}cancelada ${s.id} (${monto}) de ${email} en ${cuenta.label}`);
          }
        }
      } catch (e) {
        errores.push(`${cuenta.label} ${email}: ${(e as Error).message.slice(0, 100)}`);
      }
    }
  }

  // Aviso al dueño cuando se cancela algo — que nada pase en silencio.
  if (!dry && canceladas.length && process.env.RESEND_API_KEY) {
    try {
      const filas = canceladas.map(c => `<li><b>${c.email}</b> · ${c.cuenta} · ${c.monto} · <span style="font-family:monospace">${c.sub}</span></li>`).join('');
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'ViralADN <hola@viraladn.com>',
          to: OWNER,
          subject: `🛡️ Protección admin: ${canceladas.length} suscripción(es) cancelada(s)`,
          html: `<p>El guardián encontró y cortó cobros a correos admin:</p><ul>${filas}</ul><p style="color:#888;font-size:12px">Regla: a los correos de ADMIN_EMAILS no se les cobra nada. Corre a diario.</p>`,
        }),
      });
    } catch { /* la alerta es best-effort */ }
  }

  return Response.json({ ok: true, dry, revisados: adminEmails().length, cuentas: cuentas.map(c => c.label), canceladas, errores });
}
