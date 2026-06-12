'use client';

import { useEffect, useRef } from 'react';

// Vigila la sesión del usuario en páginas protegidas.
//
// Reglas (definidas con el usuario):
//   • NO cerrar sesión al navegar entre páginas.
//   • NO cerrar sesión al cambiar de pestaña / minimizar.
//   • Cerrar sesión tras 15 min de INACTIVIDAD real.
//   • Cerrar sesión al cerrar el navegador → ya lo garantizan las
//     "session cookies" del middleware (mueren al cerrar el navegador),
//     así que aquí no hacemos nada en pagehide/visibilitychange.
//
// Implementación de la inactividad: timestamp de última actividad +
// chequeo periódico. Es más robusto que un setTimeout único porque
// sobrevive al throttling de pestañas en segundo plano y re-chequea
// apenas la pestaña vuelve a estar visible.
//
// Render: nada visible. Solo monta listeners.

const IDLE_MS = 15 * 60 * 1000;          // 15 minutos de inactividad
const CHECK_INTERVAL_MS = 30 * 1000;     // chequeo cada 30s
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export default function SessionGuard() {
  const lastActivityRef = useRef<number>(Date.now());
  const signedOutRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function signOutIdle() {
      if (signedOutRef.current) return;
      signedOutRef.current = true;
      fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' })
        .catch(() => {})
        .finally(() => {
          window.location.href = '/login?reason=idle';
        });
    }

    // Limpiar el query param ?session=new si viene (de login/welcome/reset).
    // Ya no lo usamos para nada, pero lo sacamos para que la URL quede limpia.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('session')) {
        url.searchParams.delete('session');
        const cleaned = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '');
        window.history.replaceState({}, '', cleaned);
      }
    } catch { /* navegadores en modo privado pueden fallar — no rompe nada */ }

    // ── Inactividad ───────────────────────────────────────────
    function markActivity() {
      lastActivityRef.current = Date.now();
    }
    function checkIdle() {
      if (signedOutRef.current) return;
      if (Date.now() - lastActivityRef.current >= IDLE_MS) {
        signOutIdle();
      }
    }
    function onVisible() {
      // Al volver a la pestaña, chequeamos al toque (los timers en background
      // están throttleados, así que el chequeo puede haberse atrasado).
      if (document.visibilityState === 'visible') checkIdle();
    }

    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, markActivity, { passive: true }),
    );
    document.addEventListener('visibilitychange', onVisible);
    intervalRef.current = setInterval(checkIdle, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, markActivity));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
