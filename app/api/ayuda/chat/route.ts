import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { systemPrompt, CONTACTO_EMAIL } from '@/lib/ayuda-faq';
import { rateLimit, clientIp } from '@/lib/ratelimit';

// POST /api/ayuda/chat — chat de FAQ con IA (público, anclado a la base de
// conocimiento de lib/ayuda-faq.ts). Body: { messages: [{role, content}] }.
// Responde { reply }. Si no sabe o es algo de la cuenta del usuario, deriva al
// formulario de contacto. Modelo barato + tope de tokens + rate limit por IP.

export const dynamic = 'force-dynamic';

const MODEL = process.env.OPENAI_FAQ_MODEL || 'gpt-4o-mini';

type Msg = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  // Anti-abuso: 20 mensajes por minuto por IP.
  const rl = rateLimit(`ayuda-chat:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return Response.json({ error: `Demasiadas consultas. Probá de nuevo en ${rl.retryAfter}s.` }, { status: 429 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ reply: `Ahora mismo el asistente no está disponible. Escribinos por el formulario de abajo y te respondemos a tu correo (${CONTACTO_EMAIL}).` });
  }

  let body: { messages?: Msg[] };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido.' }, { status: 400 }); }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  // Saneamos: solo user/assistant, texto acotado, y como mucho las últimas 12.
  const clean: Msg[] = incoming
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }))
    .slice(-12);

  if (!clean.length || clean[clean.length - 1].role !== 'user') {
    return Response.json({ error: 'Falta tu mensaje.' }, { status: 400 });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'system', content: systemPrompt() }, ...clean],
      temperature: 0.3,
      max_tokens: 400,
    });
    const reply = completion.choices[0]?.message?.content?.trim()
      || `No estoy seguro de eso. Mejor escribinos por el formulario de abajo y te respondemos a tu correo.`;
    return Response.json({ reply });
  } catch (e) {
    console.error('[ayuda/chat]', e);
    return Response.json({ reply: `Tuve un problema para responder. Escribinos por el formulario de abajo (${CONTACTO_EMAIL}) y te ayudamos.` });
  }
}
