import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { spendCredits, refundCredits, monthlyGrantFor, CREDIT_COST } from '@/lib/credits';
import { crearVoz, borrarVoz } from '@/lib/elevenlabs';
import { getVoice, saveVoice } from '@/lib/voice-store';

// Clon de VOZ (ElevenLabs) — paso 1 del "clon que habla".
//   GET  → { tiene:boolean, nombre }              ¿ya tiene su voz clonada?
//   POST { audioBase64, mime, nombre } → clona su voz y la guarda. Cobra créditos.
// Solo admin por ahora (igual que el resto del /studio).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const { email, admin } = await getAccess();
  if (!email) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const v = await getVoice(email);
  return Response.json({ ok: true, tiene: !!v.voiceId, nombre: v.nombre, configured: v.configured });
}

export async function POST(req: NextRequest) {
  const { email, admin, ent } = await getAccess();
  if (!email) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!admin) return Response.json({ error: 'Avatares IA está disponible solo para administradores.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const audioBase64 = String(body?.audioBase64 || '');
  const mime = String(body?.mime || 'audio/mpeg');
  const nombre = String(body?.nombre || 'Mi voz').slice(0, 60);
  if (!audioBase64 || audioBase64.length < 5000) {
    return Response.json({ error: 'Subí una muestra de tu voz (al menos ~20-30 segundos hablando claro).' }, { status: 400 });
  }
  if (audioBase64.length > 14_000_000) { // ~10 MB de audio
    return Response.json({ error: 'La muestra es muy pesada. Subí un audio de 1-2 minutos.' }, { status: 413 });
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    return Response.json({ error: 'La voz todavía no está configurada (falta ELEVENLABS_API_KEY).' }, { status: 503 });
  }

  const grant = monthlyGrantFor(ent, admin);
  const cost = CREDIT_COST.voz;
  const spent = await spendCredits(email, cost, grant);
  if (!spent.configured) return Response.json({ error: 'Faltan configurar los créditos (correr ai_credits.sql).' }, { status: 503 });
  if (!spent.ok) return Response.json({ error: 'No te quedan créditos suficientes este mes.', balance: spent.balance }, { status: 402 });

  try {
    // Si ya tenía una voz, la borramos para no acumular en ElevenLabs.
    const prev = await getVoice(email);
    if (prev.voiceId) await borrarVoz(prev.voiceId);

    const { voiceId } = await crearVoz(nombre, audioBase64, mime);
    const guardado = await saveVoice(email, voiceId, nombre);
    if (!guardado) {
      return Response.json({ error: 'Tu voz se creó pero no la pudimos guardar (¿falta correr voice_clones.sql?).' }, { status: 503 });
    }
    return Response.json({ ok: true, tiene: true, nombre, balance: spent.balance });
  } catch (e) {
    await refundCredits(email, cost);
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
