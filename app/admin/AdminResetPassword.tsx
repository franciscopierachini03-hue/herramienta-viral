'use client';

import { useState } from 'react';

// Panel admin: restablecer la contraseña de cualquier usuario por email.
// El admin pone email + nueva contraseña y se la comunica a la persona.
export default function AdminResetPassword() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch('/api/admin/reset-password', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, newPassword: pw }),
      });
      const d = await r.json();
      if (r.ok && d.ok) { setMsg({ ok: true, text: `✅ Contraseña de ${email} restablecida. Pasásela a la persona.` }); setPw(''); }
      else setMsg({ ok: false, text: d.error || 'No se pudo.' });
    } catch {
      setMsg({ ok: false, text: 'Error de conexión.' });
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = { background: '#0c0c0c', border: '1px solid #222', color: '#fff' } as const;
  return (
    <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #1f1f1f' }}>
      <div className="text-sm font-bold mb-1">🔑 Restablecer contraseña de un usuario</div>
      <p className="text-xs mb-3" style={{ color: '#888' }}>Ponés el email y una contraseña nueva, y se la pasás a la persona (sirve para los que no pueden entrar).</p>
      <form onSubmit={submit} className="flex flex-col gap-2.5 max-w-md">
        <input type="email" placeholder="email del usuario" value={email} onChange={e => setEmail(e.target.value)}
          className="rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
        <input type="text" placeholder="nueva contraseña (mín 8)" value={pw} onChange={e => setPw(e.target.value)}
          className="rounded-xl px-3 py-2.5 text-sm outline-none" style={inputStyle} />
        {msg && <div className="text-xs" style={{ color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.text}</div>}
        <button type="submit" disabled={busy || !email || pw.length < 8}
          className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 self-start"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff' }}>
          {busy ? 'Restableciendo…' : 'Restablecer contraseña'}
        </button>
      </form>
    </div>
  );
}
