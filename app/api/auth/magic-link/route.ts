import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// POST /api/auth/magic-link
// Endpoint unificado de auth con contraseña.
//
// Body: { mode: 'signup' | 'login', email, password, name?, phone? }
//
// SIGNUP:
//   1. Valida inputs (nombre 2+, phone 6+, email válido, password 8+)
//   2. Crea el auth.user en Supabase con admin API y email_confirm=true
//      (así no necesitan clickear correo para entrar — el correo se "confirma"
//      cuando paguen con Stripe).
//   3. Inserta perfil en `profiles` con name, phone, email.
//   4. Inicia sesión inmediatamente (setea cookie).
//   5. Devuelve { ok: true, redirect: '/precios' } — el cliente redirige a pagar.
//
// LOGIN:
//   1. Valida email + password.
//   2. signInWithPassword → setea cookie de sesión.
//   3. Devuelve { ok: true, redirect: '/app' o `next` si vino con uno }
//      (el middleware se encarga de rebotar a /precios si no hay suscripción)

// Helper: lee la lista de códigos válidos desde env. Coma-separada, en mayúsculas.
// Ej: INVITE_CODES="BETA50,FRIEND2026,LAUNCH"
function isValidInviteCode(input: string): boolean {
  if (!input) return false;
  const valid = (process.env.INVITE_CODES || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return valid.includes(input.trim().toUpperCase());
}

function trialDays(): number {
  const n = parseInt(process.env.TRIAL_DAYS || '5', 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

// Normaliza email para evitar duplicados por capitalización/espacios.
// Supabase ya guarda lowercase pero somos defensivos.
function normalizeEmail(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { mode, name, phone, password, code, next } = body;
  const email = normalizeEmail(body.email);

  // ── Validación común ───────────────────────────────────────────────────
  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Correo inválido.' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return Response.json(
      { error: 'La contraseña tiene que tener al menos 8 caracteres.' },
      { status: 400 },
    );
  }

  // ── SIGNUP ─────────────────────────────────────────────────────────────
  if (mode === 'signup') {
    if (!name || name.trim().length < 2) {
      return Response.json({ error: 'Necesitamos tu nombre completo.' }, { status: 400 });
    }
    if (!phone || phone.trim().length < 6) {
      return Response.json(
        { error: 'Necesitamos tu teléfono con código de país.' },
        { status: 400 },
      );
    }

    const admin = createServiceClient();

    // 1. Crear el auth.user con email confirmado de movida.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), phone: phone.trim() },
    });

    if (createErr) {
      // Si ya existe, mostrar mensaje claro.
      if (createErr.message?.toLowerCase().includes('already')) {
        return Response.json(
          { error: 'Ya hay una cuenta con ese correo. Iniciá sesión.' },
          { status: 409 },
        );
      }
      console.error('[auth/signup] createUser:', createErr);
      return Response.json(
        { error: 'No pudimos crear la cuenta. Probá de nuevo.' },
        { status: 500 },
      );
    }

    // 2. Si trajo código de invitación válido → activar trial sin pasar por Stripe.
    const useTrial = code && isValidInviteCode(code);
    const trialEndsAt = useTrial
      ? new Date(Date.now() + trialDays() * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const profileRow: Record<string, unknown> = {
      email,
      name: name.trim(),
      phone: phone.trim(),
    };
    if (useTrial) {
      profileRow.subscription_status = 'trialing';
      profileRow.trial_ends_at = trialEndsAt;
      profileRow.redeemed_code = String(code).trim().toUpperCase();
      profileRow.activated_at = new Date().toISOString();
    }

    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert(profileRow, { onConflict: 'email' });
    if (upsertErr) console.error('[auth/signup] upsert profile:', upsertErr);

    // 3. Iniciar sesión automáticamente (cookie).
    const supabase = await createClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      console.error('[auth/signup] auto sign-in:', signInErr);
      return Response.json({ ok: true, redirect: '/login' });
    }

    // 4. Redirect: si tiene trial → directo a /app. Si no → /precios para pagar.
    return Response.json({
      ok: true,
      redirect: useTrial ? '/app' : '/precios',
      userId: created.user?.id,
      trial: useTrial ? { endsAt: trialEndsAt, days: trialDays() } : null,
    });
  }

  // ── LOGIN ──────────────────────────────────────────────────────────────
  if (mode === 'login') {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('invalid')) {
        return Response.json(
          { error: 'Correo o contraseña incorrectos.' },
          { status: 401 },
        );
      }
      console.error('[auth/login] error:', error);
      return Response.json(
        { error: 'No pudimos iniciar sesión. Probá de nuevo.' },
        { status: 500 },
      );
    }

    return Response.json({ ok: true, redirect: next || '/app' });
  }

  return Response.json({ error: 'Modo inválido.' }, { status: 400 });
}
