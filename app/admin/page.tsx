import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getBillingOverview } from '@/lib/stripe-admin';
import DailyRevenueChart from './DailyRevenueChart';
import ReconcileButton from './ReconcileButton';
import SendAccessPanel from './SendAccessPanel';
import AdminResetPassword from './AdminResetPassword';

// /admin — panel de control para ver y gestionar usuarios.
//
// Acceso restringido en 2 capas:
//   1. Email del usuario logueado debe estar en ADMIN_EMAILS (env var).
//   2. Cookie `admin_pin_ok` válida — se obtiene poniendo el PIN correcto
//      (definido en ADMIN_PIN). La cookie vive 4 horas.
//
// Si falla cualquiera de las dos, mostramos lo correspondiente.
// Render: server component. Stats arriba + tabla con búsqueda.

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ q?: string; status?: string; wrong?: string; revMonth?: string }>;

const PIN_COOKIE = 'admin_pin_ok';

const PERMANENT_OWNERS = ['franciscopierachini03@gmail.com'];

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (PERMANENT_OWNERS.includes(e)) return true;
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(e);
}

type Profile = {
  email: string;
  name: string | null;
  phone: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  redeemed_code: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string | null;
};

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function trialDaysLeft(s: string | null): number | null {
  if (!s) return null;
  const ms = new Date(s).getTime() - Date.now();
  if (!isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function statusPill(p: Profile): { label: string; color: string; bg: string } {
  const status = p.subscription_status || 'pending';
  if (status === 'active')
    return { label: 'Pagó', color: '#86efac', bg: '#22c55e22' };
  if (status === 'trialing') {
    const days = trialDaysLeft(p.trial_ends_at);
    if (days === null || days <= 0)
      return { label: 'Trial vencido', color: '#fca5a5', bg: '#7f1d1d33' };
    return { label: `Trial · ${days}d`, color: '#c4b5fd', bg: '#7c3aed22' };
  }
  if (status === 'cancelled')
    return { label: 'Canceló', color: '#fda4af', bg: '#9f123933' };
  if (status === 'past_due')
    return { label: 'Tarjeta rebotó', color: '#fde68a', bg: '#92400e33' };
  return { label: 'Sin pagar', color: '#9ca3af', bg: '#37415133' };
}

export default async function Admin({ searchParams }: { searchParams: SearchParams }) {
  const { q = '', status: statusFilter = '', wrong, revMonth } = await searchParams;

  // 1. Autenticación.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login?next=/admin');

  // 2. Email allowlist.
  if (!isAdminEmail(user.email)) {
    // Debug: contar cuántos emails hay en ADMIN_EMAILS y mostrar primeros chars
    // para ayudar al admin a diagnosticar typos sin exponer la lista completa.
    const rawEnv = process.env.ADMIN_EMAILS || '';
    const adminCount = rawEnv.split(',').map(s => s.trim()).filter(Boolean).length;
    const preview = rawEnv.length > 0
      ? rawEnv.split(',').map(s => {
          const e = s.trim();
          if (!e) return '';
          const at = e.indexOf('@');
          if (at < 0) return e.slice(0, 4) + '...';
          return e.slice(0, Math.min(4, at)) + '***' + e.slice(at);
        }).filter(Boolean).join(', ')
      : '(vacío)';

    return (
      <main className="min-h-screen text-white flex items-center justify-center p-8"
        style={{ background: '#080808' }}>
        <div className="max-w-lg text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-bold mb-2">Acceso restringido</h1>
          <p className="text-sm mb-4" style={{ color: '#888' }}>
            Tu cuenta (<span className="font-mono">{user.email}</span>) no está autorizada para ver este panel.
          </p>
          <div className="rounded-xl p-4 mb-6 text-left text-xs"
            style={{ background: '#0f0f0f', border: '1px solid #1f1f1f', color: '#888' }}>
            <div className="font-bold mb-2" style={{ color: '#aaa' }}>🐛 Diagnóstico</div>
            <div>Tu email: <span className="font-mono" style={{ color: '#fff' }}>{user.email.toLowerCase()}</span></div>
            <div>Emails configurados en ADMIN_EMAILS: <span className="font-mono" style={{ color: '#fff' }}>{adminCount}</span></div>
            <div>Lista (parcial): <span className="font-mono" style={{ color: '#c4b5fd' }}>{preview}</span></div>
            <div className="mt-2" style={{ color: '#666' }}>
              {adminCount === 0
                ? 'La variable ADMIN_EMAILS está vacía o no existe en Vercel.'
                : 'Si tu email no aparece arriba (mismo dominio), agregalo a ADMIN_EMAILS y redeployá.'}
            </div>
          </div>
          <Link href="/app" className="text-sm underline" style={{ color: '#c4b5fd' }}>
            ← Volver a la app
          </Link>
        </div>
      </main>
    );
  }

  // 3. PIN gate. Pedimos PIN SIEMPRE que el usuario llegue a /admin desde
  // afuera (referer no incluye /admin). Una vez adentro, las acciones
  // internas (filtros, csv, etc.) no piden de nuevo porque su referer ES /admin.
  // Esto permite navegar dentro del panel pero exige PIN al re-entrar.
  const cookieStore = await cookies();
  const hasPin = cookieStore.get(PIN_COOKIE)?.value === '1';

  const headersList = await headers();
  const refererRaw = headersList.get('referer') || '';
  let cameFromAdmin = false;
  try {
    if (refererRaw) {
      const refUrl = new URL(refererRaw);
      const p = refUrl.pathname;
      // Aceptamos navegación interna del panel (/admin/*) y vuelta desde
      // el endpoint de PIN (/api/admin/pin) tras un login fresco.
      cameFromAdmin = p === '/admin'
        || p.startsWith('/admin/')
        || p === '/api/admin/pin';
    }
  } catch { /* invalid referer */ }

  // Si NO viene de /admin → siempre pide PIN, aunque tenga cookie.
  // Si SÍ viene de /admin (filtros, etc.) → permite con cookie válida.
  const requirePin = !hasPin || !cameFromAdmin;

  if (requirePin) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center p-8"
        style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
        <div className="w-full max-w-sm">
          <div className="rounded-3xl p-8 text-center"
            style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
            <div className="text-5xl mb-3">🔑</div>
            <h1 className="text-xl font-bold mb-2">Ingresá el PIN</h1>
            <p className="text-sm mb-6" style={{ color: '#888' }}>
              Capa extra de seguridad para abrir el panel.
            </p>

            {wrong === '1' && (
              <div className="rounded-xl p-3 text-xs mb-4"
                style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#fca5a5' }}>
                PIN incorrecto. Probá de nuevo.
              </div>
            )}
            {wrong === 'noconfig' && (
              <div className="rounded-xl p-3 text-xs mb-4"
                style={{ background: '#92400e22', border: '1px solid #92400e44', color: '#fde68a' }}>
                Falta configurar ADMIN_PIN en el servidor.
              </div>
            )}

            <form method="POST" action="/api/admin/pin" className="flex flex-col gap-3">
              <input
                type="password"
                name="pin"
                required
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="••••••"
                className="w-full px-4 py-3 rounded-xl text-center text-lg outline-none tracking-widest"
                style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff', fontFamily: 'monospace' }}
              />
              <button type="submit"
                className="w-full py-3.5 rounded-2xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 20px #7c3aed44' }}>
                Entrar →
              </button>
            </form>

            <Link href="/app" className="text-xs underline mt-6 inline-block"
              style={{ color: '#666' }}>
              ← Volver a la app
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 2. Cargar perfiles + logs de uso en paralelo.
  const admin = createServiceClient();

  // Tarifas estimadas (USD por acción no cacheada)
  const RATES = {
    viral_ig: 0.10, viral_tt: 0.05, viral_yt: 0.03,
    transcribe_ig: 0.02, transcribe_yt: 0.005, transcribe_tt: 0.005,
  };

  type CostRow = { email: string; searches_ig: number; searches_tt: number; searches_yt: number; transcripts_ig: number; transcripts_yt: number; transcripts_tt: number; total_usd: number };
  const costMap = new Map<string, CostRow>();
  const getCost = (email: string) => {
    if (!costMap.has(email)) costMap.set(email, { email, searches_ig: 0, searches_tt: 0, searches_yt: 0, transcripts_ig: 0, transcripts_yt: 0, transcripts_tt: 0, total_usd: 0 });
    return costMap.get(email)!;
  };

  const [searchLogs, transcriptLogs] = await Promise.all([
    admin.from('viral_search_log').select('user_email, platform, cache_hit').eq('cache_hit', false).not('user_email', 'is', null),
    admin.from('transcription_log').select('user_email, platform, cache_hit').eq('cache_hit', false).not('user_email', 'is', null),
  ]);

  for (const row of (searchLogs.data || [])) {
    if (!row.user_email) continue;
    const c = getCost(row.user_email);
    const p = (row.platform || '').toLowerCase();
    if (p === 'instagram') { c.searches_ig++; c.total_usd += RATES.viral_ig; }
    else if (p === 'tiktok') { c.searches_tt++; c.total_usd += RATES.viral_tt; }
    else if (p === 'youtube') { c.searches_yt++; c.total_usd += RATES.viral_yt; }
  }
  for (const row of (transcriptLogs.data || [])) {
    if (!row.user_email) continue;
    const c = getCost(row.user_email);
    const p = (row.platform || '').toLowerCase();
    if (p === 'instagram') { c.transcripts_ig++; c.total_usd += RATES.transcribe_ig; }
    else if (p === 'youtube') { c.transcripts_yt++; c.total_usd += RATES.transcribe_yt; }
    else if (p === 'tiktok') { c.transcripts_tt++; c.total_usd += RATES.transcribe_tt; }
  }

  const userCosts = Array.from(costMap.values())
    .map(c => ({ ...c, total_usd: Math.round(c.total_usd * 100) / 100 }))
    .sort((a, b) => b.total_usd - a.total_usd);
  const totalCostUsd = Math.round(userCosts.reduce((s, c) => s + c.total_usd, 0) * 100) / 100;

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('email, name, phone, subscription_status, trial_ends_at, activated_at, cancelled_at, redeemed_code, stripe_customer_id, stripe_subscription_id, created_at')
    .order('created_at', { ascending: false });

  // Facturación: lee SOLO ViralADN desde Stripe, identificando las suscripciones
  // por su Price ID (STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY). No mezcla con
  // 2Clicks ni otros productos de la misma cuenta. Ver lib/stripe-admin.ts.
  const billing = await getBillingOverview();

  // customer Stripe → email (de profiles), para completar el detalle de
  // suscriptores cuando la factura no trae email (ej. los que están en trial).
  const custToEmail = new Map<string, string>();
  for (const p of profiles || []) if (p.stripe_customer_id) custToEmail.set(p.stripe_customer_id, p.email);

  // customer Stripe → fila del suscriptor (cuánto paga + renovación), para
  // mostrarlo en cada fila de la tabla de usuarios de abajo.
  const subByCustomer = new Map<string, (typeof billing.subscribers)[number]>();
  const subByEmail = new Map<string, (typeof billing.subscribers)[number]>();
  for (const s of billing.subscribers) {
    subByCustomer.set(s.customer, s);
    if (s.email) subByEmail.set(s.email.toLowerCase(), s);
  }

  // ── Ingreso diario del mes seleccionado (gráfico de línea) ──
  const nowD = new Date();
  const defaultMonth = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}`;
  const selMonth = /^\d{4}-\d{2}$/.test(revMonth || '') ? revMonth! : defaultMonth;
  const selY = Number(selMonth.slice(0, 4));
  const selM = Number(selMonth.slice(5, 7)); // 1..12
  const daysInMonth = new Date(selY, selM, 0).getDate();
  const daily = Array.from({ length: daysInMonth }, () => 0);
  for (const p of billing.payments) {
    const d = new Date(p.date);
    if (d.getFullYear() === selY && d.getMonth() + 1 === selM) daily[d.getDate() - 1] += p.amount;
  }
  const dailyTotal = daily.reduce((a, b) => a + b, 0);
  const dailyCount = daily.filter(v => v > 0).length;
  // Últimos 6 meses para el selector (links que preservan q/status).
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(nowD.getFullYear(), nowD.getMonth() - i, 1);
    return {
      val: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
    };
  });
  const monthHref = (val: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (statusFilter) sp.set('status', statusFilter);
    sp.set('revMonth', val);
    return `/admin?${sp.toString()}#ingreso-diario`;
  };
  const monthLabel = new Date(selY, selM - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  if (error) {
    console.error('[admin] fetch profiles:', error);
  }

  const all: Profile[] = profiles || [];

  // ¿Está en su MES DE PRUEBA? Detección dual:
  //   1) Stripe dice que la sub tiene cupón/trial activo (rápido pero efímero
  //      cuando el cupón es "una vez" — Stripe lo consume al instante).
  //   2) Fallback robusto: en /app/welcome guardamos el promo code (redeemed_code)
  //      y el fin del primer período (trial_ends_at) al momento del pago. Si la
  //      persona pagó con descuento y todavía no se le acabó ese período → mes prueba.
  // El COURTESY no cuenta (es activación manual, no mes de prueba pago).
  const trialCustomerSet = new Set(billing.trialCustomerIds || []);
  const isInTrialMonth = (p: Profile) => {
    if (!p.stripe_subscription_id) return false; // tiene que ser pago Stripe
    if ((p.redeemed_code || '').toUpperCase().startsWith('COURTESY')) return false;
    // Path 1: Stripe lo confirma ahora mismo
    if (p.stripe_customer_id && trialCustomerSet.has(p.stripe_customer_id)) return true;
    // Path 2: guardado al pagar (sobrevive aunque Stripe ya consumió el cupón)
    if (p.redeemed_code && p.trial_ends_at) {
      return new Date(p.trial_ends_at).getTime() > Date.now();
    }
    return false;
  };

  const fmtUSD = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

  // 3. Aplicar filtros.
  const qLower = q.trim().toLowerCase();
  const filtered = all.filter(p => {
    if (qLower) {
      const blob = `${p.email} ${p.name || ''} ${p.phone || ''} ${p.redeemed_code || ''}`.toLowerCase();
      if (!blob.includes(qLower)) return false;
    }
    if (statusFilter) {
      const status = p.subscription_status || 'pending';
      if (statusFilter === 'trial-active') {
        const days = trialDaysLeft(p.trial_ends_at);
        if (status !== 'trialing' || days === null || days <= 0) return false;
      } else if (statusFilter === 'trial-expired') {
        const days = trialDaysLeft(p.trial_ends_at);
        if (status !== 'trialing' || days === null || days > 0) return false;
      } else if (statusFilter === 'courtesy') {
        // Cortesías: cuentas que activamos a mano (código COURTESY_*)
        if (!(p.redeemed_code || '').toUpperCase().startsWith('COURTESY')) return false;
      } else if (statusFilter === 'trial-month') {
        // Mes de prueba: suscripción Stripe con cupón/trial activo
        if (!isInTrialMonth(p)) return false;
      } else if (status !== statusFilter) {
        return false;
      }
    }
    return true;
  });

  // 4. Stats.
  const stats = {
    total: all.length,
    active: all.filter(p => p.subscription_status === 'active').length,
    trialing: all.filter(p => {
      const d = trialDaysLeft(p.trial_ends_at);
      return p.subscription_status === 'trialing' && d !== null && d > 0;
    }).length,
    pending: all.filter(p => !p.subscription_status || p.subscription_status === 'pending').length,
    cancelled: all.filter(p => p.subscription_status === 'cancelled').length,
    courtesy: all.filter(p => (p.redeemed_code || '').toUpperCase().startsWith('COURTESY')).length,
    trialMonth: all.filter(isInTrialMonth).length,
  };

  return (
    <main className="min-h-screen text-white p-6 md:p-10"
      style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Panel de admin</h1>
            <p className="text-xs" style={{ color: '#666' }}>
              Logueado como {user.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ReconcileButton />
            <a href="/api/admin/export" download
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#eee' }}>
              ⬇ Clientes CSV
            </a>
            <a href="/api/admin/export?type=ventas" download
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#0d1f12', border: '1px solid #22c55e55', color: '#86efac' }}>
              💵 Exportar ventas
            </a>
            <Link href="/app"
              className="text-sm" style={{ color: '#888' }}>
              ← Volver a la app
            </Link>
          </div>
        </div>

        {/* Envío masivo de accesos Legacy */}
        <SendAccessPanel />

        {/* Restablecer contraseña de un usuario */}
        <div className="mb-6">
          <AdminResetPassword />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: '#fff', filter: '' },
            { label: 'Pagaron', value: stats.active, color: '#86efac', filter: 'active' },
            { label: '🎁 Mes prueba', value: stats.trialMonth, color: '#5eead4', filter: 'trial-month' },
            { label: 'En trial', value: stats.trialing, color: '#c4b5fd', filter: 'trial-active' },
            { label: 'Sin pagar', value: stats.pending, color: '#9ca3af', filter: 'pending' },
            { label: 'Cancelados', value: stats.cancelled, color: '#fda4af', filter: 'cancelled' },
            { label: '🎁 Cortesía', value: stats.courtesy, color: '#fcd34d', filter: 'courtesy' },
          ].map(s => (
            <Link
              key={s.label}
              href={s.filter ? `/admin?status=${s.filter}` : '/admin'}
              className="rounded-2xl p-4 transition-all hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(145deg, #141414, #0d0d0d)',
                border: statusFilter === s.filter ? `1px solid ${s.color}55` : '1px solid #1f1f1f',
              }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>{s.label}</div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </Link>
          ))}
        </div>

        {/* ── BILLING (Stripe) ───────────────────────────────────────────── */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            💳 Facturación
            {billing.configured && !billing.error && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: '#22c55e22', color: '#86efac' }}>
                Stripe conectado
              </span>
            )}
            {(!billing.configured || billing.error) && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: '#7f1d1d33', color: '#fca5a5' }}>
                {billing.error || 'No configurado'}
              </span>
            )}
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(145deg, #1a1030, #0d0d0d)', border: '1px solid #7c3aed66' }}>
              <div className="text-xs mb-1 flex items-center gap-1" style={{ color: '#a78bfa' }}>MRR comprometido</div>
              <div className="text-2xl font-bold" style={{ color: '#c4b5fd' }}>{fmtUSD(billing.committedMrr ?? 0)}<span className="text-xs font-normal" style={{ color: '#666' }}>/mes</span></div>
            </div>
            <div className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #22c55e44' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Cobrado este mes</div>
              <div className="text-2xl font-bold" style={{ color: '#86efac' }}>{fmtUSD(billing.totalRevenueThisMonth)}</div>
            </div>
            <div className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Mes pasado</div>
              <div className="text-2xl font-bold" style={{ color: '#888' }}>{fmtUSD(billing.totalRevenueLastMonth)}</div>
            </div>
            <div className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Total acumulado</div>
              <div className="text-2xl font-bold" style={{ color: '#c4b5fd' }}>{fmtUSD(billing.totalRevenueAllTime)}</div>
            </div>
            <div className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Suscripciones activas</div>
              <div className="text-2xl font-bold" style={{ color: '#fff' }}>{billing.activeSubscriptions}</div>
            </div>
          </div>

          {/* Histórico mensual (mini-bar chart con divs) */}
          {billing.monthlyRevenue.length > 0 && (
            <div className="rounded-2xl p-4 mb-4"
              style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-3" style={{ color: '#666' }}>Últimos 6 meses</div>
              <div className="flex items-end gap-2 h-24">
                {billing.monthlyRevenue.map(m => {
                  const max = Math.max(...billing.monthlyRevenue.map(x => x.revenue), 1);
                  const h = Math.max(4, (m.revenue / max) * 100);
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1">
                      <div className="text-[10px] font-semibold" style={{ color: '#888' }}>
                        {m.revenue > 0 ? fmtUSD(m.revenue) : ''}
                      </div>
                      <div
                        className="w-full rounded-t-lg"
                        style={{
                          height: `${h}%`,
                          background: m.revenue > 0
                            ? 'linear-gradient(180deg, #7c3aed, #c13584)'
                            : '#1a1a1a',
                          minHeight: '4px',
                        }}
                        title={`${m.count} pago${m.count !== 1 ? 's' : ''}`}
                      />
                      <div className="text-[10px]" style={{ color: '#666' }}>{m.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ingreso diario del mes (gráfico de línea, eje X = días, eje Y = $) */}
          <div id="ingreso-diario" className="rounded-2xl p-4 mb-4"
            style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="text-xs" style={{ color: '#666' }}>
                📈 Ingreso diario — <span style={{ color: '#c4b5fd', textTransform: 'capitalize' }}>{monthLabel}</span>
              </div>
              <div className="text-xs" style={{ color: '#888' }}>
                {fmtUSD(dailyTotal)} · {dailyCount} día{dailyCount === 1 ? '' : 's'} con pagos
              </div>
            </div>

            <div className="flex gap-1.5 flex-wrap mb-3">
              {monthOptions.map(o => {
                const active = o.val === selMonth;
                return (
                  <a key={o.val} href={monthHref(o.val)} className="text-xs px-2.5 py-1 rounded-full transition-all"
                    style={active
                      ? { background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff', fontWeight: 600 }
                      : { background: '#141414', border: '1px solid #222', color: '#888' }}>
                    {o.label}
                  </a>
                );
              })}
            </div>

            <DailyRevenueChart daily={daily} year={selY} month={selM} daysInMonth={daysInMonth} />
            {dailyTotal === 0 && (
              <div className="text-center text-xs mt-1" style={{ color: '#555' }}>Sin ingresos cobrados en {monthLabel}.</div>
            )}
          </div>

          {/* Lista de pagos recientes */}
          {billing.recentPayments.length > 0 && (
            <details className="rounded-2xl overflow-hidden"
              style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold flex items-center justify-between"
                style={{ color: '#aaa' }}>
                <span>Historial de pagos ({billing.recentPayments.length})</span>
                <span className="text-xs" style={{ color: '#666' }}>Click para expandir ↓</span>
              </summary>
              <div className="overflow-x-auto" style={{ borderTop: '1px solid #1a1a1a' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs" style={{ color: '#666', borderBottom: '1px solid #1a1a1a' }}>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Monto</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.recentPayments.map(p => {
                      const d = new Date(p.date);
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #141414' }}>
                          <td className="px-4 py-3 text-xs" style={{ color: '#888' }}>
                            {d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}{' '}
                            {d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3" style={{ color: '#eee' }}>{p.email || '—'}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: '#86efac' }}>
                            {fmtUSD(p.amount)} {p.currency}
                          </td>
                          <td className="px-4 py-3">
                            {p.refunded ? (
                              <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#7f1d1d33', color: '#fca5a5' }}>Reembolsado</span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#22c55e22', color: '#86efac' }}>Pagado</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* Detalle por suscriptor: cuánto paga c/u + renovación (para reconciliar) */}
          {billing.subscribers && billing.subscribers.length > 0 && (
            <details className="rounded-2xl overflow-hidden mt-3"
              style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold flex items-center justify-between"
                style={{ color: '#aaa' }}>
                <span>💳 Detalle por suscriptor ViralADN ({billing.subscribers.length}) — qué paga c/u + renovación</span>
                <span className="text-xs" style={{ color: '#666' }}>Click para expandir ↓</span>
              </summary>
              <div className="overflow-x-auto" style={{ borderTop: '1px solid #1a1a1a' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs" style={{ color: '#666', borderBottom: '1px solid #1a1a1a' }}>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Plan</th>
                      <th className="px-4 py-3 font-semibold">Paga este ciclo</th>
                      <th className="px-4 py-3 font-semibold">Total pagado</th>
                      <th className="px-4 py-3 font-semibold">Renovación</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.subscribers.map((s, idx) => {
                      const email = s.email || custToEmail.get(s.customer) || '—';
                      const renew = s.renewal ? new Date(s.renewal) : null;
                      const days = renew ? Math.ceil((renew.getTime() - Date.now()) / 86400000) : null;
                      const st = s.status === 'active' ? { bg: '#22c55e22', c: '#86efac', t: 'Activa' }
                        : s.status === 'trialing' ? { bg: '#3b82f622', c: '#93c5fd', t: 'Trial' }
                        : s.status === 'past_due' ? { bg: '#f59e0b22', c: '#fcd34d', t: 'Vencida' }
                        : { bg: '#7f1d1d33', c: '#fca5a5', t: s.status };
                      return (
                        <tr key={s.customer + idx} style={{ borderBottom: '1px solid #141414' }}>
                          <td className="px-4 py-3" style={{ color: '#eee' }}>{email}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#aaa' }}>{s.plan}</td>
                          <td className="px-4 py-3 font-bold" style={{ color: s.amountThisCycle === 0 ? '#a78bfa' : '#86efac' }}>
                            {fmtUSD(s.amountThisCycle)}
                            {s.isFreeMonth && <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#7c3aed22', color: '#c4b5fd' }}>mes gratis</span>}
                          </td>
                          <td className="px-4 py-3" style={{ color: '#ccc' }}>{fmtUSD(s.totalPaid)}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#888' }}>
                            {renew
                              ? <>{renew.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}{days != null && <span style={{ color: '#666' }}> · en {days} día{days === 1 ? '' : 's'}</span>}</>
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full" style={{ background: st.bg, color: st.c }}>{st.t}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>

        {/* ── COSTO POR USUARIO ─────────────────────────────────────────── */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            💸 Costo estimado por usuario
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: '#7c3aed22', color: '#c4b5fd' }}>
              API costs · no cacheados
            </span>
          </h2>

          {/* Resumen total */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #ef444444' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Costo total estimado</div>
              <div className="text-2xl font-bold" style={{ color: '#fca5a5' }}>{fmtUSD(totalCostUsd)}</div>
            </div>
            <div className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Usuarios con actividad</div>
              <div className="text-2xl font-bold" style={{ color: '#fff' }}>{userCosts.length}</div>
            </div>
            <div className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Búsquedas virales (total)</div>
              <div className="text-2xl font-bold" style={{ color: '#c4b5fd' }}>
                {userCosts.reduce((s, c) => s + c.searches_ig + c.searches_tt + c.searches_yt, 0)}
              </div>
            </div>
            <div className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Transcripciones (total)</div>
              <div className="text-2xl font-bold" style={{ color: '#c4b5fd' }}>
                {userCosts.reduce((s, c) => s + c.transcripts_ig + c.transcripts_yt + c.transcripts_tt, 0)}
              </div>
            </div>
          </div>

          {/* Tabla detallada por usuario */}
          {userCosts.length > 0 ? (
            <details className="rounded-2xl overflow-hidden"
              style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold flex items-center justify-between"
                style={{ color: '#aaa' }}>
                <span>Detalle por usuario ({userCosts.length})</span>
                <span className="text-xs" style={{ color: '#666' }}>Click para expandir ↓</span>
              </summary>
              <div className="overflow-x-auto" style={{ borderTop: '1px solid #1a1a1a' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs" style={{ color: '#666', borderBottom: '1px solid #1a1a1a' }}>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold text-right">🔍 Búsquedas<br/><span style={{color:'#C13584'}}>IG</span> · <span style={{color:'#69C9D0'}}>TT</span> · <span style={{color:'#FF0000'}}>YT</span></th>
                      <th className="px-4 py-3 font-semibold text-right">📝 Transcrip.<br/><span style={{color:'#C13584'}}>IG</span> · <span style={{color:'#69C9D0'}}>TT</span> · <span style={{color:'#FF0000'}}>YT</span></th>
                      <th className="px-4 py-3 font-semibold text-right">Costo est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userCosts.map(c => (
                      <tr key={c.email} style={{ borderBottom: '1px solid #141414' }}>
                        <td className="px-4 py-3" style={{ color: '#eee' }}>{c.email}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono" style={{ color: '#aaa' }}>
                          <span style={{ color: '#C13584' }}>{c.searches_ig}</span>
                          {' · '}
                          <span style={{ color: '#69C9D0' }}>{c.searches_tt}</span>
                          {' · '}
                          <span style={{ color: '#FF6666' }}>{c.searches_yt}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-mono" style={{ color: '#aaa' }}>
                          <span style={{ color: '#C13584' }}>{c.transcripts_ig}</span>
                          {' · '}
                          <span style={{ color: '#69C9D0' }}>{c.transcripts_tt}</span>
                          {' · '}
                          <span style={{ color: '#FF6666' }}>{c.transcripts_yt}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold"
                          style={{ color: c.total_usd > 1 ? '#fca5a5' : c.total_usd > 0.5 ? '#fde68a' : '#86efac' }}>
                          {fmtUSD(c.total_usd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-3 text-xs" style={{ color: '#555', borderTop: '1px solid #141414' }}>
                  Tarifas: IG search ${(0.10).toFixed(2)} · TT search ${(0.05).toFixed(2)} · YT search ${(0.03).toFixed(2)} · IG transcrip. ${(0.02).toFixed(2)} · TT/YT transcrip. ${(0.005).toFixed(3)} · Solo acciones no cacheadas.
                </div>
              </div>
            </details>
          ) : (
            <div className="rounded-2xl p-6 text-center text-sm"
              style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', color: '#555' }}>
              Sin datos de uso todavía. Los logs se generan con cada búsqueda viral o transcripción.
            </div>
          )}
        </div>

        {/* Filtros */}
        <form className="flex gap-2 mb-4 flex-wrap" method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por email, nombre, código..."
            className="flex-1 min-w-[260px] px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }}
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
            style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff' }}>
            <option value="">Todos los estados</option>
            <option value="active">Pagaron</option>
            <option value="trial-active">Trial activo</option>
            <option value="trial-expired">Trial vencido</option>
            <option value="pending">Sin pagar</option>
            <option value="cancelled">Cancelados</option>
            <option value="trial-month">🎁 Mes de prueba</option>
            <option value="courtesy">🎁 Cortesía</option>
          </select>
          <button type="submit"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
            Filtrar
          </button>
          {(q || statusFilter) && (
            <Link href="/admin"
              className="px-5 py-2.5 rounded-xl text-sm self-center"
              style={{ color: '#888' }}>
              Limpiar
            </Link>
          )}
        </form>

        <p className="text-xs mb-3" style={{ color: '#666' }}>
          Mostrando {filtered.length} de {all.length}
        </p>

        {/* Tabla */}
        <div className="rounded-2xl overflow-x-auto"
          style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: '#666', borderBottom: '1px solid #1a1a1a' }}>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Teléfono</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Pagó</th>
                <th className="px-4 py-3 font-semibold">Renovación</th>
                <th className="px-4 py-3 font-semibold">Código</th>
                <th className="px-4 py-3 font-semibold">Registrado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center" style={{ color: '#555' }}>
                    {all.length === 0
                      ? 'No hay usuarios todavía. Cuando alguien se registre va a aparecer acá.'
                      : 'No hay resultados con esos filtros.'}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const pill = statusPill(p);
                  const isCourtesy = (p.redeemed_code || '').toUpperCase().startsWith('COURTESY');
                  const inTrialMonth = isInTrialMonth(p);
                  // Cruzamos por customer_id; si el perfil no lo guardó, probamos
                  // por EMAIL (así aparece el pago igual). Sin sub por ningún lado → sin pago.
                  const sub = (p.stripe_customer_id ? subByCustomer.get(p.stripe_customer_id) : undefined)
                    || (p.email ? subByEmail.get(p.email.toLowerCase()) : undefined);
                  const renew = sub?.renewal ? new Date(sub.renewal) : null;
                  const renewDays = renew ? Math.ceil((renew.getTime() - Date.now()) / 86400000) : null;
                  // Lo que pagó: $0 si está en mes de prueba (cupón cubrió la factura),
                  // si no el monto de su última factura. Sin sub → "—".
                  const paidAmt = inTrialMonth ? 0 : (sub ? sub.amountThisCycle : null);
                  // 'active' sin pago vinculado en Stripe ni código → anomalía a revisar.
                  const activeNoPay = !sub && !inTrialMonth && !p.redeemed_code && p.subscription_status === 'active';
                  return (
                    <tr key={p.email} style={{ borderBottom: '1px solid #141414' }}>
                      <td className="px-4 py-3" style={{ color: '#eee' }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.email}
                          {isCourtesy && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: '#fcd34d22', color: '#fcd34d', border: '1px solid #fcd34d44' }}
                              title="Cuenta cortesía (activada manualmente)">
                              🎁 CORTESÍA
                            </span>
                          )}
                          {inTrialMonth && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{ background: '#5eead422', color: '#5eead4', border: '1px solid #5eead444' }}
                              title="Primer mes gratis (cupón Stripe activo) — se le cobra al terminar">
                              🎁 MES PRUEBA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: '#aaa' }}>{p.name || '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#888' }}>{p.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full font-semibold"
                          style={{ background: pill.bg, color: pill.color }}>
                          {pill.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: paidAmt === null ? (activeNoPay ? '#fbbf24' : '#444') : paidAmt === 0 ? '#a78bfa' : '#86efac' }}>
                        {paidAmt === null
                          ? (activeNoPay ? '⚠️ activo sin pago' : '—')
                          : <>{fmtUSD(paidAmt)}{paidAmt === 0 && <span className="text-[9px] ml-1" style={{ color: '#c4b5fd' }}>gratis</span>}</>}
                        {sub?.product && sub.product !== '—' && (
                          <div className="text-[10px] font-semibold mt-0.5" style={{ color: '#a78bfa' }}>{sub.product}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#888' }}>
                        {renew
                          ? <>{renew.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}{renewDays != null && <span style={{ color: '#555' }}> · {renewDays}d</span>}</>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: isCourtesy ? '#fcd34d' : '#a78bfa' }}>
                        {p.redeemed_code || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#666' }}>{fmtDate(p.created_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
