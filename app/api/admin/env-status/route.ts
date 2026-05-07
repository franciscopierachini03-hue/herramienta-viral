import { createClient } from '@/lib/supabase/server';

// GET /api/admin/env-status
//
// Devuelve el estado SANITIZADO de las env vars críticas.
// Solo responde a usuarios admin (ADMIN_EMAILS o hardcoded owners).
// No revela los valores completos — solo si están configuradas y un preview.

const HARDCODED_OWNERS = ['franciscopierachini03@gmail.com'];

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (HARDCODED_OWNERS.includes(e)) return true;
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(e);
}

function maskCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return '';
  // Si tiene formato CODE:duration → conservar la duration
  const parts = trimmed.split(':');
  const name = parts[0] || '';
  const dur = parts[1] ? `:${parts[1]}` : '';
  if (name.length <= 4) return name + dur;
  return name.slice(0, 4) + '***' + dur;
}

function maskEmail(email: string): string {
  const e = email.trim();
  if (!e) return '';
  const at = e.indexOf('@');
  if (at < 0) return e.slice(0, 4) + '***';
  return e.slice(0, Math.min(4, at)) + '***' + e.slice(at);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return Response.json({ error: 'No autorizado' }, { status: 403 });
  }

  // INVITE_CODES
  const inviteCodesRaw = process.env.INVITE_CODES || '';
  const inviteCodes = inviteCodesRaw.split(',').map(s => s.trim()).filter(Boolean);

  // ADMIN_EMAILS
  const adminEmailsRaw = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsRaw.split(',').map(s => s.trim()).filter(Boolean);

  return Response.json({
    INVITE_CODES: {
      configured: inviteCodes.length > 0,
      count: inviteCodes.length,
      preview: inviteCodes.map(maskCode),
    },
    ADMIN_EMAILS: {
      configured: adminEmails.length > 0,
      count: adminEmails.length,
      preview: adminEmails.map(maskEmail),
    },
    ADMIN_PIN: {
      configured: !!process.env.ADMIN_PIN,
    },
    STRIPE_SECRET_KEY: {
      configured: !!process.env.STRIPE_SECRET_KEY,
      mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live'
          : process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test'
          : 'unknown',
    },
    APIFY_TOKEN: {
      configured: !!process.env.APIFY_TOKEN,
    },
    OPENAI_API_KEY: {
      configured: !!process.env.OPENAI_API_KEY,
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '(no configurado)',
    TRIAL_DAYS: process.env.TRIAL_DAYS || '(default: 5)',
  });
}
