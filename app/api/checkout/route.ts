import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolvePriceId, EVENT_AMOUNTS, type ProductKey, type Ciclo } from '@/lib/products';

// Crea una sesión de Stripe Checkout y devuelve la URL para redirigir al usuario.
//
// Formato nuevo por producto:
//   { producto: 'viraladn' | 'topcut' | 'combo', ciclo?: 'monthly' | 'yearly' }
// Formato viejo (compatibilidad): { plan: 'monthly' | 'yearly' } → plan único.
//
// El price id se resuelve por (PRODUCTO + MONTO) en lib/products.ts — no hace
// falta mapear price ids a mano. Pasamos el email del usuario logueado como
// customer_email para que el webhook / verify post-pago matchee el pago al perfil.

const PRODUCTOS: ProductKey[] = ['viraladn', 'topcut', 'combo'];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // ¿Qué cuenta de Stripe COBRA esta venta? 'elevation' = Elevation Sales
  // Solutions (la página paralela /unete para comunidades); por defecto la
  // principal (2CLICKS). Cada cuenta tiene su key y sus propios precios.
  const cuenta: 'principal' | 'elevation' = body?.cuenta === 'elevation' ? 'elevation' : 'principal';
  const stripeKey = ((cuenta === 'elevation'
    ? process.env.STRIPE_SECRET_KEY_ELEVATION
    : process.env.STRIPE_SECRET_KEY) || '').trim();

  if (!stripeKey) {
    return Response.json({
      error: cuenta === 'elevation'
        ? 'Falta STRIPE_SECRET_KEY_ELEVATION en Vercel (la key de la cuenta Elevation Sales Solutions).'
        : 'Stripe no está configurado todavía. Falta STRIPE_SECRET_KEY.',
    }, { status: 503 });
  }

  // ── Resolver producto + ciclo + price id ──────────────────────────────────
  const producto: ProductKey | null = PRODUCTOS.includes(body?.producto) ? body.producto : null;
  let ciclo: Ciclo = body?.ciclo === 'yearly' ? 'yearly' : body?.ciclo === 'quarterly' ? 'quarterly' : 'monthly';

  // Página paralela (/unete): venta con PRUEBA GRATIS + etiqueta de comunidad.
  //   trial:true → 7 días gratis (tarjeta hoy, $0; Stripe cobra solo al día 8).
  //   canal → va en metadata: sabés de qué comunidad vino cada venta.
  const TRIAL_DAYS_PARALELO = 7;
  const canal = typeof body?.canal === 'string'
    ? body.canal.trim().toLowerCase().slice(0, 40).replace(/[^a-z0-9_-]/g, '')
    : '';
  const conTrial = body?.trial === true;
  let priceId: string | null;
  let metaProduct: string;
  let metaPlan: string;

  if (producto) {
    priceId = cuenta === 'elevation'
      ? await resolvePriceEnCuenta(stripeKey, producto, ciclo)
      : await resolvePriceId(producto, ciclo);
    metaProduct = producto;
    metaPlan = producto === 'combo' ? `combo-${ciclo}` : producto;
    if (!priceId) {
      const montoUsd = (EVENT_AMOUNTS[producto]?.[ciclo] ?? 0) / 100;
      return Response.json(
        { error: cuenta === 'elevation'
            ? `El plan "${producto}" (${ciclo}) todavía no existe en la cuenta Elevation: creá ahí un precio recurrente de USD $${montoUsd} y se detecta solo.`
            : `Todavía no encontramos el precio de "${producto}" (${ciclo}) en Stripe. Revisa que el producto y el monto existan.` },
        { status: 503 },
      );
    }
  } else {
    // Compatibilidad: plan único viejo.
    const plan: Ciclo = body?.plan === 'yearly' ? 'yearly' : 'monthly';
    ciclo = plan;
    metaProduct = 'viraladn';
    metaPlan = plan;
    priceId = (plan === 'yearly' ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY)?.trim() || null;
    if (!priceId) {
      return Response.json({ error: `Falta el price id del plan ${plan}.` }, { status: 503 });
    }
  }

  // Usuario logueado → su email/id para matchear el pago al perfil.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Stripe rechaza mode=subscription con prices one_time y viceversa.
  let mode: 'subscription' | 'payment' = 'subscription';
  try {
    const priceRes = await fetch(
      `https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`,
      { headers: { Authorization: `Bearer ${stripeKey}` }, cache: 'no-store' },
    );
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      mode = priceData?.type === 'recurring' ? 'subscription' : 'payment';
    }
  } catch (e) {
    console.warn('[checkout] price lookup failed, defaulting to subscription:', e);
  }

  const params = new URLSearchParams();
  params.append('mode', mode);
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  if (user?.email) params.append('customer_email', user.email);
  if (user?.id) params.append('client_reference_id', user.id);

  // Tags: ingreso nuestro + por qué producto entró (respaldo / lectura).
  const meta: Record<string, string> = { app: 'viraladn', product: metaProduct, plan: metaPlan };
  if (canal) meta.canal = canal;
  if (cuenta === 'elevation') meta.cuenta = 'elevation';
  for (const [k, v] of Object.entries(meta)) params.append(`metadata[${k}]`, v);
  const subOrPay = mode === 'subscription' ? 'subscription_data' : 'payment_intent_data';
  for (const [k, v] of Object.entries(meta)) params.append(`${subOrPay}[metadata][${k}]`, v);
  // Prueba gratis: solo aplica a suscripciones (un pago único no tiene trial).
  if (mode === 'subscription' && conTrial) {
    params.append('subscription_data[trial_period_days]', String(TRIAL_DAYS_PARALELO));
  }

  // Tras pagar, /app/welcome verifica el pago y guarda el stripe_customer_id;
  // después el hub /inicio desbloquea el producto pagado.
  // La cuenta viaja en el success_url: /app/welcome necesita saber CON QUÉ key
  // leer la sesión (las sesiones viven en la cuenta que las creó).
  const cuentaQS = cuenta === 'elevation' ? '&cuenta=elevation' : '';
  params.append('success_url', `${appUrl}/app/welcome?session_id={CHECKOUT_SESSION_ID}${cuentaQS}`);
  // Si vino de la página paralela (/unete), al cancelar vuelve ahí.
  const origen = body?.origen === 'unete' ? '/unete' : '/precios';
  params.append('cancel_url', `${appUrl}${origen}?cancelled=1&producto=${metaProduct}`);
  params.append('allow_promotion_codes', 'true');
  params.append('billing_address_collection', 'auto');
  params.append('phone_number_collection[enabled]', 'true');

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data?.error?.message || 'Stripe rechazó la solicitud.' }, { status: 502 });
    }
    return Response.json({ url: data.url });
  } catch (e) {
    return Response.json({ error: `Error de conexión con Stripe: ${(e as Error).message}` }, { status: 502 });
  }
}

// Resuelve el price id en OTRA cuenta de Stripe (p. ej. Elevation) buscando por
// MONTO + intervalo del catálogo del evento. Sin ids pegados a mano: alcanza
// con crear en esa cuenta un precio recurrente con el monto correcto (USD).
async function resolvePriceEnCuenta(key: string, producto: ProductKey, ciclo: Ciclo): Promise<string | null> {
  const amount = EVENT_AMOUNTS[producto]?.[ciclo];
  if (!amount) return null;
  const interval = ciclo === 'yearly' ? 'year' : 'month';
  const count = ciclo === 'quarterly' ? 3 : 1;
  try {
    const res = await fetch('https://api.stripe.com/v1/prices?active=true&type=recurring&limit=100', {
      headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const lista = (data?.data || []) as Array<{
      id: string; currency?: string; unit_amount?: number | null;
      recurring?: { interval?: string; interval_count?: number } | null;
    }>;
    const hit = lista.find(p =>
      p.currency === 'usd' && p.unit_amount === amount &&
      p.recurring?.interval === interval && (p.recurring?.interval_count || 1) === count,
    );
    return hit?.id || null;
  } catch { return null; }
}
