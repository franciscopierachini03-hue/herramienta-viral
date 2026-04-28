import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Middleware: protege /app, /editor, /guiones — requiere sesión activa
// con suscripción válida. Si no hay sesión, redirige a /login con `next` para
// volver al destino original tras autenticarse.
//
// La cookie de sesión la setea Supabase en /auth/callback.
//
// Activación:
// - Para activar el gate, poner REQUIRE_AUTH=1 en .env.local
// - Para desarrollo sin gate, dejar REQUIRE_AUTH=0 o sin definir.
//
// Próxima mejora (no urgente): además de chequear que haya sesión, leer
// `profiles.subscription_status` y bloquear si no está 'active'. Por ahora,
// con que esté logueado y haya pagado alguna vez alcanza para test.

const REQUIRE_AUTH = process.env.REQUIRE_AUTH === '1';

export async function middleware(req: NextRequest) {
  if (!REQUIRE_AUTH) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const isProtected =
    pathname.startsWith('/app') ||
    pathname.startsWith('/editor') ||
    pathname.startsWith('/guiones');
  if (!isProtected) return NextResponse.next();

  // Crear cliente de Supabase que lee/escribe cookies en la respuesta.
  // Necesitamos `response` para que el cliente pueda refrescar la sesión.
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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/app/:path*', '/editor/:path*', '/guiones/:path*'],
};
