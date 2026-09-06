import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { getNicho } from '@/lib/nicho-store';
import { rateLimit } from '@/lib/ratelimit';
import { CRITERIOS, puntuar, veredicto, TOTAL, medirForma, puntuarForma, TOTAL_FORMA, puntajeFinal, rangoSegundos } from '@/lib/calculadora-viral';

// POST /api/calculadora — le pones tu guion y te dice cuánto puntúa.
//
// La IA SOLO contesta sí/no a las seis preguntas y explica por qué. El puntaje
// lo calcula el código (lib/calculadora-viral), así el número es siempre el
// mismo que daría la hoja de Francisco. Si el modelo pusiera la nota, dos
// corridas del mismo guion darían distinto y dejaría de ser una calculadora.
//
// Gate: plan ViralADN.

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const SYSTEM = `Eres el evaluador de una calculadora de viralidad. Te dan un guion de video
corto (Reels, TikTok, Shorts) y contestas SEIS preguntas con sí o no.

⚖️ CÓMO CALIBRAR — esto es lo más importante
Juzgas como alguien que vio millones de videos, no como un profesor corrigiendo.
No premies lo mediocre, pero TAMPOCO castigues lo que evidentemente funciona.
Si un guion cuenta una historia con un personaje, un giro y una lección clara,
está haciendo lo que hay que hacer, aunque use alguna palabra técnica.

Los dos errores que tienes prohibido cometer:
1. Leer "¿lo entendería un niño de 5 años?" como "¿es contenido infantil?" o
   "¿conoce un niño todas estas palabras?". NO es eso. La pregunta es si la
   IDEA CENTRAL se capta de una sola pasada.
   ✅ SÍ: "una chica de 20 años vendió más que todos sus competidores, y te
      cuento cómo" → un niño entiende: alguien vendió más y hay un truco.
      Que el guion hable de "comportamiento humano" no lo invalida.
   ❌ NO: "optimiza tu embudo de conversión con atribución multicanal" → ni
      siquiera un adulto del rubro lo capta a la primera.
2. Leer "referencia viral" como "¿cita una película o un famoso?". NO es eso.
   ✅ SÍ: usa un versus, un ranking, un antes/después, un caso real con giro,
      un "el secreto que nadie te dice" → estructuras que ya se vio funcionar.
   ❌ NO: alguien hablando a cámara sin forma reconocible, un consejo suelto.

Y ojo con el gancho: si el guion que te pegan EMPIEZA a mitad (porque copiaron
solo un pedazo), no lo castigues por "falta de gancho". Juzga lo que hay.

Para CADA pregunta devuelves:
  respuesta: true o false
  porque: una frase corta y concreta, citando algo del guion cuando se pueda.
  arreglo: SOLO si contestaste false — qué cambiar, concreto y aplicable a ESTE
           guion. Nada de consejos genéricos.

Y aparte:
  loMejor: la línea del guion que mejor funciona, tal cual está escrita.
  elProblema: en una frase, lo que más le está costando puntos. Si el guion ya
              está bien, dilo en vez de inventar un defecto.
  reescritura: el gancho reescrito para que suba de puntaje. Una o dos frases,
               listas para decir en voz alta.

ESPAÑOL NEUTRO LATINOAMERICANO. Usa "tú", nunca "vos". Nada de voseo
("tienes", "quieres", "puedes", "mira") ni modismos de un solo país.
Nunca uses las palabras "real" ni "reales".

Responde SOLO en JSON con esta forma:
{"criterios":{"<key>":{"respuesta":true,"porque":"...","arreglo":"..."}},
 "loMejor":"...","elProblema":"...","reescritura":"..."}`;

export async function POST(req: NextRequest) {
  const { email, admin, ent } = await getAccess();
  if (!email) return Response.json({ error: 'Inicia sesión para usar esta herramienta.' }, { status: 401 });
  if (!admin && !ent?.viraladn) return Response.json({ error: 'Esta herramienta viene con tu plan de ViralADN.' }, { status: 403 });

  let body: { guion?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'Formato inválido.' }, { status: 400 }); }

  const guion = String(body.guion || '').trim().slice(0, 6000);
  if (guion.length < 40) {
    return Response.json({ error: 'Pega el guion completo — con menos de 40 caracteres no hay nada que medir.' }, { status: 400 });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: 'Falta configurar la IA.' }, { status: 503 });
  if (!rateLimit(`calculadora:${email}`, 40, 60 * 60 * 1000)) {
    return Response.json({ error: 'Llegaste al límite por hora. Prueba más tarde.' }, { status: 429 });
  }

  let cliente = '';
  try { cliente = (await getNicho(email)).nicho.clienteIdeal || ''; } catch { /* opcional */ }

  // Cada pregunta va con lo que significa Y con el malentendido típico. Sin el
  // "ojo:", el modelo leía "niño de 5 años" como "¿es contenido infantil?".
  const preguntas = CRITERIOS.map(c =>
    `- ${c.key}: ${c.pregunta}\n    significa: ${c.significa}\n    ojo: ${c.noEs}`).join('\n');
  const user = [
    `LAS SEIS PREGUNTAS:\n${preguntas}`,
    cliente ? `A QUIÉN LE HABLA QUIEN GRABA: ${cliente}\nÚsalo para juzgar la amplitud y el mercado, no para ablandarte.` : '',
    `EL GUION A EVALUAR:\n---\n${guion}\n---`,
    'Contesta las seis en JSON.',
  ].filter(Boolean).join('\n\n');

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.CALCULADORA_MODEL || 'gpt-4o',
        temperature: 0.3,          // evaluar pide consistencia, no creatividad
        max_tokens: 1400,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
      }),
    });
    if (!r.ok) {
      console.error('[calculadora] openai', r.status, (await r.text().catch(() => '')).slice(0, 200));
      return Response.json({ error: 'No pudimos evaluarlo. Prueba de nuevo.' }, { status: 502 });
    }
    const d = await r.json();
    const out = JSON.parse(d?.choices?.[0]?.message?.content || '{}');
    const crit = out.criterios || {};

    // El puntaje sale del código, no del modelo.
    const respuestas: Record<string, boolean> = {};
    for (const c of CRITERIOS) respuestas[c.key] = crit[c.key]?.respuesta === true;
    const puntos = puntuar(respuestas);

    const detalle = CRITERIOS.map(c => ({
      key: c.key,
      pregunta: c.pregunta,
      peso: c.peso,
      cumple: respuestas[c.key],
      porque: String(crit[c.key]?.porque || ''),
      // Si el modelo no propuso arreglo, cae el del catálogo: nunca dejamos
      // un "No" sin decir qué hacer.
      arreglo: respuestas[c.key] ? '' : String(crit[c.key]?.arreglo || c.siFalla),
    }));

    // Cuánto sube si arregla lo que falta, ordenado por lo que más pesa.
    const faltantes = detalle.filter(d => !d.cumple).sort((a, b) => b.peso - a.peso);

    // ── La otra mitad: la FORMA, medida por el código ─────────────────────
    // No pasa por la IA. Duración, apertura, tuteo, relleno y molde repetido
    // se cuentan, así que el resultado es el mismo siempre y no cuesta nada.
    const forma = medirForma(guion);
    const puntosForma = puntuarForma(forma);
    const final = puntajeFinal(puntos, puntosForma);

    return Response.json({
      // El número grande y sus dos mitades.
      puntos: final, total: 10,
      idea: { puntos, total: TOTAL },
      forma: { puntos: puntosForma, total: TOTAL_FORMA, chequeos: forma, segundos: rangoSegundos(guion) },
      veredicto: veredicto(final),
      criterios: detalle,
      pierdePor: faltantes.reduce((a, f) => a + f.peso, 0),
      prioridad: faltantes.slice(0, 2).map(f => f.key),
      loMejor: String(out.loMejor || ''),
      elProblema: String(out.elProblema || ''),
      reescritura: String(out.reescritura || ''),
    });
  } catch (e) {
    console.error('[calculadora]', (e as Error).message.slice(0, 150));
    return Response.json({ error: 'Error al evaluar. Prueba de nuevo.' }, { status: 502 });
  }
}
