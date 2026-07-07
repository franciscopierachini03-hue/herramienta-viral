import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { getCheckoutInfo } from '@/lib/stripe-checkout-info';
import { sendPaymentConfirmed } from '@/lib/email/resend';

// Webhook de Stripe — v2 (2026-07-06). Qué hace por evento:
//   checkout.session.completed  → activa acceso + libro 'venta' + email ✅ al admin
//   invoice.payment_succeeded   → libro 'renovacion' (solo ciclos, no la 1ª factura)
//   invoice.payment_failed      → libro 'fallo_pago' + email 🚨
//   charge.refunded             → libro 'reembolso' + email 🚨
//   charge.dispute.created      → libro 'disputa' + email 🚨 URGENTE
//   charge.dispute.closed       → libro 'disputa_cerrada' + email con resultado
//   customer.subscription.deleted/updated → estado del perfil (como antes)
//
// Libro: tabla `pagos_viraladn` (supabase/pagos.sql) — solo datos de esta
// plataforma, con producto clasificado por monto. Sheets opcional: si existe
// SHEET_PAGOS_URL (Apps Script), también agrega la fila allá.
//
// FIRMA: verificación HMAC del header `stripe-signature` con
// STRIPE_WEBHOOK_SECRET (whsec_…). Sin el secret configurado acepta el evento
// pero deja un warning grande en logs — configurarlo apenas se registre el
// endpoint (el registro devuelve el secret).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNER = 'franciscopierachini03@gmail.com';

// ── Verificación de firma de Stripe (sin SDK) ───────────────────────────────
// header: "t=1712345678,v1=abcdef...[,v1=...]" · firma = HMAC_SHA256(secret, `${t}.${body}`)
function verifyStripeSignature(body: string, header: string, secret: string): boolean {
  try {
    const parts = header.split(',').map(p => p.trim());
    const t = parts.find(p => p.startsWith('t='))?.slice(2);
    const v1s = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));
    if (!t || !v1s.length) return false;
    // Tolerancia de 5 min contra replay.
    const age = Math.abs(Date.now() / 1000 - Number(t));
    if (!Number.isFinite(age) || age > 300) return false;
    const expected = createHmac('sha256', secret).update(`${t}.${body}`, 'utf8').digest('hex');
    const exp = Buffer.from(expected, 'utf8');
    return v1s.some(v1 => {
      const got = Buffer.from(v1, 'utf8');
      return got.length === exp.length && timingSafeEqual(got, exp);
    });
  } catch { return false; }
}

// ── Clasificación de producto por monto (USD) ───────────────────────────────
function productoDe(amountCents: number | null | undefined): string {
  const usd = Math.round((amountCents || 0) / 100);
  if (usd === 27 || usd === 270) return 'viraladn';
  if (usd === 57 || usd === 570) return 'topcut';
  if (usd === 67 || usd === 670) return 'combo';
  if (usd === 47 || usd === 470) return 'legacy47';
  return 'otro';
}

// ── Libro de pagos (best-effort: nunca bloquea el 200 a Stripe) ─────────────
type Movimiento = {
  evento_id: string;
  tipo: string;
  email?: string | null;
  customer_id?: string | null;
  producto?: string;
  monto?: number;
  moneda?: string;
  estado?: string;
  detalle?: string;
};

async function registrarPago(m: Movimiento) {
  try {
    const sb = createServiceClient();
    await sb.from('pagos_viraladn').upsert(
      { ...m, moneda: m.moneda || 'usd' },
      { onConflict: 'evento_id', ignoreDuplicates: true },
    );
  } catch (e) {
    console.error('[stripe-webhook] libro:', (e as Error).message);
  }
  // Sheets opcional (Apps Script) — mismo patrón que /api/registro.
  const sheet = process.env.SHEET_PAGOS_URL;
  if (sheet) {
    try {
      await fetch(sheet, {
        method: 'POST',
        body: new URLSearchParams({
          fecha: new Date().toISOString(),
          tipo: m.tipo,
          email: m.email || '',
          producto: m.producto || '',
          monto: String(m.monto ?? ''),
          estado: m.estado || '',
          detalle: m.detalle || '',
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch { /* noop */ }
  }
}

// ── Aviso por email al admin (Resend) ───────────────────────────────────────
async function avisar(asunto: string, cuerpo: string) {
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) return;
    const from = process.env.RESEND_FROM || 'ViralADN Pagos <onboarding@resend.dev>';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: OWNER, subject: asunto, text: cuerpo }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error('[stripe-webhook] avisar:', (e as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    return Response.json({ error: 'Falta firma de Stripe.' }, { status: 400 });
  }

  // ── Verificación de firma ──────────────────────────────────────────────────
  if (webhookSecret) {
    if (!verifyStripeSignature(body, sig, webhookSecret)) {
      console.error('[stripe-webhook] FIRMA INVÁLIDA — evento rechazado');
      return Response.json({ error: 'Firma inválida.' }, { status: 400 });
    }
  } else {
    console.warn('[stripe-webhook] ⚠️ SIN STRIPE_WEBHOOK_SECRET — evento aceptado SIN verificar. Configuralo en Vercel YA.');
  }

  let event: { id?: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch (e) {
    return Response.json({ error: `Body inválido: ${(e as Error).message}` }, { status: 400 });
  }

  const supabase = createServiceClient();
  const evId = event.id || `sin-id-${Date.now()}`;

  console.log('[stripe-webhook]', event.type);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        id: string;
        customer: string;
        customer_email?: string;
        customer_details?: { email?: string; name?: string; phone?: string };
        subscription?: string;
        amount_total?: number;
        currency?: string;
      };

      const email =
        session.customer_email ||
        session.customer_details?.email;
      const name = session.customer_details?.name || null;
      const phone = session.customer_details?.phone || null;

      if (!email) {
        console.error('[stripe-webhook] checkout sin email');
        return Response.json({ received: true });
      }

      // Capturar de qué cupón/promo vino el pago + fin del primer período.
      const secret = process.env.STRIPE_SECRET_KEY;
      const info = secret
        ? await getCheckoutInfo(session.id, secret)
        : { subscriptionId: session.subscription || null, periodEnd: null, origin: null, hasDiscount: false };

      // 1. Upsert del perfil con stripe_customer_id y subscription_status=active
      const profilePatch: Record<string, unknown> = {
        email,
        name,
        phone,
        stripe_customer_id: session.customer,
        stripe_subscription_id: info.subscriptionId || session.subscription || null,
        subscription_status: 'active',
        activated_at: new Date().toISOString(),
      };
      if (info.origin) profilePatch.redeemed_code = info.origin;
      if (info.hasDiscount && info.periodEnd) {
        profilePatch.trial_ends_at = new Date(info.periodEnd * 1000).toISOString();
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(profilePatch, { onConflict: 'email' });

      if (upsertError) {
        console.error('[stripe-webhook] upsert error:', upsertError);
      }

      // 2. Conectar el pago a la cuenta — SIN crear cuentas a medias.
      let authUser: { id: string; email?: string; email_confirmed_at?: string | null } | null = null;
      for (let page = 1; page <= 20 && !authUser; page++) {
        const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        const users = list?.users || [];
        authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null;
        if (users.length < 200) break;
      }

      let needsWelcome = false;
      if (authUser) {
        if (!authUser.email_confirmed_at) {
          await supabase.auth.admin.updateUserById(authUser.id, { email_confirm: true });
          await supabase.from('profiles').update({ email_verified: true }).eq('email', email);
          needsWelcome = true;
        }
      } else {
        needsWelcome = true;
      }

      // 3. Email post-pago (solo cuando hace falta) por Resend.
      if (needsWelcome) {
        try {
          await sendPaymentConfirmed(email, name || undefined, !!authUser);
        } catch (e) {
          console.error('[stripe-webhook] sendPaymentConfirmed:', e);
        }
      }

      // 4. Libro + aviso ✅ de venta.
      const monto = (session.amount_total || 0) / 100;
      const producto = productoDe(session.amount_total);
      await registrarPago({
        evento_id: evId, tipo: 'venta', email, customer_id: session.customer,
        producto, monto, moneda: session.currency || 'usd', estado: 'pagado',
        detalle: info.origin ? `cupón: ${info.origin}` : '',
      });
      void avisar(
        `✅ Venta ViralADN — $${monto} (${producto}) — ${email}`,
        `Nueva venta confirmada.\n\nCliente: ${name || '—'} <${email}>\nProducto: ${producto}\nMonto: $${monto}\nCupón: ${info.origin || '—'}\n\nLibro: viraladn.com/admin/pagos`,
      );

      console.log(`[stripe-webhook] pago activado: ${email} (cuenta ${authUser ? 'existente' : 'pendiente de crear'})`);
    }

    if (event.type === 'invoice.payment_succeeded') {
      const inv = event.data.object as {
        customer: string; customer_email?: string; amount_paid?: number;
        currency?: string; billing_reason?: string;
      };
      // Solo renovaciones (la primera factura ya entra como 'venta' por checkout).
      if (inv.billing_reason === 'subscription_cycle') {
        await registrarPago({
          evento_id: evId, tipo: 'renovacion', email: inv.customer_email, customer_id: inv.customer,
          producto: productoDe(inv.amount_paid), monto: (inv.amount_paid || 0) / 100,
          moneda: inv.currency || 'usd', estado: 'pagado',
        });
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object as {
        customer: string; customer_email?: string; amount_due?: number;
        currency?: string; attempt_count?: number;
      };
      const monto = (inv.amount_due || 0) / 100;
      await registrarPago({
        evento_id: evId, tipo: 'fallo_pago', email: inv.customer_email, customer_id: inv.customer,
        producto: productoDe(inv.amount_due), monto, moneda: inv.currency || 'usd',
        estado: 'fallido', detalle: `intento #${inv.attempt_count || 1}`,
      });
      void avisar(
        `🚨 Pago FALLIDO — $${monto} — ${inv.customer_email || inv.customer}`,
        `Una renovación no se pudo cobrar (intento #${inv.attempt_count || 1}).\n\nCliente: ${inv.customer_email || inv.customer}\nMonto: $${monto}\n\nStripe reintenta solo; si sigue fallando la suscripción pasa a past_due.\nLibro: viraladn.com/admin/pagos`,
      );
    }

    if (event.type === 'charge.refunded') {
      const ch = event.data.object as {
        customer?: string; amount_refunded?: number; currency?: string;
        billing_details?: { email?: string }; receipt_email?: string;
      };
      const email = ch.billing_details?.email || ch.receipt_email || null;
      const monto = (ch.amount_refunded || 0) / 100;
      await registrarPago({
        evento_id: evId, tipo: 'reembolso', email, customer_id: ch.customer || null,
        producto: productoDe(ch.amount_refunded), monto, moneda: ch.currency || 'usd', estado: 'reembolsado',
      });
      void avisar(
        `🚨 REEMBOLSO — $${monto} — ${email || 'cliente'}`,
        `Se emitió un reembolso.\n\nCliente: ${email || ch.customer || '—'}\nMonto: $${monto}\n\nRevisá si corresponde cortarle el acceso.\nLibro: viraladn.com/admin/pagos`,
      );
    }

    if (event.type === 'charge.dispute.created') {
      const dp = event.data.object as {
        amount?: number; currency?: string; reason?: string; charge?: string;
        evidence_details?: { due_by?: number };
      };
      const monto = (dp.amount || 0) / 100;
      const vence = dp.evidence_details?.due_by
        ? new Date(dp.evidence_details.due_by * 1000).toLocaleDateString('es')
        : '—';
      await registrarPago({
        evento_id: evId, tipo: 'disputa', producto: productoDe(dp.amount), monto,
        moneda: dp.currency || 'usd', estado: 'abierta',
        detalle: `motivo: ${dp.reason || '—'} · evidencia vence: ${vence} · charge: ${dp.charge || ''}`,
      });
      void avisar(
        `🚨🚨 DISPUTA ABIERTA — $${monto} — responder antes del ${vence}`,
        `Un cliente abrió una disputa (contracargo).\n\nMonto: $${monto}\nMotivo: ${dp.reason || '—'}\nFecha límite para presentar evidencia: ${vence}\n\nEntrá YA al dashboard de Stripe → Disputes para responder (si no respondés, se pierde).\nLibro: viraladn.com/admin/pagos`,
      );
    }

    if (event.type === 'charge.dispute.closed') {
      const dp = event.data.object as { amount?: number; currency?: string; status?: string };
      const monto = (dp.amount || 0) / 100;
      const gano = dp.status === 'won';
      await registrarPago({
        evento_id: evId, tipo: 'disputa_cerrada', producto: productoDe(dp.amount), monto,
        moneda: dp.currency || 'usd', estado: dp.status || 'cerrada',
      });
      void avisar(
        `${gano ? '✅ Disputa GANADA' : '❌ Disputa perdida'} — $${monto}`,
        `La disputa se cerró con resultado: ${dp.status}.\nMonto: $${monto}\nLibro: viraladn.com/admin/pagos`,
      );
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as { customer: string };
      await supabase
        .from('profiles')
        .update({ subscription_status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('stripe_customer_id', sub.customer);
      await registrarPago({
        evento_id: evId, tipo: 'cancelacion', customer_id: sub.customer, estado: 'cancelada',
      });
      console.log('[stripe-webhook] suscripción cancelada:', sub.customer);
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as {
        customer: string;
        status: string;
        current_period_end?: number;
      };
      await supabase
        .from('profiles')
        .update({
          subscription_status: sub.status,
          renews_at: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        })
        .eq('stripe_customer_id', sub.customer);
    }

    return Response.json({ received: true });
  } catch (e) {
    console.error('[stripe-webhook] error:', e);
    return Response.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
