// TOPCUT — auth del lado server para el backend de render (Hetzner).
//
// Problema: api.viraladn.com hace el render (caro). No queremos que cualquiera
// le mande trabajos. Solución sin exponer un token largo en el navegador:
//
//   • Llamadas chicas (chat, render, poll)  → proxy /api/topcut/* (este server
//     reenvía a Hetzner agregando un ticket; el token NUNCA toca el browser).
//   • Subida del video (grande, no pasa por Vercel) → va directa a Hetzner con
//     un TICKET corto que firmamos acá solo para usuarios con suscripción.
//
// El ticket es un HMAC-SHA256 (estilo JWT compacto) con TTL corto. Hetzner lo
// verifica con el MISMO secreto (VIDEO_SIGNING_SECRET) y rechaza lo inválido/
// vencido. Si el secreto no está seteado, el ticket sale vacío (no rompe nada
// mientras el backend siga sin auth).

import { createHmac } from 'crypto';
import { createClient } from '@/lib/supabase/server';

const TICKET_TTL_SEC = 30 * 60; // 30 min: alcanza para una sesión de edición

// Owner permanente + admins: siempre pueden probar TOPCUT aunque no tengan
// suscripción de pago (mismo criterio que /api/auth/is-admin).
const PERMANENT_OWNERS = ['franciscopierachini03@gmail.com'];
function isAdminEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  if (PERMANENT_OWNERS.includes(e)) return true;
  const list = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(e);
}

export function videoApiBase(): string {
  return (process.env.VIDEO_API || process.env.NEXT_PUBLIC_VIDEO_API || 'https://api.viraladn.com').replace(/\/+$/, '');
}

// Firma un ticket corto. Sin secreto → token vacío (backend todavía abierto).
export function mintTicket(sub: string): { token: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + TICKET_TTL_SEC;
  const secret = process.env.VIDEO_SIGNING_SECRET;
  if (!secret) return { token: '', exp };
  const body = Buffer.from(JSON.stringify({ sub, scope: 'topcut', exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return { token: `${body}.${sig}`, exp };
}

// Gate: ¿el que llama puede usar TOPCUT? (logueado + suscripción activa/trial,
// o admin). Devuelve el email o null. Espeja la lógica del middleware.
export async function requireTopcutUser(): Promise<{ email: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email;

  // Modo dev (REQUIRE_AUTH != 1): el middleware deja pasar todo, acá también.
  if (process.env.REQUIRE_AUTH !== '1') return { email: email || 'dev' };

  if (!email) return null;
  if (isAdminEmail(email)) return { email };

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('email', email)
    .maybeSingle();

  const status = profile?.subscription_status ?? 'pending';
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialActive = !!trialEndsAt && trialEndsAt.getTime() > Date.now();
  const ok = status === 'active' || (status === 'trialing' && trialActive);
  return ok ? { email } : null;
}
