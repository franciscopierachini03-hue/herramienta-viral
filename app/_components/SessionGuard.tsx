'use client';

import { useEffect, useRef } from 'react';

// Componente cliente que vigila la sesión del usuario en páginas protegidas.
//
// Comportamiento:
//   1. Idle timeout: después de IDLE_MS sin actividad (mouse, teclado, scroll,
//      touch), pega POST /api/auth/signout y manda al usuario a /login.
//   2. Cierre de pestaña/navegador: en `pagehide` y `visibilitychange→hidden`
//      manda un signOut vía navigator.sendBeacon (sobrevive aunque el browser
//      esté cerrándose).
//
// Render: nada visible. Solo monta listeners.

const IDLE_MS = 15 * 60 * 1000; // 15 minutos
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export default function SessionGuard() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signedOutRef = useRef(false);

  useEffect(() => {
    function signOutAndRedirect() {
      if (signedOutRef.current) return;
      signedOutRef.current = true;
      // Limpiamos la cookie del lado del server y mandamos a /login.
      fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' })
        .catch(() => {})
        .finally(() => {
          window.location.href = '/login?reason=idle';
        });
    }

    function resetIdleTimer() {
      if (signedOutRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(signOutAndRedirect, IDLE_MS);
    }

    function signOutOnExit() {
      // sendBeacon sobrevive aunque la pestaña se esté cerrando.
      // Es POST con body vacío — el endpoint lo acepta así.
      try {
        const blob = new Blob([''], { type: 'application/json' });
        navigator.sendBeacon('/api/auth/signout', blob);
      } catch {
        // Si sendBeacon no está disponible, fallback a fetch keepalive.
        fetch('/api/auth/signout', {
          method: 'POST',
          keepalive: true,
        }).catch(() => {});
      }
    }

    function onVisibilityChange() {
      // Cuando la pestaña se oculta, si el usuario la cierra, sendBeacon dispara.
      // Si solo cambió de tab, al volver `visible` reseteamos el timer.
      if (document.visibilityState === 'hidden') {
        signOutOnExit();
      } else {
        resetIdleTimer();
      }
    }

    // Listeners de actividad → resetean el timer.
    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, resetIdleTimer, { passive: true }),
    );

    // Cierre de pestaña / navegador.
    window.addEventListener('pagehide', signOutOnExit);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Arrancamos el timer.
    resetIdleTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach(ev =>
        window.removeEventListener(ev, resetIdleTimer),
      );
      window.removeEventListener('pagehide', signOutOnExit);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}
