'use client';

import { useEffect, useState } from 'react';

// Gate de SOLO ADMIN para páginas client-side (Avatares IA, Carruseles).
// Mientras verifica /api/auth/is-admin tapa el contenido con un overlay opaco
// (así nadie alcanza a ver la herramienta). Si no es admin → al hub /inicio.
//
// Para abrir una de estas herramientas a planes pagos en el futuro: quitá este
// gate de su página, sacá `adminOnly` en lib/tools.ts y aflojá el check en su API.
export default function AdminGate() {
  const [estado, setEstado] = useState<'check' | 'ok' | 'no'>('check');

  useEffect(() => {
    let cancel = false;
    fetch('/api/auth/is-admin', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { isAdmin: false }))
      .then(d => {
        if (cancel) return;
        if (d?.isAdmin) { setEstado('ok'); return; }
        setEstado('no');
        window.location.href = '/inicio';
      })
      .catch(() => { if (!cancel) { setEstado('no'); window.location.href = '/inicio'; } });
    return () => { cancel = true; };
  }, []);

  if (estado === 'ok') return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#070710', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#8b8b96', fontSize: 14 }}>
        {estado === 'no' ? 'Esta herramienta es solo para administradores. Redirigiendo…' : 'Verificando acceso…'}
      </p>
    </div>
  );
}
