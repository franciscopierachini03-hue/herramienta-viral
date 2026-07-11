import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Middleware.
//
// ── MODO CERRADO (pre-lanzamiento) ──────────────────────────────────────────
// Mientras CLOSED = true, TODO el tráfico cae en /proximamente (la cuenta
// regresiva), EXCEPTO los admin (que entran a todo para construir el rediseño)
// y unas pocas rutas siempre abiertas (landing, login, waitlist).
// Para REABRIR la plataforma: poner CLOSED = false (o env PLATFORM_OPEN=1) y deploy.
//
// ── MODO ABIERTO (normal) ───────────────────────────────────────────────────
// Protege /app, /editor, /guiones, /cuenta: requiere login + subscription_status
// activo (o trial vigente). REQUIRE_AUTH=1 activa la protección.

// 🚀 LANZADO — plataforma ABIERTA al público. Para volver a cerrarla (cuenta
// regresiva /proximamente): setear PLATFORM_OPEN=0 en Vercel y redeploy.
const CLOSED = process.env.PLATFORM_OPEN === '0';
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === '1';
const ACTIVE_STATUSES = new Set(['active']);

const PERMANENT_OWNERS = ['franciscopierachini03@gmail.com'];
function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (PERMANENT_OWNERS.includes(e)) return true;
  const list = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(e);
}

// Cookies de auth con vida de "session" (mueren al cerrar el navegador).
function stripPersistence(options?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!options) return options;
  const { maxAge: _ma, expires: _ex, ...rest } = options;
  return rest;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── DOMINIO DEL EVENTO ──────────────────────────────────────────────────────
  // El landing del evento vive en su PROPIO dominio (franpierachini.com), sin
  // marca de la plataforma. Cualquier host de franpierachini.com (apex, www o
  // subdominio) sirve /evento en su raíz, SIN cambiar la URL (rewrite, no redirect).
  // Va ANTES de la lógica de auth/cierre para que quede siempre público.
  const reqHost = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  const isEventHost =
    reqHost === 'franpierachini.com' ||
    reqHost.endsWith('.franpierachini.com') ||
    reqHost === (process.env.EVENT_HOST || '').toLowerCase();
  if (isEventHost && pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = '/evento';
    return NextResponse.rewrite(url);
  }

  // El evento SOLO vive en franpierachini.com. Si alguien llega a /evento por
  // OTRO host (p. ej. viraladn.com/evento), lo redirigimos al dominio del evento
  // → queda desactivado fuera de franpierachini, sin romper enlaces viejos.
  if (!isEventHost && (pathname === '/evento' || pathname.startsWith('/evento/'))) {
    const base = pathname === '/evento'
      ? 'https://evento.franpierachini.com/'
      : `https://evento.franpierachini.com${pathname}`;
    return NextResponse.redirect(base + req.nextUrl.search, 307);
  }

  // /ADAMA (o cualquier mezcla de mayúsculas) → /adama. Las rutas de Next son
  // case-sensitive y la comunidad comparte el link escrito en mayúsculas.
  if (pathname.toLowerCase() === '/adama' && pathname !== '/adama') {
    const url = req.nextUrl.clone();
    url.pathname = '/adama';
    return NextResponse.redirect(url, 308);
  }

  // Formulario de registro: URL limpia /registro → sirve el HTML estático.
  if (pathname === '/registro') {
    const url = req.nextUrl.clone();
    url.pathname = '/registro.html';
    return NextResponse.rewrite(url);
  }

  // ── MODO CERRADO ──────────────────────────────────────────────────────────
  if (CLOSED) {
    // Siempre abiertas, incluso cerrado: la landing, el login y sus APIs, la waitlist.
    const alwaysOpen =
      pathname === '/proximamente' || pathname.startsWith('/proximamente/') ||
      pathname === '/login' || pathname.startsWith('/login/') ||
      pathname === '/evento' || pathname.startsWith('/evento/') || pathname === '/api/evento' ||
      pathname.startsWith('/api/auth') || pathname === '/api/waitlist';
    if (alwaysOpen) return NextResponse.next();

    // ¿Es admin? Leemos la sesión + allowlist.
    let response = NextResponse.next({ request: req });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
            response = NextResponse.next({ request: req });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, stripPersistence(options)));
          },
        },
      },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (isAdminEmail(user?.email)) return response; // admin → acceso total

    // No admin: APIs cerradas (503), páginas → cuenta regresiva.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'En mantenimiento' }, { status: 503 });
    }
    return NextResponse.redirect(new URL('/proximamente', req.url));
  }

  // ── MODO ABIERTO (protección normal por suscripción) ────────────────────────
  if (!REQUIRE_AUTH) return NextResponse.next();

  const isWelcome = pathname === '/app/welcome' || pathname.startsWith('/app/welcome/');
  const isCuenta = pathname === '/cuenta' || pathname.startsWith('/cuenta/');

  const isProtected =
    pathname.startsWith('/app') ||
    pathname.startsWith('/editor') ||
    pathname.startsWith('/guiones') ||
    isCuenta;
  if (!isProtected) return NextResponse.next();

  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, stripPersistence(options)));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Dueño / admin: acceso total, NUNCA bloqueado por suscripción (igual que en
  // modo cerrado, línea 101). Su acceso es por lista de emails, no por Stripe —
  // así cancelar el cobro propio no lo deja afuera de su propia plataforma.
  if (isAdminEmail(user.email)) return response;

  if (isWelcome || isCuenta) return response;

  const email = user.email;
  if (!email) return NextResponse.redirect(new URL('/login', req.url));

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('email', email)
    .maybeSingle();

  const status = profile?.subscription_status ?? 'pending';
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialActive = !!trialEndsAt && trialEndsAt.getTime() > Date.now();
  const allowedByStatus = ACTIVE_STATUSES.has(status);
  const allowedByTrial = status === 'trialing' && trialActive;

  if (!allowedByStatus && !allowedByTrial) {
    const url = new URL('/precios', req.url);
    url.searchParams.set('need', status === 'trialing' && !trialActive ? 'trial-expirado' : 'pago');
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // En modo cerrado el middleware corre en TODO (para redirigir). Excluimos solo
  // assets estáticos para no romper la landing (logo, etc.).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|woff|woff2|ttf|css|js|txt|xml|json)).*)'],
};
