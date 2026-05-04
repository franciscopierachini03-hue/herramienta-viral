import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import OpenPortalButton from './OpenPortalButton';

// /cuenta — vista de la cuenta del usuario:
// - Datos personales
// - Estado de suscripción
// - Días restantes de trial (si aplica)
// - Botón para abrir el Stripe Customer Portal (manage / cancel)

export const dynamic = 'force-dynamic';

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function trialTimeLeft(endsAt: string | null): string {
  if (!endsAt) return '';
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'expirado';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d} ${d === 1 ? 'día' : 'días'} ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} minutos`;
}

export default async function Cuenta() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login?next=/cuenta');

  const admin = createServiceClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('email, name, phone, subscription_status, trial_ends_at, activated_at, redeemed_code, stripe_customer_id, stripe_subscription_id, renews_at, cancelled_at')
    .eq('email', user.email)
    .maybeSingle();

  const status = profile?.subscription_status || 'pending';
  const isActive = status === 'active';
  const isTrialing = status === 'trialing';
  const isCancelled = status === 'cancelled';
  const trialActive = isTrialing && profile?.trial_ends_at && new Date(profile.trial_ends_at).getTime() > Date.now();

  let pillLabel = 'Sin pagar';
  let pillColor = '#9ca3af';
  let pillBg = '#37415133';
  if (isActive) {
    pillLabel = 'Suscripción activa';
    pillColor = '#86efac';
    pillBg = '#22c55e22';
  } else if (trialActive) {
    pillLabel = `En prueba · ${trialTimeLeft(profile?.trial_ends_at || null)}`;
    pillColor = '#c4b5fd';
    pillBg = '#7c3aed22';
  } else if (isTrialing && !trialActive) {
    pillLabel = 'Prueba expirada';
    pillColor = '#fca5a5';
    pillBg = '#7f1d1d33';
  } else if (isCancelled) {
    pillLabel = 'Cancelada';
    pillColor = '#fda4af';
    pillBg = '#9f123933';
  }

  return (
    <main className="min-h-screen text-white p-6 md:p-10"
      style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mi cuenta</h1>
            <p className="text-xs" style={{ color: '#666' }}>{user.email}</p>
          </div>
          <Link href="/app" className="text-sm" style={{ color: '#888' }}>← Volver a la app</Link>
        </div>

        {/* Status Card */}
        <div className="rounded-3xl p-6 mb-4"
          style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-bold">Suscripción</h2>
            <span className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{ background: pillBg, color: pillColor }}>
              {pillLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Activado</div>
              <div>{fmtDate(profile?.activated_at || null)}</div>
            </div>
            {trialActive && (
              <div>
                <div className="text-xs mb-1" style={{ color: '#666' }}>Termina prueba</div>
                <div>{fmtDate(profile?.trial_ends_at || null)}</div>
              </div>
            )}
            {profile?.renews_at && isActive && (
              <div>
                <div className="text-xs mb-1" style={{ color: '#666' }}>Próxima renovación</div>
                <div>{fmtDate(profile.renews_at)}</div>
              </div>
            )}
            {profile?.cancelled_at && (
              <div>
                <div className="text-xs mb-1" style={{ color: '#666' }}>Cancelada el</div>
                <div>{fmtDate(profile.cancelled_at)}</div>
              </div>
            )}
            {profile?.redeemed_code && (
              <div>
                <div className="text-xs mb-1" style={{ color: '#666' }}>Código usado</div>
                <div className="font-mono text-xs" style={{ color: '#a78bfa' }}>{profile.redeemed_code}</div>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="mt-6 pt-6 flex flex-wrap gap-3" style={{ borderTop: '1px solid #1f1f1f' }}>
            {(isActive || isCancelled) && (
              <OpenPortalButton />
            )}
            {(trialActive || !isActive) && !isCancelled && (
              <Link href="/precios"
                className="px-5 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 20px #7c3aed44' }}>
                {trialActive ? 'Suscribirme ahora' : 'Activar suscripción'} →
              </Link>
            )}
          </div>
        </div>

        {/* Info personal */}
        <div className="rounded-3xl p-6 mb-4"
          style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
          <h2 className="text-lg font-bold mb-4">Datos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Nombre</div>
              <div>{profile?.name || '—'}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Email</div>
              <div>{user.email}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Teléfono</div>
              <div className="font-mono text-xs">{profile?.phone || '—'}</div>
            </div>
          </div>
          <div className="mt-4 text-xs" style={{ color: '#555' }}>
            ¿Querés cambiar tu contraseña?{' '}
            <Link href="/login?reason=reset" className="underline">Pedí una nueva acá →</Link>
          </div>
        </div>

      </div>
    </main>
  );
}
