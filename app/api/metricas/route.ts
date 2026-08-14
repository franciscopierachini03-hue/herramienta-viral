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

const SYSTEM = `Sos analista de contenido viral. Leés las estadísticas de un reel y explicás, como se lo explicarías a un alumno en clase, QUÉ pasó, POR QUÉ pasó y EN QUÉ PARTE del video se decidió.

Te paso capturas de las métricas de un reel (Instagram, TikTok, Shorts): números, gráfico de retención, desglose de alcance.

PASO 1 — LEER: sacá TODOS los números visibles. Si un dato no está, null. NO inventes.

PASO 2 — RATIOS (calculalos vos y compará contra lo sano):
- Retención = tiempo medio ÷ duración → sano ≥50%, muy bueno ≥65%.
- Guardados ÷ reproducciones → sano ≥1%, muy bueno ≥3%.
- Compartidos ÷ reproducciones → sano ≥0.5%, viral ≥2%.
- Me gusta ÷ reproducciones → sano ≥3%.
- Comentarios ÷ me gusta → si ≥8% tocaste un nervio.
- Alcance a NO seguidores → sano ≥50%; si es bajo, el algoritmo no lo empujó afuera.
- Seguidores nuevos ÷ alcance → sano ≥0.5%.
- Reproducciones ÷ seguidores (si se puede estimar) → arriba de 1x el video superó a la cuenta.

PASO 3 — DÓNDE SE DECIDIÓ. Ubicá la falla en UNA fase y explicá el razonamiento:
- GANCHO (0-3s): retención baja desde el arranque, o alcance casi todo de seguidores → la primera frase o el primer plano no frenó el scroll.
- DESARROLLO (3s hasta ~70%): buena entrada pero tiempo medio bajo → hay relleno, la promesa se demora o el ritmo cae.
- CIERRE / CTA (último tramo): buena retención pero pocos guardados, compartidos o seguidores → no pediste nada, o no quedó claro para quién es.
- DISTRIBUCIÓN: buenas señales de interacción pero pocas reproducciones → el tema es muy de nicho o el video es nuevo (dale 48h).
Si hay gráfico de retención, decí EN QUÉ SEGUNDO se cae y qué suele haber ahí.

PASO 4 — POR QUÉ funcionó o no: un párrafo de 3-5 frases, con los números en la mano, como si se lo explicaras a la persona en una clase. Nada de generalidades: conectá cada afirmación con un dato.

PASO 5 — ACCIONES: 3 a 5, concretas y aplicables al próximo video, cada una atada al número que la justifica.

PASO 6 — GANCHO: uno listo para grabar (1-2 frases) que ataque el problema principal.

Español neutro/rioplatense, directo, sin humo. Nada de "es importante que…".

Respondé SOLO JSON:
{
  "metricas": {"reproducciones":null,"alcance":null,"seguidores_pct":null,"me_gusta":null,"comentarios":null,"guardados":null,"compartidos":null,"tiempo_medio":null,"duracion":null,"retencion_3s":null,"visitas_perfil":null,"seguidores_nuevos":null},
  "veredicto": "<una frase: qué pasó con este video>",
  "nota": <0-100>,
  "lectura": "<3-5 frases explicando qué estás viendo en los números y POR QUÉ funcionó o no>",
  "dondeFallo": {"fase":"gancho|desarrollo|cierre|distribucion|ninguna","momento":"<ej. 'a los 4 segundos' o 'en el último tercio'>","explicacion":"<qué pasó ahí y por qué>"},
  "comparacion": [{"metrica":"<nombre>","tuyo":"<valor con %>","sano":"<referencia>","estado":"bien|justo|mal"}],
  "loBueno": ["<lo que SÍ funcionó>"],
  "problema": "<EL problema principal en una frase>",
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
