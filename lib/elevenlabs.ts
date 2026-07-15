// ElevenLabs — clonado de voz (Instant Voice Cloning) + texto→voz.
//
// DORMIDO sin ELEVENLABS_API_KEY: cada función tira un error claro y el /studio
// muestra "configúrame". Se cobra por uso vía créditos (lib/credits.ts).
//
// Flujo del "clon que habla":
//   1. crearVoz(email, muestra)  → clona la voz de la persona → voice_id (se guarda).
//   2. hablar(voiceId, guion)    → audio con SU voz (mp3 base64) → alimenta a fal sadtalker.

const BASE = 'https://api.elevenlabs.io/v1';

function key(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error('ELEVENLABS_API_KEY no configurada (voz).');
  return k;
}

// Crea una voz clonada (Instant Voice Cloning) desde una muestra de audio.
// muestra: base64 SIN prefijo · mime ej. 'audio/mpeg' | 'audio/wav' | 'audio/webm'.
// Devuelve el voice_id que hay que guardar por usuario.
export async function crearVoz(nombre: string, muestraBase64: string, mime = 'audio/mpeg'): Promise<{ voiceId: string }> {
  const bin = Buffer.from(muestraBase64, 'base64');
  const ext = mime.includes('wav') ? 'wav' : mime.includes('webm') ? 'webm' : mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : 'mp3';
  const form = new FormData();
  form.append('name', nombre.slice(0, 60) || 'Voz ViralADN');
  form.append('remove_background_noise', 'true');
  form.append('files', new Blob([bin], { type: mime }), `muestra.${ext}`);

  const res = await fetch(`${BASE}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': key() },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('La key de ElevenLabs es inválida.');
    if (res.status === 403 || /can_not_use_instant_voice_cloning|subscription/i.test(t))
      throw new Error('Tu plan de ElevenLabs no permite clonar voz — necesitás al menos el plan Starter.');
    throw new Error(`ElevenLabs ${res.status}: ${t.slice(0, 200)}`);
  }
  const d = await res.json();
  const voiceId = d?.voice_id;
  if (!voiceId) throw new Error('ElevenLabs no devolvió voice_id.');
  return { voiceId };
}

// Texto → voz con la voz clonada. Devuelve el audio mp3 como base64 (para
// pasarlo a fal sadtalker como data URL).
export async function hablar(voiceId: string, texto: string): Promise<{ audioBase64: string; mime: string }> {
  const model = process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2';
  const res = await fetch(`${BASE}/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: texto.slice(0, 5000),
      model_id: model,
      voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('La key de ElevenLabs es inválida.');
    if (res.status === 404) throw new Error('Esa voz ya no existe en ElevenLabs — volvé a crear tu clon.');
    throw new Error(`ElevenLabs TTS ${res.status}: ${t.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { audioBase64: buf.toString('base64'), mime: 'audio/mpeg' };
}

// Borra una voz (para re-clonar limpio). Best-effort.
export async function borrarVoz(voiceId: string): Promise<void> {
  try { await fetch(`${BASE}/voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE', headers: { 'xi-api-key': key() } }); }
  catch { /* noop */ }
}

// ¿La key está configurada y es válida? (para el semáforo de /studio).
export async function elevenLabsSano(): Promise<'ok' | string> {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) return 'falta la env ELEVENLABS_API_KEY';
  try {
    const r = await fetch(`${BASE}/user/subscription`, { headers: { 'xi-api-key': k }, cache: 'no-store' });
    if (r.status === 401) return 'la key es inválida';
    if (!r.ok) return `error ${r.status}`;
    const d = await r.json();
    // can_use_instant_voice_cloning = false en el plan Free.
    if (d && d.can_use_instant_voice_cloning === false) return 'tu plan no permite clonar voz (subí a Starter)';
    return 'ok';
  } catch { return 'sin conexión con ElevenLabs'; }
}
