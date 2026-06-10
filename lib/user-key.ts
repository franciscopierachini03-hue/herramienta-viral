'use client';

// Identificador del usuario logueado, para namespacear datos del navegador
// (ej. el historial de videos en localStorage) y que una cuenta nunca vea los
// datos de otra que entró en el mismo navegador. Sale de /api/access (email),
// sanitizado a [a-z0-9]. Cacheado por carga de página (login/logout recargan).

let cached: string | null = null;

export async function getUserKey(): Promise<string> {
  if (cached !== null) return cached;
  try {
    const r = await fetch('/api/access', { cache: 'no-store' });
    const d = r.ok ? await r.json() : null;
    cached = String(d?.email || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  } catch {
    cached = '';
  }
  return cached;
}
