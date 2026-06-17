import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { spendCredits, refundCredits, monthlyGrantFor, CREDIT_COST } from '@/lib/credits';
import { falVideoSubmit, falVideoStatus } from '@/lib/studio';

// Foto → video con fal.ai (cola async).
//   POST { imageUrl, prompt?, duration? } → encola y cobra créditos → { jobId }
//   GET  ?id=<jobId>                       → estado { status, url? }
//
// imageUrl puede ser un data URL (base64) o una URL pública.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { email, admin, ent } = await getAccess();
  if (!email) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!admin && !ent.viraladn && !ent.topcut) {
    return Response.json({ error: 'Necesitas un plan activo para usar Avatares IA.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const imageUrl = String(body?.imageUrl || '').trim();
  if (!imageUrl) return Response.json({ error: 'Falta la imagen para animar.' }, { status: 400 });
  const prompt = body?.prompt ? String(body.prompt) : undefined;
  const duration = Number(body?.duration) || 5;

  const grant = monthlyGrantFor(ent, admin);
  const cost = CREDIT_COST.video;
  const spent = await spendCredits(email, cost, grant);
  if (!spent.configured) {
    return Response.json({ error: 'Avatares IA todavía no está configurado (falta la tabla de créditos).' }, { status: 503 });
  }
  if (!spent.ok) {
    return Response.json({ error: 'No te quedan créditos suficientes este mes.', balance: spent.balance }, { status: 402 });
  }

  try {
    const { requestId } = await falVideoSubmit({ imageUrl, prompt, duration });
    return Response.json({ ok: true, jobId: requestId, balance: spent.balance });
  } catch (e) {
    await refundCredits(email, cost);
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const { email } = await getAccess();
  if (!email) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Falta el id del job.' }, { status: 400 });

  const st = await falVideoStatus(id);
  // Si el render falló, devolvemos los créditos (el cliente deja de pollear al
  // ver el error, así que no hay doble reembolso en la práctica).
  if (st.status === 'error') await refundCredits(email, CREDIT_COST.video);
  return Response.json(st);
}
