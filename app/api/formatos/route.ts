import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { getNicho } from '@/lib/nicho-store';
import { rateLimit } from '@/lib/ratelimit';
import { FORMATOS, ESTRUCTURAS, getFormato, getEstructura } from '@/lib/formatos-video';

// POST /api/formatos — el generador de guiones POR FORMATO.
//
// Va en DOS pasos a propósito. El gancho decide el 90% del resultado y antes se
// tiraba una sola moneda: salía enterrado dentro de un párrafo, sin forma de
// elegir ni de repetir solo esa parte.
//
//   { modo:'ganchos', formato, estructura, tema }  → 5 ganchos para elegir
//   { modo:'guion', formato, estructura, tema, gancho } → el guion completo,
//     escrito EN LA FORMA de ese formato (columnas, escena, pantalla…)
//
// Gate: plan ViralADN.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE = `Sos guionista de contenido corto en español (Reels, TikTok, Shorts).

Reglas de la casa, sin excepción:
- Se lee en voz alta: frases cortas, como se habla, nunca como se escribe.
- Nada de jerga de marketing: prohibido "escalar tu negocio", "mindset",
  "empoderar", "next level", "en conclusión", "cabe destacar".
- Cero relleno: si una palabra no gana nada, se cae.
- Ejemplos concretos con números y cosas que se ven. Nada abstracto.
- Nunca uses las palabras "real" ni "reales".
- ESPAÑOL NEUTRO LATINOAMERICANO. Es lo más importante de todo.
  Usa "tú", nunca "vos". Nada de voseo: se dice "tienes" (no "tenés"),
  "quieres" (no "querés"), "puedes" (no "podés"), "elige" (no "elegí"),
  "mira" (no "mirá"), "cuéntame" (no "contame").
  Tampoco modismos de un solo país: ni "che", ni "güey", ni "parcero",
  ni "tío", ni "chevere". Tiene que sonar natural en México, Colombia,
  Perú, Chile y Argentina por igual.`;

function pedido(f: NonNullable<ReturnType<typeof getFormato>>, e: NonNullable<ReturnType<typeof getEstructura>>, tema: string, cliente: string, estilo: string) {
  return [
    `FORMATO: ${f.nombre} — ${f.cuando}`,
    `CÓMO SE GRABA: ${f.comoSeGraba}`,
    `ESQUELETO OBLIGATORIO DEL FORMATO:\n${f.receta}`,
    `ESTRUCTURA NARRATIVA: ${e.nombre} — ${e.angulo}`,
    `TEMA: ${tema}`,
    cliente ? `A QUIÉN LE HABLA: ${cliente}\nEl gancho va amplio para que el video llegue lejos; el desarrollo y el cierre le hablan a ESTA persona, con sus palabras. Nunca digas "cliente ideal".` : '',
    estilo ? `CÓMO HABLA QUIEN GRABA (copiá su tono, sus muletillas, su energía):\n---\n${estilo.slice(0, 900)}\n---` : '',
  ].filter(Boolean).join('\n\n');
}

export async function POST(req: NextRequest) {
  const { email, admin, ent } = await getAccess();
  if (!email) return Response.json({ error: 'Iniciá sesión para usar esta herramienta.' }, { status: 401 });
  if (!admin && !ent?.viraladn) return Response.json({ error: 'Esta herramienta viene con tu plan de ViralADN.' }, { status: 403 });

  let body: { modo?: string; formato?: string; estructura?: string; tema?: string; gancho?: string; estilo?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'Formato inválido.' }, { status: 400 }); }

  // Catálogo, para que el front no lo duplique.
  if (body.modo === 'catalogo') {
    return Response.json({ formatos: FORMATOS, estructuras: ESTRUCTURAS });
  }

  const f = getFormato(String(body.formato || ''));
  const e = getEstructura(String(body.estructura || ''));
  const tema = String(body.tema || '').trim().slice(0, 400);
  if (!f) return Response.json({ error: 'Elige un formato.' }, { status: 400 });
  if (!e) return Response.json({ error: 'Elige una estructura.' }, { status: 400 });
  if (!tema) return Response.json({ error: 'Contanos de qué va el video.' }, { status: 400 });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: 'Falta configurar la IA.' }, { status: 503 });
  if (!rateLimit(`formatos:${email}`, 40, 60 * 60 * 1000)) {
    return Response.json({ error: 'Llegaste al límite por hora. Probá más tarde.' }, { status: 429 });
  }

  let cliente = '';
  try { cliente = (await getNicho(email)).nicho.clienteIdeal || ''; } catch { /* seguimos sin él */ }
  const estilo = String(body.estilo || '');

  const esGanchos = body.modo === 'ganchos';
  const system = esGanchos
    ? `${BASE}

Tu tarea: escribir CINCO ganchos distintos para el mismo video. No cinco maneras
de decir lo mismo: cinco ÁNGULOS de entrada diferentes.
Cada uno se dice en menos de 4 segundos. Ninguno explica nada — solo frena el dedo.
Responde en JSON: {"ganchos":[{"texto":"...","porQueFunciona":"en una línea, qué resorte toca"}]}`
    : `${BASE}

Tu tarea: escribir el guion COMPLETO respetando el esqueleto del formato al pie
de la letra. Si el formato pide columnas, van columnas. Si pide escena, va escena.
Si separa lo hablado de lo que se lee en pantalla, van separados.

Responde en JSON con esta forma:
{
  "titulo": "<nombre corto para guardarlo>",
  "textoEnPantalla": "<el texto fijo de arriba, o null si el formato no lleva>",
  "gancho": "<el gancho, tal cual se dice>",
  "bloques": [
    {
      "etiqueta": "<'1', 'A', 'Momento 2'… o null>",
      "hablado": "<lo que se DICE>",
      "enPantalla": "<lo que se LEE, o null>",
      "acotacion": "<qué se hace o qué imagen va, o null>",
      "columnaA": "<solo formato VS: la línea del personaje A, o null>",
      "columnaB": "<solo formato VS: su espejo en B, o null>"
    }
  ],
  "cta": "<el cierre, una sola acción>",
  "segundos": <duración estimada, número>,
  "comoGrabarlo": ["<3 indicaciones concretas de grabación para ESTE formato>"]
}`;

  const user = esGanchos
    ? `${pedido(f, e, tema, cliente, estilo)}\n\nDame 5 ganchos en JSON.`
    : `${pedido(f, e, tema, cliente, estilo)}\n\nEL GANCHO YA ESTÁ ELEGIDO, usalo tal cual y construí todo alrededor:\n"${String(body.gancho || '').slice(0, 300)}"\n\nDevuelve el guion completo en JSON.`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.FORMATOS_MODEL || 'gpt-4o',
        temperature: esGanchos ? 1 : 0.85,
        max_tokens: esGanchos ? 700 : 1800,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!r.ok) {
      console.error('[formatos] openai', r.status, (await r.text().catch(() => '')).slice(0, 200));
      return Response.json({ error: 'No pudimos escribirlo. Probá de nuevo.' }, { status: 502 });
    }
    const d = await r.json();
    const out = JSON.parse(d?.choices?.[0]?.message?.content || '{}');
    return Response.json({ ...out, formato: f.key, salida: f.salida, estructura: e.key });
  } catch (err) {
    console.error('[formatos]', (err as Error).message.slice(0, 150));
    return Response.json({ error: 'Error al generar. Probá de nuevo.' }, { status: 502 });
  }
}
