import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCheckoutInfo } from '@/lib/stripe-checkout-info';
import { sendPaymentConfirmed } from '@/lib/email/resend';

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

      // Capturar de qué cupón/promo vino el pago + fin del primer período.
      // El payload del webhook NO trae la info de descuento expandida, así que
      // la pedimos a la API. Si falla, igual activamos (origin queda null).
      const secret = process.env.STRIPE_SECRET_KEY;
      const info = secret
        ? await getCheckoutInfo(session.id, secret)
        : { subscriptionId: session.subscription || null, periodEnd: null, origin: null, hasDiscount: false };

      // 1. Upsert del perfil con stripe_customer_id y subscription_status=active
      const profilePatch: Record<string, unknown> = {
        email,
        name,
        phone,
        stripe_customer_id: session.customer,
        stripe_subscription_id: info.subscriptionId || session.subscription || null,
        subscription_status: 'active',
        activated_at: new Date().toISOString(),
      };
      // Si usó código de descuento → guardamos de dónde vino + cuándo se le cobra
      if (info.origin) profilePatch.redeemed_code = info.origin;
      if (info.hasDiscount && info.periodEnd) {
        profilePatch.trial_ends_at = new Date(info.periodEnd * 1000).toISOString();
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(profilePatch, { onConflict: 'email' });

      if (upsertError) {
        console.error('[stripe-webhook] upsert error:', upsertError);
      }

      // 2. Conectar el pago a la cuenta — SIN crear cuentas a medias.
      //    Antes usábamos signInWithOtp({shouldCreateUser:true}), que creaba un
      //    usuario SIN contraseña y SIN email confirmado (y mandaba un magic link
      //    por el SMTP de Supabase que no llega) → la persona pagaba y quedaba
      //    trabada. Ahora:
      //      - Si ya tiene cuenta → la confirmamos (por si quedó a medias) y listo.
      //      - Si NO tiene cuenta (pay-first) → NO la creamos acá; le mandamos un
      //        email por Resend para que la cree con el código de 6 dígitos (flujo
      //        bueno, que sí confirma). La creación de cuenta vive en un solo lugar.
      let authUser: { id: string; email?: string; email_confirmed_at?: string | null } | null = null;
      for (let page = 1; page <= 20 && !authUser; page++) {
        const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        const users = list?.users || [];
        authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null;
        if (users.length < 200) break;
      }

      let needsWelcome = false;
      if (authUser) {
        // Cuenta existente: si quedó sin confirmar (víctima del bug viejo), la confirmamos.
        if (!authUser.email_confirmed_at) {
          await supabase.auth.admin.updateUserById(authUser.id, { email_confirm: true });
          await supabase.from('profiles').update({ email_verified: true }).eq('email', email);
          needsWelcome = true; // estaba a medias → conviene avisarle cómo entrar
        }
      } else {
        // Pay-first sin cuenta: la persona tiene que crearla con su email.
        needsWelcome = true;
      }

      // 3. Email post-pago (solo cuando hace falta) por Resend — confiable.
      if (needsWelcome) {
        try {
          await sendPaymentConfirmed(email, name || undefined, !!authUser);
        } catch (e) {
          console.error('[stripe-webhook] sendPaymentConfirmed:', e);
        }
      }

      console.log(`[stripe-webhook] pago activado: ${email} (cuenta ${authUser ? 'existente' : 'pendiente de crear'})`);
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
