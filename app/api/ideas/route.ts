// POST /api/ideas
// Asistente de ViralADN: el usuario cuenta su nicho/negocio/interés y la IA
// (Groq) devuelve una respuesta corta + una lista de TÉRMINOS de búsqueda
// concretos para encontrar contenido viral de ese nicho. Los términos se
// muestran como chips clicables que disparan la búsqueda.

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Msg = { role: 'user' | 'assistant'; content: string };

const SYSTEM = `Sos el asistente de ViralADN, una herramienta que encuentra los videos más virales de TikTok, YouTube Shorts e Instagram Reels buscando por TEMA. El usuario te cuenta su nicho, negocio o interés.

Devolvés SIEMPRE este JSON exacto:
{"reply":"1-2 frases cortas y cercanas que orienten qué le conviene buscar","terms":["término1","término2","..."]}

Sobre "terms":
- 6 a 10 términos de búsqueda CONCRETOS, en español, de 1 a 3 palabras cada uno.
- Son TEMAS amplios que mucha gente busca (ej: "finanzas personales", "recetas saludables", "rutina de gym", "ventas", "mindset", "marketing digital"), NO frases largas ni preguntas ni hashtags.
- Variados: el tema central del usuario + ángulos/subtemas que enganchan en redes.
- Si el mensaje es vago o saluda nomás, igual sugerí términos de nichos que funcionan (dinero, fitness, negocios, relaciones, productividad, recetas).

No expliques el formato. Devolvé SOLO el JSON.`;

export async function POST(req: Request) {
  // Gate básico: tiene que estar logueado (en prod /app ya exige suscripción).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && process.env.REQUIRE_AUTH === '1') {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: 'IA no configurada' }, { status: 503 });

  let body: { messages?: Msg[] };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const history = Array.isArray(body.messages) ? body.messages.slice(-8) : [];
  const clean: Msg[] = history
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 800) }));
  if (!clean.length) return Response.json({ error: 'Mensaje vacío' }, { status: 400 });

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.6,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, ...clean],
      }),
    });
    if (!res.ok) return Response.json({ error: 'La IA no respondió' }, { status: 502 });
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';
    let parsed: { reply?: string; terms?: unknown };
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const reply = typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : 'Acá tenés algunos temas para arrancar a buscar:';
    const terms = Array.isArray(parsed.terms)
      ? parsed.terms
          .filter((t): t is string => typeof t === 'string')
          .map(t => t.replace(/^#/, '').trim())
          .filter(Boolean)
          .slice(0, 10)
      : [];

    return Response.json({ reply, terms });
  } catch {
    return Response.json({ error: 'Error de conexión con la IA' }, { status: 502 });
  }
}
