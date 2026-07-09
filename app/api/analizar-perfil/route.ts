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

const SYSTEM = `Sos un estratega de perfiles de Instagram/TikTok de primer nivel. Tu trabajo: mirar el SCREENSHOT del perfil de una persona y decirle, sin vueltas, qué cambiar para que su bio convierta visitas en seguidores y en clientes.

Sabés qué hace que un perfil funcione:
- La foto: cara clara y con luz (o logo nítido si es marca). Nada borroso ni lejano.
- El NOMBRE (el campo en negrita, no el @): es lo único que Instagram busca. Debe llevar nombre + palabra clave de lo que hace la persona ("Ana · Finanzas para mujeres"), no solo el nombre.
- El @usuario: corto, sin números ni guiones raros si se puede.
- La BIO (máx 150 caracteres): en 3 segundos tiene que quedar claro A QUIÉN ayuda, CON QUÉ y POR QUÉ seguirlo. Nada de frases vacías ("apasionado por la vida", "soñador"). Beneficio concreto + prueba + un CTA.
- El LINK: uno solo, claro, con motivo para tocarlo.
- Los HIGHLIGHTS y el CTA final.

REGLAS DE FEEDBACK:
- Español natural y directo. Honesto pero constructivo: si la bio está floja, decilo y mostrá cómo se arregla.
- Concreto: nada de "mejorá tu bio". Decí EXACTAMENTE qué poner.
- Prohibido inventar datos que no ves. Si algo no se ve en el screenshot, no lo evalúes.
- Nunca uses las palabras "real" ni "reales".
- Las 3 bios que propongas: listas para copiar y pegar, máx 150 caracteres cada una, cada una con un ángulo distinto (una directa/beneficio, una con números/prueba, una con personalidad/gancho). Usá saltos de línea con \\n si ayuda a la legibilidad, y como mucho 1-2 emojis por bio.

Devolvé ÚNICAMENTE un objeto JSON válido con esta forma exacta (sin texto fuera del JSON):
{
  "score": number (0-100, qué tan bien convierte el perfil hoy),
  "veredicto": string (1-2 frases honestas del estado actual),
  "detectado": { "nombre": string, "usuario": string, "bio": string, "seguidores": string } (lo que LEÍSTE en la imagen; "" si no se ve),
  "fortalezas": [string, ...] (1-3 cosas que ya están bien),
  "mejoras": [ { "elemento": string (ej. "Nombre", "Bio", "Foto", "Link", "CTA"), "problema": string, "solucion": string } , ... ] (3-6, lo más importante primero),
  "bios": [string, string, string] (3 bios nuevas listas para copiar),
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
  const contexto = S(body.contexto, 400).trim();

  const userText = [
    'Analizá este perfil y devolvé el JSON con el feedback.',
    contexto ? `Contexto que dio la persona (nicho / objetivo / qué vende): ${contexto}` : 'La persona no dio contexto — inferí el nicho de lo que se ve.',
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
      const mejorasIn = Array.isArray(raw.mejoras) ? raw.mejoras : [];
      const analisis = {
        score: typeof raw.score === 'number' && isFinite(raw.score) ? Math.max(0, Math.min(100, Math.round(raw.score))) : 0,
        veredicto: S(raw.veredicto, 500),
        detectado: {
          nombre: S(det.nombre, 120), usuario: S(det.usuario, 60),
          bio: S(det.bio, 400), seguidores: S(det.seguidores, 40),
        },
        fortalezas: arrStr(raw.fortalezas, 240, 4),
        mejoras: mejorasIn.map((m) => {
          const o = (m ?? {}) as Record<string, unknown>;
          return { elemento: S(o.elemento, 40), problema: S(o.problema, 300), solucion: S(o.solucion, 400) };
        }).filter(m => m.elemento || m.problema).slice(0, 7),
        bios: arrStr(raw.bios, 300, 3),
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
