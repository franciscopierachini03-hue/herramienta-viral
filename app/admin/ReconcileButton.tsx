'use client';

import { useState } from 'react';

// Botón que dispara /api/admin/reconcile-codes: completa el código de promo
// de los pagos Stripe que quedaron sin él (consultando Stripe). Muestra un
// resumen y recarga la página al terminar para reflejar los cambios.

type ResultRow = { email: string; status: string; code?: string };

export default function ReconcileButton() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);

  async function run() {
    if (loading) return;
    setLoading(true);
    setSummary(null);
    setRows([]);
    try {
      const res = await fetch('/api/admin/reconcile-codes', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setSummary(data.error || 'Error al reconciliar.');
        setLoading(false);
        return;
      }
      setSummary(`Revisados ${data.checked} · Actualizados ${data.updated}`);
      setRows(data.results || []);
      // Recargar a los 2s para que la tabla muestre los códigos nuevos.
      setTimeout(() => window.location.reload(), 2500);
    } catch {
      setSummary('Error de conexión.');
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <button
        onClick={run}
        disabled={loading}
        className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#eee' }}
        title="Completa el código de promo de los pagos que quedaron sin él, consultando Stripe">
        {loading ? 'Reconciliando…' : '🔄 Reconciliar códigos'}
      </button>
      {summary && (
        <span className="text-[11px]" style={{ color: '#86efac' }}>{summary}</span>
      )}
      {rows.length > 0 && (
        <div className="text-[10px] text-right max-h-32 overflow-y-auto" style={{ color: '#888' }}>
          {rows.map((r, i) => (
            <div key={i}>
              {r.email} → <span style={{ color: r.code ? '#c4b5fd' : '#666' }}>{r.code || r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
