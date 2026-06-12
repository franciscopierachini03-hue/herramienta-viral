import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// /app/welcome?session_id=cs_test_...
//
// Esta página la abre Stripe DESPUÉS de un pago exitoso. La estrategia:
//
//   1. Tomamos el session_id que vino en la URL.
//   2. Le preguntamos a Stripe si ese pago realmente quedó (payment_status='paid').
//   3. Si está pago, marcamos profiles.subscription_status='active' nosotros
//      mismos — sin esperar al webhook.
//   4. Redirigimos al hub /inicio (ahí ve qué producto desbloqueó).
//
// Por qué hacemos esto en vez de depender solo del webhook:
//   - El webhook puede no estar configurado (caso ahora).
//   - El webhook puede llegar tarde (Stripe a veces tarda 30s+).
//   - Tener este verify de respaldo es la práctica recomendada por Stripe.
//
// Seguridad: validamos contra Stripe con la SECRET_KEY, no confiamos en lo que
// venga en la URL. El cliente solo aporta el session_id, todo lo demás se
// verifica server-side.

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ session_id?: string }>;

export default async function Welcome({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { session_id } = await searchParams;

  if (!session_id) {
    redirect('/precios');
  }

  // 1. Ver quién está logueado (puede ser nadie — flujo pay-first).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white p-8 text-center"
        style={{ background: '#080808' }}>
        <div>
          <p className="text-lg mb-2">⚠️ Stripe no está configurado.</p>
          <p className="text-sm" style={{ color: '#888' }}>
            Falta STRIPE_SECRET_KEY en las variables de entorno.
          </p>
        </div>
      </main>
    );
  }

  // 2. Verificar la sesión contra la API de Stripe.
  // IMPORTANTE: Stripe solo permite expandir hasta 4 niveles de profundidad.
  // Expandimos `subscription` (1) y `total_details.breakdown.discounts.discount`
  // (4 niveles — el máximo permitido). El nombre legible del promotion_code lo
  // resolvemos DESPUÉS con una llamada aparte, para no romper la confirmación
  // del pago si esa parte falla.
  type StripeSession = {
    id: string;
    payment_status?: string;
    status?: string;
    customer?: string;
    subscription?: string | {
      id: string;
      current_period_end?: number;
      trial_end?: number | null;
    };
    customer_email?: string;
    customer_details?: { email?: string; name?: string; phone?: string };
    total_details?: {
      amount_discount?: number;
      breakdown?: {
        discounts?: Array<{
          discount?: {
            coupon?: { id?: string; name?: string };
            promotion_code?: string | { id?: string; code?: string };
          };
        }>;
      };
    };
  };
  let session: StripeSession | null = null;

  try {
    const expandParams =
      'expand[]=subscription&expand[]=total_details.breakdown.discounts.discount';
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}?${expandParams}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        cache: 'no-store',
      },
    );
    if (res.ok) {
      session = await res.json();
    } else {
      console.error('[welcome] stripe verify failed:', await res.text());
    }
  } catch (e) {
    console.error('[welcome] stripe fetch error:', e);
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white p-8 text-center"
        style={{ background: '#080808' }}>
        <div className="max-w-md">
          <p className="text-lg mb-3">No pudimos confirmar tu pago todavía.</p>
          <p className="text-sm mb-6" style={{ color: '#888' }}>
            Si Stripe te cobró, tu acceso se va a activar automáticamente
            en unos minutos. Si esto no se resuelve, escríbenos.
          </p>
          <a href="/precios" className="text-sm underline" style={{ color: '#aaa' }}>← Volver</a>
        </div>
      </main>
    );
  }

  // 3. Validar que la sesión está pagada.
  const isPaid = session.payment_status === 'paid' || session.status === 'complete';
  const sessionEmail =
    session.customer_email || session.customer_details?.email || '';

  if (!isPaid) {
    redirect('/precios?cancelled=1');
  }

  // Si no está logueado → mandarlo a crear cuenta con el email de Stripe
  // pre-cargado. El session_id se preserva en el `next` para volver aquí.
  if (!user?.email) {
    const next = encodeURIComponent(`/app/welcome?session_id=${session_id}`);
    const hint = encodeURIComponent(sessionEmail);
    redirect(`/login?signup=1&next=${next}&email=${hint}`);
  }

  // Defensa contra session_id manipulado: el email de la sesión tiene que
  // coincidir con el email del usuario logueado.
  if (sessionEmail && sessionEmail.toLowerCase() !== user.email.toLowerCase()) {
    console.warn('[welcome] email mismatch', { session: sessionEmail, user: user.email });
    redirect('/login');
  }

  // 4. Extraer info del descuento (si hubo) y la suscripción.
  // Si usó un código promocional (ej: "LegacyPanama"), lo capturamos aquí —
  // el cupón de Stripe se consume al instante, así que esta es la única chance
  // de saber DE DÓNDE vino ese pago.
  const subscriptionObj = typeof session.subscription === 'object' ? session.subscription : null;
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : subscriptionObj?.id ?? null;
  const periodEnd = subscriptionObj?.current_period_end ?? null;

  const discountInfo = session.total_details?.breakdown?.discounts?.[0]?.discount;
  const hasDiscount = (session.total_details?.amount_discount ?? 0) > 0;
  const couponName = discountInfo?.coupon?.name || discountInfo?.coupon?.id || null;

  // El nombre legible del promo code (ej: "LegacyPanama") requiere una llamada
  // aparte porque no lo pudimos expandir (límite de 4 niveles de Stripe).
  // Si falla, caemos al nombre del cupón — NUNCA bloquea la activación.
  let promoCodeName: string | null = null;
  if (hasDiscount) {
    const promoRaw = discountInfo?.promotion_code;
    const promoId = typeof promoRaw === 'string' ? promoRaw : promoRaw?.id ?? null;
    if (typeof promoRaw === 'object' && promoRaw?.code) {
      promoCodeName = promoRaw.code;
    } else if (promoId) {
      try {
        const pr = await fetch(
          `https://api.stripe.com/v1/promotion_codes/${encodeURIComponent(promoId)}`,
          { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' },
        );
        if (pr.ok) {
          const pdata = await pr.json();
          promoCodeName = pdata?.code ?? null;
        }
      } catch (e) {
        console.warn('[welcome] promo code lookup failed:', (e as Error).message);
      }
    }
  }
  // Etiqueta de origen: prio promo code legible, si no coupon name
  const origin = hasDiscount ? (promoCodeName || couponName) : null;

  // 5. Activar la suscripción en profiles. Usamos service client para bypassear RLS.
  const admin = createServiceClient();
  const patch: Record<string, unknown> = {
    email: user.email,
    name: session.customer_details?.name ?? null,
    phone: session.customer_details?.phone ?? null,
    stripe_customer_id: session.customer ?? null,
    stripe_subscription_id: subscriptionId,
    subscription_status: 'active',
    activated_at: new Date().toISOString(),
  };
  // Solo guardamos código + trial_end SI hubo descuento — así no pisamos
  // el redeemed_code de un invite code anterior cuando paga sin promo.
  if (origin) patch.redeemed_code = origin;
  if (hasDiscount && periodEnd) {
    patch.trial_ends_at = new Date(periodEnd * 1000).toISOString();
  }

  const { error } = await admin
    .from('profiles')
    .upsert(patch, { onConflict: 'email' });

  if (error) {
    console.error('[welcome] upsert profile error:', error);
    // Aun así dejamos pasar — el webhook puede arreglarlo después.
  }

  // 5. Listo → al hub /inicio: ahí ve sus dos cuadrados con lo que desbloqueó
  //    (ViralADN, TOPCUT o las dos según lo que pagó).
  redirect('/inicio');
}
