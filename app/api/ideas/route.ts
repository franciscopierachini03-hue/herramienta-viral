// POST /api/ideas
// Asistente de ViralADN basado en el CLIENTE IDEAL:
//   El usuario describe a su cliente ideal (nicho grande) y la IA (Groq) devuelve
//   15 palabras CLAVE (1-2 palabras) para escribir directo en el buscador y
//   encontrar el contenido viral que más le funciona a ese nicho.
// Las palabras y el cliente ideal se guardan aparte (ver /api/nicho) para no
// rehacer el proceso cada vez.

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = `Actúas como un experto en crecimiento orgánico en redes sociales (Instagram y TikTok), especializado en detectar patrones de contenido viral. A partir del CLIENTE IDEAL del usuario, tu trabajo es dar palabras clave para BUSCAR en el buscador el contenido que YA está funcionando en ese nicho.

Devuelves SIEMPRE este JSON exacto, sin texto fuera del JSON:
{"reply":"una frase corta y cercana","terms":["palabra clave 1","palabra 2", ... 15 en total ...]}

Reglas DURAS para "terms":
- EXACTAMENTE 15 términos.
- 1 o 2 palabras cada uno (cortos, para escribir directo en el buscador). Sin "#", sin comillas, sin explicaciones.
- Enfocados en el BENEFICIO FINAL y en los temas/dolores/deseos que ese cliente ideal consume y que YA son virales en su nicho.
- Mezclá términos del problema/deseo del cliente con términos de formato/tema viral (hooks, tendencias, resultados).
- Evita palabras genéricas sin intención (ej: "video", "viral", "fyp", "contenido").
- En español salvo que el nicho use términos en inglés que se buscan así.`;

function buildUserPrompt(clienteIdeal: string, exclude: string[], extra: string): string {
  let p = `Estoy dividiendo a mis clientes en nichos grandes para facilitar la creación de sus guiones para redes sociales. El objetivo es que se viralicen, enfocándome en el BENEFICIO FINAL que ofrezco: primero encuentro el nicho grande para buscar guiones virales y después adapto el cuerpo/CTA a lo que hace específicamente cada cliente.

Mi cliente ideal es: ${clienteIdeal}

Dame 15 palabras clave (1 o 2 palabras cada una) para escribir directo en el buscador de Instagram/TikTok y encontrar el contenido viral que más le funcione a este nicho.`;
  if (exclude.length) p += `\n\nNO repitas estas (ya las tengo): ${exclude.join(', ')}. Dame 15 NUEVAS y distintas.`;
  if (extra) p += `\n\nAjuste extra del usuario: ${extra}`;
  return p;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && process.env.REQUIRE_AUTH === '1') {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: 'IA no configurada' }, { status: 503 });

  let body: { clienteIdeal?: string; dedico?: string; exclude?: string[]; extra?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const clienteIdeal = (body.clienteIdeal || body.dedico || '').toString().slice(0, 600).trim();
  const exclude = Array.isArray(body.exclude) ? body.exclude.filter(x => typeof x === 'string').slice(0, 80) : [];
  const extra = (body.extra || '').toString().slice(0, 300).trim();
  if (!clienteIdeal) return Response.json({ error: 'Falta el cliente ideal' }, { status: 400 });

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildUserPrompt(clienteIdeal, exclude, extra) },
        ],
      }),
    });
    if (!res.ok) return Response.json({ error: 'La IA no respondió' }, { status: 502 });
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';
    let parsed: { reply?: string; terms?: unknown };
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const reply = typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : 'Aquí tienes palabras para buscar contenido viral de tu nicho:';

    const seen = new Set(exclude.map(x => x.toLowerCase()));
    const terms = (Array.isArray(parsed.terms) ? parsed.terms : [])
      .filter((t): t is string => typeof t === 'string')
      .map(t => t.replace(/[#"']/g, '').trim().split(/\s+/).slice(0, 2).join(' ')) // 1-2 palabras
      .filter(Boolean)
      .filter(t => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 15);

    return Response.json({ reply, terms });
  } catch {
    return Response.json({ error: 'Error de conexión con la IA' }, { status: 502 });
  }
}
