import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /auth/callback?code=...
//
// Recibe el click del magic link. Supabase pasa un `code` en la query string,
// nosotros lo intercambiamos por una sesión y seteamos la cookie firmada.
// Después redirigimos al usuario a /app (o a la ruta original si vino con `next`).

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/app';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] exchange error:', error);
    return NextResponse.redirect(`${origin}/login?error=invalid_code`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
