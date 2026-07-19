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
- De 1 a 3 palabras cada uno, y SIEMPRE una idea COMPLETA. NUNCA termines un término en preposición o artículo suelto ("de", "en", "para", "y", "la"): si no entra completo, usá uno más corto. Mal: "estrategia de", "creación de". Bien: "estrategia de contenido" o "copywriting".
- Sin "#", sin comillas, sin explicaciones.
- Enfocados en el BENEFICIO FINAL y en los temas/dolores/deseos que ese cliente ideal consume y que YA son virales en su nicho.
- Mezclá términos del problema/deseo del cliente con términos de formato/tema viral (hooks, tendencias, resultados).
- Evita palabras genéricas sin intención (ej: "video", "viral", "fyp", "contenido").
- En español salvo que el nicho use términos en inglés que se buscan así.`;

// Modo "definir": la persona NO sabe quién es su cliente ideal → la ayudamos a
// construirlo con preguntas cortas y le PROPONEMOS una frase para guardar.
const SYSTEM_DEFINIR = `Sos un estratega de marketing de contenidos, cercano y concreto (español rioplatense, tuteo con "vos"). Tu único objetivo es ayudar a la persona a DEFINIR su CLIENTE IDEAL en UNA frase clara y accionable.

Devolvés SIEMPRE este JSON exacto, sin texto fuera del JSON:
{"reply":"lo que le decís","propuesta":"la frase del cliente ideal o null"}

Cómo trabajás:
- Si te falta información clave (qué vende u ofrece, qué resultado logra la gente con eso, a quién se lo vende), poné "propuesta": null y en "reply" hacé UNA sola pregunta corta y concreta. Nunca cuestionarios largos ni varias preguntas juntas.
- Apenas tengas lo suficiente (con el rubro y el resultado ya alcanza), poné en "propuesta" UNA frase con esta forma: QUIÉN es + QUÉ quiere lograr + en qué situación está. Ejemplo: "Coaches y consultores con una oferta validada que quieren escalar sus ventas convirtiendo su conocimiento en contenido".
- En "reply" presentás esa propuesta en 1 frase amable e invitás a usarla o ajustarla.
- No inventes datos del negocio de la persona: si no te los dijo, preguntá.`;

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

  type Turno = { role: 'user' | 'assistant'; content: string };
  let body: { modo?: string; messages?: Turno[]; clienteIdeal?: string; dedico?: string; exclude?: string[]; extra?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  // ── Modo DEFINIR: la persona no sabe su cliente ideal → lo construimos ─────
  if (body.modo === 'definir') {
    const turnos: Turno[] = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m): m is Turno => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 1200) }))
      .slice(-12);
    if (!turnos.length) return Response.json({ error: 'Contame algo de tu negocio' }, { status: 400 });
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', temperature: 0.5, max_tokens: 400,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: SYSTEM_DEFINIR }, ...turnos],
        }),
      });
      if (!r.ok) return Response.json({ error: 'La IA no respondió' }, { status: 502 });
      const d = await r.json();
      let p: { reply?: string; propuesta?: unknown } = {};
      try { p = JSON.parse(d?.choices?.[0]?.message?.content || '{}'); } catch { p = {}; }
      const propuesta = typeof p.propuesta === 'string' && p.propuesta.trim().length > 10
        ? p.propuesta.trim().slice(0, 600) : null;
      return Response.json({
        reply: (typeof p.reply === 'string' && p.reply.trim()) ? p.reply.trim() : '¿Qué vendés o qué resultado le das a la gente?',
        propuesta,
      });
    } catch {
      return Response.json({ error: 'Error de conexión con la IA' }, { status: 502 });
    }
  }

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
      .map(t => t.replace(/[#"']/g, '').trim().split(/\s+/).slice(0, 3).join(' ')) // hasta 3 palabras
      // Nunca dejar la palabra colgada de una preposición ("estrategia de" → "estrategia").
      .map(t => t.replace(/\s+(de|del|la|el|los|las|un|una|en|para|con|y|a|que|por)$/i, '').trim())
      .filter(Boolean)
      .filter(t => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 15);

    return Response.json({ reply, terms });
  } catch {
    return Response.json({ error: 'Error de conexión con la IA' }, { status: 502 });
  }
}
