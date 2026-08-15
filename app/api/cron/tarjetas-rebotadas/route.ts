import { NextRequest } from 'next/server';
import { getAccess } from '@/lib/access';
import { createServiceClient } from '@/lib/supabase/server';

// 💳 TARJETAS REBOTADAS — regla de la casa (14-ago-2026, Francisco):
// "hay que enviarle el correo y quitarle los accesos a las clases, eso siempre
//  que pase, tiene que ser así".
//
// El corte de clases es automático y vive en el gate (/comunidad mira
// access.rebotada). Este cron se encarga de la otra mitad: AVISARLE a la
// persona, con el link para actualizar la tarjeta, hasta 3 veces (día 1, 3 y 7).
//
// Corre a diario desde /api/cron/daily.
//   ?dry=1  → solo lista a quién le escribiría, sin enviar
//   ?force=1 → ignora el "ya le escribí hoy"
// Auth: Vercel Cron (CRON_SECRET / user-agent) o admin logueado.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const APP = 'https://www.viraladn.com';
const OWNER = 'franciscopierachini03@gmail.com';
const DIAS_AVISO = [1, 3, 7]; // días desde que rebotó en los que se escribe

function esCron(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  return (req.headers.get('user-agent') || '').includes('vercel-cron');
}

type SubRebotada = {
  id: string; status: string; customer: string | { id?: string; email?: string; name?: string };
  current_period_end?: number;
  items?: { data?: Array<{ price?: { unit_amount?: number | null } }> };
};

async function rebotadasDeCuenta(key: string, etiqueta: string) {
  const out: Array<{ email: string; nombre: string; customer: string; monto: number; desde: number; cuenta: string }> = [];
  try {
    const r = await fetch(
      'https://api.stripe.com/v1/subscriptions?status=past_due&limit=100&expand[]=data.customer',
      { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
    if (!r.ok) return out;
    const d = await r.json() as { data?: SubRebotada[] };
    for (const s of d.data || []) {
      const c = typeof s.customer === 'object' ? s.customer : null;
      const email = String(c?.email || '').toLowerCase();
      if (!email.includes('@')) continue;
      out.push({
        email,
        nombre: String(c?.name || '').split(' ')[0] || '',
        customer: String(c?.id || (typeof s.customer === 'string' ? s.customer : '')),
        monto: (s.items?.data?.[0]?.price?.unit_amount || 0) / 100,
        desde: s.current_period_end || 0,
        cuenta: etiqueta,
      });
    }
  } catch { /* si Stripe falla, no escribimos a nadie */ }
  return out;
}

function correo(nombre: string, monto: number): { subject: string; html: string } {
  const hola = nombre ? `Hola ${nombre}` : 'Hola';
  return {
    subject: '💳 Tu tarjeta rechazó el cobro — se arregla en 1 minuto',
    html: `<!DOCTYPE html><html><body style="margin:0;background:#0b0b10;padding:26px 14px;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background:#101018;border:1px solid #23232e;border-radius:18px;">
<tr><td style="padding:30px 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="background:#7c3aed;background-image:linear-gradient(90deg,#7c3aed,#ec4899);border-radius:8px;padding:8px 14px;">
      <span style="color:#fff;font-weight:bold;font-size:15px;">ViralADN</span>
    </td></tr></table>

  <h1 style="margin:22px 0 12px;font-size:27px;line-height:1.2;color:#fff;">${hola}, tu tarjeta rechazó el cobro</h1>

  <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#c8c8d4;">
    No es nada raro: suele pasar por una tarjeta vencida, un tope de compra o el banco bloqueando un cobro del exterior.
    <b style="color:#fff;">Se arregla en un minuto</b> y seguís donde estabas.
  </p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a0d0d;border:1px solid #ef444455;border-radius:14px;margin-bottom:20px;">
    <tr><td style="padding:16px;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#f0d0d0;">
        Mientras tanto <b style="color:#fff;">pausamos tu lugar en las clases en vivo de los miércoles</b>.
        Tus herramientas siguen funcionando — apenas se acredite el pago, tu lugar vuelve solo.
      </p>
    </td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
    <tr><td align="center" style="background:#7c3aed;background-image:linear-gradient(90deg,#7c3aed,#ec4899);border-radius:14px;">
      <a href="${APP}/cuenta" style="display:block;padding:18px;color:#fff;font-weight:bold;font-size:18px;text-decoration:none;">
        💳 ACTUALIZAR MI TARJETA
      </a>
    </td></tr></table>

  <p style="margin:0 0 18px;font-size:13px;color:#8b8b96;text-align:center;">
    Entrás a tu cuenta y tocás “Gestionar mi suscripción”. ${monto ? `Son $${monto.toFixed(0)} del mes.` : ''}
  </p>

  <p style="margin:0;font-size:14px;line-height:1.7;color:#8b8b96;">
    Si preferís cancelar, también podés hacerlo desde ahí y no te cobramos más — pero avisame por acá si hubo algo que no te gustó, me sirve para mejorar.<br><br>
    <b style="color:#c8c8d4;">Francisco</b>
  </p>
</td></tr></table>
</td></tr></table></body></html>`,
  };
}

export async function GET(req: NextRequest) {
  const { admin } = await getAccess();
  if (!esCron(req) && !admin) return Response.json({ error: 'No autorizado.' }, { status: 401 });

  const dry = req.nextUrl.searchParams.get('dry') === '1';
  const force = req.nextUrl.searchParams.get('force') === '1';
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: 'Falta STRIPE_SECRET_KEY.' }, { status: 503 });

  const [pri, elev] = await Promise.all([
    rebotadasDeCuenta(key, '2CLICKS'),
    process.env.STRIPE_SECRET_KEY_ELEVATION ? rebotadasDeCuenta(process.env.STRIPE_SECRET_KEY_ELEVATION, 'Elevation') : Promise.resolve([]),
  ]);
  const todas = [...pri, ...elev];

  if (dry) {
    return Response.json({
      modo: 'dry', rebotadas: todas.length,
      detalle: todas.map(t => ({ email: t.email, monto: t.monto, cuenta: t.cuenta })),
      nota: 'Sin ?dry=1 se les manda el correo (máx 1 por día por persona).',
    });
  }

  // Candado: 1 correo por persona por día (marca en ai_credits).
  const sb = createServiceClient();
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const resend = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'ViralADN <hola@viraladn.com>';

  let enviados = 0, salteados = 0, fallidos = 0;
  for (const t of todas) {
    const marca = `rebote:${t.email}`;
    if (!force) {
      try {
        const { data } = await sb.from('ai_credits').select('period').eq('email', marca).maybeSingle();
        if (data?.period === hoy) { salteados++; continue; }
      } catch { /* sin tabla → sin candado */ }
    }
    if (!resend) { fallidos++; continue; }
    const { subject, html } = correo(t.nombre, t.monto);
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [t.email], subject, html, reply_to: OWNER }),
      });
      if (r.ok) {
        enviados++;
        try { await sb.from('ai_credits').upsert({ email: marca, balance: 0, period: hoy, updated_at: new Date().toISOString() }, { onConflict: 'email' }); } catch { /* best-effort */ }
      } else { fallidos++; console.error('[rebotadas]', r.status, (await r.text().catch(() => '')).slice(0, 120)); }
    } catch { fallidos++; }
  }

  console.log(`[tarjetas-rebotadas] ${todas.length} rebotadas · ${enviados} avisadas · ${salteados} ya avisadas hoy · ${fallidos} fallidas`);
  return Response.json({ rebotadas: todas.length, enviados, salteados, fallidos, diasAviso: DIAS_AVISO });
}
