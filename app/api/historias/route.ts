import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { getNicho } from '@/lib/nicho-store';
import { getFormato, FORMATOS } from '@/lib/historias-formatos';
import { rateLimit } from '@/lib/ratelimit';

// POST /api/historias — 📖 ARMADOR DE HISTORIAS QUE VENDEN.
// La persona elige un formato (cuestionario / rellena / leadmagnet / dime X),
// responde 2-3 preguntas sobre su negocio, y la IA arma la historia lista para
// publicar, adaptada a su nicho y a su cliente ideal (nicho_usuario).
//
//   { modo:'preguntas', formato }            → qué hay que preguntarle
//   { modo:'armar', formato, respuestas{} }  → la historia lista + variantes
// Gate: plan ViralADN.

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const SYSTEM = `Sos estratega de historias de Instagram que VENDEN (el método de Francisco Pierachini: secuencias de 1 historia que abren conversación y traen clientes).

Reglas de la casa:
- La historia se lee en 3 segundos: frases cortas, nada de párrafos.
- Habla EN EL IDIOMA DEL CLIENTE, no en jerga de marketing. Nada de "escalar tu negocio al siguiente nivel", "mindset", "empoderar".
- Siempre termina pidiendo UNA acción simple (responder, comentar una palabra).
- El objetivo no son los likes: es que te ESCRIBAN.
- Nunca prometas lo que la persona no dijo que vende.

Respondé SOLO en JSON con esta forma:
{
  "historia": {
    "encabezado": "<etiqueta corta o null>",
    "texto": "<el texto principal de la historia, tal cual va en pantalla>",
    "opciones": ["<opción A>", "<opción B>", "..."] ,
    "cta": "<la frase de cierre que pide la acción>"
  },
  "variantes": [{"texto":"<otra versión del texto principal>","cta":"<su cta>"}],
  "comoUsarla": ["<3 tips concretos: cuándo subirla, qué contestar, cómo encadenar la venta>"],
  "queResponder": "<qué contestarle a quien te escriba, para pasar de la respuesta a la venta>"
}`;

export async function POST(req: NextRequest) {
  const { email, admin, ent } = await getAccess();
  if (!email) return Response.json({ error: 'Iniciá sesión para usar esta herramienta.' }, { status: 401 });
  if (!admin && !ent?.viraladn) return Response.json({ error: 'Esta herramienta viene con tu plan de ViralADN.' }, { status: 403 });

  let body: { modo?: string; formato?: string; respuestas?: Record<string, string> };
  try { body = await req.json(); } catch { return Response.json({ error: 'Formato inválido.' }, { status: 400 }); }

  const formato = getFormato(String(body.formato || ''));
  if (!formato) return Response.json({ error: 'Elegí un formato.', formatos: FORMATOS.map(f => f.key) }, { status: 400 });

  // Su cliente ideal, definido una vez en ViralADN.
  let clienteIdeal = '';
  try { clienteIdeal = (await getNicho(email)).nicho.clienteIdeal || ''; } catch { /* seguimos sin él */ }

  // ── Modo 1: qué preguntarle (sin IA, instantáneo) ──
  if (body.modo === 'preguntas') {
    const preguntas = [
      { key: 'oferta', label: '¿Qué vendés (o querés vender)?', placeholder: 'Ej.: mentoría de 8 semanas para coaches que quieren llenar su agenda' },
      { key: 'dolor', label: '¿Qué es lo que MÁS frena a tu cliente hoy?', placeholder: 'Ej.: publica todos los días pero no le llegan clientes' },
      { key: 'transformacion', label: '¿Cómo queda esa persona después de trabajar con vos?', placeholder: 'Ej.: agenda llena y cobrando el doble sin vivir pegada al celular' },
    ];
    if (!clienteIdeal) {
      preguntas.unshift({ key: 'cliente', label: '¿A quién le hablás? (tu cliente ideal)', placeholder: 'Ej.: coaches y consultoras que ya tienen clientes y quieren escalar' });
    }
    return Response.json({ formato: formato.key, preguntas, clienteIdeal });
  }

  // ── Modo 2: armar la historia ──
  if (!rateLimit(`historias:${email}`, 30, 60 * 60 * 1000)) {
    return Response.json({ error: 'Llegaste al límite por hora. Probá más tarde.' }, { status: 429 });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: 'Falta configurar la IA (OPENAI_API_KEY).' }, { status: 503 });

  const r0 = body.respuestas || {};
  const cliente = clienteIdeal || String(r0.cliente || '').slice(0, 500);
  if (!cliente) return Response.json({ error: 'Contanos a quién le hablás.' }, { status: 400 });

  const ej = formato.ejemplo;
  const userText = [
    `FORMATO: ${formato.nombre} (${formato.cuando}).`,
    `PARA QUÉ SIRVE: ${formato.paraQue}`,
    `ESTRUCTURA QUE TENÉS QUE RESPETAR:\n${formato.receta}`,
    formato.opciones > 0
      ? `OPCIONES: este formato lleva EXACTAMENTE ${formato.opciones}, con el prefijo "A · ", "B · ", "C · ", "D · " (punto medio, como el ejemplo).`
      : 'OPCIONES: este formato NO lleva opciones. Devolvé "opciones": [] vacío. No inventes listas ni rangos.',
    `EJEMPLO ORIGINAL DE LA CLASE (respetá su estructura y su tono, NO copies el contenido):\n${ej.encabezado ? `[${ej.encabezado}]\n` : ''}${ej.pregunta}${ej.opciones ? '\n' + ej.opciones.join('\n') : ''}\n→ ${ej.cta}`,
    `A QUIÉN LE HABLA: ${cliente}`,
    r0.oferta ? `QUÉ VENDE: ${String(r0.oferta).slice(0, 500)}` : '',
    r0.dolor ? `QUÉ FRENA A ESA PERSONA HOY: ${String(r0.dolor).slice(0, 500)}` : '',
    r0.transformacion ? `CÓMO QUEDA DESPUÉS: ${String(r0.transformacion).slice(0, 500)}` : '',
    'Armá la historia lista para publicar + 2 variantes del texto principal.',
  ].filter(Boolean).join('\n\n');

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.HISTORIAS_MODEL || 'gpt-4o',
        temperature: 0.8,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userText }],
      }),
    });
    if (!r.ok) {
      console.error('[historias] openai', r.status, (await r.text().catch(() => '')).slice(0, 200));
      return Response.json({ error: 'No pudimos armar la historia. Probá de nuevo.' }, { status: 502 });
    }
    const d = await r.json();
    const out = JSON.parse(d?.choices?.[0]?.message?.content || '{}');
    return Response.json({ ...out, formato: formato.key, cuando: formato.cuando });
  } catch (e) {
    console.error('[historias]', (e as Error).message.slice(0, 150));
    return Response.json({ error: 'Error al armar. Probá de nuevo.' }, { status: 502 });
  }
}
