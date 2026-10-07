import { NextRequest } from 'next/server';
import { generar, SinIA, MENSAJE_SIN_IA } from '@/lib/ia';
import OpenAI from 'openai';

const IDIOMAS: Record<string, string> = {
  ingles:    'English',
  portugues: 'Portuguese (Brazilian)',
  espanol:   'Spanish (Latin American)',
  frances:   'French',
};

export async function POST(req: NextRequest) {
  const { texto, idioma } = await req.json();

  if (!texto) return Response.json({ error: 'Falta el texto' }, { status: 400 });
  if (!idioma || !IDIOMAS[idioma]) return Response.json({ error: 'Idioma no válido' }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: 'Falta configurar OPENAI_API_KEY.' }, { status: 422 });

  try {
    const targetLang = IDIOMAS[idioma];

    const { texto: traduccionIA } = await generar({
      etiqueta: 'traducir',
      modelo: 'gpt-4o-mini',
      temperatura: 0.3,
      maxTokens: 2000,
      mensajes: [
        {
          role: 'system',
          content: `You are a professional translator specialized in social media content scripts.
Translate the following script into ${targetLang}.
- Keep the same tone, energy and style as the original
- Preserve the structure and flow of the script
- Make it natural and conversational, not robotic
- Do NOT add any explanation or commentary — only return the translated text`,
        },
        { role: 'user', content: texto },
      ],
    });

    return Response.json({ traduccion: traduccionIA.trim() });
  } catch (e) {
    if (e instanceof SinIA) return Response.json({ error: MENSAJE_SIN_IA }, { status: 503 });
    return Response.json({ error: `Error al traducir: ${(e as Error).message}` }, { status: 502 });
  }
}
