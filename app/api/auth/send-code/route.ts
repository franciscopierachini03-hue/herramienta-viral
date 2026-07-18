import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { findAuthUserByEmail } from '@/lib/auth-users';
import { generateCode, sendVerificationCode, sendPasswordResetCode } from '@/lib/email/resend';

// POST /api/auth/send-code
//
// Genera un código de 6 dígitos, lo guarda en profiles.pending_code y lo manda
// por email vía Resend.
//
// Body:
//   { mode: 'signup', email, password, name, phone, code? }
//      → Pre-crea el auth user (email_confirm=true para que después pueda loguear)
//        + profile con email_verified=false. Manda código.
//   { mode: 'reset', email }
//      → Genera código para reseteo de contraseña. Responde ok=true incluso si
//        el email no existe (para no exponer la lista de cuentas).
//
// Rate limit: máx 1 envío cada 60 segundos por email.

const CODE_TTL_MS = 15 * 60 * 1000;       // 15 minutos
const MIN_RESEND_MS = 60 * 1000;          // 60 seg entre reenvíos

function normalizeEmail(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const mode = String(body.mode || '');
  const email = normalizeEmail(body.email);

  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Correo inválido.' }, { status: 400 });
  }

  const admin = createServiceClient();

  // ── Rate limit común ──────────────────────────────────────────
  const { data: existing } = await admin
    .from('profiles')
    .select('pending_code_expires_at, email_verified')
    .eq('email', email)
    .maybeSingle();

  if (existing?.pending_code_expires_at) {
    const sentAt = new Date(existing.pending_code_expires_at).getTime() - CODE_TTL_MS;
    const since = Date.now() - sentAt;
    if (since < MIN_RESEND_MS) {
      const wait = Math.ceil((MIN_RESEND_MS - since) / 1000);
      return Response.json(
        { error: `Espera ${wait}s antes de pedir otro código.` },
        { status: 429 },
      );
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  // ─────────────────────────────────────────────────────────────
  // SIGNUP
  // ─────────────────────────────────────────────────────────────
  if (mode === 'signup') {
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const inviteCode = body.code ? String(body.code).trim() : null;

    if (password.length < 8) {
      return Response.json(
        { error: 'La contraseña tiene que tener al menos 8 caracteres.' },
        { status: 400 },
      );
    }
    if (name.length < 2) return Response.json({ error: 'Necesitamos tu nombre.' }, { status: 400 });
    if (phone.length < 6) return Response.json({ error: 'Necesitamos tu teléfono.' }, { status: 400 });

    // Si ya hay cuenta verificada con ese email → bloquear
    if (existing?.email_verified) {
      return Response.json(
        { error: 'Ya hay una cuenta con ese correo. Inicia sesión.' },
        { status: 409 },
      );
    }

    // ¿Existe el auth.user? Busca en TODAS las páginas (con 100+ cuentas, la
    // página 1 sola no alcanza — ver lib/auth-users.ts). Si no existe, lo
    // creamos. Si sí pero no está verificado, actualizamos su password.
    let existingUser = await findAuthUserByEmail(admin, email);

    if (!existingUser) {
      const meta = { name, phone, pending_invite: inviteCode, terms_accepted_at: new Date().toISOString(), terms_version: 'v1' };
      const { error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        // Aceptó los términos en el checkbox del registro (el cliente bloquea sin él).
        user_metadata: meta,
      });
      if (createErr) {
        // Red de seguridad: si igual chocó con "ya registrado" (carrera u otra
        // fuente de cuentas), recuperamos la cuenta en vez de morir con 500.
        if (/already|registered|exists/i.test(createErr.message || '')) {
          existingUser = await findAuthUserByEmail(admin, email);
        }
        if (!existingUser) {
          console.error('[send-code/signup] createUser:', createErr);
          return Response.json({ error: 'No pudimos crear la cuenta.' }, { status: 500 });
        }
      }
    }
    if (existingUser) {
      // Si existe pero no fue verificado por nosotros → permitir reintento.
      // email_confirm:true repara cuentas que quedaron a medias (ej. pagaron y
      // el webhook viejo las creó sin confirmar) — sin esto el login fallaba con
      // "Email not confirmed" aunque la clave fuera correcta.
      await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(existingUser.user_metadata || {}), name, phone, pending_invite: inviteCode, terms_accepted_at: new Date().toISOString(), terms_version: 'v1' },
      });
    }

    // OJO: solo tocamos redeemed_code si la persona TIPEÓ un código. Si no,
    // no lo pisamos: perfiles activados por webhook/cortesía (ej. LegacyQuito)
    // ya traen el suyo y el signup no debe borrarlo.
    const row: Record<string, unknown> = {
      email,
      name,
      phone,
      email_verified: false,
      pending_code: code,
      pending_code_expires_at: expiresAt,
      pending_code_attempts: 0,
      pending_code_purpose: 'signup',
    };
    if (inviteCode) row.redeemed_code = inviteCode;
    const { error: upErr } = await admin
      .from('profiles')
      .upsert(row, { onConflict: 'email' });

    if (upErr) {
      console.error('[send-code/signup] upsert:', upErr);
      return Response.json({ error: 'Error al guardar el código.' }, { status: 500 });
    }

    try {
      await sendVerificationCode(email, code, name);
    } catch (e) {
      console.error('[send-code/signup] resend:', e);
      return Response.json({ error: 'No pudimos enviar el correo.' }, { status: 500 });
    }

    return Response.json({ ok: true });
  }

  // ─────────────────────────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────────────────────────
  if (mode === 'reset') {
    // Por seguridad, respondemos ok=true incluso si el email no existe.
    if (!existing) return Response.json({ ok: true });

    const { error: upErr } = await admin
      .from('profiles')
      .update({
        pending_code: code,
        pending_code_expires_at: expiresAt,
        pending_code_attempts: 0,
        pending_code_purpose: 'reset',
      })
      .eq('email', email);

    if (upErr) {
      console.error('[send-code/reset] update:', upErr);
      return Response.json({ ok: true });
    }

    try {
      await sendPasswordResetCode(email, code);
    } catch (e) {
      console.error('[send-code/reset] resend:', e);
    }

    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Modo inválido.' }, { status: 400 });
}
