'use client';

// 💰 BALANCE DEL MES (del 1 al último día) — la cifra de verdad: las DOS cuentas
// de Stripe + pagos únicos, en USD liquidado y neto de reembolsos. Misma base
// que el CSV de ventas, así que panel/export/Stripe cuadran.

import { useEffect, useState } from 'react';

type Cuenta = { cobros: number; neto: number; configurada?: boolean };
type Motivo = 'producto' | 'metadata' | 'elevation';
type Grande = {
  fecha: string; email: string; nombre: string; neto: number;
  producto: string; cuenta: string; motivo: Motivo; moneda: string; recibo: string;
};
type Resp = {
  mes: string; ventana: string; moneda: string;
  tuyo: {
    cobros: number; bruto: number; reembolsado: number; neto: number;
    por_cuenta: { clicks: Cuenta; elevation: Cuenta };
    por_producto: Record<string, { cobros: number; neto: number }>;
    de_donde_sale?: Record<Motivo, { cobros: number; neto: number }>;
    mas_grandes?: Grande[];
  };
  otros_negocios: { cobros: number; neto: number };
  csv: string;
  error?: string;
};

// Cómo se ganó su lugar cada cobro. "producto" es prueba dura; los otros dos
// son las puertas por donde se puede colar plata que no es tuya.
const MOTIVOS: Record<Motivo, { icono: string; titulo: string; explica: string; color: string }> = {
  producto: {
    icono: '✅', titulo: 'Producto nuestro', color: '#86efac',
    explica: 'La factura es de ViralADN, TOPCUT o Combo. No hay duda posible.',
  },
  metadata: {
    icono: '🟡', titulo: 'Pago suelto etiquetado', color: '#fcd34d',
    explica: 'Cobros sin suscripción, marcados como ViralADN al crearse (ligas de pago, checkout del evento). Si algo ajeno quedó mal etiquetado, entra por acá.',
  },
  elevation: {
    icono: '🔵', titulo: 'Cuenta Elevation', color: '#93c5fd',
    explica: 'TODO lo que cobra la cuenta Elevation se cuenta como tuyo, sin mirar el producto. Si esa cuenta vende otra cosa, se suma igual.',
  },
};

function mesActualCDMX(): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7); }
  catch { return new Date().toISOString().slice(0, 7); }
}
function nombreMes(m: string): string {
  const [y, mm] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function BalanceMes() {
  const [mes, setMes] = useState(mesActualCDMX());
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  function cargar(m: string) {
    setCargando(true); setError(''); setData(null);
    fetch(`/api/admin/balance-mes?mes=${encodeURIComponent(m)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('Error de conexión.'))
      .finally(() => setCargando(false));
  }
  // Solo la carga inicial: al cambiar de mes lo dispara el propio <input>.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(mes); }, []);

  const usd = (n: number) => `$${n.toFixed(2)}`;
  const prods = data ? Object.entries(data.tuyo.por_producto).sort((a, b) => b[1].neto - a[1].neto) : [];

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: 'linear-gradient(145deg, #0a1a12, #0d0d0d)', border: '1px solid #22c55e66' }}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="text-xs font-bold" style={{ color: '#86efac' }}>
          💰 Balance del mes — las 2 cuentas, neto de reembolsos
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={mes} max={mesActualCDMX()}
            onChange={e => { setMes(e.target.value); if (e.target.value) cargar(e.target.value); }}
            className="text-xs px-2 py-1 rounded-lg outline-none"
            style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff', colorScheme: 'dark' }} />
          {data && <a href={data.csv} download className="text-[11px] underline" style={{ color: '#5a8a6a' }}>CSV</a>}
        </div>
      </div>

      {cargando && <div className="text-xs" style={{ color: '#5a8a6a' }}>sumando cobros de las dos cuentas…</div>}
      {error && <div className="text-xs" style={{ color: '#fca5a5' }}>{error}</div>}

      {data && !cargando && (
        <>
          <div className="flex items-end gap-3 flex-wrap mb-2">
            <div>
              <div className="text-3xl font-extrabold" style={{ color: '#86efac' }}>{usd(data.tuyo.neto)}</div>
              <div className="text-[11px] capitalize" style={{ color: '#5a8a6a' }}>{nombreMes(data.mes)} · {data.tuyo.cobros} cobro{data.tuyo.cobros === 1 ? '' : 's'}</div>
            </div>
            {data.tuyo.reembolsado > 0 && (
              <div className="text-[11px]" style={{ color: '#5a8a6a' }}>
                vendido {usd(data.tuyo.bruto)} <span style={{ color: '#fda4af' }}>− {usd(data.tuyo.reembolsado)} reembolsado</span>
              </div>
            )}
          </div>

          <div className="text-[11px] mb-2" style={{ color: '#7dd3a8' }}>
            2CLICKS {usd(data.tuyo.por_cuenta.clicks.neto)} ({data.tuyo.por_cuenta.clicks.cobros})
            {' · '}Elevation {data.tuyo.por_cuenta.elevation.configurada === false
              ? <span style={{ color: '#fcd34d' }}>sin llave ⚠️</span>
              : <>{usd(data.tuyo.por_cuenta.elevation.neto)} ({data.tuyo.por_cuenta.elevation.cobros})</>}
          </div>

          {prods.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {prods.map(([p, v]) => (
                <span key={p} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: '#0a0a12', border: '1px solid #22c55e33', color: '#cbead6' }}>
                  {p}: <b style={{ color: '#86efac' }}>{usd(v.neto)}</b> ({v.cobros})
                </span>
              ))}
            </div>
          )}

          {/* 🔍 De dónde sale el número — para auditar un mes que parece de más */}
          {data.tuyo.de_donde_sale && (
            <details className="mt-3 rounded-xl overflow-hidden" style={{ background: '#0a0a12', border: '1px solid #23232e' }}>
              <summary className="px-3 py-2 cursor-pointer text-[11px] font-bold flex items-center justify-between gap-2"
                style={{ color: '#c9c9d4' }}>
                <span>🔍 ¿De dónde salen estos {usd(data.tuyo.neto)}?</span>
                <span style={{ color: '#666' }}>ver ↓</span>
              </summary>
              <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid #1a1a24' }}>
                <p className="text-[10px] mb-3 mt-2" style={{ color: '#8b8b96' }}>
                  Cada cobro entra por una de estas tres puertas. Si un mes da más de lo que esperabas,
                  el sobrante casi siempre está en las dos de abajo.
                </p>

                {(Object.keys(MOTIVOS) as Motivo[]).map(k => {
                  const v = data.tuyo.de_donde_sale![k];
                  const M = MOTIVOS[k];
                  if (!v || v.cobros === 0) return null;
                  const pct = data.tuyo.neto > 0 ? Math.round((v.neto / data.tuyo.neto) * 100) : 0;
                  return (
                    <div key={k} className="mb-2.5 rounded-lg p-2.5" style={{ background: '#101018', border: '1px solid #23232e' }}>
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <span className="text-[12px] font-bold" style={{ color: M.color }}>{M.icono} {M.titulo}</span>
                        <span className="text-[12px] font-bold" style={{ color: M.color }}>
                          {usd(v.neto)} <span className="font-normal" style={{ color: '#666' }}>· {v.cobros} cobro{v.cobros === 1 ? '' : 's'} · {pct}%</span>
                        </span>
                      </div>
                      <div className="w-full rounded-full mt-1.5 mb-1.5" style={{ height: 5, background: '#1a1a24' }}>
                        <div className="rounded-full" style={{ width: `${pct}%`, height: 5, background: M.color }} />
                      </div>
                      <p className="text-[10px]" style={{ color: '#7a7a86' }}>{M.explica}</p>
                    </div>
                  );
                })}

                {data.tuyo.mas_grandes && data.tuyo.mas_grandes.length > 0 && (
                  <>
                    <p className="text-[11px] font-bold mt-4 mb-1.5" style={{ color: '#c9c9d4' }}>
                      Los cobros más grandes del mes
                    </p>
                    <p className="text-[10px] mb-2" style={{ color: '#7a7a86' }}>
                      Si hay uno acá que no reconocés, ese es el que infla el mes.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <tbody>
                          {data.tuyo.mas_grandes.map((g, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #1a1a24' }}>
                              <td className="py-1.5 pr-2 whitespace-nowrap" style={{ color: '#7a7a86' }}>{g.fecha.slice(5)}</td>
                              <td className="py-1.5 pr-2" style={{ color: '#e8e8ee' }}>
                                {g.email}
                                {g.nombre && <span style={{ color: '#666' }}> · {g.nombre}</span>}
                              </td>
                              <td className="py-1.5 pr-2 whitespace-nowrap" style={{ color: '#9a9aa6' }}>{g.producto}</td>
                              <td className="py-1.5 pr-2 whitespace-nowrap">
                                <span title={MOTIVOS[g.motivo]?.explica} style={{ color: MOTIVOS[g.motivo]?.color }}>
                                  {MOTIVOS[g.motivo]?.icono}
                                </span>
                              </td>
                              <td className="py-1.5 text-right font-bold whitespace-nowrap" style={{ color: '#86efac' }}>
                                {usd(g.neto)}
                                {g.moneda && <span className="font-normal" style={{ color: '#666' }}> ({g.moneda})</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] mt-2" style={{ color: '#5a5a66' }}>
                      ¿Falta contexto? El <a href={data.csv} download style={{ color: '#7dd3a8', textDecoration: 'underline' }}>Excel del mes</a> trae los {data.tuyo.cobros} cobros con nombre, país, comisión y recibo.
                    </p>
                  </>
                )}
              </div>
            </details>
          )}

          <div className="text-[10px] mt-2" style={{ color: '#4a6a55' }}>
            {data.ventana} · {data.moneda}. Otros negocios de la cuenta compartida: {usd(data.otros_negocios.neto)} ({data.otros_negocios.cobros}) — no es tuyo.
          </div>
        </>
      )}
    </div>
  );
}
