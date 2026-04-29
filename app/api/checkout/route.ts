import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Crea una sesión de Stripe Checkout y devuelve la URL para redirigir al usuario.
//
// IMPORTANTE: requiere usuario logueado. Pasamos su email a Stripe como
// `customer_email` para:
//   1. Pre-rellenar el email en el checkout (mejor UX).
//   2. Que el webhook (o el verify post-pago) pueda matchear el pago al perfil.

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

  // Necesitamos el email del usuario logueado para vincular el pago.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return Response.json({
      error: 'Tenés que iniciar sesión antes de pagar.',
      redirect: '/login?next=/precios',
    }, { status: 401 });
  }

  // Stripe rechaza `mode=subscription` con prices de tipo `one_time` y viceversa.
  // Consultamos el price para elegir el mode correcto y soportar ambos casos.
  let mode: 'subscription' | 'payment' = 'subscription';
  try {
    const priceRes = await fetch(
      `https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`,
      { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' },
    );
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      mode = priceData?.type === 'recurring' ? 'subscription' : 'payment';
    }
  } catch (e) {
    console.warn('[checkout] price lookup failed, defaulting to subscription mode:', e);
  }

  const params = new URLSearchParams();
  params.append('mode', mode);
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('customer_email', user.email);
  params.append('client_reference_id', user.id);
  // Tras pagar, /app/welcome verifica el pago y activa la cuenta.
  params.append('success_url', `${appUrl}/app/welcome?session_id={CHECKOUT_SESSION_ID}`);
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
