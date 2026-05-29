import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// POST /api/billing/portal
//
// Crea una sesión del Stripe Customer Portal para que el usuario pueda:
// - Ver su facturación
// - Cambiar método de pago
// - Cancelar suscripción
// - Descargar facturas
//
// Devuelve { url } al portal — el cliente redirige.

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return Response.json({ error: 'Tenés que iniciar sesión.' }, { status: 401 });
  }

  // Buscar el customer + subscription de ViralADN en profiles.
  const admin = createServiceClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('email', user.email)
    .maybeSingle();

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return Response.json({ error: 'Stripe no está configurado.' }, { status: 500 });
  }

  // IMPORTANTE: solo usamos el customer_id que guardamos cuando la persona PAGÓ
  // ViralADN (lo setea /app/welcome). NO buscamos por email en Stripe, porque
  // la cuenta de Stripe es compartida (2CLICKS.COM LLC) y una búsqueda por email
  // puede devolver el cliente de OTRO producto (ej: una vieja suscripción a
  // 2Clicks), abriendo el portal equivocado.
  const customerId = profile?.stripe_customer_id || null;

  // Sin customer de ViralADN (ej: activó por código de invitación / cortesía)
  // → no hay suscripción Stripe que gestionar.
  if (!customerId || !profile?.stripe_subscription_id) {
    return Response.json({
      error: 'Tu acceso no tiene una suscripción de pago en Stripe (entraste con código o cortesía). No hay nada que gestionar acá.',
      redirect: '/cuenta',
    }, { status: 404 });
  }

  // Crear sesión del Customer Portal
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const params = new URLSearchParams();
  params.append('customer', customerId);
  params.append('return_url', `${appUrl}/cuenta`);

  try {
    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[billing/portal]', data);
      return Response.json({
        error: data?.error?.message || 'No pudimos abrir el portal de facturación.',
      }, { status: 502 });
    }
    return Response.json({ url: data.url });
  } catch (e) {
    return Response.json({
      error: `Error de conexión con Stripe: ${(e as Error).message}`,
    }, { status: 502 });
  }
}
