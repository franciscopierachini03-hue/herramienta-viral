import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';

// GET /api/admin/pagos-de?email=persona@x.com — TODOS los cobros de esa persona
// en LAS DOS cuentas de Stripe (2CLICKS + Elevation), últimos 90 días.
// Responde la pregunta "¿esta persona pagó de verdad, cuánto y dónde?" sin
// depender de cómo el panel clasifica (que ignora pagos únicos si hay sub).
// Solo admin. Busca por billing_details.email (Charges Search API).

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const r2 = (n: number) => Math.round(n * 100) / 100;

type Cuenta = { id: string; label: string; key: string | undefined };

function cuentas(): Cuenta[] {
  return [
    { id: 'clicks', label: '2CLICKS', key: process.env.STRIPE_SECRET_KEY },
    { id: 'elevation', label: 'Elevation', key: process.env.STRIPE_SECRET_KEY_ELEVATION },
  ];
}

type ChargeHit = {
  created: number; amount: number; amount_refunded?: number; currency: string; status: string;
  invoice?: string | null; description?: string | null; receipt_url?: string | null;
  payment_intent?: string | null; calculated_statement_descriptor?: string | null;
};

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  if (!email.includes('@')) return Response.json({ error: 'Pasá ?email=' }, { status: 400 });

  const out: Array<Record<string, unknown>> = [];
  for (const c of cuentas()) {
    if (!c.key) { out.push({ cuenta: c.label, error: 'sin llave configurada' }); continue; }
    try {
      const q = encodeURIComponent(`billing_details.email:'${email}'`);
      const r = await fetch(`https://api.stripe.com/v1/charges/search?query=${q}&limit=100`, {
        headers: { Authorization: `Bearer ${c.key}` }, cache: 'no-store',
      });
      const d = await r.json();
      if (!r.ok) { out.push({ cuenta: c.label, error: d?.error?.message || `HTTP ${r.status}` }); continue; }
      const cobros = ((d?.data || []) as ChargeHit[])
        .sort((a, b) => b.created - a.created)
        .map(ch => ({
          fecha_cdmx: new Date((ch.created - 6 * 3600) * 1000).toISOString().replace('T', ' ').slice(0, 16),
          monto: r2(ch.amount / 100),
          moneda: ch.currency.toUpperCase(),
          reembolsado: r2((ch.amount_refunded || 0) / 100),
          estado: ch.status,
          tipo: ch.invoice ? 'factura de SUSCRIPCIÓN' : 'PAGO ÚNICO (liga/checkout)',
          descripcion: ch.description || ch.calculated_statement_descriptor || null,
          recibo: ch.receipt_url || null,
        }));
      out.push({ cuenta: c.label, cobros: cobros.length, detalle: cobros });
    } catch (e) {
      out.push({ cuenta: c.label, error: (e as Error).message.slice(0, 150) });
    }
  }
  return Response.json({ email, ventana: 'últimos ~90 días (Stripe Search)', cuentas: out });
}
