import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { spendCredits, refundCredits, monthlyGrantFor, CREDIT_COST } from '@/lib/credits';
import { hablar } from '@/lib/elevenlabs';
import { getVoice, getBaseVideo } from '@/lib/voice-store';
import { falTalkingSubmit, falTalkingStatus } from '@/lib/studio';

// CLON QUE HABLA v2 (lipsync) — guion → voz clonada (ElevenLabs) → LatentSync
// sincroniza la boca sobre el VIDEO BASE del usuario (su selfie, subido 1 vez).
// Cola async: POST encola → GET ?id= pollea. Solo admin.
//   POST { texto } → { jobId }
//   GET  ?id=<jobId> → { status, url? }

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { email, admin, ent } = await getAccess();
  if (!email) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!admin) return Response.json({ error: 'Avatares IA está disponible solo para administradores.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const texto = String(body?.texto || '').trim();
  if (!texto) return Response.json({ error: 'Escribí el guion que va a decir.' }, { status: 400 });
  if (texto.length > 900) return Response.json({ error: 'El guion es muy largo para un clip — cortalo a ~900 caracteres.' }, { status: 400 });

  if (!process.env.ELEVENLABS_API_KEY) return Response.json({ error: 'Falta ELEVENLABS_API_KEY (voz).' }, { status: 503 });
  if (!process.env.FAL_KEY) return Response.json({ error: 'Falta FAL_KEY (video).' }, { status: 503 });

  const base = await getBaseVideo(email);
  if (base.faltaSql) return Response.json({ error: 'Falta correr supabase/clon_video.sql en Supabase (1 min).' }, { status: 503 });
  if (!base.url) return Response.json({ error: 'Primero subí tu video base (paso 1): 30-60s tuyos hablando a cámara.' }, { status: 400 });

  const v = await getVoice(email);
  if (!v.voiceId) return Response.json({ error: 'Primero creá tu voz (paso 2 → subir muestra).' }, { status: 400 });

  const grant = monthlyGrantFor(ent, admin);
  const cost = CREDIT_COST.hablar;
  const spent = await spendCredits(email, cost, grant);
  if (!spent.configured) return Response.json({ error: 'Faltan configurar los créditos (ai_credits.sql).' }, { status: 503 });
  if (!spent.ok) return Response.json({ error: 'No te quedan créditos suficientes este mes.', balance: spent.balance }, { status: 402 });

  try {
    // 1) Guion → audio con SU voz.
    const { audioBase64, mime } = await hablar(v.voiceId, texto);
    const audioUrl = `data:${mime};base64,${audioBase64}`;
    // 2) Video base + audio → lipsync (cola de fal).
    const { requestId } = await falTalkingSubmit({ videoUrl: base.url, audioUrl });
    return Response.json({ ok: true, jobId: requestId, balance: spent.balance });
  } catch (e) {
    await refundCredits(email, cost);
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const { email, admin } = await getAccess();
  if (!email) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Falta el id del job.' }, { status: 400 });
  const st = await falTalkingStatus(id);
  return Response.json(st);
}
