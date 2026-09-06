'use client';

import { useState } from 'react';

// Botón cliente que abre el Stripe Customer Portal en una nueva sesión.
// Útil para: ver facturas, cambiar tarjeta, cancelar suscripción.

export default function OpenPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Correo de soporte que devuelve el endpoint cuando algo sale mal: sin esto,
  // quien no puede cancelar se queda con un mensaje rojo y ninguna salida.
  const [soporte, setSoporte] = useState('');

  async function open() {
    if (loading) return;
    setError(''); setSoporte('');
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
      if (data.soporte) setSoporte(data.soporte);
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
        <div className="rounded-xl p-3 text-xs leading-relaxed"
          style={{ background: '#1a0d0d', border: '1px solid #ef444455', color: '#fca5a5' }}>
          {error}
          {soporte && (
            <a href={`mailto:${soporte}?subject=${encodeURIComponent('Quiero cancelar mi suscripción')}`}
              className="block mt-2 font-bold px-3 py-2 rounded-lg text-center"
              style={{ background: '#7f1d1d', border: '1px solid #b91c1c', color: '#fecaca', textDecoration: 'none' }}>
              ✉️ Escribirnos para cancelar
            </a>
          )}
        </div>
      )}
    </div>
  );
}
