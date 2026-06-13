// Hub post-login: dos cuadrados (ViralADN · TOPCUT). Se desbloquea el que pagó.
// Server component: lee la sesión + permisos por producto (entitlement).

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/access';
import { TOOLS } from '@/lib/tools';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const { email, name, ent } = await getAccess();
  if (!email) redirect('/login?next=/inicio');
  const profile = { name };

  // Las cards salen de lib/tools.ts (fuente única). Cada una se desbloquea según
  // el entitlement que necesita. Sumar una herramienta = agregar 1 entrada allí.
  const cards = TOOLS.map(t => ({ ...t, unlocked: ent[t.needs] }));

  return (
    <main className="min-h-screen text-white flex flex-col items-center justify-center px-6 py-16"
      style={{ background: 'radial-gradient(ellipse 90% 45% at 25% 0%, #1a0a2e 0%, transparent 60%), radial-gradient(ellipse 70% 35% at 85% 8%, #06243a 0%, transparent 55%), #070710' }}>
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="ViralADN" width={48} height={48} className="mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 18px #7c3aed55)' }} />
          <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#8b8b96' }}>
            ViralADN <span style={{ color: '#5f5f6e' }}>✕</span> <span style={{ color: '#67e8f9' }}>TOPCUT</span>
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold">¿Con qué arrancas hoy{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}?</h1>
          <p className="text-sm mt-1" style={{ color: '#a1a1aa' }}>Elige tu herramienta.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => (
            c.unlocked ? (
              <Link key={c.key} href={c.href}
                className="group rounded-3xl p-7 flex flex-col transition-all duration-200 hover:-translate-y-1"
                style={{ background: 'linear-gradient(145deg, #14141f, #0d0d16)', border: `1px solid ${c.border}`, boxShadow: `0 0 30px ${c.glow}` }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4 transition-transform duration-200 group-hover:scale-110" style={{ background: c.grad, boxShadow: `0 0 24px ${c.iconGlow}` }}>{c.icon}</div>
                <h2 className="text-xl font-bold mb-1">{c.name}</h2>
                <p className="text-sm mb-6 flex-1" style={{ color: '#b4b4c0' }}>{c.desc}</p>
                <span className="w-full py-3 rounded-2xl text-sm font-bold text-center transition-transform duration-200 group-hover:scale-[1.02]" style={{ background: c.grad, color: '#fff' }}>
                  Entrar <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
                </span>
              </Link>
            ) : (
              <div key={c.key} className="rounded-3xl p-7 flex flex-col relative" style={{ background: '#0c0c14', border: '1px solid #23232f' }}>
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

        {/* Combo upsell si no tiene las dos */}
        {!(ent.viraladn && ent.topcut) && (
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
