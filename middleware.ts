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

// Estados que cuentan como "pagó y puede entrar".
// `trialing` por si después agregamos free trial. `past_due` lo dejamos afuera
// a propósito — si la tarjeta rebotó, no entra hasta regularizar.
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export async function middleware(req: NextRequest) {
  if (!REQUIRE_AUTH) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // /app/welcome es la página de "post-pago": viene de Stripe a verificar la
  // sesión y activar la suscripción. Si la bloqueáramos por subscription_status
  // entraría en loop (justo viene a setearlo). Solo le exigimos que esté logueado.
  const isWelcome = pathname === '/app/welcome' || pathname.startsWith('/app/welcome/');

  const isProtected =
    pathname.startsWith('/app') ||
    pathname.startsWith('/editor') ||
    pathname.startsWith('/guiones');
  if (!isProtected) return NextResponse.next();

  let response = NextResponse.next({ request: req });

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
            response.cookies.set(name, value, options),
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
    .select('subscription_status')
    .eq('email', email)
    .maybeSingle();

  const status = profile?.subscription_status ?? 'pending';

  if (!ACTIVE_STATUSES.has(status)) {
    // Está logueado pero no pagó (o canceló) → a /precios.
    const url = new URL('/precios', req.url);
    url.searchParams.set('need', 'pago');
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/app/:path*', '/editor/:path*', '/guiones/:path*'],
};
