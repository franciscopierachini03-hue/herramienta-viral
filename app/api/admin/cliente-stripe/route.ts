import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';

// GET /api/admin/cliente-stripe?email=...  (o ?customer=cus_...)
// Inspecciona en Stripe (cuenta de producción = 2CLICKS) la suscripción de un
// cliente: trial, fechas del período, y sobre todo el CUPÓN/promo que aplicó
// con su DURACIÓN — que es lo que decide cuántos días gratis tiene. Solo admin.
//
// Sirve para responder "¿por qué esta persona tiene más de 30 días gratis?":
// casi siempre es un promotion_code con duration 'repeating' de varios meses.

export const dynamic = 'force-dynamic';

const money = (c?: number | null) => (c == null ? null : Math.round(c) / 100);
const day = (t?: number | null) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : null);

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: 'Falta STRIPE_SECRET_KEY.' }, { status: 503 });
  const auth = { Authorization: `Bearer ${key}` };

  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  let customerId = (req.nextUrl.searchParams.get('customer') || '').trim();

  try {
    if (!customerId) {
      if (!email) return Response.json({ error: 'Pasá ?email= o ?customer=' }, { status: 400 });
      const r = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, { headers: auth, cache: 'no-store' });
      const d = await r.json();
      const c = (d.data || [])[0];
      if (!c) return Response.json({ email, encontrado: false, nota: 'No hay cliente con ese email en esta cuenta de Stripe.' });
      customerId = c.id;
    }

    const r = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10&expand[]=data.discount.coupon`,
      { headers: auth, cache: 'no-store' },
    );
    const d = await r.json();
    if (!r.ok) return Response.json({ error: d?.error?.message || `Stripe HTTP ${r.status}` }, { status: 502 });

    const ahora = Date.now() / 1000;
    const subs = (d.data || []).map((sub: Record<string, unknown>) => {
      const cup = (sub.discount as { coupon?: Record<string, unknown> })?.coupon;
      const it = (sub.items as { data?: Array<{ price?: { unit_amount?: number; recurring?: { interval?: string } } }> })?.data?.[0];
      const periodEnd = sub.current_period_end as number | undefined;
      // Días "gratis": desde ahora hasta el primer cobro pagado (fin del descuento).
      const finGratis = (sub.trial_end as number) || periodEnd || 0;
      const diasGratisRestantes = finGratis > ahora ? Math.round((finGratis - ahora) / 86400) : 0;
      return {
        status: sub.status,
        precio: money(it?.price?.unit_amount),
        ciclo: it?.price?.recurring?.interval === 'year' ? 'anual' : 'mensual',
        trial_end: day(sub.trial_end as number),
        periodo_actual: `${day(sub.current_period_start as number)} → ${day(periodEnd)}`,
        proximo_cobro: day(periodEnd),
        dias_gratis_restantes: diasGratisRestantes,
        cancela_al_final: !!sub.cancel_at_period_end,
        cupon: cup ? {
          nombre: cup.name || cup.id,
          duracion: cup.duration,                       // 'once' | 'repeating' | 'forever'
          meses: cup.duration_in_months ?? null,        // ← si es repeating, cuántos MESES gratis
          descuento: cup.percent_off ? `${cup.percent_off}%` : cup.amount_off ? `$${money(cup.amount_off as number)}` : '—',
        } : null,
      };
    });

    // Diagnóstico legible del "por qué".
    let porque = 'Sin suscripción con descuento — no debería figurar como mes de prueba.';
    const conCupon = subs.find((s: { cupon: unknown }) => s.cupon);
    if (conCupon?.cupon) {
      const c = conCupon.cupon as { duracion: string; meses: number | null; descuento: string };
      if (c.duracion === 'forever') porque = `⚠️ El cupón "${(c as { nombre?: string }).nombre}" es de duración FOREVER (${c.descuento}) → gratis para siempre. Revisar si es intencional.`;
      else if (c.duracion === 'repeating' && (c.meses ?? 1) > 1) porque = `El cupón da ${c.descuento} durante ${c.meses} MESES (repeating) → por eso tiene más de 30 días gratis. Es por diseño del código.`;
      else porque = `El cupón da ${c.descuento} por 1 período (${c.duracion}). El "mes de prueba" cuenta desde que activó el código, no desde que se registró.`;
    }

    return Response.json({ email, customer: customerId, porque, subs });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
