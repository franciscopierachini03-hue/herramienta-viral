'use client';

// 🚫 Cortar el cobro recurrente de una cuenta — /admin/pagos.
// Busca en LAS DOS cuentas de Stripe (2CLICKS + Elevation) por email, lista las
// suscripciones y las cancela con un clic. Pensado para cuentas admin / de prueba
// que no deberían estar pagando (cancelar NO les saca el acceso — eso lo da
// ADMIN_EMAILS). Llama a /api/admin/cancelar-suscripcion.

import { useEffect, useState } from 'react';

type Sub = {
  id: string; cuenta: 'viraladn' | 'elevation'; cuentaLabel: string; customer: string;
  status: string; cancelaAlFinal: boolean; monto: number | null; moneda: string;
  ciclo: string; nombre: string | null; proximoCobro: string | null; cancelable: boolean;
};
type Resp = {
  email: string; isAdmin: boolean; cuentasConsultadas: string[];
  cuentas: Array<{ cuenta: string; id: string; subs: Sub[] }>;
  error?: string;
};

const STATUS_UI: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'activa', color: '#86efac', bg: '#22c55e18' },
  trialing: { label: 'en prueba', color: '#7dd3fc', bg: '#0ea5e918' },
  past_due: { label: 'atrasada', color: '#fcd34d', bg: '#eab30818' },
  unpaid: { label: 'impaga', color: '#fcd34d', bg: '#eab30818' },
  canceled: { label: 'cancelada', color: '#a1a1aa', bg: '#3f3f4622' },
};

export default function CancelarSuscripcion() {
  const [email, setEmail] = useState('');
  const [data, setData] = useState<Resp | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [hechos, setHechos] = useState<Record<string, string>>({}); // subId → nuevo status

  useEffect(() => {
    fetch('/api/admin/cancelar-suscripcion', { cache: 'no-store' })
      .then(r => r.json()).then(d => setAdminEmails(d.adminEmails || [])).catch(() => {});
  }, []);

  function buscar(e?: string) {
    const q = (e ?? email).trim().toLowerCase();
    if (!q) return;
    setEmail(q); setCargando(true); setError(''); setData(null); setHechos({});
    fetch(`/api/admin/cancelar-suscripcion?email=${encodeURIComponent(q)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('Error de conexión.'))
      .finally(() => setCargando(false));
  }

  async function cancelar(s: Sub) {
    const dinero = s.monto != null ? `${s.monto} ${s.moneda}/${s.ciclo}` : 'este cobro';
    if (!confirm(`¿Cortar el cobro de ${dinero} en ${s.cuentaLabel}?\n\nDeja de facturar desde ya. Si es una cuenta admin, NO pierde el acceso.`)) return;
    setCancelando(s.id); setError('');
    try {
      const r = await fetch('/api/admin/cancelar-suscripcion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: s.id, cuenta: s.cuenta }),
      });
      const d = await r.json();
      if (d.error) setError(d.error);
      else setHechos(h => ({ ...h, [s.id]: d.status || 'canceled' }));
    } catch { setError('Error de conexión al cancelar.'); }
    finally { setCancelando(null); }
  }

  const card = { background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' } as const;
  const todasSubs = data?.cuentas.flatMap(c => c.subs) || [];
  const cancelables = todasSubs.filter(s => s.cancelable && !hechos[s.id]);

  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-bold" style={{ color: '#fca5a5' }}>🚫 Cortar cobro de una cuenta</h2>
        <span className="text-[11px]" style={{ color: '#666' }}>busca en 2CLICKS + Elevation · cancelar no saca el acceso admin</span>
      </div>

      {/* Buscador */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          type="email" value={email} placeholder="correo@ejemplo.com"
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') buscar(); }}
          className="text-sm px-3 py-2 rounded-xl outline-none flex-1 min-w-[220px]"
          style={{ background: '#0a0a12', border: '1px solid #2a2a36', color: '#fff' }} />
        <button onClick={() => buscar()} className="text-xs font-bold px-4 py-2 rounded-xl"
          style={{ background: '#14141f', border: '1px solid #2a2a36', color: '#d4d4dc' }}>
          Buscar suscripciones
        </button>
        {cargando && <span className="text-xs" style={{ color: '#888' }}>buscando…</span>}
      </div>

      {/* Chips de cuentas admin (no deberían pagar) */}
      {adminEmails.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-[11px]" style={{ color: '#666' }}>Cuentas admin:</span>
          {adminEmails.map(a => (
            <button key={a} onClick={() => buscar(a)}
              className="text-[11px] px-2.5 py-1 rounded-lg"
              style={{ background: '#1a1030', border: '1px solid #4c1d95', color: '#c4b5fd' }}>
              {a}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl p-4 text-sm mb-3" style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d55', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {data && (
        <div className="rounded-2xl p-4" style={card}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-sm font-bold" style={{ color: '#e4e4e7' }}>{data.email}</span>
            {data.isAdmin && (
              <span className="text-[10px] px-2 py-0.5 rounded-md font-bold" style={{ background: '#4c1d9533', border: '1px solid #6d28d9', color: '#c4b5fd' }}>
                ADMIN — no debería pagar
              </span>
            )}
          </div>

          {todasSubs.length === 0 && (
            <div className="text-xs" style={{ color: '#888' }}>
              No hay suscripciones en ninguna cuenta ({data.cuentasConsultadas.join(' · ') || 'sin cuentas configuradas'}). Nada que cortar. ✅
            </div>
          )}

          {todasSubs.map(s => {
            const st = hechos[s.id] || s.status;
            const ui = STATUS_UI[st] || STATUS_UI.canceled;
            const yaHecho = !!hechos[s.id];
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2.5 flex-wrap" style={{ borderTop: '1px solid #1a1a1a' }}>
                <div className="min-w-0">
                  <div className="text-sm font-bold" style={{ color: '#e4e4e7' }}>
                    {s.monto != null ? `${s.monto} ${s.moneda}` : '—'}
                    <span className="font-normal" style={{ color: '#888' }}> · {s.ciclo}</span>
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#101018', border: '1px solid #2a2a36', color: '#9ca3af' }}>{s.cuentaLabel}</span>
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#666' }}>
                    <span className="px-1.5 py-0.5 rounded" style={{ background: ui.bg, color: ui.color }}>{ui.label}</span>
                    {s.proximoCobro && !yaHecho && s.cancelable && <span> · próximo cobro {s.proximoCobro}</span>}
                    {s.cancelaAlFinal && !yaHecho && <span> · ya marcada para cancelar al final</span>}
                    <span className="ml-1 font-mono" style={{ color: '#3f3f46' }}>{s.id.slice(0, 14)}…</span>
                  </div>
                </div>
                {yaHecho ? (
                  <span className="text-xs font-bold" style={{ color: '#86efac' }}>✅ cobro cortado</span>
                ) : s.cancelable ? (
                  <button onClick={() => cancelar(s)} disabled={cancelando === s.id}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap"
                    style={{ background: cancelando === s.id ? '#3f1515' : '#7f1d1d', border: '1px solid #b91c1c', color: '#fecaca', opacity: cancelando === s.id ? 0.6 : 1 }}>
                    {cancelando === s.id ? 'cancelando…' : 'Cortar cobro'}
                  </button>
                ) : (
                  <span className="text-[11px]" style={{ color: '#555' }}>sin cobro activo</span>
                )}
              </div>
            );
          })}

          {cancelables.length > 0 && (
            <div className="text-[11px] mt-3 pt-2" style={{ color: '#666', borderTop: '1px solid #1a1a1a' }}>
              {cancelables.length} suscripci{cancelables.length === 1 ? 'ón' : 'ones'} con cobro activo. El corte es inmediato.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
