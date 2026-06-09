import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// POST /api/auth/verify-code
//
// Body:
//   { mode: 'signup', email, code, password }
//      → Verifica código, marca email_verified=true, activa trial si hay
//        invite_code, e inicia sesión.
//   { mode: 'reset', email, code, newPassword }
//      → Verifica código, actualiza la password vía admin, e inicia sesión.
//
// Después de 5 intentos fallidos invalida el código.

const MAX_ATTEMPTS = 5;

function normalizeEmail(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

function parseDurationToMs(spec: string): number | null {
  const m = spec.trim().toLowerCase().match(/^(\d+)\s*(m|h|d)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2];
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 'h') return n * 60 * 60 * 1000;
  if (unit === 'd') return n * 24 * 60 * 60 * 1000;
  return null;
}

function defaultTrialMs(): number {
  const n = parseInt(process.env.TRIAL_DAYS || '5', 10);
  const d = Number.isFinite(n) && n > 0 ? n : 5;
  return d * 24 * 60 * 60 * 1000;
}

function lookupInviteCode(input: string): { code: string; durationMs: number } | null {
  if (!input) return null;
  const target = input.trim().toUpperCase();
  const entries = (process.env.INVITE_CODES || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const parts = entry.split(':');
    const code = parts[0]?.trim().toUpperCase();
    if (!code || code !== target) continue;
    const durationSpec = parts[1]?.trim();
    if (durationSpec) {
      const ms = parseDurationToMs(durationSpec);
      if (ms) return { code, durationMs: ms };
    }
    return { code, durationMs: defaultTrialMs() };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const mode = String(body.mode || '');
  const email = normalizeEmail(body.email);
  const code = String(body.code || '').trim();

  if (!email || !code) {
    return Response.json({ error: 'Faltan datos.' }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: profile, error: fetchErr } = await admin
    .from('profiles')
    .select('email, name, redeemed_code, pending_code, pending_code_expires_at, pending_code_attempts, pending_code_purpose, email_verified')
    .eq('email', email)
    .maybeSingle();

  if (fetchErr || !profile) {
    return Response.json({ error: 'Código inválido.' }, { status: 400 });
  }

  if (!profile.pending_code || !profile.pending_code_expires_at) {
    return Response.json({ error: 'No hay un código activo. Pedí uno nuevo.' }, { status: 400 });
  }

  if (new Date(profile.pending_code_expires_at).getTime() < Date.now()) {
    return Response.json({ error: 'El código venció. Pedí uno nuevo.' }, { status: 400 });
  }

  if ((profile.pending_code_attempts || 0) >= MAX_ATTEMPTS) {
    return Response.json({ error: 'Demasiados intentos. Pedí un código nuevo.' }, { status: 429 });
  }

  if (profile.pending_code !== code) {
    await admin
      .from('profiles')
      .update({ pending_code_attempts: (profile.pending_code_attempts || 0) + 1 })
      .eq('email', email);
    return Response.json({ error: 'Código incorrecto.' }, { status: 400 });
  }

  // ── Código correcto ───────────────────────────────────────────

  // SIGNUP
  if (mode === 'signup' && profile.pending_code_purpose === 'signup') {
    const password = String(body.password || '');
    if (password.length < 8) {
      return Response.json({ error: 'Contraseña inválida.' }, { status: 400 });
    }

    const inviteMatch = profile.redeemed_code ? lookupInviteCode(profile.redeemed_code) : null;
    const trialEndsAt = inviteMatch ? new Date(Date.now() + inviteMatch.durationMs).toISOString() : null;

    const patch: Record<string, unknown> = {
      email_verified: true,
      pending_code: null,
      pending_code_expires_at: null,
      pending_code_attempts: 0,
      pending_code_purpose: null,
    };
    if (inviteMatch) {
      patch.subscription_status = 'trialing';
      patch.trial_ends_at = trialEndsAt;
      patch.redeemed_code = inviteMatch.code;
      patch.activated_at = new Date().toISOString();
    } else {
      // Si no había código → limpiar el redeemed_code "pending"
      patch.redeemed_code = null;
    }

    await admin.from('profiles').update(patch).eq('email', email);

    const supabase = await createClient();
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) {
      console.error('[verify-code/signup] signIn:', signErr);
      return Response.json({ ok: true, redirect: '/login' });
    }

    return Response.json({
      ok: true,
      redirect: '/inicio',
      trial: inviteMatch ? { endsAt: trialEndsAt, durationMs: inviteMatch.durationMs } : null,
    });
  }

  // RESET
  if (mode === 'reset' && profile.pending_code_purpose === 'reset') {
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 8) {
      return Response.json(
        { error: 'La contraseña tiene que tener al menos 8 caracteres.' },
        { status: 400 },
      );
    }

    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
    const authUser = list?.users?.find(u => u.email?.toLowerCase() === email);
    if (!authUser) {
      return Response.json({ error: 'Cuenta no encontrada.' }, { status: 404 });
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(authUser.id, {
      password: newPassword,
    });
    if (updErr) {
      console.error('[verify-code/reset] updateUser:', updErr);
      return Response.json({ error: 'No pudimos cambiar la contraseña.' }, { status: 500 });
    }

    await admin
      .from('profiles')
      .update({
        pending_code: null,
        pending_code_expires_at: null,
        pending_code_attempts: 0,
        pending_code_purpose: null,
        email_verified: true,
      })
      .eq('email', email);

    const supabase = await createClient();
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: newPassword });
    if (signErr) {
      return Response.json({ ok: true, redirect: '/login' });
    }
    return Response.json({ ok: true, redirect: '/inicio' });
  }

  return Response.json({ error: 'Modo inválido.' }, { status: 400 });
}
