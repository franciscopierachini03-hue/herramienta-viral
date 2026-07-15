import { getAccess } from '@/lib/access';
import { createServiceClient } from '@/lib/supabase/server';
import { elevenLabsSano } from '@/lib/elevenlabs';
import { falTalkingModel } from '@/lib/studio';

// GET /api/studio/health — semáforo de Avatares IA (solo admin).
// Verifica EN VIVO las 3 piezas que la herramienta necesita:
//   · tabla ai_credits en Supabase (créditos por usuario)
//   · GEMINI_API_KEY válida (imagen del avatar — valida contra la API)
//   · FAL_KEY válida (foto→video — valida contra la API)
// El banner de /studio muestra este resultado con qué falta y cómo arreglarlo.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  // 1) Tabla de créditos.
  let tabla: 'ok' | 'falta' = 'falta';
  try {
    const sb = createServiceClient();
    const { error } = await sb.from('ai_credits').select('email').limit(1);
    tabla = error ? 'falta' : 'ok';
  } catch { tabla = 'falta'; }

  // 2) Gemini (imagen) — presencia + validez de la key contra la API.
  const gModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const gKey = process.env.GEMINI_API_KEY;
  let gemini = 'falta la env GEMINI_API_KEY';
  if (gKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(gModel)}?key=${encodeURIComponent(gKey)}`,
        { cache: 'no-store' },
      );
      gemini = r.ok ? 'ok'
        : r.status === 404 ? `el modelo "${gModel}" no existe para esta key`
        : (r.status === 400 || r.status === 401 || r.status === 403) ? 'la key es inválida o no tiene acceso'
        : `error ${r.status}`;
    } catch { gemini = 'sin conexión con Gemini'; }
  }

  // 3) fal.ai (video) — presencia + validez: pedir el estado de un request
  //    inexistente responde 404/422 con key buena y 401/403 con key mala.
  const fModelPro = process.env.FAL_VIDEO_MODEL || 'fal-ai/kling-video/v2.1/standard/image-to-video';
  const fModelFast = process.env.FAL_VIDEO_MODEL_FAST || 'fal-ai/ltxv-13b-098-distilled/image-to-video';
  const fModel = `${fModelFast} (económico) · ${fModelPro} (pro)`;
  const fKey = process.env.FAL_KEY;
  let fal = 'falta la env FAL_KEY';
  if (fKey) {
    try {
      const r = await fetch(
        `https://queue.fal.run/${fModelPro}/requests/00000000-0000-0000-0000-000000000000/status`,
        { headers: { Authorization: `Key ${fKey}` }, cache: 'no-store' },
      );
      fal = (r.status === 401 || r.status === 403) ? 'la key es inválida' : 'ok';
    } catch { fal = 'sin conexión con fal.ai'; }
  }

  // 4) Clon que habla — ElevenLabs (voz) + tabla voice_clones.
  const voz = await elevenLabsSano();
  let tablaVoz: 'ok' | 'falta' = 'falta';
  try {
    const sb = createServiceClient();
    const { error } = await sb.from('voice_clones').select('email').limit(1);
    tablaVoz = error ? 'falta' : 'ok';
  } catch { tablaVoz = 'falta'; }

  // El clon básico (imagen + video mudo) queda listo con tabla+gemini+fal.
  // El clon que HABLA suma ElevenLabs + la tabla de voces.
  const listo = tabla === 'ok' && gemini === 'ok' && fal === 'ok';
  const listoHabla = listo && voz === 'ok' && tablaVoz === 'ok';
  const pasos: string[] = [];
  if (tabla !== 'ok') pasos.push('Correr supabase/ai_credits.sql en Supabase → SQL Editor (1 min).');
  if (gemini !== 'ok') pasos.push(`Gemini: ${gemini} → agregá/corregí GEMINI_API_KEY en Vercel (aistudio.google.com → API keys) y redeploy.`);
  if (fal !== 'ok') pasos.push(`fal.ai: ${fal} → creá la key en fal.ai/dashboard/keys (con billing activo), agregala como FAL_KEY en Vercel y redeploy.`);
  if (voz !== 'ok') pasos.push(`Voz (ElevenLabs): ${voz} → plan Starter+ · agregá ELEVENLABS_API_KEY en Vercel y redeploy.`);
  if (tablaVoz !== 'ok') pasos.push('Correr supabase/voice_clones.sql en Supabase (guarda la voz de cada usuario).');

  return Response.json({
    listo, listoHabla, tabla, gemini, fal, voz, tablaVoz,
    modeloImagen: gModel, modeloVideo: fModel, modeloVoz: falTalkingModel(), pasos,
  });
}
