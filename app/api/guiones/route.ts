import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { getNicho } from '@/lib/nicho-store';

export const maxDuration = 60;

// Lazy init: sólo creamos el cliente cuando se llama al endpoint.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// El guion se escribe en vivo, así que no puede pasar por lib/ia (que devuelve
// el texto completo). Pero Groq habla el mismo idioma de API que OpenAI: si
// OpenAI no contesta —el 7-oct-2026 se quedó sin saldo y este apartado murió—
// el mismo pedido se repite contra Groq y la persona igual ve el guion
// apareciendo letra por letra.
async function abrirStream(params: OpenAI.Chat.ChatCompletionCreateParamsStreaming) {
  try {
    return await getOpenAI().chat.completions.create(params);
  } catch (e) {
    const detalle = (e as Error).message.slice(0, 160);
    const sinSaldo = /insufficient_quota|no credits|billing|429/i.test(detalle);
    console.error(`[guiones] OpenAI no respondió${sinSaldo ? ' (SIN SALDO)' : ''}: ${detalle}`);
    if (!process.env.GROQ_API_KEY) throw e;
    const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
    const modelo = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    console.log(`[guiones] escribiendo con el respaldo de Groq (${modelo})`);
    return await groq.chat.completions.create({ ...params, model: modelo });
  }
}

const SYSTEM_PROMPT = `Eres un experto en guiones virales para redes sociales (TikTok, Instagram Reels, YouTube Shorts).
Tu trabajo es escribir guiones que suenen exactamente como la persona que te lo pide — capturando su forma de hablar, sus muletillas, su energía y su tono.

ESTRUCTURA OBLIGATORIA — siempre en este orden:

[HOOK]
Los primeros 3 segundos. Debe detener el scroll. Técnicas:
- Pregunta que duele ("¿Por qué sigues haciendo X si no te funciona?")
- Dato sorprendente ("El 90% de las personas no sabe que...")
- Afirmación polémica o contraintuitiva ("Dejar de hacer X fue lo mejor que me pasó")
- Promesa directa ("Voy a mostrarte cómo X en menos de 60 segundos")
El hook nunca explica — solo engancha.

[BODY]
El desarrollo. Da el valor prometido en el hook. Reglas:
- Frases cortas. Una idea por frase.
- Sin relleno — cada palabra tiene que ganarse su lugar.
- Máximo 3 puntos o pasos (si es informativo)
- Usa ejemplos concretos, no abstracciones
- Mantén la energía y el ritmo ascendente

[CTA]
El cierre. Claro, específico, con razón para actuar:
- Diles exactamente qué hacer ("Guarda esto para no olvidarlo")
- Dales un motivo ("porque te va a pasar cuando menos lo esperes")
- Una sola acción — no des tres opciones

REGLAS IMPORTANTES:
- El guión debe sonar hablado, no escrito
- Adapta el vocabulario, ritmo y energía al estilo de la persona
- Si la persona usa palabras en inglés, úsalas también
- Si es informal, sé informal. Si es serio, sé serio.
- Nunca uses palabras de relleno genéricas como "en conclusión" o "cabe destacar"
- El guión dura lo que el storytelling necesite. No lo estires ni lo cortes artificialmente.

Devuelve SOLO el guión como texto corrido, listo para leer y grabar.
Sin encabezados, sin etiquetas, sin secciones marcadas. Solo el texto que diría la persona.
Separas el hook, body y cta con una línea en blanco entre cada parte, pero sin ningún título ni etiqueta.
El guión tiene que poder leerse de corrido como si fuera una sola pieza.`;

export async function POST(req: NextRequest) {
  const { tema, estilo, tono } = await req.json();

  if (!tema?.trim()) {
    return new Response(JSON.stringify({ error: 'Falta el tema' }), { status: 400 });
  }

  // Cliente ideal guardado (ver /api/nicho) → el BODY y el CTA le hablan a ÉL.
  // Es el paso final del proceso: encontrás el viral del nicho grande y lo
  // adaptás a quien de verdad le vendes. Si no lo definió, el guión sale igual.
  let clienteIdeal = '';
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) clienteIdeal = (await getNicho(user.id)).nicho.clienteIdeal || '';
  } catch { /* sin cliente ideal seguimos normal */ }

  const userMessage = `
TEMA DEL VIDEO: ${tema}

TONO: ${tono || 'natural y conversacional'}
${clienteIdeal ? `
A QUIÉN LE HABLA (cliente ideal de quien graba):
---
${clienteIdeal}
---
Importante: el HOOK va amplio para que el video llegue lejos, pero el BODY y sobre todo el CTA tienen que hablarle a ESTA persona — su problema, sus palabras y lo que quiere lograr. El CTA debe conectar con lo que esta persona necesita, sin nombrar "cliente ideal" ni sonar a marketing.` : ''}

${estilo?.trim() ? `CÓMO HABLA ESTA PERSONA (analiza su estilo y replicalo):
---
${estilo.trim()}
---` : ''}

Escribe el guión viral completo con HOOK, BODY y CTA que suene exactamente como esta persona hablando sobre este tema.
`.trim();

  const stream = await abrirStream({
    model: 'gpt-4o',
    stream: true,
    temperature: 0.85,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
