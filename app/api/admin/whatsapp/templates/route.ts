import { getAccess } from '@/lib/access';

// GET /api/admin/whatsapp/templates — lista las plantillas APROBADAS de la
// cuenta de WhatsApp Business (Meta Cloud API). Solo admin.
//
// Necesita en Vercel:
//   WHATSAPP_TOKEN    → token permanente (System User) con permisos
//                       whatsapp_business_messaging + whatsapp_business_management
//   WHATSAPP_WABA_ID  → ID de la cuenta de WhatsApp Business (WhatsApp Manager)
//   WHATSAPP_PHONE_ID → ID del número emisor (para /send)

export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com/v20.0';

export async function GET() {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const token = process.env.WHATSAPP_TOKEN;
  const waba = process.env.WHATSAPP_WABA_ID;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const faltan = [
    !token ? 'WHATSAPP_TOKEN' : '',
    !waba ? 'WHATSAPP_WABA_ID' : '',
    !phoneId ? 'WHATSAPP_PHONE_ID' : '',
  ].filter(Boolean);
  if (faltan.length) return Response.json({ configurado: false, faltan });

  try {
    const res = await fetch(
      `${GRAPH}/${waba}/message_templates?fields=name,language,status,category,components&limit=100`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    const d = await res.json();
    if (!res.ok) {
      return Response.json({
        configurado: true,
        error: d?.error?.message || `Meta respondió HTTP ${res.status}`,
      }, { status: 502 });
    }

    type Comp = { type?: string; text?: string; format?: string };
    const plantillas = ((d.data || []) as Array<Record<string, unknown>>)
      .filter(t => t.status === 'APPROVED')
      .map(t => {
        const comps = (t.components || []) as Comp[];
        const body = comps.find(c => c.type === 'BODY')?.text || '';
        const header = comps.find(c => c.type === 'HEADER');
        // Variables {{1}}..{{n}} del cuerpo.
        const nums = [...body.matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1]));
        const variables = nums.length ? Math.max(...nums) : 0;
        return {
          name: String(t.name),
          language: String(t.language),
          category: String(t.category || ''),
          body,
          variables,
          headerConVariable: header?.text?.includes('{{') || (header?.format && header.format !== 'TEXT') || false,
        };
      });

    return Response.json({ configurado: true, plantillas });
  } catch (e) {
    return Response.json({ configurado: true, error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
