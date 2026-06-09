// Hub post-login: dos cuadrados (ViralADN · TOPCUT). Se desbloquea el que pagó.
// Server component: lee la sesión + permisos por producto (entitlement).

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { entitlementForCustomer } from '@/lib/entitlement';

export const dynamic = 'force-dynamic';

const PERMANENT_OWNERS = ['franciscopierachini03@gmail.com'];
function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (PERMANENT_OWNERS.includes(e)) return true;
  return (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(e);
}

export default async function Inicio() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login?next=/inicio');

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, name')
    .eq('email', user.email)
    .maybeSingle();

  const admin = isAdminEmail(user.email);
  const ent = admin
    ? { viraladn: true, topcut: true }
    : await entitlementForCustomer(profile?.stripe_customer_id);

  const cards = [
    {
      key: 'viraladn', href: '/app', icon: '🧬', name: 'ViralADN',
      desc: 'Descifrá el ADN del contenido viral. Buscá los videos que explotan y generá guiones.',
      unlocked: ent.viraladn, price: '$27/mes', producto: 'viraladn',
      grad: 'linear-gradient(135deg, #7c3aed, #c13584)',
    },
    {
      key: 'topcut', href: '/editor', icon: '✂️', name: 'TOPCUT',
      desc: 'Subí tu video y la IA lo edita solo: recorte, subtítulos, B-roll y música.',
      unlocked: ent.topcut, price: '$57/mes', producto: 'topcut',
      grad: 'linear-gradient(135deg, #a855f7, #ec4899)',
    },
  ];

  return (
    <main className="min-h-screen text-white flex flex-col items-center justify-center px-6 py-16"
      style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, #1a0a2e 0%, #080808 55%)' }}>
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="ViralADN" width={48} height={48} className="mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 18px #7c3aed55)' }} />
          <h1 className="text-2xl sm:text-3xl font-bold">¿Con qué arrancás hoy{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}?</h1>
          <p className="text-sm mt-1" style={{ color: '#888' }}>Elegí tu herramienta.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {cards.map(c => (
            c.unlocked ? (
              <Link key={c.key} href={c.href}
                className="group rounded-3xl p-7 flex flex-col transition-all"
                style={{ background: 'linear-gradient(145deg, #161616, #0d0d0d)', border: '1px solid #7c3aed55', boxShadow: '0 0 30px #7c3aed1f' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: c.grad, boxShadow: '0 0 24px #a855f744' }}>{c.icon}</div>
                <h2 className="text-xl font-bold mb-1">{c.name}</h2>
                <p className="text-sm mb-6 flex-1" style={{ color: '#999' }}>{c.desc}</p>
                <span className="w-full py-3 rounded-2xl text-sm font-bold text-center" style={{ background: c.grad, color: '#fff' }}>Entrar →</span>
              </Link>
            ) : (
              <div key={c.key} className="rounded-3xl p-7 flex flex-col relative" style={{ background: '#0c0c0c', border: '1px solid #1f1f1f' }}>
                <div className="absolute top-4 right-4 text-xs px-2 py-1 rounded-full" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#777' }}>🔒 Bloqueado</div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: '#161616', border: '1px solid #2a2a2a', filter: 'grayscale(1)', opacity: 0.6 }}>{c.icon}</div>
                <h2 className="text-xl font-bold mb-1" style={{ color: '#bbb' }}>{c.name}</h2>
                <p className="text-sm mb-6 flex-1" style={{ color: '#666' }}>{c.desc}</p>
                <Link href={`/precios?producto=${c.producto}`} className="w-full py-3 rounded-2xl text-sm font-bold text-center"
                  style={{ background: '#1a1a1a', border: '1px solid #7c3aed55', color: '#c4b5fd' }}>
                  Desbloquear · {c.price}
                </Link>
              </div>
            )
          ))}
        </div>

        {/* Combo upsell si no tiene las dos */}
        {!(ent.viraladn && ent.topcut) && (
          <div className="mt-5 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap"
            style={{ background: 'linear-gradient(145deg, #14101f, #0d0d0d)', border: '1px solid #7c3aed44' }}>
            <span className="text-sm" style={{ color: '#c4b5fd' }}>✨ Llevate <b>las dos</b> (ViralADN + TOPCUT) por <b>$67/mes</b> en vez de $84.</span>
            <Link href="/precios?producto=combo" className="text-xs font-bold px-4 py-2 rounded-xl" style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff' }}>Ver combo</Link>
          </div>
        )}

        <div className="text-center mt-10">
          <Link href="/cuenta" className="text-xs" style={{ color: '#666' }}>👤 Mi cuenta</Link>
        </div>
      </div>
    </main>
  );
}
