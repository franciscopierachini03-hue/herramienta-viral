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
//   4. Redirigimos a /app.
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

  // 1. Ver quién está logueado.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect('/login?next=/precios');
  }

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
  let session: {
    id: string;
    payment_status?: string;
    status?: string;
    customer?: string;
    subscription?: string;
    customer_email?: string;
    customer_details?: { email?: string; name?: string; phone?: string };
  } | null = null;

  try {
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}`,
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
            en unos minutos. Si esto no se resuelve, escribinos.
          </p>
          <a href="/precios" className="text-sm underline" style={{ color: '#aaa' }}>← Volver</a>
        </div>
      </main>
    );
  }

  // 3. Validar que la sesión está pagada y es del usuario correcto.
  const isPaid = session.payment_status === 'paid' || session.status === 'complete';
  const sessionEmail =
    session.customer_email || session.customer_details?.email || '';

  if (!isPaid) {
    redirect('/precios?cancelled=1');
  }

  // Defensa contra session_id manipulado: el email de la sesión tiene que
  // coincidir con el email del usuario logueado.
  if (sessionEmail.toLowerCase() !== user.email.toLowerCase()) {
    console.warn('[welcome] email mismatch', { session: sessionEmail, user: user.email });
    redirect('/login');
  }

  // 4. Activar la suscripción en profiles. Usamos service client para bypassear RLS.
  const admin = createServiceClient();
  const { error } = await admin
    .from('profiles')
    .upsert(
      {
        email: user.email,
        name: session.customer_details?.name ?? null,
        phone: session.customer_details?.phone ?? null,
        stripe_customer_id: session.customer ?? null,
        stripe_subscription_id: session.subscription ?? null,
        subscription_status: 'active',
        activated_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    );

  if (error) {
    console.error('[welcome] upsert profile error:', error);
    // Aun así dejamos pasar — el webhook puede arreglarlo después.
  }

  // 5. Listo, mandalo a la app.
  redirect('/app');
}
