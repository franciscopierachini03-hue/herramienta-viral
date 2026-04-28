import { NextRequest } from 'next/server';

// Crea una sesión de Stripe Checkout y devuelve la URL para redirigir al usuario.
// Requiere variables de entorno:
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_MONTHLY
//   STRIPE_PRICE_YEARLY
//   NEXT_PUBLIC_APP_URL (para success/cancel URLs)

export async function POST(req: NextRequest) {
  const { plan } = await req.json();

  const secret = process.env.STRIPE_SECRET_KEY;
  const priceMonthly = process.env.STRIPE_PRICE_MONTHLY;
  const priceYearly = process.env.STRIPE_PRICE_YEARLY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!secret) {
    return Response.json({
      error: 'Stripe no está configurado todavía. Falta STRIPE_SECRET_KEY en las variables de entorno.'
    }, { status: 500 });
  }

  const priceId = plan === 'yearly' ? priceYearly : priceMonthly;
  if (!priceId) {
    return Response.json({
      error: `Falta el price_id para el plan ${plan}. Configurá STRIPE_PRICE_${plan === 'yearly' ? 'YEARLY' : 'MONTHLY'} en .env.`
    }, { status: 500 });
  }

  // Stripe Checkout Session vía API REST (sin SDK para mantener bundle ligero).
  // Si querés más features, instalamos `stripe` npm package y usamos el SDK oficial.
  const params = new URLSearchParams();
  params.append('mode', 'subscription');
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('success_url', `${appUrl}/app?welcome=1&session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${appUrl}/precios?cancelled=1`);
  params.append('allow_promotion_codes', 'true');
  params.append('billing_address_collection', 'auto');
  params.append('phone_number_collection[enabled]', 'true');

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({
        error: data?.error?.message || 'Stripe rechazó la solicitud.',
      }, { status: 502 });
    }

    return Response.json({ url: data.url });
  } catch (e) {
    return Response.json({
      error: `Error de conexión con Stripe: ${(e as Error).message}`
    }, { status: 502 });
  }
}
