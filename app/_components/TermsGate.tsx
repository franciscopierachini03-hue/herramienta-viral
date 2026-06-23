'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Barrera universal de aceptación de Términos. Aparece UNA vez para cualquier
// usuario logueado que todavía no aceptó (paguen como paguen: link, checkout,
// cuenta vieja). Bloquea hasta aceptar y registra la aceptación (fecha/hora).
// No se muestra en páginas públicas/legales para no estorbar la lectura/registro.
const SKIP = new Set(['/', '/login', '/terminos', '/privacidad', '/reembolsos']);

export default function TermsGate() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (SKIP.has(pathname)) { setShow(false); return; }
    let cancelled = false;
    fetch('/api/auth/terms', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (!cancelled && d.authed && !d.accepted) setShow(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  if (!show) return null;

  async function accept() {
    setBusy(true);
    try {
      const r = await fetch('/api/auth/terms', { method: 'POST' });
      if (r.ok) setShow(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ maxWidth: 440, width: '100%', background: 'linear-gradient(145deg,#141414,#0d0d0d)', border: '1px solid #1f1f1f', borderRadius: 24, padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Antes de continuar</h2>
        <p style={{ fontSize: 14, color: '#b4b4c0', lineHeight: 1.6, margin: '0 0 16px' }}>
          Para usar ViralADN ✕ TOPCUT necesitamos que aceptes nuestras políticas, incluida la renovación automática de la suscripción.
        </p>
        <div style={{ fontSize: 13, margin: '0 0 18px' }}>
          <a href="/terminos" target="_blank" rel="noopener" style={{ color: '#c4b5fd', textDecoration: 'underline' }}>Términos</a>
          <span style={{ color: '#555' }}> · </span>
          <a href="/privacidad" target="_blank" rel="noopener" style={{ color: '#c4b5fd', textDecoration: 'underline' }}>Privacidad</a>
          <span style={{ color: '#555' }}> · </span>
          <a href="/reembolsos" target="_blank" rel="noopener" style={{ color: '#c4b5fd', textDecoration: 'underline' }}>Reembolsos</a>
        </div>
        <button onClick={accept} disabled={busy}
          style={{ width: '100%', padding: '14px', borderRadius: 16, fontWeight: 700, fontSize: 14, color: '#fff', border: 'none', cursor: busy ? 'default' : 'pointer', background: 'linear-gradient(135deg,#7c3aed,#c13584)', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Guardando…' : 'Acepto y continúo →'}
        </button>
        <p style={{ fontSize: 11, color: '#666', margin: '12px 0 0', textAlign: 'center' }}>
          Al continuar aceptas los Términos, la Política de Privacidad y la Política de Reembolsos.
        </p>
      </div>
    </div>
  );
}
