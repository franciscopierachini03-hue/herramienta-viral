import { createServiceClient } from '@/lib/supabase/server';

// Biblioteca de clases grabadas de /comunidad (el "classroom").
// Todo con service role (bypassa RLS); el acceso lo gatea /api/comunidad/clases.
// Si la tabla no existe (no corriste el SQL) → configurada:false y el resto de
// la app muestra "pronto"/"configúrame" sin romper.

export type Archivo = { nombre: string; url: string };

export type Clase = {
  id: string;
  fecha: string;         // 'YYYY-MM-DD'
  titulo: string;
  resumen: string | null;
  video_url: string | null;
  archivos: Archivo[];
  creado: string;
};

const BUCKET = 'clases';

// Deja solo archivos {nombre,url} válidos (defensa por si viene basura del form).
function limpiarArchivos(x: unknown): Archivo[] {
  if (!Array.isArray(x)) return [];
  return x
    .map((a) => ({
      nombre: String((a as Archivo)?.nombre || '').slice(0, 160),
      url: String((a as Archivo)?.url || '').slice(0, 2000),
    }))
    .filter((a) => a.nombre && /^https?:\/\//i.test(a.url))
    .slice(0, 30);
}

export async function listarClases(): Promise<{ configurada: boolean; clases: Clase[] }> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('clases_grabadas')
      .select('id, fecha, titulo, resumen, video_url, archivos, creado')
      .order('fecha', { ascending: false })
      .order('creado', { ascending: false });
    if (error) return { configurada: false, clases: [] };
    const clases = (data || []).map((c) => ({ ...c, archivos: limpiarArchivos(c.archivos) })) as Clase[];
    return { configurada: true, clases };
  } catch {
    return { configurada: false, clases: [] };
  }
}

export type ClaseInput = {
  fecha: string;
  titulo: string;
  resumen?: string;
  video_url?: string;
  archivos?: Archivo[];
};

function normalizar(input: ClaseInput) {
  return {
    fecha: String(input.fecha || '').slice(0, 10),
    titulo: String(input.titulo || '').trim().slice(0, 200),
    resumen: (input.resumen ?? '').toString().trim().slice(0, 4000) || null,
    video_url: (input.video_url ?? '').toString().trim().slice(0, 2000) || null,
    archivos: limpiarArchivos(input.archivos),
  };
}

export async function crearClase(input: ClaseInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const row = normalizar(input);
  if (!row.fecha || !row.titulo) return { ok: false, error: 'Falta la fecha o el título.' };
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from('clases_grabadas').insert(row).select('id').maybeSingle();
    if (error) return { ok: false, error: error.message.includes('does not exist') ? 'Falta correr clases_grabadas.sql.' : error.message };
    return { ok: true, id: data?.id };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function editarClase(id: string, input: ClaseInput): Promise<{ ok: boolean; error?: string }> {
  const row = normalizar(input);
  if (!row.fecha || !row.titulo) return { ok: false, error: 'Falta la fecha o el título.' };
  try {
    const sb = createServiceClient();
    const { error } = await sb.from('clases_grabadas').update(row).eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function borrarClase(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = createServiceClient();
    const { error } = await sb.from('clases_grabadas').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

// Firma una subida directa (navegador → Supabase Storage) para un archivo de
// clase. Devuelve la URL firmada (PUT) y la URL pública final que se guarda.
export async function firmarSubida(
  nombreArchivo: string,
): Promise<{ ok: boolean; token?: string; publicUrl?: string; path?: string; bucket?: string; error?: string }> {
  const limpio = String(nombreArchivo || 'archivo')
    .normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-120) || 'archivo';
  // prefijo random (sin depender de la hora) para no pisar archivos con el mismo nombre.
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `grabaciones/${rand}_${limpio}`;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      const msg = /not found|does not exist|bucket/i.test(error?.message || '')
        ? `Falta crear el bucket "${BUCKET}" en Supabase → Storage (marcalo Public).`
        : (error?.message || 'No se pudo preparar la subida.');
      return { ok: false, error: msg };
    }
    const publicUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return { ok: true, token: data.token, publicUrl, path, bucket: BUCKET };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
