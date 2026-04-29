// Cliente de Supabase para Server Components, Route Handlers y Middleware.
// Lee/escribe la cookie de sesión (firmada por Supabase, no por nosotros).
//
// IMPORTANTE: este cliente usa la publishable key. Para operaciones que requieren
// privilegios (como insertar perfiles desde el webhook de Stripe) usar
// `createServiceClient()` que usa la service_role key.
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupaClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Quitamos maxAge/expires de las cookies de auth para que vivan solo mientras
// el navegador esté abierto. Cuando el usuario cierra el browser, la sesión
// muere y tiene que volver a loguearse en la próxima visita.
function makeSessionCookie<T extends Record<string, unknown> | undefined>(options: T): T {
  if (!options) return options;
  const { maxAge: _ma, expires: _ex, ...rest } = options as Record<string, unknown>;
  return rest as T;
}

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, makeSessionCookie(options)),
            );
          } catch {
            // En Server Components puros no se pueden setear cookies — Supabase
            // refresca la sesión vía middleware, así que esto es ok ignorarlo.
          }
        },
      },
    },
  );
}

// Cliente con privilegios completos. SOLO para uso en backend (webhooks, jobs).
// NUNCA exponer al cliente — bypassa Row Level Security.
export function createServiceClient() {
  return createSupaClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
