'use client';

// 💵 Exportar ventas de UN MES a Google Sheets (.xlsx) — /admin toolbar.
// Elegís mes + producto (ViralADN / TOPCUT / Combo / todos) y baja una planilla
// con TODOS los datos: persona (nombre, email, teléfono, país, código, estado,
// registro, renovación), plata (cobrado, reembolso, comisión, neto al banco, lo
// que pagó en su moneda) y trazabilidad (cuenta, método, suscripción, recibo).
// Base completa: 2CLICKS + Elevation + pagos únicos, neto de reembolsos.

import { useState } from 'react';

const PRODUCTOS = [
  { v: '', label: 'Todos' },
  { v: 'viraladn', label: '🧬 ViralADN' },
  { v: 'topcut', label: '✂️ TOPCUT' },
  { v: 'combo', label: '🎁 Combo' },
] as const;

function mesActualCDMX(): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7); }
  catch { return new Date().toISOString().slice(0, 7); }
}

export default function ExportVentasMes() {
  const [mes, setMes] = useState(mesActualCDMX());
  const [producto, setProducto] = useState('');

  const href = (formato?: 'csv') =>
    `/api/admin/export?type=ventas&mes=${encodeURIComponent(mes)}`
    + (producto ? `&producto=${producto}` : '')
    + (formato ? `&formato=${formato}` : '');

  const ctrl = { background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff', colorScheme: 'dark' } as const;

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <input type="month" value={mes} max={mesActualCDMX()} onChange={e => setMes(e.target.value)}
        className="text-xs px-2 py-1.5 rounded-lg outline-none" style={ctrl} aria-label="Mes a exportar" />
      <select value={producto} onChange={e => setProducto(e.target.value)}
        className="text-xs px-2 py-1.5 rounded-lg outline-none cursor-pointer" style={ctrl} aria-label="Producto">
        {PRODUCTOS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
      </select>
      <a href={mes ? href() : '#'} download
        className="px-3 py-1.5 rounded-xl text-xs font-bold"
        style={{ background: '#0d1f12', border: '1px solid #22c55e55', color: '#86efac', pointerEvents: mes ? 'auto' : 'none', opacity: mes ? 1 : 0.5 }}
        title="Planilla lista para Google Sheets (.xlsx)">
        📊 Exportar ventas
      </a>
      <a href={href('csv')} download className="text-[11px] underline" style={{ color: '#666' }} title="Mismo reporte en CSV">csv</a>
      <a href={`/api/admin/export?type=ventas&mes=historico${producto ? `&producto=${producto}` : ''}`} download
        className="px-3 py-1.5 rounded-xl text-xs font-bold"
        style={{ background: '#12101f', border: '1px solid #7c3aed55', color: '#c4b5fd' }}
        title="TODAS las ventas desde el día uno: cada pago + acumulado por persona + total general">
        🗂 Histórico completo
      </a>
    </span>
  );
}
