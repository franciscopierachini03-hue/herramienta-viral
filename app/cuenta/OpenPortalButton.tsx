'use client';

import { useState } from 'react';

// Botón cliente que abre el Stripe Customer Portal en una nueva sesión.
// Útil para: ver facturas, cambiar tarjeta, cancelar suscripción.

export default function OpenPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      setError(data.error || 'No pudimos abrir el portal de facturación.');
    } catch {
      setError('Error de conexión.');
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={open}
        disabled={loading}
        className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#eee' }}>
        {loading ? 'Abriendo...' : '💳 Gestionar suscripción / Cancelar'}
      </button>
      {error && (
        <span className="text-xs" style={{ color: '#fca5a5' }}>{error}</span>
      )}
    </div>
  );
}
