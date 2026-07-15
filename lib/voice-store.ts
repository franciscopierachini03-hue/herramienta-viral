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
