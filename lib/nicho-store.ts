// Guardado del cliente ideal + palabras clave por usuario (ViralADN).
// Una fila por usuario en public.nicho_usuario (ver supabase/nicho_usuario.sql).
// Si la tabla todavía no existe → "dormido": el resto de la app sigue andando,
// solo que las palabras no persisten hasta correr el SQL.

import { createServiceClient } from '@/lib/supabase/server';

export type Nicho = { clienteIdeal: string; palabras: string[] };

function tablaFalta(err: unknown): boolean {
  const e = err as { message?: string; code?: string } | null;
  const msg = e?.message || '';
  return e?.code === '42P01' || (/nicho_usuario/.test(msg) && /exist/i.test(msg));
}

function limpiarPalabras(arr: unknown): string[] {
  const lista = Array.isArray(arr) ? arr : [];
  const out: string[] = [];
  const vistas = new Set<string>();
  for (const x of lista) {
    if (typeof x !== 'string') continue;
    const t = x.trim().slice(0, 60);
    const k = t.toLowerCase();
    if (!t || vistas.has(k)) continue;
    vistas.add(k);
    out.push(t);
    if (out.length >= 200) break;
  }
  return out;
}

export async function getNicho(userId: string): Promise<{ nicho: Nicho; dormido: boolean }> {
  const vacio: Nicho = { clienteIdeal: '', palabras: [] };
  const admin = createServiceClient();
  const { data, error } = await admin
    .from('nicho_usuario')
    .select('cliente_ideal, palabras')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { nicho: vacio, dormido: tablaFalta(error) };
  if (!data) return { nicho: vacio, dormido: false };
  return {
    nicho: { clienteIdeal: data.cliente_ideal || '', palabras: limpiarPalabras(data.palabras) },
    dormido: false,
  };
}

export async function saveNicho(userId: string, clienteIdeal: string, palabras: string[]): Promise<{ ok: boolean; dormido: boolean }> {
  const admin = createServiceClient();
  const { error } = await admin.from('nicho_usuario').upsert(
    {
      user_id: userId,
      cliente_ideal: (clienteIdeal || '').slice(0, 1000),
      palabras: limpiarPalabras(palabras),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) return { ok: false, dormido: tablaFalta(error) };
  return { ok: true, dormido: false };
}
