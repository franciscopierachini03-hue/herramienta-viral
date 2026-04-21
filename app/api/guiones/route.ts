import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
- Diles exactamente qué hacer ("Guardá esto para no olvidarlo")
- Dales un motivo ("porque te va a pasar cuando menos lo esperes")
- Una sola acción — no des tres opciones

REGLAS IMPORTANTES:
- El guión debe sonar hablado, no escrito
- Adaptá el vocabulario, ritmo y energía al estilo de la persona
- Si la persona usa palabras en inglés, úsalas también
- Si es informal, sé informal. Si es serio, sé serio.
- Nunca uses palabras de relleno genéricas como "en conclusión" o "cabe destacar"
- El guión dura lo que el storytelling necesite. No lo estires ni lo cortes artificialmente.

Devuelve SOLO el guión como texto corrido, listo para leer y grabar.
Sin encabezados, sin etiquetas, sin secciones marcadas. Solo el texto que diría la persona.
Separás el hook, body y cta con una línea en blanco entre cada parte, pero sin ningún título ni etiqueta.
El guión tiene que poder leerse de corrido como si fuera una sola pieza.`;

export async function POST(req: NextRequest) {
  const { tema, estilo, tono } = await req.json();

  if (!tema?.trim()) {
    return new Response(JSON.stringify({ error: 'Falta el tema' }), { status: 400 });
  }

  const userMessage = `
TEMA DEL VIDEO: ${tema}

TONO: ${tono || 'natural y conversacional'}

${estilo?.trim() ? `CÓMO HABLA ESTA PERSONA (analizá su estilo y replicalo):
---
${estilo.trim()}
---` : ''}

Escribí el guión viral completo con HOOK, BODY y CTA que suene exactamente como esta persona hablando sobre este tema.
`.trim();

  const stream = await openai.chat.completions.create({
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
