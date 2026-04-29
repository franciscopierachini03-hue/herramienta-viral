import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// /admin — panel de control para ver y gestionar usuarios.
//
// Acceso restringido: solo emails listados en ADMIN_EMAILS (env var,
// coma-separada). Si la var no está, NADIE puede entrar (fail-closed).
//
// Render: server component. Stats arriba + tabla con búsqueda client-side.

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ q?: string; status?: string }>;

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
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
  const { q = '', status: statusFilter = '' } = await searchParams;

  // 1. Autenticación + autorización.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login?next=/admin');
  if (!isAdminEmail(user.email)) {
    return (
      <main className="min-h-screen text-white flex items-center justify-center p-8"
        style={{ background: '#080808' }}>
        <div className="max-w-md text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-bold mb-2">Acceso restringido</h1>
          <p className="text-sm mb-6" style={{ color: '#888' }}>
            Tu cuenta ({user.email}) no está autorizada para ver este panel.
          </p>
          <Link href="/app" className="text-sm underline" style={{ color: '#c4b5fd' }}>
            ← Volver a la app
          </Link>
        </div>
      </main>
    );
  }

  // 2. Cargar perfiles con service client (bypass RLS).
  const admin = createServiceClient();
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('email, name, phone, subscription_status, trial_ends_at, activated_at, cancelled_at, redeemed_code, stripe_customer_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin] fetch profiles:', error);
  }

  const all: Profile[] = profiles || [];

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
            <a href="/api/admin/export" download
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#eee' }}>
              ⬇ Exportar CSV
            </a>
            <Link href="/app"
              className="text-sm" style={{ color: '#888' }}>
              ← Volver a la app
            </Link>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: '#fff' },
            { label: 'Pagaron', value: stats.active, color: '#86efac' },
            { label: 'En trial', value: stats.trialing, color: '#c4b5fd' },
            { label: 'Sin pagar', value: stats.pending, color: '#9ca3af' },
            { label: 'Cancelados', value: stats.cancelled, color: '#fda4af' },
          ].map(s => (
            <div key={s.label}
              className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>{s.label}</div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
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
                <th className="px-4 py-3 font-semibold">Código</th>
                <th className="px-4 py-3 font-semibold">Registrado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center" style={{ color: '#555' }}>
                    {all.length === 0
                      ? 'No hay usuarios todavía. Cuando alguien se registre va a aparecer acá.'
                      : 'No hay resultados con esos filtros.'}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const pill = statusPill(p);
                  return (
                    <tr key={p.email} style={{ borderBottom: '1px solid #141414' }}>
                      <td className="px-4 py-3" style={{ color: '#eee' }}>{p.email}</td>
                      <td className="px-4 py-3" style={{ color: '#aaa' }}>{p.name || '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#888' }}>{p.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full font-semibold"
                          style={{ background: pill.bg, color: pill.color }}>
                          {pill.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#a78bfa' }}>
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
