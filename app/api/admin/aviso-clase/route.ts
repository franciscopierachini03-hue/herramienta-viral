import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { createServiceClient } from '@/lib/supabase/server';
import { claseEnFecha } from '@/app/comunidad/clase-config';

// GET /api/admin/aviso-clase — aviso puntual a TODOS los miembros activos:
// "la clase de mañana arranca a las 8:00 AM" (cambio de horario puntual).
//   ?test=1            → manda SOLO al dueño (para ver el correo antes)
//   ?enviar=1          → manda a todos (con candado anti doble-clic por día)
//   ?hora=8:00%20AM    → hora a anunciar (default 8:00 AM)
//   ?force=1           → salta el candado (re-envío consciente)
// Solo admin logueado. Sin parámetros = muestra cuántos lo recibirían (dry).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OWNER = 'franciscopierachini03@gmail.com';
const APP = 'https://www.viraladn.com';

type ClaseInfo = ReturnType<typeof claseEnFecha>;

function emailHtml(hora: string, fechaTxt: string, C: ClaseInfo): { subject: string; html: string } {
  const subject = `🕗 Cambio de horario: la clase de mañana es a las ${hora}`;
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#0b0b10;padding:28px 14px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#101018;border:1px solid #23232e;border-radius:18px;padding:28px;">
  <div style="background:linear-gradient(90deg,#7c3aed,#ec4899);border-radius:8px;padding:8px 14px;display:inline-block;">
    <span style="color:#fff;font-weight:800;font-size:15px;">ViralADN</span>
  </div>
  <h1 style="margin:18px 0 8px;font-size:25px;color:#fff;">🕗 ¡Ojo! Mañana la clase arranca más temprano</h1>
  <p style="margin:0 0 16px;font-size:15px;color:#c8c8d4;line-height:1.55;">
    <b style="color:#fff;">${fechaTxt}</b> la clase <b style="color:#fff;">${C.nombre}</b> comienza a las
    <b style="color:#fcd34d;font-size:18px;">${hora} (hora CDMX)</b> — más temprano que de costumbre. ¡Agendalo para no perdértela!
  </p>
  <div style="background:#0b0b10;border:1px solid #23232e;border-radius:14px;padding:16px;margin:0 0 18px;">
    <p style="margin:0 0 6px;font-size:13px;color:#9a9aa6;">📍 Sala: <b style="color:#fff;">${C.sala}</b></p>
    <p style="margin:0 0 6px;font-size:13px;color:#9a9aa6;">ID: <b style="color:#fff;font-family:monospace;">${C.zoomId}</b> · Código: <b style="color:#fff;font-family:monospace;">${C.zoomCodigo}</b></p>
  </div>
  <a href="${C.zoomUrl}" style="display:block;text-align:center;background:linear-gradient(90deg,#7c3aed,#ec4899);color:#fff;font-weight:800;font-size:16px;padding:14px;border-radius:12px;text-decoration:none;">
    👉 Entrar a la clase (${hora})
  </a>
  <p style="margin:16px 0 0;font-size:12px;color:#6a6a76;">El acceso también está siempre en <a href="${APP}/comunidad" style="color:#fcd34d;">viraladn.com/comunidad</a>.</p>
</div>
</body></html>`;
  return { subject, html };
}

async function enviar(emails: string[], subject: string, html: string): Promise<{ enviados: number; fallidos: number }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { enviados: 0, fallidos: emails.length };
  const from = process.env.RESEND_FROM || 'ViralADN <hola@viraladn.com>';
  let enviados = 0, fallidos = 0;
  for (let i = 0; i < emails.length; i += 90) {
    const chunk = emails.slice(i, i + 90);
    const payload = chunk.map(to => ({ from, to: [to], subject, html }));
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) enviados += chunk.length;
      else { fallidos += chunk.length; console.error('[aviso-clase] batch', r.status, await r.text().catch(() => '')); }
    } catch { fallidos += chunk.length; }
  }
  return { enviados, fallidos };
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const hora = (sp.get('hora') || '8:00 AM').slice(0, 20);
  const test = sp.get('test') === '1';
  const mandar = sp.get('enviar') === '1';
  const force = sp.get('force') === '1';

  // "Mañana" en CDMX, con nombre de día legible.
  const manana = new Date(Date.now() + 24 * 3600 * 1000);
  const fechaTxt = 'Mañana ' + new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long' }).format(manana);
  const mananaCDMX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(manana);
  const C = claseEnFecha(mananaCDMX); // la ESPECIAL si mañana es su día (link/sala correctos)
  const horaFinal = C.esEspecial ? C.horaCDMX : hora;
  const { subject, html } = emailHtml(horaFinal, fechaTxt, C);

  const sb = createServiceClient();
  const { data } = await sb.from('profiles')
    .select('email, subscription_status')
    .in('subscription_status', ['active', 'trialing']);
  const emails = [...new Set((data || []).map(p => (p.email || '').toLowerCase()).filter(e => e.includes('@')))];

  if (test) {
    const r = await enviar([OWNER], `[PRUEBA] ${subject}`, html);
    return Response.json({ modo: 'test', para: OWNER, ...r, aviso: fechaTxt + ' · ' + horaFinal });
  }

  if (!mandar) {
    return Response.json({ modo: 'dry', recibirian: emails.length, aviso: fechaTxt + ' · ' + horaFinal, siguiente: 'agregá &test=1 para verlo vos, o &enviar=1 para mandarlo a todos' });
  }

  // Candado anti doble-clic: 1 envío por día (marca en ai_credits si existe).
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const marca = 'aviso:clase-horario';
  if (!force) {
    try {
      const { data: m } = await sb.from('ai_credits').select('period').eq('email', marca).maybeSingle();
      if (m?.period === hoy) {
        return Response.json({ modo: 'bloqueado', motivo: `Ya se envió hoy (${hoy}). Agregá &force=1 para re-enviar conscientemente.` });
      }
    } catch { /* sin tabla → sin candado */ }
  }
  try {
    await sb.from('ai_credits').upsert({ email: marca, balance: 0, period: hoy, updated_at: new Date().toISOString() }, { onConflict: 'email' });
  } catch { /* best-effort */ }

  const r = await enviar(emails, subject, html);
  console.log(`[aviso-clase] enviado a ${r.enviados} miembros (${fechaTxt} · ${horaFinal})`);
  return Response.json({ modo: 'enviado', destinatarios: emails.length, ...r, aviso: fechaTxt + ' · ' + horaFinal });
}
