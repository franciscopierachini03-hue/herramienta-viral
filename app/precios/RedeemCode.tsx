'use client';

import { useState } from 'react';

// Componente para que un usuario LOGUEADO ingrese un código de invitación
// y active un trial sin pagar. Visible en /precios como alternativa a pagar.

export default function RedeemCode() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (!code.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      // Si no está logueado → mandarlo a login con next=precios
      if (res.status === 401) {
        window.location.href = '/login?next=/precios';
        return;
      }

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // Activado → ir a la app
      window.location.href = (data.redirect || '/app') + '?session=new';
    } catch {
      setError('Error de conexión. Probá de nuevo.');
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="text-center mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs underline"
          style={{ color: '#888' }}>
          ¿Tenés un código de invitación? +
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 mt-4"
      style={{ background: 'linear-gradient(145deg, #141414, #0d0d0d)', border: '1px solid #7c3aed44' }}>
      <h3 className="text-sm font-bold mb-3 text-center">Activar con código</h3>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="EJ: PRUEBA1"
          autoCapitalize="characters"
          autoFocus
          className="w-full px-4 py-3 rounded-xl text-sm outline-none text-center tracking-widest"
          style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#fff', fontFamily: 'monospace' }}
        />
        {error && (
          <div className="rounded-xl p-3 text-xs"
            style={{ background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#fca5a5' }}>
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setOpen(false); setError(''); setCode(''); }}
            className="flex-1 py-2.5 rounded-xl text-sm"
            style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', color: '#888' }}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="flex-[2] py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #c13584)', color: '#fff', boxShadow: '0 0 20px #7c3aed44' }}>
            {loading ? 'Activando...' : 'Activar →'}
          </button>
        </div>
      </form>
      <p className="text-[10px] text-center mt-3" style={{ color: '#555' }}>
        Si no tenés código, suscribite arriba para acceso completo.
      </p>
    </div>
  );
}
