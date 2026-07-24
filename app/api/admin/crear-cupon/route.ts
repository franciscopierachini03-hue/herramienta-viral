import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';

// GET /api/admin/crear-cupon — crea el cupón "-$X el primer mes" + su código
// promocional en Stripe (cuenta de producción 2CLICKS, key en Vercel). Solo admin.
//
// El cupón es duration:'once' → descuenta SOLO la primera factura de la
// suscripción; desde el mes 2 se cobra el precio completo (el MRR no se toca).
//
// Uso:
//   /api/admin/crear-cupon                    → -$20, código ARRANCA20
//   /api/admin/crear-cupon?monto=20&code=MIC0DIGO
//
// Idempotente: si el código ya existe, lo devuelve (no duplica).
// El código funciona en el checkout web (allow_promotion_codes) y en las ligas.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: 'Falta STRIPE_SECRET_KEY (2CLICKS).' }, { status: 503 });
  const auth = { Authorization: `Bearer ${key}` };

  const sp = req.nextUrl.searchParams;
  const monto = Math.max(1, Math.min(100, parseInt(sp.get('monto') || '20', 10) || 20));
  const code = (sp.get('code') || `ARRANCA${monto}`).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
  if (!code) return Response.json({ error: 'Código inválido.' }, { status: 400 });

  try {
    // ¿Ya existe el código? → devolverlo (idempotente).
    const rq = await fetch(`https://api.stripe.com/v1/promotion_codes?code=${encodeURIComponent(code)}&limit=1`, { headers: auth, cache: 'no-store' });
    const dq = await rq.json();
    const existente = (dq?.data || [])[0];
    if (existente) {
      return Response.json({
        ok: true, yaExistia: true, code: existente.code, activo: existente.active,
        resumen: `El código ${existente.code} ya existía — listo para usar en el checkout.`,
      });
    }

    // 1) Cupón: -$monto una sola vez (la primera factura).
    const cuponParams = new URLSearchParams({
      amount_off: String(monto * 100),
      currency: 'usd',
      duration: 'once',
      name: `-$${monto} el primer mes`,
    });
    const rc = await fetch('https://api.stripe.com/v1/coupons', { method: 'POST', headers: auth, body: cuponParams });
    const dc = await rc.json();
    if (!rc.ok) return Response.json({ error: dc?.error?.message || `Stripe cupón HTTP ${rc.status}` }, { status: 502 });

    // 2) Código promocional legible para escribir en el checkout.
    const promoParams = new URLSearchParams({ coupon: dc.id, code });
    const rp = await fetch('https://api.stripe.com/v1/promotion_codes', { method: 'POST', headers: auth, body: promoParams });
    const dp = await rp.json();
    if (!rp.ok) return Response.json({ error: dp?.error?.message || `Stripe promo HTTP ${rp.status}` }, { status: 502 });

    return Response.json({
      ok: true, code: dp.code, cuponId: dc.id,
      resumen: `Listo: el código ${dp.code} descuenta $${monto} SOLO en el primer cobro (después precio completo). Compartilo o escribilo en el campo "código promocional" del checkout.`,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
