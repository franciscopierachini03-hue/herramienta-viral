import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { getNicho } from '@/lib/nicho-store';
import { rateLimit } from '@/lib/ratelimit';

// POST /api/metricas — 📊 DIAGNÓSTICO DE REELS por captura de pantalla.
// La persona sube el screenshot de las estadísticas de su reel (IG/TikTok) y la
// IA: 1) LEE los números de la imagen, 2) los interpreta como un editor/estratega
// (qué falló: gancho, retención, valor, CTA…), 3) le da acciones concretas
// adaptadas a SU cliente ideal (el que ya definió en ViralADN).
//
// Entrada: { imagenes: ["data:image/jpeg;base64,…"], contexto?: string }
// Salida:  { metricas, diagnostico, notas, acciones, guionSugerido }
// Gate: entitlement viraladn (o combo). Rate limit por usuario.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_IMAGENES = 3;
const MAX_BYTES = 4 * 1024 * 1024; // por imagen, ya comprimida en el navegador

const SYSTEM = `Sos analista de contenido viral: leés las estadísticas de un reel y decís, sin vueltas, qué hay que mejorar.

Te paso una o más capturas de pantalla de las métricas de un reel (Instagram, TikTok, YouTube Shorts). Puede venir el gráfico de retención, el desglose de alcance, interacciones, etc.

PASO 1 — LEER: sacá de la imagen todos los números que veas (reproducciones, alcance, seguidores vs no seguidores, me gusta, comentarios, guardados, compartidos, tiempo de reproducción medio, retención, visitas al perfil, seguidores ganados). Si un dato NO está en la imagen, dejalo en null: NO lo inventes.

PASO 2 — DIAGNOSTICAR con estas reglas de oficio:
- Retención primeros 3s < 70% o caída fuerte al inicio → EL GANCHO no funcionó (visual o primera frase).
- Muchas reproducciones pero pocos guardados (<1% de las repros) → falta VALOR accionable; entretiene pero no sirve.
- Pocos compartidos (<0.5%) → falta CARGA EMOCIONAL o identificación ("esto es para vos").
- Alcance casi todo de seguidores (>60%) → el algoritmo no lo empujó afuera: gancho débil o tema muy de nicho.
- Buena retención pero pocos seguidores nuevos → falta CTA de seguir y que quede claro de qué hablás.
- Tiempo de reproducción medio < 50% de la duración → se cae en el medio: sobra relleno, faltan cortes.
- Muchos comentarios respecto de los "me gusta" → tocaste un nervio: hacé secuela.

PASO 3 — ACCIONES: 3 a 5 acciones CONCRETAS y aplicables al próximo video (no consejos genéricos). Cada una: qué hacer y por qué, según los números que leíste.

PASO 4 — GANCHO: escribí UN gancho listo para grabar (1-2 frases) que ataque el problema principal detectado.

Hablás en español rioplatense/neutro, directo y sin humo. Nada de "es importante que…"; decí exactamente qué hacer.

Respondé SOLO en JSON con esta forma:
{
  "metricas": {"reproducciones":null,"alcance":null,"seguidores_pct":null,"me_gusta":null,"comentarios":null,"guardados":null,"compartidos":null,"tiempo_medio":null,"retencion_3s":null,"seguidores_nuevos":null},
  "veredicto": "<una frase: qué pasó con este video>",
  "nota": <0-100, qué tan bien le fue>,
  "loBueno": ["<lo que SÍ funcionó, 1-3 puntos>"],
  "problema": "<EL problema principal, en una frase>",
  "acciones": [{"que":"<acción concreta>","porque":"<el número que lo justifica>"}],
  "ganchoSugerido": "<gancho listo para grabar>"
}`;

export async function POST(req: NextRequest) {
  const { email, admin, ent } = await getAccess();
  if (!email) return Response.json({ error: 'Iniciá sesión para usar esta herramienta.' }, { status: 401 });
  if (!admin && !ent?.viraladn) {
    return Response.json({ error: 'Esta herramienta viene con tu plan de ViralADN.' }, { status: 403 });
  }
  if (!rateLimit(`metricas:${email}`, 20, 60 * 60 * 1000)) {
    return Response.json({ error: 'Llegaste al límite por hora. Probá más tarde.' }, { status: 429 });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: 'Falta configurar el análisis (OPENAI_API_KEY).' }, { status: 503 });

  let body: { imagenes?: string[]; contexto?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'Formato inválido.' }, { status: 400 }); }

  const imagenes = (body.imagenes || []).filter(s => typeof s === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(s)).slice(0, MAX_IMAGENES);
  if (!imagenes.length) return Response.json({ error: 'Subí al menos una captura de tus estadísticas.' }, { status: 400 });
  for (const img of imagenes) {
    const b64 = img.split(',')[1] || '';
    if (b64.length * 0.75 > MAX_BYTES) return Response.json({ error: 'La imagen pesa demasiado. Probá con una captura más chica.' }, { status: 413 });
  }

  // Su cliente ideal (definido una vez en ViralADN) → el análisis le habla a ESA persona.
  let clienteIdeal = '';
  try { clienteIdeal = (await getNicho(email)).nicho.clienteIdeal || ''; } catch { /* sin nicho, análisis general */ }

  const contexto = String(body.contexto || '').slice(0, 600).trim();
  const userText = [
    'Analizá las métricas de estas capturas.',
    clienteIdeal ? `A QUIÉN LE HABLA quien graba (su cliente ideal): ${clienteIdeal}. Las acciones y el gancho tienen que servirle para llegar a ESA persona.` : '',
    contexto ? `Contexto que da el usuario sobre el video: ${contexto}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.METRICAS_MODEL || 'gpt-4o',
        temperature: 0.4,
        max_tokens: 1400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: [
            { type: 'text', text: userText },
            ...imagenes.map(url => ({ type: 'image_url', image_url: { url, detail: 'high' } })),
          ] },
        ],
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.error('[metricas] openai', r.status, t.slice(0, 200));
      return Response.json({ error: 'No pudimos analizar la captura. Probá de nuevo.' }, { status: 502 });
    }
    const d = await r.json();
    const out = JSON.parse(d?.choices?.[0]?.message?.content || '{}');
    return Response.json({ ...out, conClienteIdeal: !!clienteIdeal });
  } catch (e) {
    console.error('[metricas]', (e as Error).message.slice(0, 150));
    return Response.json({ error: 'Error al analizar. Probá de nuevo.' }, { status: 502 });
  }
}
