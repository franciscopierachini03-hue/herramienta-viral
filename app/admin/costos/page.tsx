'use client';

// /admin/costos — dashboard de gasto de TODAS las APIs (solo admin).
// Se refresca solo cada 5 min (el server cachea 15 min las mediciones que
// cuestan requests). «Actualizar» fuerza la lectura; «Medición profunda»
// además mide los respaldos de plan chico (scraptik / FB downloader).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminGate from '../../_components/AdminGate';

type Servicio = {
  key: string;
  icono: string;
  nombre: string;
  costoMes: number | null;
  gastoMes?: number | null;
  limite?: number;
  usado?: number;
  restante?: number;
  unidad?: string;
  detalle?: string;
  nota?: string;
  estado: 'ok' | 'atencion' | 'agotado' | 'roto' | 'sin-dato';
};

type GastoTarjeta = {
  key: string;
  icono: string;
  nombre: string;
  costoMes: number | null;
  ultimo?: number;
  nota?: string;
};

type Data = {
  actualizado: string;
  deep: boolean;
  cacheado?: boolean;
  totalApis: number;
  totalTarjeta: number;
  totalFijo: number;
  variableTarjeta: number;
  gastoVariable: number;
  servicios: Servicio[];
  gastosTarjeta: GastoTarjeta[];
};

const ESTADO: Record<Servicio['estado'], { label: string; color: string; bg: string }> = {
  ok: { label: 'OK', color: '#86efac', bg: '#22c55e22' },
  atencion: { label: 'Atención', color: '#fcd34d', bg: '#eab30822' },
  agotado: { label: 'Agotado', color: '#fda4af', bg: '#ef444422' },
  roto: { label: 'Pendiente', color: '#fda4af', bg: '#ef444422' },
  'sin-dato': { label: 'Sin dato', color: '#9ca3af', bg: '#6b728022' },
};

export default function CostosPage() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async (modo: 'normal' | 'fresh' | 'deep' = 'normal') => {
    setBusy(true); setError('');
    try {
      const qs = modo === 'deep' ? '?deep=1' : modo === 'fresh' ? '?fresh=1' : '';
      const res = await fetch(`/api/admin/costos${qs}`, { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) setError(d.error || `No se pudo leer (HTTP ${res.status}).`);
      else setData(d as Data);
    } catch { setError('Error de conexión.'); }
    setBusy(false);
  }, []);

  // Carga inicial + auto-refresco cada 5 min (usa la caché del server).
  useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), 5 * 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  const hora = data ? new Date(data.actualizado).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <main className="min-h-screen text-white px-6 py-8" style={{ background: '#080808' }}>
      <AdminGate />
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">💸 Costos de APIs</h1>
            <p className="text-xs" style={{ color: '#666' }}>
              {data ? <>Actualizado {hora}{data.cacheado ? ' · (caché del server)' : ''}</> : 'Cargando…'}
              {' · '}se refresca solo cada 5 min
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => void cargar('fresh')} disabled={busy}
              className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#eee' }}>
              {busy ? 'Midiendo…' : '🔄 Actualizar'}
            </button>
            <button onClick={() => void cargar('deep')} disabled={busy}
              title="Además mide scraptik y el downloader de FB (gasta 1 request de cada uno)"
              className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
              style={{ background: '#0d1f12', border: '1px solid #22c55e55', color: '#86efac' }}>
              🔬 Medición profunda
            </button>
            <Link href="/admin" className="text-sm ml-1" style={{ color: '#888' }}>← Panel</Link>
          </div>
        </div>

        {/* Totales */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Fijo mensual</div>
              <div className="text-2xl font-extrabold">${data.totalFijo.toFixed(2)}<span className="text-sm font-normal" style={{ color: '#666' }}>/mes</span></div>
              <div className="text-[11px] mt-1" style={{ color: '#666' }}>APIs ${data.totalApis.toFixed(2)} · tarjeta ${data.totalTarjeta.toFixed(2)}</div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Variable</div>
              <div className="text-2xl font-extrabold">
                {data.servicios.some(s => s.gastoMes != null)
                  ? <>${(data.gastoVariable + data.variableTarjeta).toFixed(2)}</>
                  : <>~${data.variableTarjeta.toFixed(2)}</>}
              </div>
              <div className="text-[11px] mt-1" style={{ color: '#666' }}>
                ads + comisiones{data.servicios.some(s => s.gastoMes != null) ? ' + OpenAI' : ' · OpenAI: falta OPENAI_ADMIN_KEY'}
              </div>
            </div>
            <div className="rounded-2xl p-4 col-span-2 md:col-span-1" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Estimado total</div>
              <div className="text-2xl font-extrabold" style={{ color: '#86efac' }}>
                ${(data.totalFijo + data.gastoVariable + data.variableTarjeta).toFixed(0)}<span className="text-sm font-normal" style={{ color: '#666' }}>/mes</span>
              </div>
            </div>
          </div>
        )}

        {/* Cards por servicio */}
        {data && (
          <div className="grid md:grid-cols-2 gap-3">
            {data.servicios.map(s => {
              const est = ESTADO[s.estado];
              const pct = s.limite && s.usado != null ? Math.min(100, Math.round((s.usado / s.limite) * 100)) : null;
              return (
                <div key={s.key} className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="text-sm font-bold">{s.icono} {s.nombre}</div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: est.bg, color: est.color }}>
                      {est.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-lg font-extrabold">
                      {s.costoMes != null ? (s.costoMes === 0 ? 'Gratis' : `$${s.costoMes}/mes`) : s.gastoMes != null ? `$${s.gastoMes.toFixed(2)} este mes` : '—'}
                    </span>
                    {s.detalle && <span className="text-[11px]" style={{ color: '#888' }}>{s.detalle}</span>}
                  </div>
                  {pct != null && (
                    <>
                      <div className="h-2 rounded-full mb-1" style={{ background: '#1f1f1f' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 85 ? '#f59e0b' : '#22c55e' }} />
                      </div>
                      <div className="flex justify-between text-[11px]" style={{ color: '#888' }}>
                        <span>{s.usado?.toLocaleString('es')} usadas ({pct}%)</span>
                        <span>{s.restante?.toLocaleString('es')} restantes de {s.limite?.toLocaleString('es')} {s.unidad}</span>
                      </div>
                    </>
                  )}
                  {s.nota && <p className="text-[11px] mt-2" style={{ color: '#777' }}>{s.nota}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Gastos de la tarjeta (sin API consultable) */}
        {data && (data.gastosTarjeta?.length ?? 0) > 0 && (
          <>
            <div className="flex items-baseline justify-between mt-8 mb-3">
              <h2 className="text-sm font-bold" style={{ color: '#d4d4dc' }}>💳 Otros gastos de la tarjeta (Mercury ••3883)</h2>
              <span className="text-xs" style={{ color: '#666' }}>
                Subtotal fijo: <b style={{ color: '#eee' }}>${data.totalTarjeta.toFixed(2)}/mes</b>
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {data.gastosTarjeta.map(g => (
                <div key={g.key} className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: g.nota?.startsWith('⚠️') ? '1px solid #a1620a55' : '1px solid #1f1f1f' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-bold">{g.icono} {g.nombre}</div>
                    <span className="text-base font-extrabold shrink-0">
                      {g.costoMes != null ? `$${g.costoMes.toFixed(2)}/mes` : g.ultimo != null ? `~$${g.ultimo.toFixed(2)}` : '—'}
                    </span>
                  </div>
                  {g.nota && <p className="text-[11px] mt-1.5" style={{ color: g.nota.startsWith('⚠️') ? '#fcd34d' : '#777' }}>{g.nota}</p>}
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-2" style={{ color: '#555' }}>
              Estos montos vienen del extracto del banco (no tienen API). Cuando cambie alguno, pedime actualizarlo.
            </p>
          </>
        )}

        {error && (
          <div className="mt-5 rounded-2xl p-4 text-sm" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d55', color: '#fca5a5' }}>{error}</div>
        )}
        {!data && !error && (
          <div className="text-center py-20 text-sm" style={{ color: '#666' }}>Midiendo todas las APIs…</div>
        )}
      </div>
    </main>
  );
}
