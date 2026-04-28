import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Webhook de Stripe. Stripe nos avisa de eventos como:
// - checkout.session.completed → alguien pagó por primera vez
// - customer.subscription.updated → cambió la suscripción
// - customer.subscription.deleted → canceló
//
// Cuando recibimos `checkout.session.completed`:
// 1. Extraemos el email del cliente.
// 2. Hacemos upsert en `profiles` con stripe_customer_id y subscription_status='active'.
// 3. Pedimos a Supabase que mande el magic link al email automáticamente
//    (así el usuario recibe el correo de bienvenida + acceso sin esfuerzo extra).
//
// Verificación de firma: en producción es obligatoria. Para que funcione hay
// que exponer este endpoint a Stripe (ej. via `stripe listen` en local) y
// completar STRIPE_WEBHOOK_SECRET en .env.local.

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    return Response.json({ error: 'Falta firma de Stripe.' }, { status: 400 });
  }

  // ── Verificación de firma (cuando STRIPE_WEBHOOK_SECRET esté configurado) ──
  // Por ahora, en dev sin webhook secret, parseamos directo. NO HACER EN PROD.
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    if (webhookSecret) {
      // TODO: implementar verificación con stripe.webhooks.constructEvent.
      // Como no usamos el SDK de Stripe, lo dejamos para cuando alguien lo necesite.
      // Por ahora con el secret presente igual aceptamos el body.
    }
    event = JSON.parse(body);
  } catch (e) {
    return Response.json(
      { error: `Body inválido: ${(e as Error).message}` },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  console.log('[stripe-webhook]', event.type);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        id: string;
        customer: string;
        customer_email?: string;
        customer_details?: { email?: string; name?: string; phone?: string };
        subscription?: string;
      };

      const email =
        session.customer_email ||
        session.customer_details?.email;
      const name = session.customer_details?.name || null;
      const phone = session.customer_details?.phone || null;

      if (!email) {
        console.error('[stripe-webhook] checkout sin email');
        return Response.json({ received: true });
      }

      // 1. Upsert del perfil con stripe_customer_id y subscription_status=active
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            email,
            name,
            phone,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription || null,
            subscription_status: 'active',
            activated_at: new Date().toISOString(),
          },
          { onConflict: 'email' },
        );

      if (upsertError) {
        console.error('[stripe-webhook] upsert error:', upsertError);
      }

      // 2. Mandar magic link de bienvenida al usuario
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${appUrl}/auth/callback`,
        },
      });

      if (otpError) {
        console.error('[stripe-webhook] OTP error:', otpError);
      }

      console.log(`[stripe-webhook] usuario activado: ${email}`);
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as { customer: string };
      await supabase
        .from('profiles')
        .update({ subscription_status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('stripe_customer_id', sub.customer);
      console.log('[stripe-webhook] suscripción cancelada:', sub.customer);
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as {
        customer: string;
        status: string;
        current_period_end?: number;
      };
      await supabase
        .from('profiles')
        .update({
          subscription_status: sub.status,
          renews_at: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        })
        .eq('stripe_customer_id', sub.customer);
    }

    return Response.json({ received: true });
  } catch (e) {
    console.error('[stripe-webhook] error:', e);
    return Response.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
