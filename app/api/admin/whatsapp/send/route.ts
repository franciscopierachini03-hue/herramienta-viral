import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';

// POST /api/admin/whatsapp/send — envía UNA plantilla aprobada a UN número
// (Meta Cloud API). El envío masivo lo orquesta el navegador del admin, que
// llama esto por cada fila del CSV (con concurrencia suave) — así hay progreso
// en vivo, reintentos por fila y ningún request se acerca al límite de 60s.
//
// Body: { to: "+5215512345678", template: "nombre", lang: "es_MX",
//         vars: ["Francisco", "viernes 10"] }  ← {{1}}, {{2}}, …

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GRAPH = 'https://graph.facebook.com/v20.0';

// E.164 sin '+' para la API: dígitos, 8–15, ya con código de país.
function normalizarTelefono(raw: string): string | null {
  const d = String(raw || '').replace(/[^\d]/g, '');
  if (d.length < 8 || d.length > 15) return null;
  return d;
}

export async function POST(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    return Response.json({ error: 'Falta configurar WHATSAPP_TOKEN / WHATSAPP_PHONE_ID en Vercel.' }, { status: 501 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }); }

  const to = normalizarTelefono(String(body.to || ''));
  const template = String(body.template || '').trim();
  const lang = String(body.lang || 'es_MX').trim();
  const vars = Array.isArray(body.vars)
    ? body.vars.map(v => String(v ?? '').slice(0, 500))
    : [];

  if (!to) return Response.json({ error: 'Teléfono inválido (falta código de país o largo incorrecto).' }, { status: 400 });
  if (!template) return Response.json({ error: 'Falta la plantilla.' }, { status: 400 });

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template,
      language: { code: lang },
      ...(vars.length
        ? { components: [{ type: 'body', parameters: vars.map(text => ({ type: 'text', text })) }] }
        : {}),
    },
  };

  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = d?.error?.message || `Meta respondió HTTP ${res.status}`;
      const code = d?.error?.code;
      return Response.json({ ok: false, error: `${msg}${code ? ` (código ${code})` : ''}` }, { status: 502 });
    }
    return Response.json({ ok: true, id: d?.messages?.[0]?.id || null });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
