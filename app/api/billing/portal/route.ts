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

  // Buscar stripe_customer_id en profiles
  const admin = createServiceClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, subscription_status')
    .eq('email', user.email)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id || null;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return Response.json({ error: 'Stripe no está configurado.' }, { status: 500 });
  }

  // Si no hay customer_id en nuestro perfil, intentamos buscarlo en Stripe por email
  if (!customerId) {
    try {
      const search = await fetch(
        `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=1`,
        { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' },
      );
      if (search.ok) {
        const data = await search.json();
        if (data.data?.[0]?.id) {
          customerId = data.data[0].id;
          // Guardar para próxima vez
          await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('email', user.email);
        }
      }
    } catch (e) {
      console.warn('[billing/portal] customer lookup failed:', (e as Error).message);
    }
  }

  if (!customerId) {
    return Response.json({
      error: 'No encontramos tu cuenta de Stripe. Si todavía no pagaste, suscribite primero en /precios.',
      redirect: '/precios',
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
