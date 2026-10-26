import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { createServiceClient } from '@/lib/supabase/server';

// /api/admin/pausa-viraladn — EL OPERATIVO DE LA PAUSA, en un solo lugar.
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// El 26-oct-2026 Francisco decidió pausar ViralADN HOY, congelar el cobro de
// quien tiene suscripción (sin reembolsos) y avisarle a todos los activos.
// Son tres pasos con dinero y clientes de por medio; este panel los reúne y
// NINGUNO se ejecuta sin una confirmación explícita.
//
//   GET                         → simulacro: a cuántos les llega el correo,
//                                 cuántas suscripciones se congelarían, y el
//                                 correo tal cual. No toca nada.
//   GET ?test=1                 → manda el correo SOLO al dueño, para verlo.
//   POST {accion:'congelar', confirmar:true, alcance:'todos'|'octubre'}
//                               → congela el cobro en Stripe (pause_collection,
//                                 behavior=void: las facturas de la pausa se
//                                 anulan, no se cobra nada). REVERSIBLE.
//   POST {accion:'reanudar', confirmar:true}
//                               → quita la congelación (para cuando vuelva).
//   POST {accion:'enviar', confirmar:true, desde?:n}
//                               → manda el correo a todos los activos, en
//                                 tandas de 100. Si Resend corta por cuota,
//                                 devuelve hasta dónde llegó y se sigue con
//                                 `desde` al día siguiente.
//
// "Congelar" NO detiene el reloj: el período que cada uno ya pagó sigue
// corriendo durante la pausa. Por eso el correo no promete devolver tiempo.
// Solo admin.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OWNER = 'franciscopierachini03@gmail.com';
const APP = 'https://www.viraladn.com';

type Cuenta = { id: string; label: string; key: string | undefined };
const cuentas = (): Cuenta[] => ([
  { id: '2clicks',   label: '2CLICKS / ViralADN', key: process.env.STRIPE_SECRET_KEY },
  { id: 'elevation', label: 'Elevation',          key: process.env.STRIPE_SECRET_KEY_ELEVATION },
  { id: 'legacy',    label: 'Legacy',             key: process.env.STRIPE_SECRET_KEY_LEGACY },
] as Cuenta[]).filter(c => !!c.key);

type SubVivaLite = {
  cuenta: Cuenta; id: string; email: string; status: string;
  pagadaEnOctubre: boolean; yaCongelada: boolean;
};

async function subsVivas(): Promise<SubVivaLite[]> {
  const out: SubVivaLite[] = [];
  for (const c of cuentas()) {
    for (const status of ['active', 'trialing', 'past_due']) {
      let after: string | null = null;
      for (let i = 0; i < 6; i++) {
        const q = `subscriptions?status=${status}&limit=100&expand[]=data.customer&expand[]=data.latest_invoice`
          + (after ? `&starting_after=${after}` : '');
        const r = await fetch(`https://api.stripe.com/v1/${q}`, { headers: { Authorization: `Bearer ${c.key}` }, cache: 'no-store' });
        if (!r.ok) break;
        const d = await r.json() as { data?: Array<Record<string, unknown>>; has_more?: boolean };
        const lote = d.data || [];
        for (const s of lote) {
          const cust = s.customer as { email?: string } | null;
          const inv = s.latest_invoice as { created?: number; amount_paid?: number } | null;
          const creada = inv?.created ? new Date(inv.created * 1000) : null;
          out.push({
            cuenta: c,
            id: String(s.id),
            email: String(cust?.email || '').toLowerCase().trim(),
            status: String(s.status),
            pagadaEnOctubre: !!creada && creada.getUTCFullYear() === 2026 && creada.getUTCMonth() === 9 && (inv?.amount_paid || 0) > 0,
            yaCongelada: !!s.pause_collection,
          });
        }
        if (!d.has_more || !lote.length) break;
        after = String(lote[lote.length - 1].id);
      }
    }
  }
  return out;
}

// "Todos los correos activos en ViralADN": quien tiene acceso en la plataforma
// MÁS quien tiene suscripción viva en Stripe. Las dos listas no coinciden
// (durante meses no hubo webhook), y a cualquiera de los dos le cambia algo.
async function destinatarios(subs: SubVivaLite[]): Promise<string[]> {
  const sb = createServiceClient();
  const { data } = await sb.from('profiles').select('email')
    .in('subscription_status', ['active', 'trialing']).not('email', 'is', null).limit(5000);
  const set = new Set<string>();
  for (const p of data || []) { const e = String(p.email || '').toLowerCase().trim(); if (e.includes('@')) set.add(e); }
  for (const s of subs) if (s.email.includes('@')) set.add(s.email);
  return [...set].sort();
}

function correo(): { subject: string; html: string } {
  const subject = 'ViralADN entra en pausa — tu cobro queda congelado';
  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f0f17;border:1px solid #1f1f2b;border-radius:18px;padding:30px;">
<tr><td>
  <p style="margin:0 0 18px;font-size:16px;font-weight:800;color:#fff;">⏸️ <span style="color:#c4b5fd;">ViralADN</span></p>
  <h1 style="margin:0 0 12px;font-size:24px;color:#fff;">ViralADN entra en pausa</h1>
  <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#b4b4c0;">
    Te escribimos para avisarte que <b style="color:#fff;">a partir de hoy ViralADN entra en pausa</b> mientras reconstruimos la herramienta.
  </p>

  <div style="background:#0b0b14;border:1px solid #23232f;border-radius:14px;padding:16px 18px;margin:0 0 18px;">
    <p style="margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:1px;color:#c4b5fd;">QUÉ SIGNIFICA PARA TI</p>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#d4d4dc;">
      <b style="color:#fff;">No se te va a cobrar mientras dure la pausa.</b> Congelamos tu suscripción: tu próximo cobro no va a salir.
    </p>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:#d4d4dc;">
      <b style="color:#fff;">Cuando ViralADN vuelva, te avisamos antes</b> de reactivar nada.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.55;color:#d4d4dc;">
      <b style="color:#fff;">Las clases en vivo siguen igual:</b> domingos 10:00 AM con Francisco y lunes 9:00 AM con Rogger (hora de Ciudad de México).
    </p>
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
    <td align="center" bgcolor="#f59e0b" style="border-radius:12px;">
      <a href="${APP}/comunidad" target="_blank" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:800;color:#1a1206;text-decoration:none;border-radius:12px;">
        🎓 Ir a las clases →
      </a>
    </td>
  </tr></table>

  <p style="margin:0 0 6px;font-size:13px;line-height:1.55;color:#9a9aa6;">
    ¿Dudas con tu cuenta o tu cobro? Respóndenos a este correo o escríbenos desde el <a href="${APP}/ayuda" style="color:#c4b5fd;">Centro de Ayuda</a>.
  </p>
  <p style="margin:18px 0 0;font-size:14px;color:#d4d4dc;">Gracias por ser parte.<br/><b style="color:#fff;">Francisco y el equipo de ViralADN</b></p>
</td></tr></table>
</td></tr></table></body></html>`;
  return { subject, html };
}

async function enviarLote(emails: string[], subject: string, html: string): Promise<{ ok: boolean; status: number; detalle: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, status: 503, detalle: 'Falta RESEND_API_KEY' };
  const from = process.env.RESEND_FROM || 'ViralADN <hola@viraladn.com>';
  const r = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emails.map(to => ({ from, to: [to], subject, html }))),
  });
  return { ok: r.ok, status: r.status, detalle: r.ok ? '' : (await r.text().catch(() => '')).slice(0, 200) };
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const { subject, html } = correo();

  if (req.nextUrl.searchParams.get('test') === '1') {
    const r = await enviarLote([OWNER], `[PRUEBA] ${subject}`, html);
    return Response.json({ test: true, a: OWNER, ...r });
  }

  const subs = await subsVivas();
  const lista = await destinatarios(subs);
  const porCuenta: Record<string, number> = {};
  for (const s of subs) porCuenta[s.cuenta.label] = (porCuenta[s.cuenta.label] || 0) + 1;

  return Response.json({
    simulacro: true,
    nada_se_ejecuto: 'Esto es solo el conteo. Para congelar o enviar hay que confirmarlo con un POST.',
    correo: { destinatarios: lista.length, asunto: subject, muestra: lista.slice(0, 5) },
    congelar: {
      cuentas_leidas: cuentas().map(c => c.label),
      suscripciones_vivas: subs.length,
      por_cuenta: porCuenta,
      si_alcance_todos: subs.filter(s => !s.yaCongelada).length,
      si_alcance_octubre: subs.filter(s => s.pagadaEnOctubre && !s.yaCongelada).length,
      ya_congeladas: subs.filter(s => s.yaCongelada).length,
    },
    ver_el_correo: '/api/admin/pausa-viraladn?test=1',
  });
}

export async function POST(req: NextRequest) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { accion?: string; confirmar?: boolean; alcance?: string; desde?: number };
  if (body.confirmar !== true) {
    return Response.json({ error: 'Falta confirmar:true. Nada se ejecutó.' }, { status: 400 });
  }

  if (body.accion === 'congelar' || body.accion === 'reanudar') {
    const congelar = body.accion === 'congelar';
    const subs = await subsVivas();
    const objetivo = subs.filter(s => congelar
      ? !s.yaCongelada && (body.alcance === 'octubre' ? s.pagadaEnOctubre : true)
      : s.yaCongelada);
    let ok = 0; const fallos: string[] = [];
    for (const s of objetivo) {
      const form = congelar ? 'pause_collection[behavior]=void' : 'pause_collection=';
      const r = await fetch(`https://api.stripe.com/v1/subscriptions/${s.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${s.cuenta.key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      });
      if (r.ok) ok++; else fallos.push(`${s.email || s.id} (${r.status})`);
    }
    console.log(`[pausa-viraladn] ${body.accion}: ${ok} ok, ${fallos.length} fallos`);
    return Response.json({ accion: body.accion, alcance: body.alcance || 'todos', objetivo: objetivo.length, ok, fallos });
  }

  if (body.accion === 'enviar') {
    const subs = await subsVivas();
    const lista = await destinatarios(subs);
    const desde = Math.max(0, Number(body.desde || 0));
    const { subject, html } = correo();
    let enviados = 0, hasta = desde;
    for (let i = desde; i < lista.length; i += 100) {
      const lote = lista.slice(i, i + 100);
      const r = await enviarLote(lote, subject, html);
      if (!r.ok) {
        // Cuota de Resend u otro corte: se detiene acá para no duplicar a nadie.
        return Response.json({
          accion: 'enviar', total: lista.length, enviados, siguiente_desde: i,
          cortado: true, motivo: `HTTP ${r.status} ${r.detalle}`,
          para_seguir: `POST {accion:'enviar', confirmar:true, desde:${i}}`,
        });
      }
      enviados += lote.length; hasta = i + lote.length;
    }
    return Response.json({ accion: 'enviar', total: lista.length, enviados, hasta, cortado: false });
  }

  return Response.json({ error: 'accion debe ser congelar, reanudar o enviar.' }, { status: 400 });
}
