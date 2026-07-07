// /admin/pagos — libro de pagos de ViralADN (lo alimenta el webhook de Stripe).
// Server component, solo admin. Muestra ventas/renovaciones/reembolsos/disputas
// con totales del mes. Si la tabla no existe todavía, muestra cómo crearla.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/access';

export const dynamic = 'force-dynamic';

type Pago = {
  id: string;
  tipo: string;
  email: string | null;
  producto: string | null;
  monto: number | null;
  estado: string | null;
  detalle: string | null;
  created_at: string;
};

const TIPO_UI: Record<string, { label: string; color: string; bg: string }> = {
  venta: { label: '✅ Venta', color: '#86efac', bg: '#22c55e18' },
  renovacion: { label: '🔄 Renovación', color: '#7dd3fc', bg: '#0ea5e918' },
  reembolso: { label: '↩️ Reembolso', color: '#fda4af', bg: '#ef444418' },
  disputa: { label: '🚨 Disputa', color: '#fca5a5', bg: '#ef444426' },
  disputa_cerrada: { label: '⚖️ Disputa cerrada', color: '#fcd34d', bg: '#eab30818' },
  fallo_pago: { label: '⚠️ Pago fallido', color: '#fcd34d', bg: '#eab30818' },
  cancelacion: { label: '✖️ Cancelación', color: '#9ca3af', bg: '#6b728018' },
};

export default async function Pagos({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login?next=/admin/pagos');
  if (!isAdminEmail(user.email)) redirect('/admin');

  const { tipo } = await searchParams;
  const svc = createServiceClient();

  let filas: Pago[] = [];
  let tablaFalta = false;
  {
    let q = svc.from('pagos_viraladn')
      .select('id,tipo,email,producto,monto,estado,detalle,created_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (tipo) q = q.eq('tipo', tipo);
    const { data, error } = await q;
    if (error) tablaFalta = /does not exist|relation/i.test(error.message);
    filas = (data || []) as Pago[];
  }

  // Totales del mes en curso.
  const inicioMes = new Date();
  inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const delMes = filas.filter(f => new Date(f.created_at) >= inicioMes);
  const suma = (t: string) => delMes.filter(f => f.tipo === t).reduce((n, f) => n + (Number(f.monto) || 0), 0);
  const cuenta = (t: string) => delMes.filter(f => f.tipo === t).length;
  const ingresos = suma('venta') + suma('renovacion');
  const disputasAbiertas = filas.filter(f => f.tipo === 'disputa' && f.estado === 'abierta').length;

  const fmtFecha = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const chip = (activo: boolean) => ({
    background: activo ? '#7c3aed' : '#14141f',
    border: `1px solid ${activo ? '#7c3aed' : '#2a2a36'}`,
    color: activo ? '#fff' : '#a1a1aa',
  });

  return (
    <main className="min-h-screen text-white px-6 py-8" style={{ background: '#080808' }}>
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">💳 Pagos de ViralADN</h1>
            <p className="text-xs" style={{ color: '#666' }}>
              Libro alimentado por el webhook de Stripe · reembolsos y disputas avisan por email solos
            </p>
          </div>
          <Link href="/admin" className="text-sm" style={{ color: '#888' }}>← Panel</Link>
        </div>

        {tablaFalta && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: '#1a1408', border: '1px solid #a1620a55' }}>
            <p className="text-sm font-bold mb-1" style={{ color: '#fcd34d' }}>⚙️ Falta crear la tabla (1 minuto, una sola vez)</p>
            <p className="text-xs" style={{ color: '#c9b48a' }}>
              Supabase → SQL Editor → New query → pegá el contenido de <span className="font-mono">supabase/pagos.sql</span> → Run.
              Desde ahí, cada movimiento de Stripe aparece acá solo.
            </p>
          </div>
        )}

        {/* Totales del mes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
            <div className="text-xs mb-1" style={{ color: '#666' }}>Ingresos del mes</div>
            <div className="text-2xl font-extrabold" style={{ color: '#86efac' }}>${ingresos.toFixed(0)}</div>
            <div className="text-[11px] mt-1" style={{ color: '#666' }}>{cuenta('venta')} ventas · {cuenta('renovacion')} renovaciones</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
            <div className="text-xs mb-1" style={{ color: '#666' }}>Reembolsos del mes</div>
            <div className="text-2xl font-extrabold" style={{ color: '#fda4af' }}>${suma('reembolso').toFixed(0)}</div>
            <div className="text-[11px] mt-1" style={{ color: '#666' }}>{cuenta('reembolso')} reembolsos</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: disputasAbiertas ? '1px solid #ef444455' : '1px solid #1f1f1f' }}>
            <div className="text-xs mb-1" style={{ color: '#666' }}>Disputas abiertas</div>
            <div className="text-2xl font-extrabold" style={{ color: disputasAbiertas ? '#fca5a5' : '#fff' }}>{disputasAbiertas}</div>
            <div className="text-[11px] mt-1" style={{ color: '#666' }}>responder a tiempo en Stripe</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
            <div className="text-xs mb-1" style={{ color: '#666' }}>Fallos de cobro (mes)</div>
            <div className="text-2xl font-extrabold" style={{ color: '#fcd34d' }}>{cuenta('fallo_pago')}</div>
            <div className="text-[11px] mt-1" style={{ color: '#666' }}>Stripe reintenta solo</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Link href="/admin/pagos" className="text-xs font-bold px-3 py-1.5 rounded-xl" style={chip(!tipo)}>Todo</Link>
          {Object.entries(TIPO_UI).map(([k, v]) => (
            <Link key={k} href={`/admin/pagos?tipo=${k}`} className="text-xs font-bold px-3 py-1.5 rounded-xl" style={chip(tipo === k)}>
              {v.label}
            </Link>
          ))}
        </div>

        {/* Tabla */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1f1f1f' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#101010', color: '#888' }}>
                <th className="text-left px-4 py-2.5 text-xs font-bold">Fecha</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold">Cliente</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold">Producto</th>
                <th className="text-right px-4 py-2.5 text-xs font-bold">Monto</th>
                <th className="text-left px-4 py-2.5 text-xs font-bold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-xs" style={{ color: '#666' }}>
                  {tablaFalta ? 'Creá la tabla y los movimientos empiezan a caer solos.' : 'Todavía no hay movimientos registrados — van a aparecer con el próximo evento de Stripe.'}
                </td></tr>
              )}
              {filas.map(f => {
                const ui = TIPO_UI[f.tipo] || { label: f.tipo, color: '#aaa', bg: '#33333318' };
                return (
                  <tr key={f.id} style={{ borderTop: '1px solid #161616' }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: '#888' }}>{fmtFecha(f.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ color: ui.color, background: ui.bg }}>{ui.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{f.email || '—'}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#aaa' }}>{f.producto || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-right font-bold">{f.monto != null ? `$${Number(f.monto).toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-[11px]" style={{ color: '#777' }}>{[f.estado, f.detalle].filter(Boolean).join(' · ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] mt-3" style={{ color: '#555' }}>
          Solo movimientos de esta cuenta de Stripe (ViralADN/TOPCUT/Legacy). Los avisos 🚨 de reembolso, disputa y
          fallo de cobro llegan a {`franciscopierachini03@gmail.com`} al instante.
        </p>
      </div>
    </main>
  );
}
