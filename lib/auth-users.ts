import type { SupabaseClient, User } from '@supabase/supabase-js';

// Busca un auth user por email recorriendo TODAS las páginas.
//
// ⚠️ Nunca usar listUsers({ page: 1 }) suelto para "¿existe este email?":
// con 100+ cuentas, los usuarios de la página 2 en adelante no aparecen y el
// signup intentaba CREARLOS de nuevo → "No pudimos crear la cuenta." (y el
// reset les decía "Cuenta no encontrada"). Bug real: Jazmín, 267 cuentas,
// la suya estaba en la página 2.
export async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const target = (email || '').trim().toLowerCase();
  if (!target) return null;
  for (let page = 1; page <= 60; page++) {          // 60 × 200 = 12.000 cuentas
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const users = data?.users || [];
    const hit = users.find(u => (u.email || '').toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) break;                  // última página
  }
  return null;
}
