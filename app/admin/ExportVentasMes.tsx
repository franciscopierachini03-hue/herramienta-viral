'use client';

// 💵 Exportar ventas de UN MES calendario (CSV) — /admin toolbar.
// Elegís el mes y baja viraladn-ventas-YYYY-MM.csv con la base COMPLETA
// (2CLICKS + Elevation + pagos únicos, USD liquidado, neto de reembolsos).
// El link "todo" conserva el histórico completo de siempre.

import { useState } from 'react';

function mesActualCDMX(): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7); }
  catch { return new Date().toISOString().slice(0, 7); }
}

export default function ExportVentasMes() {
  const [mes, setMes] = useState(mesActualCDMX());

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="month" value={mes} max={mesActualCDMX()}
        onChange={e => setMes(e.target.value)}
        className="text-xs px-2 py-1.5 rounded-lg outline-none"
        style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff', colorScheme: 'dark' }}
        aria-label="Mes a exportar"
      />
      <a
        href={mes ? `/api/admin/export?type=ventas&mes=${encodeURIComponent(mes)}` : '#'}
        download
        className="px-3 py-1.5 rounded-xl text-xs font-bold"
        style={{ background: '#0d1f12', border: '1px solid #22c55e55', color: '#86efac', pointerEvents: mes ? 'auto' : 'none', opacity: mes ? 1 : 0.5 }}>
        💵 Exportar ventas del mes
      </a>
      <a href="/api/admin/export?type=ventas" download className="text-[11px] underline" style={{ color: '#666' }} title="Histórico completo (facturas de suscripciones)">
        todo
      </a>
    </span>
  );
}
