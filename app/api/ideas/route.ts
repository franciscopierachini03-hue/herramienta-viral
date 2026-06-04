// POST /api/ideas
// Asistente de ViralADN basado en el método de 3 preguntas:
//   1) ¿A qué te dedicás hoy? (nicho)
//   2) ¿Qué es lo que más te apasiona hoy? (pilar 1)
//   3) ¿Qué es lo que más amás hoy? (pilar 2)
// Con eso la IA (Groq) devuelve 15 palabras CLAVE de UNA sola palabra para
// escribir directo en el buscador y encontrar contenido viral del nicho.

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = `Actuás como un experto en crecimiento orgánico en redes sociales (Instagram y TikTok), especializado en detectar patrones de contenido viral. Tu trabajo es dar palabras clave para BUSCAR contenido que ya está funcionando.

Devolvés SIEMPRE este JSON exacto, sin texto fuera del JSON:
{"reply":"una frase corta y cercana","terms":["palabra1","palabra2", ... 15 en total ...]}

Reglas DURAS para "terms":
- EXACTAMENTE 15 palabras.
- UNA SOLA palabra cada una. Sin frases, sin espacios, sin "#", sin explicaciones.
- Directamente relacionadas con contenido que YA es viral en ese nicho.
- Palabras que un creador usaría para encontrar tendencias, hooks y formatos que funcionan.
- Evitá palabras genéricas sin intención (ej: "video", "viral", "fyp", "contenido").
- En español salvo que el nicho use términos en inglés que se buscan así.`;

function buildUserPrompt(dedico: string, apasiona: string, amo: string, exclude: string[], extra: string): string {
  const pilares = [apasiona, amo].filter(Boolean);
  let p = `Mi nicho es: ${dedico}\n\nMis pilares de contenido son:\n${pilares.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nDame 15 palabras CLAVE (una sola palabra cada una) para escribir directo en el buscador de Instagram o TikTok y encontrar contenido viral de mi nicho.`;
  if (exclude.length) p += `\n\nNO repitas estas palabras (ya las tengo): ${exclude.join(', ')}. Dame 15 NUEVAS y distintas.`;
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

  let body: { dedico?: string; apasiona?: string; amo?: string; exclude?: string[]; extra?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const dedico = (body.dedico || '').toString().slice(0, 300).trim();
  const apasiona = (body.apasiona || '').toString().slice(0, 300).trim();
  const amo = (body.amo || '').toString().slice(0, 300).trim();
  const exclude = Array.isArray(body.exclude) ? body.exclude.filter(x => typeof x === 'string').slice(0, 60) : [];
  const extra = (body.extra || '').toString().slice(0, 300).trim();
  if (!dedico && !apasiona && !amo) return Response.json({ error: 'Faltan respuestas' }, { status: 400 });

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
          { role: 'user', content: buildUserPrompt(dedico, apasiona, amo, exclude, extra) },
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
      : 'Acá tenés palabras para buscar contenido viral de tu nicho:';

    const seen = new Set(exclude.map(x => x.toLowerCase()));
    const terms = (Array.isArray(parsed.terms) ? parsed.terms : [])
      .filter((t): t is string => typeof t === 'string')
      .map(t => t.replace(/[#"']/g, '').trim().split(/\s+/)[0]) // UNA sola palabra
      .filter(Boolean)
      .filter(t => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 15);

    return Response.json({ reply, terms });
  } catch {
    return Response.json({ error: 'Error de conexión con la IA' }, { status: 502 });
  }
}
