import { createServiceClient } from '@/lib/supabase/server';

// Guarda/lee el voice_id de ElevenLabs por usuario (tabla voice_clones).
// Si la tabla no existe (no corriste el SQL) → configured:false, para que el
// /studio muestre "configúrame" en vez de romper.

export async function getVoice(email: string): Promise<{ configured: boolean; voiceId: string | null; nombre: string | null }> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from('voice_clones').select('voice_id, nombre').eq('email', email).maybeSingle();
    if (error) return { configured: false, voiceId: null, nombre: null };
    return { configured: true, voiceId: data?.voice_id ?? null, nombre: data?.nombre ?? null };
  } catch {
    return { configured: false, voiceId: null, nombre: null };
  }
}

export async function saveVoice(email: string, voiceId: string, nombre: string): Promise<boolean> {
  try {
    const sb = createServiceClient();
    const { error } = await sb.from('voice_clones').upsert(
      { email, voice_id: voiceId, nombre: nombre.slice(0, 60), created_at: new Date().toISOString() },
      { onConflict: 'email' },
    );
    return !error;
  } catch { return false; }
}

// ── Video base del clon (arquitectura lipsync) ───────────────────────────────
// El video selfie que la persona sube UNA vez; cada reel le sincroniza la boca.
// Vive en la misma fila de voice_clones (columna base_video_url, ver
// supabase/clon_video.sql). Si falta la columna → mensaje claro, no rompe.

export async function getBaseVideo(email: string): Promise<{ url: string | null; faltaSql: boolean }> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from('voice_clones').select('base_video_url').eq('email', email).maybeSingle();
    if (error) return { url: null, faltaSql: /base_video_url|column|does not exist/i.test(error.message || '') };
    return { url: (data as { base_video_url?: string } | null)?.base_video_url ?? null, faltaSql: false };
  } catch { return { url: null, faltaSql: false }; }
}

export async function saveBaseVideo(email: string, url: string): Promise<{ ok: boolean; faltaSql: boolean }> {
  try {
    const sb = createServiceClient();
    const { error } = await sb.from('voice_clones').upsert(
      { email, base_video_url: url },
      { onConflict: 'email' },
    );
    if (error) return { ok: false, faltaSql: /base_video_url|column|does not exist|null value/i.test(error.message || '') };
    return { ok: true, faltaSql: false };
  } catch { return { ok: false, faltaSql: false }; }
}
