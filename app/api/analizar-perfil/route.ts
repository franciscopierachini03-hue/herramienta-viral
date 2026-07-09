import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getAccess } from '@/lib/access';

// POST /api/analizar-perfil — Analista de perfil.
// El usuario sube un SCREENSHOT de su perfil (bio de Instagram/TikTok/etc.) y la
// IA de visión lee lo que hay (nombre, @usuario, bio, foto, seguidores,
// highlights, link) y devuelve feedback accionable + 3 bios nuevas listas para
// copiar. Para usuarios con plan ViralADN (no admin-only).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}
const MODEL_CHAIN = ['gpt-5.5', 'gpt-5.4', 'gpt-5.1', 'gpt-4.1', 'gpt-4o'];
let _modeloOk: string | null = null;

const SYSTEM = `Sos un estratega de perfiles de Instagram/TikTok de primer nivel, especializado en BIOS que convierten. Mirás el SCREENSHOT del perfil de una persona (más el contexto que te da) y le decís, sin vueltas, qué cambiar para que su descripción convierta visitas en seguidores y en clientes.

Sabés qué hace que un perfil funcione:
- La foto: cara clara y con luz (o logo nítido si es marca). Nada borroso ni lejano.
- El NOMBRE (el campo en negrita, no el @): es lo único que el buscador de Instagram indexa. Debe llevar nombre + palabra clave de lo que hace ("Ana · Finanzas para mujeres"), no solo el nombre.
- El @usuario: corto, alineado al nicho, sin números ni guiones raros si se puede.
- La BIO / descripción (máx 150 caracteres): en 3 segundos tiene que quedar clarísimo A QUIÉN ayuda, CON QUÉ resultado y QUÉ acción hacer. Cero frases vacías ("apasionado por la vida", "soñador", "amante del café"). La fórmula que funciona: línea 1 = a quién ayudás y con qué resultado concreto · línea 2 = prueba o diferencial (número, logro, método con nombre) · línea 3 = CTA con la acción exacta ("Escribí PLAN", "Agendá abajo").
- El LINK: uno solo, con motivo claro para tocarlo. Los HIGHLIGHTS ordenados para vender.

REGLAS DE FEEDBACK:
- Español natural y directo. Honesto pero constructivo: si la bio está floja, decilo y mostrá EXACTAMENTE cómo se arregla.
- Usá el CONTEXTO que dio la persona (qué vende, a quién, qué objetivo, qué tono) para que TODO el feedback y las bios estén hechos a medida. Si no dio contexto, inferí del screenshot y decilo.
- Prohibido inventar datos que no ves. Nunca uses las palabras "real" ni "reales".
- Sé claro y concreto sobre la DESCRIPCIÓN: es lo más importante del análisis. Explicá el porqué, no solo el qué.

Devolvé ÚNICAMENTE un objeto JSON válido con esta forma exacta (sin texto fuera del JSON):
{
  "score": number (0-100, qué tan bien convierte el perfil hoy),
  "veredicto": string (1-2 frases honestas del estado actual),
  "detectado": { "nombre": string, "usuario": string, "bio": string, "seguidores": string } (lo que LEÍSTE en la imagen; "" si no se ve),
  "fortalezas": [string, ...] (1-3 cosas que ya están bien),
  "bioAnalisis": {
    "queComunicaHoy": string (qué transmite la descripción actual a quien la lee en 3 segundos — honesto),
    "queDeberia": string (qué debería transmitir para convertir: a quién ayuda + resultado + acción),
    "estructura": string (la fórmula concreta línea por línea que le recomendás para SU caso)
  },
  "mejoras": [ { "elemento": string (ej. "Nombre", "Descripción", "Foto", "Link", "CTA", "Highlights"), "problema": string, "solucion": string } , ... ] (3-6, lo más importante primero),
  "bios": [ { "texto": string (bio lista para copiar, máx 150 caracteres, saltos de línea con \\n y máx 1-2 emojis), "angulo": string (2-4 palabras, ej. "Beneficio directo", "Con prueba", "Con personalidad"), "porque": string (1 frase de por qué esta versión convierte) } ] (exactamente 3, cada una con un ángulo distinto),
  "recomendaciones": [string, ...] (2-4 acciones extra accionables)
}`;

function sanitizeImagenes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  let total = 0;
  for (const v of raw) {
    if (typeof v !== 'string' || !v.startsWith('data:image/')) continue;
    if (v.length > 2_500_000) continue;
    total += v.length;
    if (total > 6_000_000) break;
    out.push(v);
    if (out.length >= 3) break;
  }
  return out;
}

const S = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const arrStr = (v: unknown, max: number, n: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(x => x.slice(0, max)).slice(0, n) : [];

export async function POST(req: NextRequest) {
  // Acceso: cualquier usuario logueado con plan (la página vive en /app, ya protegida).
  const { email } = await getAccess();
  if (!email) return Response.json({ error: 'Iniciá sesión para analizar tu perfil.' }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Falta configurar la IA (OPENAI_API_KEY).' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }); }

  const imagenes = sanitizeImagenes(body.imagenes);
  if (!imagenes.length) return Response.json({ error: 'Subí una captura de tu perfil.' }, { status: 400 });

  // Contexto rico (todo opcional): mientras más da, más a medida sale el feedback.
  // Acepta objeto {oferta, audiencia, objetivo, tono} o un string suelto (compat).
  const ctx = (typeof body.contexto === 'object' && body.contexto ? body.contexto : {}) as Record<string, unknown>;
  const oferta = S(ctx.oferta ?? (typeof body.contexto === 'string' ? body.contexto : ''), 400).trim();
  const audiencia = S(ctx.audiencia, 400).trim();
  const objetivo = S(ctx.objetivo, 300).trim();
  const tono = S(ctx.tono, 120).trim();
  const bloques = [
    oferta && `- Qué hace / vende: ${oferta}`,
    audiencia && `- A quién ayuda (cliente ideal): ${audiencia}`,
    objetivo && `- Qué quiere que haga quien visita el perfil: ${objetivo}`,
    tono && `- Tono / personalidad deseada: ${tono}`,
  ].filter(Boolean);

  const userText = [
    'Analizá este perfil y devolvé el JSON con el feedback. Poné foco en la DESCRIPCIÓN (bio): que quede clarísimo qué comunica hoy, qué debería, y dame 3 bios nuevas explicadas.',
    bloques.length
      ? `CONTEXTO que dio la persona (usalo para que TODO salga a medida):\n${bloques.join('\n')}`
      : 'La persona no dio contexto — inferí el nicho y el objetivo de lo que se ve, y decilo.',
    `A continuación, ${imagenes.length} captura(s) del perfil.`,
  ].join('\n');

  const base = process.env.CARRUSELES_MODEL
    ? [process.env.CARRUSELES_MODEL, ...MODEL_CHAIN.filter(m => m !== process.env.CARRUSELES_MODEL)]
    : MODEL_CHAIN;
  const lista = _modeloOk ? [_modeloOk, ...base.filter(m => m !== _modeloOk)] : base;

  let lastErr: unknown = null;
  for (const model of lista) {
    try {
      const completion = await getOpenAI().chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        ...(model.startsWith('gpt-5') ? { reasoning_effort: 'low' as const } : { temperature: 0.7 }),
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              ...imagenes.map((url) => ({ type: 'image_url' as const, image_url: { url, detail: 'high' as const } })),
            ],
          },
        ],
      });
      _modeloOk = model;
      const raw = JSON.parse(completion.choices[0]?.message?.content || '{}') as Record<string, unknown>;
      const det = (raw.detectado ?? {}) as Record<string, unknown>;
      const bioA = (raw.bioAnalisis ?? {}) as Record<string, unknown>;
      const mejorasIn = Array.isArray(raw.mejoras) ? raw.mejoras : [];
      const biosIn = Array.isArray(raw.bios) ? raw.bios : [];
      const analisis = {
        score: typeof raw.score === 'number' && isFinite(raw.score) ? Math.max(0, Math.min(100, Math.round(raw.score))) : 0,
        veredicto: S(raw.veredicto, 500),
        detectado: {
          nombre: S(det.nombre, 120), usuario: S(det.usuario, 60),
          bio: S(det.bio, 400), seguidores: S(det.seguidores, 40),
        },
        fortalezas: arrStr(raw.fortalezas, 240, 4),
        bioAnalisis: {
          queComunicaHoy: S(bioA.queComunicaHoy, 500),
          queDeberia: S(bioA.queDeberia, 500),
          estructura: S(bioA.estructura, 600),
        },
        mejoras: mejorasIn.map((m) => {
          const o = (m ?? {}) as Record<string, unknown>;
          return { elemento: S(o.elemento, 40), problema: S(o.problema, 300), solucion: S(o.solucion, 400) };
        }).filter(m => m.elemento || m.problema).slice(0, 7),
        // Bios como objetos {texto, angulo, porque}; tolera que el modelo mande strings sueltos.
        bios: biosIn.map((b) => {
          if (typeof b === 'string') return { texto: b.slice(0, 300), angulo: '', porque: '' };
          const o = (b ?? {}) as Record<string, unknown>;
          return { texto: S(o.texto, 300), angulo: S(o.angulo, 40), porque: S(o.porque, 300) };
        }).filter(b => b.texto).slice(0, 3),
        recomendaciones: arrStr(raw.recomendaciones, 300, 5),
      };
      if (!analisis.veredicto && !analisis.mejoras.length && !analisis.bios.length) {
        return Response.json({ error: 'No pudimos leer el perfil. Probá con una captura más nítida.' }, { status: 502 });
      }
      return Response.json({ analisis });
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : '';
      if (/model|not found|does not exist|unsupported|access/i.test(msg)) { continue; }
      break;
    }
  }
  console.error('[analizar-perfil] error:', lastErr instanceof Error ? lastErr.message : lastErr);
  return Response.json({ error: 'No se pudo analizar ahora. Probá de nuevo en un momento.' }, { status: 500 });
}
