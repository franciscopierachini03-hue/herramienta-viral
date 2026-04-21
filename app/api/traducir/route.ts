import { NextRequest } from 'next/server';
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
    const openai = new OpenAI({ apiKey });
    const targetLang = IDIOMAS[idioma];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specialized in social media content scripts.
Translate the following script into ${targetLang}.
- Keep the same tone, energy and style as the original
- Preserve the structure and flow of the script
- Make it natural and conversational, not robotic
- Do NOT add any explanation or commentary — only return the translated text`,
        },
        {
          role: 'user',
          content: texto,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const traduccion = completion.choices[0]?.message?.content?.trim() || '';
    return Response.json({ traduccion });
  } catch (e) {
    return Response.json({ error: `Error al traducir: ${(e as Error).message}` }, { status: 502 });
  }
}
