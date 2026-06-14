'use client';

import { useState } from 'react';

type Pending = { email: string; status: string | null; paid: boolean };

// Panel admin: arregla en masa el backlog de cuentas que pagaron pero quedaron
// sin confirmar (no pueden entrar). Primero previsualiza, después confirma.
export default function AdminFixAccess() {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [paidCount, setPaidCount] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function preview() {
    setMsg(null);
    setLoading(true);
    try {
      const r = await fetch('/api/admin/fix-access');
      const d = await r.json();
      if (r.ok && d.ok) { setPending(d.pending); setPaidCount(d.paidCount); }
      else setMsg({ ok: false, text: d.error || 'No se pudo.' });
    } catch {
      setMsg({ ok: false, text: 'Error de conexión.' });
    } finally {
      setLoading(false);
    }
  }

  async function fix(onlyPaid: boolean) {
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch('/api/admin/fix-access', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ onlyPaid }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        setMsg({ ok: true, text: `✅ Confirmé ${d.fixed} cuenta(s).${d.failed ? ` (${d.failed} fallaron)` : ''} Ya pueden entrar (las que no recuerdan su clave usan "¿Olvidaste tu contraseña?").` });
        setPending(null);
      } else setMsg({ ok: false, text: d.error || 'No se pudo.' });
    } catch {
      setMsg({ ok: false, text: 'Error de conexión.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
      <div className="text-sm font-bold mb-1">🔓 Arreglar accesos pendientes</div>
      <p className="text-xs mb-3" style={{ color: '#888' }}>
        Confirma de una a todos los que pagaron (o entraron por código) pero su email quedó sin confirmar y no pueden entrar. Primero revisa cuántos son, después confirma.
      </p>

      {!pending && (
        <button onClick={preview} disabled={loading}
          className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff' }}>
          {loading ? 'Revisando…' : 'Revisar cuántas hay'}
        </button>
      )}

      {pending && (
        <div className="flex flex-col gap-3">
          <div className="text-xs" style={{ color: '#ccc' }}>
            <b>{pending.length}</b> cuenta(s) sin confirmar — <b style={{ color: '#4ade80' }}>{paidCount}</b> con pago/acceso.
          </div>
          {pending.length > 0 && (
            <div className="rounded-xl p-3 max-h-48 overflow-auto text-xs" style={{ background: '#0c0c0c', border: '1px solid #222' }}>
              {pending.map(p => (
                <div key={p.email} className="flex items-center justify-between py-0.5">
                  <span style={{ color: p.paid ? '#e5e5e5' : '#777' }}>{p.email}</span>
                  <span style={{ color: p.paid ? '#4ade80' : '#666' }}>{p.paid ? (p.status || 'acceso') : 'sin pago'}</span>
                </div>
              ))}
            </div>
          )}
          {pending.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => fix(true)} disabled={busy || paidCount === 0}
                className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
                {busy ? 'Confirmando…' : `Confirmar solo los ${paidCount} con pago`}
              </button>
              <button onClick={() => fix(false)} disabled={busy}
                className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: '#1a1a1a', border: '1px solid #333', color: '#ccc' }}>
                Confirmar las {pending.length}
              </button>
            </div>
          )}
        </div>
      )}

      {msg && <div className="text-xs mt-3" style={{ color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.text}</div>}
    </div>
  );
}
