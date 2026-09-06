import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// POST /api/billing/portal — abre el Customer Portal de Stripe para que la
// persona pueda cambiar su tarjeta, ver sus facturas y CANCELAR.
//
// ── Por qué esto era un problema (3-sep-2026) ─────────────────────────────
// Francisco: "las personas tienen problemas para cancelar sus suscripciones".
// Había dos fallas, y las dos terminaban en que alguien que PAGA no podía darse
// de baja:
//
// 1. Solo se probaba la cuenta 2CLICKS. Quien compró por una comunidad
//    (/adama, /unete) tiene su cliente en la cuenta ELEVATION: Stripe
//    respondía "No such customer" y la persona quedaba encerrada.
//
// 2. Se exigía que el perfil tuviera stripe_subscription_id. Si faltaba —y
//    falta seguido, el dato no siempre se guarda— se le decía "tu acceso no
//    tiene una suscripción de pago", que para alguien a quien le cobran cada
//    mes es sencillamente falso.
//
// Ahora: se prueba en las DOS cuentas, alcanza con el customer, y si no hay
// customer guardado se busca por email exigiendo que tenga una suscripción de
// verdad. Lo que se encuentra se guarda de vuelta en el perfil, así la próxima
// vez es directo. Y si aun así no hay nada, la respuesta NO es un callejón sin
// salida: se le dice a quién escribir.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SOPORTE = 'contacto@viraladn.com';

type Cuenta = { id: string; label: string; key: string | undefined };
const cuentas = (): Cuenta[] => [
  { id: '2clicks', label: '2CLICKS', key: process.env.STRIPE_SECRET_KEY },
  { id: 'elevation', label: 'Elevation', key: process.env.STRIPE_SECRET_KEY_ELEVATION },
];

async function sGet(path: string, key: string) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` }, cache: 'no-store',
  });
  return r.ok ? r.json() : null;
}

// ¿Este customer existe en esta cuenta y tiene alguna suscripción viva?
async function revisar(key: string, customerId: string) {
  const c = await sGet(`customers/${encodeURIComponent(customerId)}`, key);
  if (!c || c.deleted) return null;
  const subs = await sGet(`subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`, key);
  const vivas = (subs?.data || []).filter((s: { status: string }) =>
    ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status));
  return { customerId, sub: vivas[0]?.id || null };
}

// Sin customer guardado: lo buscamos por email, pero SOLO aceptamos uno que
// tenga suscripción viva. La cuenta 2CLICKS es compartida con otros negocios;
// aceptar cualquier coincidencia de email abriría el portal equivocado.
async function buscarPorEmail(key: string, email: string) {
  const r = await sGet(`customers?email=${encodeURIComponent(email)}&limit=20`, key);
  for (const c of (r?.data || []) as Array<{ id: string }>) {
    const hit = await revisar(key, c.id);
    if (hit?.sub) return hit;
  }
  return null;
}

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return Response.json({ error: 'Tienes que iniciar sesión.' }, { status: 401 });
  const email = user.email.toLowerCase();

  const admin = createServiceClient();
  const { data: profile } = await admin.from('profiles')
    .select('stripe_customer_id').eq('email', user.email).maybeSingle();
  const guardado = profile?.stripe_customer_id || null;

  const disponibles = cuentas().filter(c => c.key);
  if (!disponibles.length) {
    return Response.json({ error: 'Stripe no está configurado.' }, { status: 500 });
  }

  // 1) El customer guardado, probado en las DOS cuentas.
  let encontrado: { cuenta: Cuenta; customerId: string; sub: string | null } | null = null;
  if (guardado) {
    for (const c of disponibles) {
      const hit = await revisar(c.key!, guardado);
      if (hit) { encontrado = { cuenta: c, ...hit }; break; }
    }
  }
  // 2) Si no, por email — exigiendo suscripción viva.
  if (!encontrado) {
    for (const c of disponibles) {
      const hit = await buscarPorEmail(c.key!, email);
      if (hit) { encontrado = { cuenta: c, ...hit }; break; }
    }
  }

  if (!encontrado) {
    console.log(`[billing/portal] sin suscripción para ${email} (guardado: ${guardado || 'ninguno'})`);
    // Nunca dejar a la persona sin salida: si de verdad no encontramos nada,
    // puede ser cortesía… o puede ser un caso que no supimos leer.
    return Response.json({
      error: 'No encontramos una suscripción de pago asociada a tu cuenta. '
        + `Si a ti te están cobrando, escríbenos a ${SOPORTE} y lo resolvemos el mismo día.`,
      soporte: SOPORTE,
    }, { status: 404 });
  }

  // Guardamos lo que encontramos: la próxima vez entra directo.
  if (encontrado.customerId !== guardado) {
    try {
      await admin.from('profiles')
        .update({ stripe_customer_id: encontrado.customerId })
        .eq('email', user.email);
    } catch { /* si falla, el portal igual abre */ }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.viraladn.com';
  const params = new URLSearchParams({
    customer: encontrado.customerId,
    return_url: `${appUrl}/cuenta`,
  });

  try {
    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${encontrado.cuenta.key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || '';
      console.error('[billing/portal]', encontrado.cuenta.label, res.status, msg.slice(0, 200));
      // El error más común y el más fácil de arreglar: el portal nunca se
      // configuró en el panel de Stripe. Lo decimos con nombre y apellido.
      const sinConfig = /configuration/i.test(msg);
      return Response.json({
        error: sinConfig
          ? `Falta activar el portal de facturación en Stripe (cuenta ${encontrado.cuenta.label}). Escríbenos a ${SOPORTE} y cancelamos tu suscripción a mano hoy mismo.`
          : `No pudimos abrir el portal. Escríbenos a ${SOPORTE} y lo resolvemos el mismo día.`,
        soporte: SOPORTE,
        detalle: msg.slice(0, 160),
      }, { status: 502 });
    }
    console.log(`[billing/portal] abierto para ${email} en ${encontrado.cuenta.label}`);
    return Response.json({ url: data.url });
  } catch (e) {
    return Response.json({
      error: `No pudimos conectar con Stripe. Escríbenos a ${SOPORTE}.`,
      soporte: SOPORTE,
      detalle: (e as Error).message.slice(0, 120),
    }, { status: 502 });
  }
}
