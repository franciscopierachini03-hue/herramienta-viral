'use client';

// 💰 BALANCE DEL MES (del 1 al último día) — la cifra de verdad: las DOS cuentas
// de Stripe + pagos únicos, en USD liquidado y neto de reembolsos. Misma base
// que el CSV de ventas, así que panel/export/Stripe cuadran.

import { useEffect, useState } from 'react';

type Cuenta = { cobros: number; neto: number; configurada?: boolean };
type Resp = {
  mes: string; ventana: string; moneda: string;
  tuyo: {
    cobros: number; bruto: number; reembolsado: number; neto: number;
    por_cuenta: { clicks: Cuenta; elevation: Cuenta };
    por_producto: Record<string, { cobros: number; neto: number }>;
  };
  otros_negocios: { cobros: number; neto: number };
  csv: string;
  error?: string;
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
  useEffect(() => { cargar(mes); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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

          <div className="text-[10px] mt-2" style={{ color: '#4a6a55' }}>
            {data.ventana} · {data.moneda}. Otros negocios de la cuenta compartida: {usd(data.otros_negocios.neto)} ({data.otros_negocios.cobros}) — no es tuyo.
          </div>
        </>
      )}
    </div>
  );
}
