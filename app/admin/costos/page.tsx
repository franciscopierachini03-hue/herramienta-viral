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
  grupo: 'viraladn' | 'otros';
  costoMes: number | null;
  ultimo?: number;
  nota?: string;
};

type Data = {
  actualizado: string;
  deep: boolean;
  cacheado?: boolean;
  totalViralAdn: number;
  totalApis: number;
  totalOtros: number;
  variableOtros: number;
  gastoVariable: number;
  totalFijo: number;
  servicios: Servicio[];
  tarjetaViral: GastoTarjeta[];
  tarjetaOtros: GastoTarjeta[];
};

const ESTADO: Record<Servicio['estado'], { label: string; color: string; bg: string }> = {
  ok: { label: 'OK', color: '#86efac', bg: '#22c55e22' },
  atencion: { label: 'Atención', color: '#fcd34d', bg: '#eab30822' },
  agotado: { label: 'Agotado', color: '#fda4af', bg: '#ef444422' },
  roto: { label: 'Pendiente', color: '#fda4af', bg: '#ef444422' },
  'sin-dato': { label: 'Sin dato', color: '#9ca3af', bg: '#6b728022' },
};

type Salud = { servicio: string; estado: 'ok' | 'alerta' | 'roto'; detalle: string };

export default function CostosPage() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [salud, setSalud] = useState<Salud[] | null>(null);
  const [saludBusy, setSaludBusy] = useState(false);

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

  // Vigilante de salud: prueba las 4 plataformas + cuotas (noalert=1 → no manda
  // email en el chequeo manual; el cron sí alerta cuando corre solo).
  const chequearSalud = useCallback(async () => {
    setSaludBusy(true);
    try {
      const res = await fetch('/api/cron/health?noalert=1', { cache: 'no-store' });
      const d = await res.json();
      if (res.ok || d.checks) setSalud(d.checks as Salud[]);
    } catch { /* ignore */ }
    setSaludBusy(false);
  }, []);

  // Carga inicial + auto-refresco cada 5 min (usa la caché del server).
  useEffect(() => {
    void cargar();
    void chequearSalud();
    const t = setInterval(() => void cargar(), 5 * 60_000);
    return () => clearInterval(t);
  }, [cargar, chequearSalud]);

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

        {/* Vigilante de salud — prueba las herramientas en vivo + alerta por email (cron 2×/día) */}
        <div className="rounded-2xl p-4 mb-6" style={{ background: 'linear-gradient(145deg, #0c130f, #0a0d0b)', border: '1px solid #1d3b34' }}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div className="text-sm font-bold" style={{ color: '#86efac' }}>
              🩺 Salud de las herramientas
              {salud && (salud.every(s => s.estado === 'ok')
                ? <span className="ml-2 text-xs font-normal" style={{ color: '#86efac' }}>· todo OK</span>
                : <span className="ml-2 text-xs font-normal" style={{ color: '#fca5a5' }}>· {salud.filter(s => s.estado !== 'ok').length} con problemas</span>)}
            </div>
            <button onClick={() => void chequearSalud()} disabled={saludBusy}
              className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
              style={{ background: '#0d1f12', border: '1px solid #22c55e55', color: '#86efac' }}>
              {saludBusy ? 'Probando…' : '🩺 Chequear ahora'}
            </button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(salud || []).map(s => {
              const c = s.estado === 'ok' ? '#86efac' : s.estado === 'alerta' ? '#fcd34d' : '#fca5a5';
              const icon = s.estado === 'ok' ? '✅' : s.estado === 'alerta' ? '⚠️' : '🚨';
              return (
                <div key={s.servicio} className="rounded-xl px-3 py-2" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                  <div className="text-xs font-bold" style={{ color: '#e6e6ee' }}>{icon} {s.servicio}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: c }}>{s.detalle}</div>
                </div>
              );
            })}
            {!salud && <div className="text-xs" style={{ color: '#666' }}>Probando las herramientas…</div>}
          </div>
          <p className="text-[11px] mt-2" style={{ color: '#555' }}>
            Corre solo 2× al día y te manda un email a {`franciscopierachini03@gmail.com`} si algo se cae o está por agotarse — antes que lo note un usuario.
          </p>
        </div>

        {/* Totales — ViralADN separado del resto del negocio */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #10141f, #0b0d14)', border: '1px solid #7c3aed44' }}>
              <div className="text-xs mb-1" style={{ color: '#a78bfa' }}>🧬 ViralADN (plataforma)</div>
              <div className="text-2xl font-extrabold">${data.totalViralAdn.toFixed(2)}<span className="text-sm font-normal" style={{ color: '#666' }}>/mes</span></div>
              <div className="text-[11px] mt-1" style={{ color: '#666' }}>
                APIs ${data.totalApis.toFixed(2)}
                {data.totalViralAdn > data.totalApis ? ` · tarjeta $${(data.totalViralAdn - data.totalApis).toFixed(2)}` : ''}
                {data.servicios.some(s => s.gastoMes != null) ? ` · +$${data.gastoVariable.toFixed(2)} OpenAI` : ' · OpenAI: falta OPENAI_ADMIN_KEY'}
              </div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#888' }}>🏢 Otros negocios (misma tarjeta)</div>
              <div className="text-2xl font-extrabold">${data.totalOtros.toFixed(2)}<span className="text-sm font-normal" style={{ color: '#666' }}>/mes</span></div>
              <div className="text-[11px] mt-1" style={{ color: '#666' }}>+ ~${data.variableOtros.toFixed(2)} variable (ads + comisiones)</div>
            </div>
            <div className="rounded-2xl p-4 col-span-2 md:col-span-1" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>Todo junto (estimado)</div>
              <div className="text-2xl font-extrabold" style={{ color: '#86efac' }}>
                ${(data.totalFijo + data.gastoVariable + data.variableOtros).toFixed(0)}<span className="text-sm font-normal" style={{ color: '#666' }}>/mes</span>
              </div>
            </div>
          </div>
        )}

        {/* Título de la sección ViralADN */}
        {data && (
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: '#c4b5fd' }}>🧬 Costos de ViralADN — APIs de la plataforma (medición en vivo)</h2>
            <span className="text-xs" style={{ color: '#666' }}>
              Subtotal: <b style={{ color: '#eee' }}>${data.totalViralAdn.toFixed(2)}/mes</b>
            </span>
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

        {/* Extras de ViralADN en la tarjeta (ej. Apify legado) */}
        {data && (data.tarjetaViral?.length ?? 0) > 0 && (
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            {data.tarjetaViral.map(g => (
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
        )}

        {/* Otros gastos del negocio (misma tarjeta, NO ViralADN) */}
        {data && (data.tarjetaOtros?.length ?? 0) > 0 && (
          <>
            <div className="flex items-baseline justify-between mt-8 mb-3">
              <h2 className="text-sm font-bold" style={{ color: '#d4d4dc' }}>🏢 Otros gastos del negocio — misma tarjeta, no son de ViralADN</h2>
              <span className="text-xs" style={{ color: '#666' }}>
                Subtotal fijo: <b style={{ color: '#eee' }}>${data.totalOtros.toFixed(2)}/mes</b> + ~${data.variableOtros.toFixed(2)} variable
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {data.tarjetaOtros.map(g => (
                <div key={g.key} className="rounded-2xl p-4" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-bold">{g.icono} {g.nombre}</div>
                    <span className="text-base font-extrabold shrink-0">
                      {g.costoMes != null ? `$${g.costoMes.toFixed(2)}/mes` : g.ultimo != null ? `~$${g.ultimo.toFixed(2)}` : '—'}
                    </span>
                  </div>
                  {g.nota && <p className="text-[11px] mt-1.5" style={{ color: '#777' }}>{g.nota}</p>}
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-2" style={{ color: '#555' }}>
              Los montos de tarjeta vienen del extracto del banco (no tienen API). Cuando cambie alguno, pedime actualizarlo.
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
