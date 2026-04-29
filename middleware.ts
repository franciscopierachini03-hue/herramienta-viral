import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Middleware: protege /app, /editor, /guiones — requiere:
//   1. sesión activa (usuario logueado)
//   2. subscription_status === 'active' en `profiles`
//
// Si no hay sesión → /login?next=...
// Si hay sesión pero no pagó → /precios?need=pago
//
// Activación:
// - REQUIRE_AUTH=1 en .env → protege rutas
// - REQUIRE_AUTH=0 o ausente → modo dev, deja pasar todo

const REQUIRE_AUTH = process.env.REQUIRE_AUTH === '1';

// Estados que cuentan como "pagó y puede entrar". `trialing` se verifica
// aparte con trial_ends_at para no dejar pasar trials vencidos.
// `past_due` queda afuera a propósito: si la tarjeta rebotó, no entra
// hasta regularizar.
const ACTIVE_STATUSES = new Set(['active']);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // TOPCUT (/editor) está en construcción — siempre bloquear el acceso directo
  // por URL y mandar a /app, sin importar el estado de auth ni REQUIRE_AUTH.
  // Cuando esté listo, eliminar este bloque y descomentar /editor en el matcher.
  if (pathname.startsWith('/editor')) {
    return NextResponse.redirect(new URL('/app', req.url));
  }

  if (!REQUIRE_AUTH) return NextResponse.next();

  // /app/welcome es la página de "post-pago": viene de Stripe a verificar la
  // sesión y activar la suscripción. Si la bloqueáramos por subscription_status
  // entraría en loop (justo viene a setearlo). Solo le exigimos que esté logueado.
  const isWelcome = pathname === '/app/welcome' || pathname.startsWith('/app/welcome/');

  const isProtected =
    pathname.startsWith('/app') ||
    pathname.startsWith('/guiones');
  if (!isProtected) return NextResponse.next();

  let response = NextResponse.next({ request: req });

  // Cookies de auth con vida de "session" (mueren al cerrar el navegador).
  // Quitamos maxAge/expires para que sean session cookies.
  const stripPersistence = (
    options?: Record<string, unknown>,
  ): Record<string, unknown> | undefined => {
    if (!options) return options;
    const { maxAge: _ma, expires: _ex, ...rest } = options;
    return rest;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, stripPersistence(options)),
          );
        },
      },
    },
  );

  // 1. ¿Está logueado?
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // /app/welcome solo requiere login; el chequeo de pago lo hace la propia página.
  if (isWelcome) return response;

  // 2. ¿Pagó? Buscamos el status en profiles por email.
  const email = user.email;
  if (!email) {
    // Edge case: usuario sin email (no debería pasar). Lo mandamos a /login.
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('email', email)
    .maybeSingle();

  const status = profile?.subscription_status ?? 'pending';
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialActive = !!trialEndsAt && trialEndsAt.getTime() > Date.now();

  // Pasa si: (1) status activo o (2) está en trial vigente
  const allowedByStatus = ACTIVE_STATUSES.has(status);
  const allowedByTrial = status === 'trialing' && trialActive;

  if (!allowedByStatus && !allowedByTrial) {
    const url = new URL('/precios', req.url);
    // ?need=trial-expirado si el trial venció, ?need=pago si nunca pagó.
    url.searchParams.set('need', status === 'trialing' && !trialActive ? 'trial-expirado' : 'pago');
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/app/:path*', '/editor/:path*', '/guiones/:path*'],
};
