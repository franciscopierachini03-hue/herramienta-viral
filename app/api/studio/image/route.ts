import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { spendCredits, refundCredits, monthlyGrantFor, CREDIT_COST } from '@/lib/credits';
import { generateAvatarImage } from '@/lib/studio';

// POST /api/studio/image  { prompt, photoBase64?, photoMime? }
// Genera/edita una imagen con Nano Banana. Cobra créditos; si la API falla, los
// devuelve. Gateado a planes pagos (o admin).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { email, admin, ent } = await getAccess();
  if (!email) return Response.json({ error: 'No autorizado' }, { status: 401 });
  if (!admin && !ent.viraladn && !ent.topcut) {
    return Response.json({ error: 'Necesitas un plan activo para usar Avatares IA.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt = String(body?.prompt || '').trim();
  if (!prompt) return Response.json({ error: 'Falta describir qué generar.' }, { status: 400 });
  const photoBase64 = body?.photoBase64 ? String(body.photoBase64) : undefined;
  const photoMime = body?.photoMime ? String(body.photoMime) : undefined;

  const grant = monthlyGrantFor(ent, admin);
  const cost = CREDIT_COST.image;
  const spent = await spendCredits(email, cost, grant);
  if (!spent.configured) {
    return Response.json({ error: 'Avatares IA todavía no está configurado (falta la tabla de créditos).' }, { status: 503 });
  }
  if (!spent.ok) {
    return Response.json({ error: 'No te quedan créditos este mes.', balance: spent.balance }, { status: 402 });
  }

  try {
    const { dataUrl } = await generateAvatarImage({ prompt, photoBase64, photoMime });
    return Response.json({ ok: true, image: dataUrl, balance: spent.balance });
  } catch (e) {
    await refundCredits(email, cost);
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
