import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// GET /api/admin/export — descarga la tabla profiles como CSV.
// Solo accesible para emails en ADMIN_EMAILS.

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return new Response('Forbidden', { status: 403 });
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from('profiles')
    .select('email, name, phone, subscription_status, trial_ends_at, activated_at, cancelled_at, redeemed_code, stripe_customer_id, stripe_subscription_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/export] error:', error);
    return new Response('Error', { status: 500 });
  }

  const headers = [
    'email', 'name', 'phone', 'subscription_status', 'trial_ends_at',
    'activated_at', 'cancelled_at', 'redeemed_code', 'stripe_customer_id',
    'stripe_subscription_id', 'created_at',
  ];

  const lines = [headers.join(',')];
  for (const row of (data || [])) {
    lines.push(headers.map(h => csvEscape((row as Record<string, unknown>)[h])).join(','));
  }
  const csv = lines.join('\n');

  const filename = `viraladn-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
