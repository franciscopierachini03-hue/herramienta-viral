// Hub post-login: cards de herramientas (salen de lib/tools.ts). Se desbloquea lo que pagó.
// Server component: lee la sesión + permisos por producto (entitlement).
//
// VISTA ADMIN: el admin ve arriba una barra con acceso al panel (/admin) y un
// "Ver como" para simular el hub exacto de cada plan (?ver=27|57|67|gratis):
//   $27 ViralADN · $57 TOPCUT · $67 Combo · gratis = sin plan.
// En simulación se ocultan las herramientas adminOnly y se recalculan los
// candados con el entitlement del plan elegido — lo mismo que vería ese usuario.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/access';
import { TOOLS } from '@/lib/tools';

export const dynamic = 'force-dynamic';

const VISTAS = {
  '27': { label: 'Plan $27 · ViralADN', ent: { viraladn: true, topcut: false } },
  '57': { label: 'Plan $57 · TOPCUT', ent: { viraladn: false, topcut: true } },
  '67': { label: 'Plan $67 · Combo', ent: { viraladn: true, topcut: true } },
  gratis: { label: 'Sin plan (todo bloqueado)', ent: { viraladn: false, topcut: false } },
} as const;
type VistaKey = keyof typeof VISTAS;

export default async function Inicio({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { email, name, ent, admin } = await getAccess();
  if (!email) redirect('/login?next=/inicio');
  const profile = { name };

  // "Ver como" (solo admin): simula permisos y visibilidad de un plan.
  const { ver } = await searchParams;
  const vista = admin && ver && ver in VISTAS ? VISTAS[ver as VistaKey] : null;
  const entUI = vista ? vista.ent : ent;
  const adminUI = vista ? false : admin; // simulando un plan → como usuario común

  // Las cards salen de lib/tools.ts (fuente única). Cada una se desbloquea según
  // el entitlement que necesita. Sumar una herramienta = agregar 1 entrada allí.
  // Las herramientas adminOnly (Avatares IA, Carruseles) solo las ve el admin.
  const cards = TOOLS.filter(t => !t.adminOnly || adminUI).map(t => ({
    ...t,
    // unlockOn:'any' → se abre con cualquier plan pago (add-ons por créditos);
    // si no, requiere el entitlement puntual del producto.
    unlocked: t.unlockOn === 'any' ? (entUI.viraladn || entUI.topcut) : entUI[t.needs],
  }));

  const chip = (activo: boolean) => ({
    background: activo ? '#7c3aed' : '#14141f',
    border: `1px solid ${activo ? '#7c3aed' : '#2a2a36'}`,
    color: activo ? '#fff' : '#a1a1aa',
  });

  return (
    <main className="min-h-screen text-white flex flex-col items-center justify-center px-6 py-16"
      style={{ background: 'radial-gradient(ellipse 90% 45% at 25% 0%, #1a0a2e 0%, transparent 60%), radial-gradient(ellipse 70% 35% at 85% 8%, #06243a 0%, transparent 55%), #070710' }}>
      <div className="w-full max-w-5xl">

        {/* ── Barra de admin: panel + "ver como" ── */}
        {admin && (
          <div className="mb-8 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 flex-wrap"
            style={{ background: 'linear-gradient(145deg, #14141f, #0d0d16)', border: '1px solid #2a2a36' }}>
            <Link href="/admin" className="text-xs font-bold px-3 py-1.5 rounded-xl transition-transform hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff' }}>
              🛠 Panel admin
            </Link>
            <Link href="/admin/costos" className="text-xs font-bold px-3 py-1.5 rounded-xl transition-transform hover:-translate-y-0.5"
              style={{ background: '#1a1408', border: '1px solid #a1620a55', color: '#fcd34d' }}>
              💸 Costos
            </Link>
            <span className="mx-1 text-xs" style={{ color: '#3f3f4d' }}>|</span>
            <span className="text-xs font-bold" style={{ color: '#8b8b96' }}>👁 Ver como:</span>
            <Link href="/inicio" className="text-xs font-bold px-3 py-1.5 rounded-xl" style={chip(!vista)}>🛡 Admin</Link>
            <Link href="/inicio?ver=27" className="text-xs font-bold px-3 py-1.5 rounded-xl" style={chip(ver === '27')}>$27 ViralADN</Link>
            <Link href="/inicio?ver=57" className="text-xs font-bold px-3 py-1.5 rounded-xl" style={chip(ver === '57')}>$57 TOPCUT</Link>
            <Link href="/inicio?ver=67" className="text-xs font-bold px-3 py-1.5 rounded-xl" style={chip(ver === '67')}>$67 Combo</Link>
            <Link href="/inicio?ver=gratis" className="text-xs font-bold px-3 py-1.5 rounded-xl" style={chip(ver === 'gratis')}>Sin plan</Link>
          </div>
        )}

        {/* Aviso de simulación activa */}
        {vista && (
          <div className="mb-6 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
            style={{ background: '#1a1408', border: '1px solid #a1620a55' }}>
            <span className="text-xs" style={{ color: '#fbbf24' }}>
              👁 Estás viendo el hub <b>exactamente como lo ve un usuario de {vista.label}</b> (las herramientas de admin se ocultan).
            </span>
            <Link href="/inicio" className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: '#14141f', border: '1px solid #2a2a36', color: '#e8e8ee' }}>
              ← Volver a vista admin
            </Link>
          </div>
        )}

        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="ViralADN" width={48} height={48} className="mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 18px #7c3aed55)' }} />
          <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#8b8b96' }}>
            ViralADN <span style={{ color: '#5f5f6e' }}>✕</span> <span style={{ color: '#67e8f9' }}>TOPCUT</span>
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold">¿Con qué arrancas hoy{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}?</h1>
          <p className="text-sm mt-1" style={{ color: '#a1a1aa' }}>Elige tu herramienta.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {cards.map(c => (
            c.unlocked ? (
              <Link key={c.key} href={c.href}
                className="group rounded-3xl p-7 flex flex-col transition-all duration-200 hover:-translate-y-1 w-full sm:w-80"
                style={{ background: 'linear-gradient(145deg, #14141f, #0d0d16)', border: `1px solid ${c.border}`, boxShadow: `0 0 30px ${c.glow}` }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4 transition-transform duration-200 group-hover:scale-110" style={{ background: c.grad, boxShadow: `0 0 24px ${c.iconGlow}` }}>{c.icon}</div>
                <h2 className="text-xl font-bold mb-1">{c.name}</h2>
                <p className="text-sm mb-6 flex-1" style={{ color: '#b4b4c0' }}>{c.desc}</p>
                <span className="w-full py-3 rounded-2xl text-sm font-bold text-center transition-transform duration-200 group-hover:scale-[1.02]" style={{ background: c.grad, color: '#fff' }}>
                  Entrar <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
                </span>
              </Link>
            ) : (
              <div key={c.key} className="rounded-3xl p-7 flex flex-col relative w-full sm:w-80" style={{ background: '#0c0c14', border: '1px solid #23232f' }}>
                <div className="absolute top-4 right-4 text-xs px-2 py-1 rounded-full" style={{ background: '#14141f', border: '1px solid #2a2a36', color: '#8b8b96' }}>🔒 Bloqueado</div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: '#14141f', border: '1px solid #2a2a36', filter: 'grayscale(1)', opacity: 0.6 }}>{c.icon}</div>
                <h2 className="text-xl font-bold mb-1" style={{ color: '#d4d4dc' }}>{c.name}</h2>
                <p className="text-sm mb-6 flex-1" style={{ color: '#8b8b96' }}>{c.desc}</p>
                <Link href={`/precios?producto=${c.producto}`} className="w-full py-3 rounded-2xl text-sm font-bold text-center transition-colors hover:text-white"
                  style={{ background: '#14141f', border: `1px solid ${c.unlockBorder}`, color: c.unlockColor }}>
                  Desbloquear · {c.price}
                </Link>
              </div>
            )
          ))}
        </div>

        {/* Combo upsell si no tiene las dos (usa el entitlement de la vista activa) */}
        {!(entUI.viraladn && entUI.topcut) && (
          <div className="mt-5 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap"
            style={{ background: 'linear-gradient(145deg, #14101f, #0d1018)', border: '1px solid #7c3aed44' }}>
            <span className="text-sm" style={{ color: '#c4b5fd' }}>✨ Llévate <b>las dos</b> (ViralADN + TOPCUT) por <b>$67/mes</b> en vez de $84.</span>
            <Link href="/precios?producto=combo" className="text-xs font-bold px-4 py-2 rounded-xl transition-transform hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584 45%, #2563eb)', color: '#fff' }}>Ver combo</Link>
          </div>
        )}

        <div className="text-center mt-10">
          <Link href="/cuenta" className="text-xs transition-colors hover:text-white" style={{ color: '#8b8b96' }}>👤 Mi cuenta</Link>
        </div>
      </div>
    </main>
  );
}
