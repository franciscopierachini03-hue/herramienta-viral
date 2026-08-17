'use client';

// 💵 BLOQUE DE PLATA del panel — cobrado hoy · este mes · mes pasado ·
// acumulado · histórico · ingreso diario · historial de pagos.
//
// Carga del lado del navegador (/api/admin/dinero) a propósito: escanear los
// cobros de las 2 cuentas DENTRO del render de /admin tumbaba la página por
// timeout de 60s. Así el panel abre al instante y las cifras entran solas unos
// segundos después; si Stripe tarda o falla, el resto del panel sigue vivo.
//
// Fuente única (lib/dinero → cobrosRango): la misma del Balance del mes y del
// CSV de ventas → las cifras no pueden discrepar entre sí.

import { useEffect, useState } from 'react';
import DailyRevenueChart from './DailyRevenueChart';
import BalanceMes from './BalanceMes';

const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tramo = { neto: number; bruto: number; reembolsado: number; cobros: number; porProducto: Array<[string, number]> };
type PagoLinea = { id: string; email: string; date: string; amount: number; currency: string; product: string; refunded: boolean; cuenta: string };
type Resp = {
  ok: boolean; error?: string;
  hoy: Tramo; mes: Tramo; mesPasado: Tramo; acumulado: Tramo;
  meses: Array<{ label: string; neto: number; cobros: number }>;
  diario: number[]; ultimos: PagoLinea[]; desdeLabel: string;
};

type Props = {
  mesSel: string;                                   // 'YYYY-MM' del gráfico diario
  monthLabel: string;
  monthOptions: Array<{ val: string; label: string; href: string }>;
  // Datos de SUSCRIPCIONES (ya vienen del servidor, son baratos)
  committedMrr: number;
  activeSubscriptions: number;
  porCobrarEsteMes: number;
  bonoMrr: number;
  esperadoMesQueVieneCal: number;
  mesActualLabel: string;
  mesProximoLabel: string;
  porCancelar: number;
  mostrarEsperado: boolean;
};

const CARD = { background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' } as const;

// Placeholder mientras Stripe responde: una rayita que late en vez de un $0.00
// que se lee como "no entró nada".
function Cargando() {
  return <span className="inline-block rounded animate-pulse" style={{ width: 74, height: 22, background: '#2a2a36' }} />;
}

export default function Dinero(p: Props) {
  const [d, setD] = useState<Resp | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setD(null); setError('');
    fetch(`/api/admin/dinero?mes=${encodeURIComponent(p.mesSel)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(x => { if (!vivo) return; if (x.error && !x.hoy) setError(x.error); else setD(x); })
      .catch(() => { if (vivo) setError('No se pudo conectar con Stripe.'); });
    return () => { vivo = false; };
  }, [p.mesSel]);

  const [selY, selM] = p.mesSel.split('-').map(Number);
  const daysInMonth = new Date(selY, selM, 0).getDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => d?.diario?.[i] || 0);
  const dailyTotal = daily.reduce((a, b) => a + b, 0);
  const dailyCount = daily.filter(v => v > 0).length;

  return (
    <>
      {(error || d?.error) && (
        <div className="rounded-2xl px-4 py-3 mb-3 text-xs"
          style={{ background: '#1a0d0d', border: '1px solid #ef444455', color: '#fca5a5' }}>
          ⚠️ No se pudieron leer los cobros de Stripe ({error || d?.error}) — las cifras de plata están incompletas. Recargá en un minuto.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div className="rounded-2xl p-4"
          style={{ background: 'linear-gradient(145deg, #0a1a12, #0d0d0d)', border: '1px solid #22c55e88' }}>
          <div className="text-xs mb-1 font-bold" style={{ color: '#86efac' }}>💚 Cobrado HOY</div>
          <div className="text-2xl font-extrabold" style={{ color: '#86efac' }}>{d ? fmtUSD(d.hoy.neto) : <Cargando />}</div>
          <div className="text-[11px] mt-1" style={{ color: '#666' }}>
            {d ? (
              <>
                {d.hoy.cobros} pago{d.hoy.cobros === 1 ? '' : 's'} hoy (CDMX)
                {d.hoy.porProducto.length > 0 && <span style={{ color: '#86efac' }}> · {d.hoy.porProducto.map(([k, v]) => `${k} $${v.toFixed(0)}`).join(' · ')}</span>}
              </>
            ) : 'leyendo Stripe…'}
          </div>
        </div>

        <div className="rounded-2xl p-4"
          style={{ background: 'linear-gradient(145deg, #1a1030, #0d0d0d)', border: '1px solid #7c3aed66' }}>
          <div className="text-xs mb-1 flex items-center gap-1" style={{ color: '#a78bfa' }}>MRR comprometido</div>
          <div className="text-2xl font-bold" style={{ color: '#c4b5fd' }}>{fmtUSD(p.committedMrr ?? 0)}<span className="text-xs font-normal" style={{ color: '#666' }}>/mes</span></div>
        </div>

        <div className="rounded-2xl p-4" style={{ ...CARD, border: '1px solid #22c55e44' }}>
          <div className="text-xs mb-1" style={{ color: '#666' }}>Cobrado este mes</div>
          <div className="text-2xl font-bold" style={{ color: '#86efac' }}>{d ? fmtUSD(d.mes.neto) : <Cargando />}</div>
          <div className="text-[11px] mt-1" style={{ color: '#888' }}>
            {d ? (d.mes.porProducto.length ? d.mes.porProducto.map(([k, v]) => `${k} $${v.toFixed(0)}`).join(' · ') : '—') : 'leyendo Stripe…'}
          </div>
        </div>

        <div className="rounded-2xl p-4" style={CARD}>
          <div className="text-xs mb-1" style={{ color: '#666' }}>Mes pasado</div>
          <div className="text-2xl font-bold" style={{ color: '#888' }}>{d ? fmtUSD(d.mesPasado.neto) : <Cargando />}</div>
        </div>

        <div className="rounded-2xl p-4" style={CARD}>
          <div className="text-xs mb-1" style={{ color: '#666' }}>Total acumulado</div>
          <div className="text-2xl font-bold" style={{ color: '#c4b5fd' }}>{d ? fmtUSD(d.acumulado.neto) : <Cargando />}</div>
          <div className="text-[11px] mt-1" style={{ color: '#666' }}>{d?.desdeLabel ? `desde ${d.desdeLabel}` : ''}</div>
        </div>

        <div className="rounded-2xl p-4" style={CARD}>
          <div className="text-xs mb-1" style={{ color: '#666' }}>Suscripciones activas</div>
          <div className="text-2xl font-bold" style={{ color: '#fff' }}>{p.activeSubscriptions}</div>
        </div>
      </div>

      {/* 💰 Balance del mes — las 2 cuentas, dato duro */}
      <BalanceMes />

      {/* 📆 Facturación por MES CALENDARIO (del día 1 al último día) */}
      {p.mostrarEsperado && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'linear-gradient(145deg, #12101f, #0d0d0d)', border: '1px solid #7c3aed44' }}>
          <div className="text-xs mb-3 font-bold flex items-center gap-1" style={{ color: '#a78bfa' }}>
            📆 Esperado a facturar — mes calendario (del 1 al último día)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl p-3" style={{ background: '#0a1a12', border: '1px solid #22c55e44' }}>
              <div className="text-[11px] mb-1 capitalize" style={{ color: '#7dd3a8' }}>📅 {p.mesActualLabel || 'Este mes'} completo (1 → último día)</div>
              <div className="text-2xl font-extrabold" style={{ color: '#86efac' }}>{d ? fmtUSD(d.mes.neto + p.porCobrarEsteMes) : <Cargando />}</div>
              <div className="text-[10px] mt-1" style={{ color: '#5a8a6a' }}>
                cobrado {d ? fmtUSD(d.mes.neto) : '…'} (del 1 a hoy) + por cobrar {fmtUSD(p.porCobrarEsteMes)} (de hoy al último día)
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ background: '#1a1408', border: '1px solid #f59e0b44' }}>
              <div className="text-[11px] mb-1" style={{ color: '#fcd34d' }}>En bono/descuento ahora</div>
              <div className="text-2xl font-extrabold" style={{ color: '#fcd34d' }}>{fmtUSD(p.bonoMrr)}<span className="text-xs font-normal" style={{ color: '#a98b3a' }}>/mes</span></div>
              <div className="text-[10px] mt-1" style={{ color: '#a98b3a' }}>hoy paga $0 → entra full cuando el bono termina</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: '#12101f', border: '1px solid #7c3aed66' }}>
              <div className="text-[11px] mb-1 capitalize" style={{ color: '#c4b5fd' }}>📅 {p.mesProximoLabel || 'Mes que viene'} (1 → último día)</div>
              <div className="text-2xl font-extrabold" style={{ color: '#c4b5fd' }}>{fmtUSD(p.esperadoMesQueVieneCal)}</div>
              <div className="text-[10px] mt-1" style={{ color: '#8b7fb0' }}>
                renovaciones que caen en {p.mesProximoLabel || 'el próximo mes'}{p.porCancelar > 0 ? ` · ${p.porCancelar} por cancelar ya restadas` : ''}
              </div>
            </div>
          </div>
          <div className="text-[10px] mt-3" style={{ color: '#666' }}>
            💡 Cada tarjeta es un mes de calendario: lo del 1 a hoy es cobrado en serio (neto de reembolsos) y lo que falta sale de la PRÓXIMA factura exacta de cada suscripción (bonos y descuentos ya aplicados). Referencia: MRR comprometido {fmtUSD(p.committedMrr)} (precio de lista, sin restar bonos).
          </div>
        </div>
      )}

      {/* Histórico mensual (mini-bar chart con divs) */}
      {d && d.meses.length > 0 && (
        <div className="rounded-2xl p-4 mb-4" style={CARD}>
          <div className="text-xs mb-3" style={{ color: '#666' }}>Últimos 6 meses</div>
          <div className="flex items-end gap-2 h-24">
            {d.meses.map(m => {
              const max = Math.max(...d.meses.map(x => x.neto), 1);
              const h = Math.max(4, (m.neto / max) * 100);
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div className="text-[10px] font-semibold" style={{ color: '#888' }}>{m.neto > 0 ? fmtUSD(m.neto) : ''}</div>
                  <div className="w-full rounded-t-lg"
                    style={{
                      height: `${h}%`,
                      background: m.neto > 0 ? 'linear-gradient(180deg, #7c3aed, #c13584)' : '#1a1a1a',
                      minHeight: '4px',
                    }}
                    title={`${m.cobros} cobro${m.cobros !== 1 ? 's' : ''}`} />
                  <div className="text-[10px]" style={{ color: '#666' }}>{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ingreso diario del mes (eje X = días, eje Y = $) */}
      <div id="ingreso-diario" className="rounded-2xl p-4 mb-4" style={CARD}>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="text-xs" style={{ color: '#666' }}>
            📈 Ingreso diario — <span style={{ color: '#c4b5fd', textTransform: 'capitalize' }}>{p.monthLabel}</span>
          </div>
          <div className="text-xs" style={{ color: '#888' }}>
            {d ? <>{fmtUSD(dailyTotal)} · {dailyCount} día{dailyCount === 1 ? '' : 's'} con pagos</> : 'leyendo Stripe…'}
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap mb-3">
          {p.monthOptions.map(o => {
            const active = o.val === p.mesSel;
            return (
              <a key={o.val} href={o.href} className="text-xs px-2.5 py-1 rounded-full transition-all"
                style={active
                  ? { background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: '#fff', fontWeight: 600 }
                  : { background: '#141414', border: '1px solid #222', color: '#888' }}>
                {o.label}
              </a>
            );
          })}
        </div>

        <DailyRevenueChart daily={daily} year={selY} month={selM} daysInMonth={daysInMonth} />
        {d && dailyTotal === 0 && (
          <div className="text-center text-xs mt-1" style={{ color: '#555' }}>Sin ingresos cobrados en {p.monthLabel}.</div>
        )}
      </div>

      {/* Lista de pagos recientes */}
      {d && d.ultimos.length > 0 && (
        <details className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <summary className="px-4 py-3 cursor-pointer text-sm font-semibold flex items-center justify-between" style={{ color: '#aaa' }}>
            <span>Historial de pagos ({d.ultimos.length})</span>
            <span className="text-xs" style={{ color: '#666' }}>Click para expandir ↓</span>
          </summary>
          <div className="overflow-x-auto" style={{ borderTop: '1px solid #1a1a1a' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: '#666', borderBottom: '1px solid #1a1a1a' }}>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Monto</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {d.ultimos.map(pay => {
                  const f = new Date(pay.date);
                  return (
                    <tr key={pay.id} style={{ borderBottom: '1px solid #141414' }}>
                      <td className="px-4 py-3 text-xs" style={{ color: '#888' }}>
                        {f.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}{' '}
                        {f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3" style={{ color: '#eee' }}>{pay.email || '—'}</td>
                      <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#a78bfa' }}>{pay.product}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: '#86efac' }}>{fmtUSD(pay.amount)} {pay.currency}</td>
                      <td className="px-4 py-3">
                        {pay.refunded
                          ? <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#7f1d1d33', color: '#fca5a5' }}>Reembolsado</span>
                          : <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#22c55e22', color: '#86efac' }}>Pagado</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
