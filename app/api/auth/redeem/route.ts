import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// POST /api/auth/redeem { code }
//
// Permite que un USUARIO YA LOGUEADO active un trial usando un código de
// invitación. Útil cuando alguien creó la cuenta pero no usó código en el
// momento, o cuando un código se les pasa después.
//
// Reglas:
// - Solo si el usuario está logueado
// - Solo si NO tiene suscripción 'active' (no robar pagos a quien ya pagó)
// - El código debe estar en INVITE_CODES con su duración
// - Soporta formato CODE o CODE:DURATION (15m, 2h, 5d)

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
  const entries = (process.env.INVITE_CODES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

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
  const { code } = await req.json();
  if (!code) return Response.json({ error: 'Falta el código.' }, { status: 400 });

  // 1. Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return Response.json({ error: 'Tenés que iniciar sesión primero.' }, { status: 401 });
  }

  // 2. Validar el código
  const match = lookupInviteCode(code);
  if (!match) {
    // Log para que el admin pueda diagnosticar — si alguien intenta un código
    // que se ve legítimo pero no está en la lista, queremos saberlo.
    const configuredCodes = (process.env.INVITE_CODES || '')
      .split(',').map(s => s.trim()).filter(Boolean).length;
    console.warn(`[redeem] código rechazado: "${code}" — INVITE_CODES tiene ${configuredCodes} códigos configurados`);
    return Response.json({
      error: 'Código no válido o expirado. Si pensás que debería funcionar, contactá al equipo.',
    }, { status: 400 });
  }

  // 3. Chequear estado actual del usuario
  const admin = createServiceClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status, redeemed_code')
    .eq('email', user.email)
    .maybeSingle();

  if (profile?.subscription_status === 'active') {
    return Response.json({
      error: 'Ya tenés una suscripción activa. No necesitás canjear un código.',
    }, { status: 400 });
  }

  // 4. Activar trial
  const trialEndsAt = new Date(Date.now() + match.durationMs).toISOString();
  const { error: upsertErr } = await admin
    .from('profiles')
    .update({
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt,
      redeemed_code: match.code,
      activated_at: new Date().toISOString(),
    })
    .eq('email', user.email);

  if (upsertErr) {
    console.error('[redeem]', upsertErr);
    return Response.json({ error: 'No pudimos activar el código. Probá de nuevo.' }, { status: 500 });
  }

  return Response.json({
    ok: true,
    redirect: '/app',
    trial: { endsAt: trialEndsAt, durationMs: match.durationMs },
  });
}
