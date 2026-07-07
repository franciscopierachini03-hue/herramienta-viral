import { getAccess } from '@/lib/access';

// GET /api/admin/stripe-setup — registra el webhook de pagos EN LA CUENTA DE
// STRIPE QUE USA PRODUCCIÓN (la key de Vercel = 2CLICKS, donde viven los 3
// productos nuevos). Pensada para abrirse UNA vez desde el navegador logueado
// como admin: crea el endpoint (o avisa si ya existe) y te muestra el secret
// whsec_… para pegarlo en Vercel como STRIPE_WEBHOOK_SECRET.
//
// ¿Ya existe un endpoint apuntando a nuestra URL pero no tenés su secret?
// (Stripe solo lo muestra al crearlo) → abrí con ?recrear=1: borra y crea de
// nuevo, devolviendo un secret fresco.
//
// Idempotente y sin datos sensibles guardados: el secret solo se muestra acá.

export const dynamic = 'force-dynamic';

const WEBHOOK_URL = 'https://www.viraladn.com/api/webhook/stripe';
const EVENTOS = [
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
  'customer.subscription.deleted',
  'customer.subscription.updated',
];

export async function GET(req: Request) {
  const { admin } = await getAccess();
  if (!admin) return Response.json({ error: 'Solo administradores.' }, { status: 403 });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return Response.json({ error: 'Falta STRIPE_SECRET_KEY en este entorno.' }, { status: 503 });

  const auth = { Authorization: `Bearer ${key}` };
  const recrear = new URL(req.url).searchParams.get('recrear') === '1';

  try {
    // ¿A qué cuenta pertenece la key? (para confirmar que registramos donde corresponde)
    const accRes = await fetch('https://api.stripe.com/v1/account', { headers: auth, cache: 'no-store' });
    const acc = await accRes.json();
    const cuenta = {
      id: acc?.id || '?',
      nombre: acc?.settings?.dashboard?.display_name || acc?.business_profile?.name || '(sin nombre)',
    };

    // ¿Ya hay un endpoint apuntando a nuestra URL?
    const listRes = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=20', { headers: auth, cache: 'no-store' });
    const list = await listRes.json();
    const existente = (list?.data || []).find((w: { url?: string }) => w.url === WEBHOOK_URL);

    if (existente && !recrear) {
      return Response.json({
        cuenta,
        estado: 'ya-existia',
        endpoint: { id: existente.id, status: existente.status, eventos: existente.enabled_events?.length },
        nota: 'El endpoint ya existe en esta cuenta. Stripe NO vuelve a mostrar el secret de un endpoint creado antes: si no lo tenés guardado, abrí esta misma URL con ?recrear=1 para regenerarlo (borra y crea de nuevo, con secret fresco).',
      });
    }

    if (existente && recrear) {
      await fetch(`https://api.stripe.com/v1/webhook_endpoints/${existente.id}`, { method: 'DELETE', headers: auth });
    }

    // Crear el endpoint con los 8 eventos.
    const params = new URLSearchParams({
      url: WEBHOOK_URL,
      description: 'ViralADN — accesos, libro de pagos y alertas (setup admin)',
    });
    EVENTOS.forEach(e => params.append('enabled_events[]', e));
    const createRes = await fetch('https://api.stripe.com/v1/webhook_endpoints', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      return Response.json({ cuenta, error: created?.error?.message || `Stripe HTTP ${createRes.status}` }, { status: 502 });
    }

    return Response.json({
      cuenta,
      estado: recrear ? 'recreado' : 'creado',
      endpoint: { id: created.id, status: created.status, url: created.url, eventos: created.enabled_events?.length },
      SECRET_para_Vercel: created.secret,
      siguiente_paso: [
        '1. Copiá el valor de SECRET_para_Vercel (whsec_…).',
        '2. Vercel → Settings → Environment Variables → STRIPE_WEBHOOK_SECRET = ese valor.',
        '3. (Si además querés firmar la cuenta legacy: STRIPE_WEBHOOK_SECRET_LEGACY = el whsec de la cuenta vieja).',
        '4. Redeploy. Desde ahí, cada pago/reembolso/disputa de esta cuenta avisa solo.',
      ],
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
