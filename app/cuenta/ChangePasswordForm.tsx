'use client';

import { useState } from 'react';

// Cambiar contraseña (self-service) con doble check:
//   contraseña actual + nueva + repetir nueva.
// El back además verifica la contraseña actual antes de cambiarla.
export default function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) { setMsg({ ok: false, text: 'La nueva tiene que tener al menos 8 caracteres.' }); return; }
    if (next !== confirm) { setMsg({ ok: false, text: 'Las dos contraseñas nuevas no coinciden.' }); return; }
    if (next === cur) { setMsg({ ok: false, text: 'La nueva no puede ser igual a la actual.' }); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        setMsg({ ok: true, text: '✅ Contraseña cambiada.' });
        setCur(''); setNext(''); setConfirm('');
      } else {
        setMsg({ ok: false, text: d.error || 'No se pudo cambiar.' });
      }
    } catch {
      setMsg({ ok: false, text: 'Error de conexión. Prueba de nuevo.' });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-xl text-sm font-bold"
        style={{ background: '#141414', border: '1px solid #2a2a2a', color: '#ddd' }}>🔒 Cambiar contraseña</button>
    );
  }

  const inputStyle = { background: '#0c0c0c', border: '1px solid #222', color: '#fff' } as const;
  return (
    <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-2.5">
      <div className="text-sm font-bold mb-1">🔒 Cambiar contraseña</div>
      <input type="password" placeholder="Contraseña actual" value={cur} onChange={e => setCur(e.target.value)}
        autoComplete="current-password" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
      <input type="password" placeholder="Nueva contraseña (mín 8)" value={next} onChange={e => setNext(e.target.value)}
        autoComplete="new-password" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
      <input type="password" placeholder="Repetir nueva contraseña" value={confirm} onChange={e => setConfirm(e.target.value)}
        autoComplete="new-password" className="rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
      {msg && <div className="text-xs" style={{ color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.text}</div>}
      <div className="flex gap-2 mt-1">
        <button type="submit" disabled={busy || !cur || !next || !confirm}
          className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
          {busy ? 'Cambiando…' : 'Cambiar'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setMsg(null); }}
          className="px-4 py-2.5 rounded-xl text-sm" style={{ color: '#888' }}>Cancelar</button>
      </div>
    </form>
  );
}
