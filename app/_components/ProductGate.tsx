'use client';

import { useEffect } from 'react';

// Gate por producto para páginas client-side (/app = ViralADN, /editor = TOPCUT).
// Consulta /api/access (entitlement por Stripe + trial) y:
//   • admin → entra a todo.
//   • sin sesión → al login.
//   • pagó OTRO producto (no este) → al hub /inicio (ahí ve qué tiene y el upsell).
//
// No bloquea el render del producto correcto: solo redirige al que no corresponde.
export default function ProductGate({ product }: { product: 'viraladn' | 'topcut' }) {
  useEffect(() => {
    let cancel = false;
    fetch('/api/access', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancel || !d) return;
        if (d.admin) return;
        if (!d.ok) {
          window.location.href = '/login?next=' + (product === 'topcut' ? '/editor' : '/app');
          return;
        }
        if (!d[product]) window.location.href = '/inicio';
      })
      .catch(() => { /* si falla el check, no echamos a nadie */ });
    return () => { cancel = true; };
  }, [product]);

  return null;
}
