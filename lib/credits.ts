// Créditos de IA (Avatares / foto→video) por usuario.
//
// Modelo: cada plan trae N créditos al mes. Cada generación gasta créditos.
// Como el costo del API se paga con esos créditos (y el crédito se cobra por
// encima del costo), el costo NETO del negocio ≈ 0.
//
// Persistencia: tabla `ai_credits` en Supabase (corré el SQL de
// `supabase/ai_credits.sql` UNA vez). Si la tabla todavía no existe, todo
// devuelve configured:false y la herramienta muestra "configúrame" sin romper.

import { createServiceClient } from '@/lib/supabase/server';
import type { Entitlement } from '@/lib/products';

// Créditos mensuales por plan (ajustable). 1 imagen = 1 crédito, 1 video = 10.
export const PLAN_CREDITS = { viraladn: 50, topcut: 50, combo: 150 } as const;

// Costo en créditos por tipo de generación. El video tiene dos niveles:
// videoFast (LTX, ≈$0.10/clip) y video pro (Kling, ≈$0.28/clip).
export const CREDIT_COST = { image: 1, video: 10, videoFast: 3 } as const;

// Cuántos créditos/mes le tocan a este usuario según su plan.
export function monthlyGrantFor(ent: Entitlement, admin: boolean): number {
  if (admin) return 1_000_000;            // dueño/admin: prácticamente ilimitado
  if (ent.viraladn && ent.topcut) return PLAN_CREDITS.combo;
  if (ent.topcut) return PLAN_CREDITS.topcut;
  if (ent.viraladn) return PLAN_CREDITS.viraladn;
  return 0;                                // sin plan pago → sin créditos
}

// Mes actual como 'YYYY-MM' (clave del período para el refill mensual).
function periodKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export type CreditState = { configured: boolean; balance: number; grant: number };

// Lee el saldo, refrescando el grant si cambió el mes (sin acumular). Si la
// tabla no existe (no corriste el SQL) → configured:false.
export async function getCredits(email: string, grant: number): Promise<CreditState> {
  try {
    const sb = createServiceClient();
    const period = periodKey();
    const { data, error } = await sb
      .from('ai_credits')
      .select('balance, period')
      .eq('email', email)
      .maybeSingle();

    if (error) return { configured: false, balance: 0, grant };

    if (!data) {
      await sb.from('ai_credits').upsert(
        { email, balance: grant, period, updated_at: new Date().toISOString() },
        { onConflict: 'email' },
      );
      return { configured: true, balance: grant, grant };
    }

    if (data.period !== period) {
      await sb.from('ai_credits')
        .update({ balance: grant, period, updated_at: new Date().toISOString() })
        .eq('email', email);
      return { configured: true, balance: grant, grant };
    }

    return { configured: true, balance: data.balance ?? 0, grant };
  } catch {
    return { configured: false, balance: 0, grant };
  }
}

// Descuenta n créditos si alcanza. Read-modify-write: suficiente para v1 (el
// peor caso de una carrera es cobrar de más una sola vez). Si querés exactitud
// estricta, mové esto a una función SQL `spend_credits` con UPDATE ... RETURNING.
export async function spendCredits(
  email: string, n: number, grant: number,
): Promise<{ ok: boolean; balance: number; configured: boolean }> {
  const st = await getCredits(email, grant);
  if (!st.configured) return { ok: false, balance: 0, configured: false };
  if (st.balance < n) return { ok: false, balance: st.balance, configured: true };
  const newBalance = st.balance - n;
  try {
    const sb = createServiceClient();
    await sb.from('ai_credits')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('email', email);
    return { ok: true, balance: newBalance, configured: true };
  } catch {
    return { ok: false, balance: st.balance, configured: false };
  }
}

// Devuelve créditos (ej. si una generación falló después de cobrar).
export async function refundCredits(email: string, n: number): Promise<void> {
  try {
    const sb = createServiceClient();
    const { data } = await sb.from('ai_credits').select('balance').eq('email', email).maybeSingle();
    if (!data) return;
    await sb.from('ai_credits')
      .update({ balance: (data.balance ?? 0) + n, updated_at: new Date().toISOString() })
      .eq('email', email);
  } catch { /* best-effort */ }
}
