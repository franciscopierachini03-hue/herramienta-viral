'use client';

// 📅 Selector de día para /admin/pagos — "¿qué pagos entraron el <fecha>?".
// Llama a /api/admin/pagos-dia (cobros del día en hora CDMX desde Stripe 2CLICKS,
// separando lo tuyo de otros negocios). Elegís la fecha y se actualiza al toque.

import { useEffect, useState } from 'react';

type Detalle = { hora: string; email: string; monto: number; refund: number; producto: string; estado: string; viralAdn: boolean };
type Resp = {
  fecha: string; zona: string;
  tuyo_viraladn: { cobros: number; total: number; bruto: number; reembolsado: number; neto: number; detalle: Detalle[] };
  otros_negocios: { cobros: number; total: number };
  reembolsos_del_dia: number;
};

function hoyCDMX(): string {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); }
  catch { return new Date().toISOString().slice(0, 10); }
}
function sumarDias(f: string, dias: number): string {
  const [y, m, d] = f.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}
function fechaLinda(f: string): string {
  const [y, m, d] = f.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${dias[dt.getUTCDay()]} ${dt.getUTCDate()} de ${meses[dt.getUTCMonth()]}`;
}

export default function PagosDia() {
  const hoy = hoyCDMX();
  const [fecha, setFecha] = useState(hoy);
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  function cargar(f: string) {
    setCargando(true); setError('');
    fetch(`/api/admin/pagos-dia?fecha=${encodeURIComponent(f)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); setData(null); } else setData(d); })
      .catch(() => setError('Error de conexión.'))
      .finally(() => setCargando(false));
  }
  useEffect(() => { cargar(hoy); /* carga hoy al abrir */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function elegir(f: string) { if (!f) return; setFecha(f); cargar(f); }

  const card = { background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' } as const;
  const btn = (activo: boolean) => ({
    background: activo ? '#166534' : '#14141f',
    border: `1px solid ${activo ? '#22c55e55' : '#2a2a36'}`,
    color: activo ? '#86efac' : '#a1a1aa',
  });
  const ayer = sumarDias(hoy, -1);

  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-bold" style={{ color: '#d4d4dc' }}>📅 Pagos que entraron un día puntual</h2>
        <span className="text-[11px]" style={{ color: '#666' }}>hora Ciudad de México · en vivo desde Stripe (2CLICKS)</span>
      </div>

      {/* Selector */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input type="date" value={fecha} max={hoy} onChange={e => elegir(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl outline-none"
          style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff', colorScheme: 'dark' }} />
        <button onClick={() => elegir(hoy)} className="text-xs font-bold px-3 py-2 rounded-xl" style={btn(fecha === hoy)}>Hoy</button>
        <button onClick={() => elegir(ayer)} className="text-xs font-bold px-3 py-2 rounded-xl" style={btn(fecha === ayer)}>Ayer</button>
        {cargando && <span className="text-xs" style={{ color: '#888' }}>cargando…</span>}
      </div>

      {error && (
        <div className="rounded-2xl p-4 text-sm" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d55', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {data && !error && (
        <>
          {/* Resumen del día */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div className="rounded-2xl p-4 sm:col-span-1" style={{ background: '#0a1a12', border: '1px solid #22c55e55' }}>
              <div className="text-xs mb-1" style={{ color: '#7dd3a8' }}>🧬 TUYO (ViralADN) el {fechaLinda(data.fecha)}</div>
              <div className="text-2xl font-extrabold" style={{ color: '#86efac' }}>${data.tuyo_viraladn.neto.toFixed(0)}</div>
              {data.tuyo_viraladn.reembolsado > 0 ? (
                <div className="text-[11px] mt-1" style={{ color: '#5a8a6a' }}>
                  vendido ${data.tuyo_viraladn.bruto.toFixed(0)} <span style={{ color: '#fda4af' }}>− reembolsado ${data.tuyo_viraladn.reembolsado.toFixed(0)}</span> = neto · {data.tuyo_viraladn.cobros} cobro{data.tuyo_viraladn.cobros === 1 ? '' : 's'}
                </div>
              ) : (
                <div className="text-[11px] mt-1" style={{ color: '#5a8a6a' }}>{data.tuyo_viraladn.cobros} cobro{data.tuyo_viraladn.cobros === 1 ? '' : 's'} · sin reembolsos</div>
              )}
            </div>
            <div className="rounded-2xl p-4" style={card}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>🏢 Otros negocios</div>
              <div className="text-2xl font-extrabold" style={{ color: '#888' }}>${data.otros_negocios.total.toFixed(0)}</div>
              <div className="text-[11px] mt-1" style={{ color: '#555' }}>{data.otros_negocios.cobros} cobros · no es tuyo</div>
            </div>
            <div className="rounded-2xl p-4" style={card}>
              <div className="text-xs mb-1" style={{ color: '#666' }}>↩️ Reembolsos del día</div>
              <div className="text-2xl font-extrabold" style={{ color: data.reembolsos_del_dia ? '#fda4af' : '#fff' }}>{data.reembolsos_del_dia}</div>
              <div className="text-[11px] mt-1" style={{ color: '#555' }}>en toda la cuenta</div>
            </div>
          </div>

          {/* Detalle de TUS cobros */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1f1f1f' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#101010', color: '#888' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-bold">Hora</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold">Cliente</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold">Producto</th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold">Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.tuyo_viraladn.detalle.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-xs" style={{ color: '#666' }}>
                    No entró ningún pago tuyo ese día.
                  </td></tr>
                )}
                {data.tuyo_viraladn.detalle.map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #161616' }}>
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: '#888' }}>{c.hora}</td>
                    <td className="px-4 py-2.5 text-xs">{c.email}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#aaa' }}>{c.producto}</td>
                    <td className="px-4 py-2.5 text-xs text-right font-bold" style={{ color: c.refund > 0 ? '#fda4af' : '#86efac' }}>
                      ${c.monto.toFixed(2)}
                      {c.refund > 0 && (
                        <div className="text-[10px] font-normal" style={{ color: '#fda4af' }}>
                          🔴 −${c.refund.toFixed(2)} reemb.{c.refund >= c.monto ? ' (total)' : ' (parcial)'}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
