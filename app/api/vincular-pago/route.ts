import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { generateCode, sendVincularCode } from '@/lib/email/resend';

// POST /api/vincular-pago — "Pagué con OTRO correo y mi cuenta sale bloqueada".
//
// El comprador demuestra que controla el CORREO DE PAGO (le mandamos un código
// ahí) y el sistema le engancha ese pago a la cuenta con la que está logueado.
// Busca el pago en LAS DOS cuentas de Stripe (principal 2CLICKS y Elevation).
//
//   { accion:'enviar',    emailPago }          → valida que exista un pago con
//     ese correo y manda el código. Si emailPago == correo logueado, vincula
//     directo sin código (ya demostró ser dueño al loguearse).
//   { accion:'verificar', emailPago, codigo }  → valida el código y vincula.
//
// Seguridad: código de 6 dígitos al correo de pago, 15 min de vida, máx 5
// intentos, reenvío cada 60s. Sin el código nadie puede "robar" un pago ajeno.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

type Hallazgo = {
  cuenta: 'principal' | 'elevation';
  customerId: string;
  subId: string;
  status: string;
  renewsAt: string | null;
};

// Busca una suscripción viva (activa/trial/past_due) de clientes con ese email,
// primero en la cuenta principal y después en Elevation.
async function buscarPago(emailPago: string): Promise<Hallazgo | null> {
  const cuentas: Array<['principal' | 'elevation', string | undefined]> = [
    ['principal', process.env.STRIPE_SECRET_KEY],
    ['elevation', process.env.STRIPE_SECRET_KEY_ELEVATION],
  ];
  for (const [cuenta, key] of cuentas) {
    if (!key) continue;
    const auth = { Authorization: `Bearer ${key}` };
    try {
      const cr = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(emailPago)}&limit=5`, { headers: auth, cache: 'no-store' });
      if (!cr.ok) continue;
      const cs = await cr.json();
      for (const c of cs?.data || []) {
        const sr = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(c.id)}&status=all&limit=10`, { headers: auth, cache: 'no-store' });
        if (!sr.ok) continue;
        const subs = await sr.json();
        const hit = (subs?.data || []).find((s: { status?: string }) => ['active', 'trialing', 'past_due'].includes(s.status || ''));
        if (hit) {
          return {
            cuenta, customerId: c.id, subId: hit.id, status: hit.status,
            renewsAt: hit.current_period_end ? new Date(hit.current_period_end * 1000).toISOString() : null,
          };
        }
      }
    } catch { /* siguiente cuenta */ }
  }
  return null;
}

// Engancha el pago al perfil del logueado. El customer id tiene constraint
// UNIQUE: si ya vive en el perfil "cáscara" del correo de pago, lo liberamos de
// ahí (ese perfil no tiene login con acceso — el dueño está acá reclamándolo).
async function vincular(svc: ReturnType<typeof createServiceClient>, emailLogin: string, emailPago: string, h: Hallazgo): Promise<{ ok: boolean; detalle: string }> {
  const base = {
    subscription_status: 'active',
    stripe_subscription_id: h.subId,
    renews_at: h.renewsAt,
    activated_at: new Date().toISOString(),
    pending_code: null, pending_code_expires_at: null, pending_code_purpose: null, pending_code_attempts: 0,
  };
  const intento = () => svc.from('profiles').update({ ...base, stripe_customer_id: h.customerId }).eq('email', emailLogin);
  let { error } = await intento();
  if (error && error.code === '23505') {
    // El customer está en otro perfil (el del correo de pago) → liberarlo y reintentar.
    await svc.from('profiles').update({ stripe_customer_id: null }).eq('email', emailPago);
    ({ error } = await intento());
  }
  if (error && error.code === '23505') {
    // Sigue tomado (perfil de un tercero): no movemos el customer. Damos acceso
    // igual vía status+código (cubre ViralADN, lo que vende la página paralela).
    const { error: e2 } = await svc.from('profiles').update({ ...base, redeemed_code: 'PAGO-VINCULADO' }).eq('email', emailLogin);
    if (e2) return { ok: false, detalle: e2.message };
    return { ok: true, detalle: 'vinculado sin customer (conflicto)' };
  }
  if (error) return { ok: false, detalle: error.message };
  return { ok: true, detalle: 'vinculado completo' };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: 'Inicia sesión primero.' }, { status: 401 });
  const emailLogin = user.email.toLowerCase();

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }); }
  const accion = body.accion === 'verificar' ? 'verificar' : 'enviar';
  const emailPago = String(body.emailPago || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPago)) {
    return Response.json({ error: 'Escribe el correo con el que pagaste.' }, { status: 400 });
  }

  const svc = createServiceClient();

  if (accion === 'enviar') {
    // ¿Existe un pago con ese correo? (si no, ni mandamos código)
    const hallazgo = await buscarPago(emailPago);
    if (!hallazgo) {
      return Response.json({ error: 'No encontramos un pago activo con ese correo. Revisa que sea el mismo que usaste en la pantalla de pago (mira tu recibo de Stripe).' }, { status: 404 });
    }

    // Mismo correo que el login → ya demostró ser el dueño: vincular directo.
    if (emailPago === emailLogin) {
      const r = await vincular(svc, emailLogin, emailPago, hallazgo);
      if (!r.ok) return Response.json({ error: 'No pudimos vincular. Intenta de nuevo.' }, { status: 500 });
      return Response.json({ ok: true, vinculado: true, cuenta: hallazgo.cuenta });
    }

    // Anti-spam: reenvío cada 60s.
    const { data: perfil } = await svc.from('profiles')
      .select('pending_code_expires_at, pending_code_purpose').eq('email', emailLogin).maybeSingle();
    if (perfil?.pending_code_expires_at && String(perfil.pending_code_purpose || '').startsWith('vincular:')) {
      const sentAt = new Date(perfil.pending_code_expires_at).getTime() - CODE_TTL_MS;
      if (Date.now() - sentAt < RESEND_WINDOW_MS) {
        return Response.json({ error: 'Ya te enviamos un código hace un momento. Espera un minuto para reenviar.' }, { status: 429 });
      }
    }

    const code = generateCode();
    const { error } = await svc.from('profiles').update({
      pending_code: code,
      pending_code_expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      pending_code_attempts: 0,
      pending_code_purpose: `vincular:${emailPago}`,
    }).eq('email', emailLogin);
    if (error) return Response.json({ error: 'No pudimos preparar el código. Intenta de nuevo.' }, { status: 500 });

    try { await sendVincularCode(emailPago, code); }
    catch { return Response.json({ error: 'No pudimos enviar el correo. Intenta de nuevo.' }, { status: 500 }); }
    return Response.json({ ok: true, enviado: true });
  }

  // accion === 'verificar'
  const codigo = String(body.codigo || '').trim();
  const { data: perfil } = await svc.from('profiles')
    .select('pending_code, pending_code_expires_at, pending_code_attempts, pending_code_purpose')
    .eq('email', emailLogin).maybeSingle();

  if (!perfil?.pending_code || perfil.pending_code_purpose !== `vincular:${emailPago}`) {
    return Response.json({ error: 'Pide un código primero.' }, { status: 400 });
  }
  if ((perfil.pending_code_attempts ?? 0) >= MAX_ATTEMPTS) {
    return Response.json({ error: 'Demasiados intentos. Pide un código nuevo.' }, { status: 429 });
  }
  if (!perfil.pending_code_expires_at || new Date(perfil.pending_code_expires_at).getTime() < Date.now()) {
    return Response.json({ error: 'El código venció. Pide uno nuevo.' }, { status: 400 });
  }
  if (codigo !== perfil.pending_code) {
    await svc.from('profiles').update({ pending_code_attempts: (perfil.pending_code_attempts ?? 0) + 1 }).eq('email', emailLogin);
    return Response.json({ error: 'Código incorrecto. Revisa el correo y vuelve a intentar.' }, { status: 400 });
  }

  const hallazgo = await buscarPago(emailPago);
  if (!hallazgo) {
    return Response.json({ error: 'El código es correcto pero ya no encontramos el pago. Escríbenos y lo revisamos.' }, { status: 404 });
  }
  const r = await vincular(svc, emailLogin, emailPago, hallazgo);
  if (!r.ok) return Response.json({ error: 'No pudimos vincular. Intenta de nuevo.' }, { status: 500 });
  console.log(`[vincular-pago] ${emailLogin} ← pago de ${emailPago} (${hallazgo.cuenta}, ${hallazgo.subId}, ${r.detalle})`);
  return Response.json({ ok: true, vinculado: true, cuenta: hallazgo.cuenta });
}
