// Acceso por producto del usuario logueado (server-side).
//
// Fuente de verdad del entitlement (a qué plataforma entra cada quien):
//   1. Admin (dueño) → las dos.
//   2. Suscripción de Stripe por PRICE ID (entitlementForCustomer):
//        ViralADN / TOPCUT / Combo / legacy $47 (fundadores → las dos).
//   3. Trial o código de regalo (sin sub de Stripe): solo ViralADN
//      (todos los accesos previos al lanzamiento eran de ViralADN).
//
// OJO: el webhook pone subscription_status='active' para CUALQUIER producto,
// así que NO sirve para decidir ViralADN — por eso el entitlement por producto
// se saca del PRICE ID de Stripe, no del status del perfil.

import { createClient } from '@/lib/supabase/server';
import { entitlementForCustomer, type Entitlement } from '@/lib/entitlement';

export const PERMANENT_OWNERS = ['franciscopierachini03@gmail.com'];

// Códigos de cortesía (redeemed_code) que desbloquean LAS DOS plataformas
// (ViralADN + TOPCUT), no solo ViralADN. Para accesos de cortesía "full".
export const CORTESIA_FULL = new Set(['CORTESIA-FULL']);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (PERMANENT_OWNERS.includes(e)) return true;
  return (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(e);
}

export type Access = {
  email: string | null;
  name: string | null;
  admin: boolean;
  ent: Entitlement;
};

export async function getAccess(): Promise<Access> {
  const empty: Access = { email: null, name: null, admin: false, ent: { viraladn: false, topcut: false } };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return empty;

  const email = user.email;
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, name, subscription_status, trial_ends_at, redeemed_code')
    .eq('email', email)
    .maybeSingle();

  const name = profile?.name ?? null;

  if (isAdminEmail(email)) {
    return { email, name, admin: true, ent: { viraladn: true, topcut: true } };
  }

  // Entitlement por suscripción de Stripe (autoritativo para quien paga).
  const ent = await entitlementForCustomer(profile?.stripe_customer_id);

  // Trial/código vigente (sin sub de Stripe) → ViralADN.
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialActive = !!trialEndsAt && trialEndsAt.getTime() > Date.now();
  if (profile?.subscription_status === 'trialing' && trialActive) ent.viraladn = true;

  // Cuentas activadas por CÓDIGO sin suscripción de Stripe (cortesías como
  // COURTESY_ONELIFE, accesos manuales): status 'active' + redeemed_code y
  // ninguna sub que les dé permisos. Acceso a ViralADN mientras siga vigente
  // (o sin vencimiento). Sin esto quedaban con todo bloqueado → "pagá".
  if (
    !ent.viraladn && !ent.topcut &&
    profile?.subscription_status === 'active' &&
    profile?.redeemed_code &&
    (trialActive || !trialEndsAt)
  ) {
    ent.viraladn = true;
    // Cortesías "full" (redeemed_code marcado) → también TOPCUT = acceso completo.
    if (CORTESIA_FULL.has(profile.redeemed_code.trim().toUpperCase())) ent.topcut = true;
  }

  return { email, name, admin: false, ent };
}
