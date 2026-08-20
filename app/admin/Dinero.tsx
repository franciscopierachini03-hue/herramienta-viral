'use client';

// 💵 BLOQUE DE PLATA del panel — cobrado hoy · este mes · mes pasado ·
// acumulado · comparativa · histórico · ingreso diario · historial de pagos.
//
// ── Por qué pide MES POR MES ───────────────────────────────────────────────
// El primer intento escaneaba todo el historial (ene→hoy, las 2 cuentas) en un
// solo pedido: se pasaba de los 60s de Vercel, devolvía 504 y las tarjetas
// quedaban en "leyendo Stripe…" para siempre — y encima el cartel decía "no se
// pudo conectar con Stripe", cuando Stripe estaba perfecto.
//
// Ahora se piden los meses EN PARALELO, uno por pedido (/api/admin/balance-mes).
// Cada uno entra holgado, van apareciendo a medida que llegan, y si un mes
// falla los demás se ven igual. El mes en curso y los 2 anteriores se piden con
// detalle (diario, últimos cobros, corte al día de hoy); los viejos, solo el total.
//
// Fuente única (cobrosRango): la misma del Balance del mes y del CSV de ventas
// → las cifras no pueden discrepar entre sí.

import { useEffect, useState } from 'react';
import DailyRevenueChart from './DailyRevenueChart';
import BalanceMes from './BalanceMes';

const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Desde acá se mide el "Total acumulado" (mismo corte que el export histórico).
const INICIO = '2026-01';

type Ultimo = { id: string; email: string; fecha: string; hora: string; neto: number; reembolsado: boolean; producto: string; cuenta: string };
type MesResp = {
  mes: string;
  dias_del_mes: number;
  tuyo: {
    cobros: number; neto: number;
    por_plataforma: Record<string, number>;
    diario: number[];
    ultimos: Ultimo[];
    hasta_dia: { dia: number; cobros: number; neto: number } | null;
  };
  error?: string;
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

// Mientras Stripe responde: una rayita que late, no un $0.00 que se lee como
// "no entró nada".
function Cargando({ w = 74 }: { w?: number }) {
  return <span className="inline-block rounded animate-pulse align-middle" style={{ width: w, height: 22, background: '#2a2a36' }} />;
}

// Lista de meses 'YYYY-MM' desde INICIO hasta el actual, del más viejo al más nuevo.
function mesesDesdeInicio(mesActual: string): string[] {
  const out: string[] = [];
  const [iy, im] = INICIO.split('-').map(Number);
  const [ay, am] = mesActual.split('-').map(Number);
  for (let y = iy, m = im; y < ay || (y === ay && m <= am);) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}
const nombreCorto = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-AR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};
const nombreLargo = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' });
};
// 'YYYY-MM' de n meses antes.
function mesAntes(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function Dinero(p: Props) {
  const [datos, setDatos] = useState<Record<string, MesResp>>({});
  const [fallaron, setFallaron] = useState<string[]>([]);
  const [listo, setListo] = useState(false);

  // Hoy en CDMX, calculado en el navegador (el servidor corre en UTC).
  const hoyStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const mesActual = hoyStr.slice(0, 7);
  const diaHoy = Number(hoyStr.slice(8, 10));

  useEffect(() => {
    let vivo = true;
    const meses = [...new Set([...mesesDesdeInicio(mesActual), p.mesSel])];
    // Con detalle: el mes en curso, los 2 anteriores (comparativa) y el que
    // está mirando en el gráfico. El resto, solo el total.
    const conDetalle = new Set([mesActual, mesAntes(mesActual, 1), mesAntes(mesActual, 2), p.mesSel]);

    for (const mes of meses) {
      const qs = new URLSearchParams({ mes, corte: String(diaHoy) });
      if (!conDetalle.has(mes)) qs.set('detalle', '0');
      fetch(`/api/admin/balance-mes?${qs}`, { cache: 'no-store' })
        .then(r => r.json())
        .then((d: MesResp) => {
          if (!vivo) return;
          if (d.error || !d.tuyo) setFallaron(f => [...f, mes]);
          else setDatos(prev => ({ ...prev, [mes]: d }));
        })
        .catch(() => { if (vivo) setFallaron(f => [...f, mes]); })
        .finally(() => { if (vivo) setListo(true); });
    }
    return () => { vivo = false; };
  }, [p.mesSel, mesActual, diaHoy]);

  const cargados = Object.keys(datos).length;
  const hay = (mes: string) => datos[mes]?.tuyo;
  const neto = (mes: string) => hay(mes)?.neto ?? 0;

  // Cobrado HOY: sale del detalle diario del mes en curso.
  const dHoy = hay(mesActual);
  const cobradoHoy = dHoy ? (dHoy.diario[diaHoy - 1] || 0) : null;
  const cobrosHoy = dHoy ? (dHoy.ultimos.filter(u => u.fecha === hoyStr).length) : 0;

  const mesPasadoKey = mesAntes(mesActual, 1);
  const antepenultimo = mesAntes(mesActual, 2);

  // Acumulado: la suma de todos los meses que ya llegaron.
  const acumulado = Object.values(datos).reduce((a, d) => a + (d.tuyo?.neto || 0), 0);
  const acumuladoCompleto = fallaron.length === 0 && cargados > 0;

  // Últimos 6 meses para el gráfico de barras.
  const seisMeses = Array.from({ length: 6 }, (_, i) => mesAntes(mesActual, 5 - i));

  // Comparativa: los 2 meses anteriores + el actual, al mismo día.
  const comparables = [antepenultimo, mesPasadoKey, mesActual];
  const compaLista = comparables.every(m => hay(m));

  // Gráfico diario del mes elegido.
  const dSel = hay(p.mesSel);
  const [selY, selM] = p.mesSel.split('-').map(Number);
  const daysInMonth = datos[p.mesSel]?.dias_del_mes || new Date(selY, selM, 0).getDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => dSel?.diario?.[i] || 0);
  const dailyTotal = daily.reduce((a, b) => a + b, 0);
  const dailyCount = daily.filter(v => v > 0).length;

  // Historial: los cobros recientes de los meses que trajeron detalle.
  const ultimos = Object.values(datos).flatMap(d => d.tuyo?.ultimos || [])
    .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)).slice(0, 60);

  const prodMes = Object.entries(hay(mesActual)?.por_plataforma || {}).sort((a, b) => b[1] - a[1]);

  return (
    <>
      {listo && fallaron.length > 0 && (
        <div className="rounded-2xl px-4 py-3 mb-3 text-xs"
          style={{ background: '#1a1408', border: '1px solid #f59e0b55', color: '#fcd34d' }}>
          ⚠️ Stripe tardó de más en {fallaron.length === 1 ? 'un mes' : `${fallaron.length} meses`} ({fallaron.map(nombreCorto).join(', ')}).
          Todo lo demás es correcto; el <b>Total acumulado</b> queda corto hasta que recargues.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div className="rounded-2xl p-4"
          style={{ background: 'linear-gradient(145deg, #0a1a12, #0d0d0d)', border: '1px solid #22c55e88' }}>
          <div className="text-xs mb-1 font-bold" style={{ color: '#86efac' }}>💚 Cobrado HOY</div>
          <div className="text-2xl font-extrabold" style={{ color: '#86efac' }}>
            {cobradoHoy === null ? <Cargando /> : fmtUSD(cobradoHoy)}
          </div>
          <div className="text-[11px] mt-1" style={{ color: '#666' }}>
            {cobradoHoy === null ? 'leyendo Stripe…' : `${cobrosHoy} pago${cobrosHoy === 1 ? '' : 's'} hoy (CDMX)`}
          </div>
        </div>

        <div className="rounded-2xl p-4"
          style={{ background: 'linear-gradient(145deg, #1a1030, #0d0d0d)', border: '1px solid #7c3aed66' }}>
          <div className="text-xs mb-1 flex items-center gap-1" style={{ color: '#a78bfa' }}>MRR comprometido</div>
          <div className="text-2xl font-bold" style={{ color: '#c4b5fd' }}>{fmtUSD(p.committedMrr ?? 0)}<span className="text-xs font-normal" style={{ color: '#666' }}>/mes</span></div>
        </div>

        <div className="rounded-2xl p-4" style={{ ...CARD, border: '1px solid #22c55e44' }}>
          <div className="text-xs mb-1" style={{ color: '#666' }}>Cobrado este mes</div>
          <div className="text-2xl font-bold" style={{ color: '#86efac' }}>
            {hay(mesActual) ? fmtUSD(neto(mesActual)) : <Cargando />}
          </div>
          <div className="text-[11px] mt-1" style={{ color: '#888' }}>
            {hay(mesActual)
              ? (prodMes.length ? prodMes.map(([k, v]) => `${k} $${v.toFixed(0)}`).join(' · ') : '—')
              : 'leyendo Stripe…'}
          </div>
        </div>

        <div className="rounded-2xl p-4" style={CARD}>
          <div className="text-xs mb-1" style={{ color: '#666' }}>Mes pasado</div>
          <div className="text-2xl font-bold" style={{ color: '#888' }}>
            {hay(mesPasadoKey) ? fmtUSD(neto(mesPasadoKey)) : <Cargando />}
          </div>
        </div>

        <div className="rounded-2xl p-4" style={CARD}>
          <div className="text-xs mb-1" style={{ color: '#666' }}>Total acumulado</div>
          <div className="text-2xl font-bold" style={{ color: '#c4b5fd' }}>
            {cargados > 0 ? fmtUSD(acumulado) : <Cargando />}
          </div>
          <div className="text-[11px] mt-1" style={{ color: '#666' }}>
            {cargados === 0 ? '' : acumuladoCompleto ? `desde enero de 2026` : `${cargados} meses leídos…`}
          </div>
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
              <div className="text-2xl font-extrabold" style={{ color: '#86efac' }}>
                {hay(mesActual) ? fmtUSD(neto(mesActual) + p.porCobrarEsteMes) : <Cargando />}
              </div>
              <div className="text-[10px] mt-1" style={{ color: '#5a8a6a' }}>
                cobrado {hay(mesActual) ? fmtUSD(neto(mesActual)) : '…'} (del 1 a hoy) + por cobrar {fmtUSD(p.porCobrarEsteMes)} (de hoy al último día)
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

      {/* 📊 Este mes contra los 2 anteriores, en el MISMO tramo del mes */}
      {compaLista && (() => {
        const filas = comparables.map(k => ({
          key: k, label: nombreLargo(k),
          hastaDia: datos[k].tuyo.hasta_dia?.neto ?? 0,
          cobrosHastaDia: datos[k].tuyo.hasta_dia?.cobros ?? 0,
          completo: datos[k].tuyo.neto,
          diasDelMes: datos[k].dias_del_mes,
          enCurso: k === mesActual,
        }));
        const actual = filas[2];
        const max = Math.max(...filas.map(f => f.hastaDia), 1);
        const cierre = actual.completo + p.porCobrarEsteMes;
        return (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'linear-gradient(145deg, #12101f, #0d0d0d)', border: '1px solid #7c3aed44' }}>
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <div className="text-xs font-bold" style={{ color: '#a78bfa' }}>
                📊 <span className="capitalize">{actual.label}</span> contra los 2 meses anteriores
              </div>
              <div className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#8b8b96' }}>
                mismo tramo: del 1 al {diaHoy}
              </div>
            </div>
            <div className="text-[10px] mb-3" style={{ color: '#666' }}>
              <span className="capitalize">{actual.label}</span> va por el día {diaHoy} de {actual.diasDelMes} — compararlo contra meses cerrados diría cualquier cosa, así que se mide contra el mismo tramo de cada mes.
            </div>

            <div className="grid grid-cols-3 gap-3">
              {filas.map(m => {
                const alto = Math.max(6, (m.hastaDia / max) * 100);
                const dif = m.enCurso || m.hastaDia <= 0 ? null
                  : Math.round(((actual.hastaDia - m.hastaDia) / m.hastaDia) * 100);
                return (
                  <div key={m.key} className="rounded-xl p-3"
                    style={m.enCurso
                      ? { background: '#0a1a12', border: '1px solid #22c55e66' }
                      : { background: '#0a0a12', border: '1px solid #23232e' }}>
                    <div className="text-[11px] mb-1 font-semibold" style={{ color: m.enCurso ? '#86efac' : '#8b8b96' }}>
                      <span className="capitalize">{m.label}</span>{m.enCurso ? ' (hoy)' : ''}
                    </div>
                    <div className="text-xl font-extrabold" style={{ color: m.enCurso ? '#86efac' : '#c9c9d4' }}>{fmtUSD(m.hastaDia)}</div>
                    <div className="text-[10px] mb-2" style={{ color: '#666' }}>
                      {m.cobrosHastaDia} cobro{m.cobrosHastaDia === 1 ? '' : 's'} al día {diaHoy}
                    </div>

                    <div className="w-full rounded-full mb-2" style={{ height: 8, background: '#1a1a24' }}>
                      <div className="rounded-full" style={{
                        width: `${alto}%`, height: 8,
                        background: m.enCurso ? 'linear-gradient(90deg, #22c55e, #86efac)' : 'linear-gradient(90deg, #7c3aed, #c13584)',
                      }} />
                    </div>

                    {m.enCurso ? (
                      <div className="text-[10px]" style={{ color: '#5a8a6a' }}>
                        cierre estimado <b style={{ color: '#86efac' }}>{fmtUSD(cierre)}</b>
                        <br />faltan {m.diasDelMes - diaHoy} día{m.diasDelMes - diaHoy === 1 ? '' : 's'}
                      </div>
                    ) : (
                      <div className="text-[10px]" style={{ color: '#8b8b96' }}>
                        cerró en <b style={{ color: '#c9c9d4' }}>{fmtUSD(m.completo)}</b>
                        {dif !== null && (
                          // El sujeto es el mes EN CURSO: "agosto está 47% abajo
                          // que julio a esta altura" — no al revés.
                          <><br /><span className="capitalize">{actual.label}</span> está{' '}
                            <span style={{ color: dif >= 0 ? '#86efac' : '#fca5a5', fontWeight: 700 }}>
                              {dif >= 0 ? '▲' : '▼'} {Math.abs(dif)}%
                            </span></>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[10px] mt-3" style={{ color: '#666' }}>
              💡 El número grande de cada mes es lo que había entrado <b style={{ color: '#8b8b96' }}>al día {diaHoy}</b> — comparable entre sí. Abajo, cómo cerró el mes completo. El cierre estimado de {actual.label} suma lo cobrado + las renovaciones que faltan.
            </div>
          </div>
        );
      })()}

      {/* Histórico mensual (mini-bar chart con divs) */}
      <div className="rounded-2xl p-4 mb-4" style={CARD}>
        <div className="text-xs mb-3" style={{ color: '#666' }}>Últimos 6 meses</div>
        <div className="flex items-end gap-2 h-24">
          {seisMeses.map(k => {
            const v = hay(k)?.neto ?? null;
            const max = Math.max(...seisMeses.map(x => hay(x)?.neto ?? 0), 1);
            const h = v === null ? 4 : Math.max(4, (v / max) * 100);
            return (
              <div key={k} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div className="text-[10px] font-semibold" style={{ color: '#888' }}>
                  {v === null ? '' : v > 0 ? fmtUSD(v) : ''}
                </div>
                <div className={v === null ? 'w-full rounded-t-lg animate-pulse' : 'w-full rounded-t-lg'}
                  style={{
                    height: v === null ? '20%' : `${h}%`,
                    background: v === null ? '#2a2a36' : v > 0 ? 'linear-gradient(180deg, #7c3aed, #c13584)' : '#1a1a1a',
                    minHeight: '4px',
                  }}
                  title={hay(k) ? `${hay(k)!.cobros} cobros` : 'leyendo…'} />
                <div className="text-[10px]" style={{ color: '#666' }}>{nombreCorto(k)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ingreso diario del mes (eje X = días, eje Y = $) */}
      <div id="ingreso-diario" className="rounded-2xl p-4 mb-4" style={CARD}>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="text-xs" style={{ color: '#666' }}>
            📈 Ingreso diario — <span style={{ color: '#c4b5fd', textTransform: 'capitalize' }}>{p.monthLabel}</span>
          </div>
          <div className="text-xs" style={{ color: '#888' }}>
            {dSel ? <>{fmtUSD(dailyTotal)} · {dailyCount} día{dailyCount === 1 ? '' : 's'} con pagos</> : 'leyendo Stripe…'}
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
        {dSel && dailyTotal === 0 && (
          <div className="text-center text-xs mt-1" style={{ color: '#555' }}>Sin ingresos cobrados en {p.monthLabel}.</div>
        )}
      </div>

      {/* Lista de pagos recientes */}
      {ultimos.length > 0 && (
        <details className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <summary className="px-4 py-3 cursor-pointer text-sm font-semibold flex items-center justify-between" style={{ color: '#aaa' }}>
            <span>Historial de pagos ({ultimos.length})</span>
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
                {ultimos.map(pay => (
                  <tr key={pay.id} style={{ borderBottom: '1px solid #141414' }}>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#888' }}>{pay.fecha} {pay.hora}</td>
                    <td className="px-4 py-3" style={{ color: '#eee' }}>{pay.email || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#a78bfa' }}>{pay.producto}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: '#86efac' }}>{fmtUSD(pay.neto)} USD</td>
                    <td className="px-4 py-3">
                      {pay.reembolsado
                        ? <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#7f1d1d33', color: '#fca5a5' }}>Reembolsado</span>
                        : <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#22c55e22', color: '#86efac' }}>Pagado</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
