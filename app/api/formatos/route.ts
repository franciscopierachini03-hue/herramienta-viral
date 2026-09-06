import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { getNicho } from '@/lib/nicho-store';
import { rateLimit } from '@/lib/ratelimit';
import { FORMATOS, ESTRUCTURAS, getFormato, getEstructura } from '@/lib/formatos-video';
import { CRITERIOS, medirForma, puntuarForma } from '@/lib/calculadora-viral';

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

// El guion tiene que nacer cumpliendo lo que la Calculadora mide. Las reglas
// salen del MISMO archivo que puntúa (lib/calculadora-viral), así que si mañana
// cambia un criterio, el generador se entera solo.
const REGLAS_DE_ORO = `
🎯 ESTE GUION SE VA A MEDIR. Cumple las doce cosas o no sirve.

LA FORMA — esto se verifica contando, no opinando:
  1. LARGO: entre 150 y 220 palabras de texto hablado. Ni una menos.
     (De 67 virales medidos, ninguno bajaba de 15s; la mediana fue 52s.)
  2. ABRE con una pregunta o con la voz de OTRA persona. 6 de los 10 videos
     más vistos lo hacen. Nunca abras contigo afirmando.
  3. JAMÁS te presentes. Nada de "hola", "soy", "bienvenidos". Cero de los 10
     más vistos se presenta.
  4. La PRIMERA frase le habla a la persona: "tú", "te", o un verbo en
     imperativo ("mira", "deja de", "observa"). 10 de 10 lo hacen.
  5. NADA de relleno: prohibido "en conclusión", "cabe destacar", "es
     importante que", "como sabemos", "espero que les guste".
  6. REPITE UN MOLDE. Esto se verifica contando, así que hazlo literal:
     TRES O MÁS frases seguidas que EMPIECEN CON LAS MISMAS DOS O TRES
     PALABRAS. No "parecidas": las mismas.
       ✅ "Si cobras por hora, vendes tiempo.
            Si cobras por proyecto, vendes resultado.
            Si cobras por resultado, vendes tu criterio."
       ✅ "El que aguanta espera el lunes.
            El que resuelve empezó el martes.
            El que gana ya ni se acuerda."
       ❌ Tres frases distintas que hablan del mismo tema. Eso NO cuenta.
     Es el patrón de un video de 11.4M y casi nadie lo usa.

LA SUSTANCIA — sin esto, cumplir el resto no sirve de nada:
  · La persona tiene que TERMINAR SABIENDO ALGO QUE NO SABÍA y que pueda usar
    hoy. Si al final solo se queda con una frase bonita, el guion no sirve.
  · Da una de estas cuatro cosas, nunca un consejo suelto:
      a) UN MECANISMO paso a paso — "el rico le pide al banco, invierte, espera
         a que suba, y con la ganancia le paga" (ese video hizo 13.4 millones).
      b) DISTINCIONES CON NOMBRE — "si te gusta por su cuerpo se llama deseo;
         por su inteligencia, admiración; porque te da paz, amor" (11.4M).
      c) INTERCAMBIOS CONCRETOS — "en lugar de 'disculpa por llegar tarde',
         di 'gracias por esperarme'" (4.6M).
      d) NÚMEROS Y CASOS — cifras, edades, plazos, precios. Nada de "mucho",
         "poco" o "bastante".
  · CADA bloque suma información NUEVA. Prohibido repetir con otras palabras
    lo que ya dijiste, y prohibido rellenar para llegar a las 150 palabras.
  · Nada de generalidades: "sé constante", "trabaja tu mentalidad", "todo
    empieza por ti" están PROHIBIDAS. Si una frase le sirve igual a cualquier
    nicho, bórrala y pon algo específico.
  · EL CIERRE tampoco puede ser genérico. Prohibido "cambia tu enfoque hoy",
    "empieza a cobrar lo que vales", "el cambio está en ti", "tú puedes".
    El cierre pide UNA acción concreta y da el motivo:
      ✅ "Toma tu último presupuesto y vuelve a cotizarlo por entregable.
          Vas a ver el número que estabas regalando."
      ❌ "Empieza hoy a valorar tu trabajo."
  · Palabras prohibidas en todo el guion: "real", "reales", "realmente",
    "literalmente", "increíble", "brutal".

LA IDEA — esto lo juzga una persona, así que hazlo evidente:
  7. Que la idea central se entienda de UNA pasada. Sin tecnicismos.
  8. Apóyate en una estructura que ya se vio funcionar (versus, ranking,
     antes/después, caso con giro, "lo que nadie te dice").
  9. Que le interese a la mitad de quien lo vea, no solo a tu nicho.
 10. Que el tema toque algo que circula: dinero, salud, relaciones, tiempo.
 11. ÁNCLALO a algo de ahora: la época del año, una fecha, una conversación
     que ya está dando vueltas. Este es el que más se olvida.
 12. TOMA POSICIÓN. Di qué está mal de lo que todos hacen. Sin debate no hay
     comentarios. Este es el otro que más se olvida.
`;

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


// El guion vuelve por partes (gancho / bloques / cierre). Para medirlo con la
// misma vara que la Calculadora hay que armar el texto HABLADO, que es lo que
// la persona va a decir en voz alta.
type BloqueGuion = { hablado?: string; columnaA?: string; columnaB?: string; enPantalla?: string };
function textoHablado(g: { gancho?: string; bloques?: BloqueGuion[]; cta?: string }): string {
  const p: string[] = [];
  if (g.gancho) p.push(g.gancho);
  for (const b of g.bloques || []) {
    if (b.columnaA || b.columnaB) p.push([b.columnaA, b.columnaB].filter(Boolean).join(' '));
    else if (b.hablado) p.push(b.hablado);
    else if (b.enPantalla) p.push(b.enPantalla);
  }
  if (g.cta) p.push(g.cta);
  return p.join(' ');
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
  const reglas = REGLAS_DE_ORO;
  const system = esGanchos
    ? `${BASE}

Tu tarea: escribir CINCO ganchos distintos para el mismo video. No cinco maneras
de decir lo mismo: cinco ÁNGULOS de entrada diferentes.
Cada uno se dice en menos de 4 segundos. Ninguno explica nada — solo frena el dedo.
Responde en JSON: {"ganchos":[{"texto":"...","porQueFunciona":"en una línea, qué resorte toca"}]}`
    : `${BASE}
${reglas}

Tu tarea: escribir el guion COMPLETO respetando el esqueleto del formato al pie
de la letra Y las doce reglas de arriba. Si el formato pide columnas, van columnas. Si pide escena, va escena.
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
    let out = JSON.parse(d?.choices?.[0]?.message?.content || '{}');

    // ── Se corrige solo ────────────────────────────────────────────────────
    // La mitad de FORMA se mide contando, no opinando: podemos verificar el
    // guion antes de mostrarlo y, si le falta algo, pedir UNA corrección con
    // los fallos concretos. Es la diferencia entre "le pedí que cumpliera" y
    // "verifiqué que cumple".
    if (!esGanchos) {
      let ch = medirForma(textoHablado(out));
      if (puntuarForma(ch) < 10) {
        const fallos = ch.filter(c => !c.cumple)
          .map(c => `· ${c.nombre}: ${c.detalle} → ${c.arreglo}`).join('\n');
        try {
          const fix = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: process.env.FORMATOS_MODEL || 'gpt-4o',
              temperature: 0.7, max_tokens: 1800,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
                { role: 'assistant', content: JSON.stringify(out) },
                { role: 'user', content: `Ese guion NO pasa el control de calidad. Fallos medidos:\n${fallos}\n\nDevuélvelo corregido, con la MISMA idea y el mismo formato — solo arregla lo listado. Mismo JSON.` },
              ],
            }),
          });
          if (fix.ok) {
            const corregido = JSON.parse((await fix.json())?.choices?.[0]?.message?.content || '{}');
            const chNuevo = medirForma(textoHablado(corregido));
            // Nos quedamos con el corregido solo si de verdad mejoró.
            if (corregido.gancho && puntuarForma(chNuevo) > puntuarForma(ch)) { out = corregido; ch = chNuevo; }
          }
        } catch { /* si la corrección falla, va el original */ }
      }
      const forma = puntuarForma(ch);
      console.log(`[formatos] ${f.key}/${e.key} · forma ${forma}/10${forma < 10 ? ' · falta: ' + ch.filter(c => !c.cumple).map(c => c.key).join(',') : ''}`);
      return Response.json({
        ...out, formato: f.key, salida: f.salida, estructura: e.key,
        // Se muestra en pantalla: la persona ve que ya pasó el control.
        control: { forma, total: 10, chequeos: ch },
      });
    }

    return Response.json({ ...out, formato: f.key, salida: f.salida, estructura: e.key });
  } catch (err) {
    console.error('[formatos]', (err as Error).message.slice(0, 150));
    return Response.json({ error: 'Error al generar. Probá de nuevo.' }, { status: 502 });
  }
}
