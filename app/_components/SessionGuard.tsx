'use client';

import { useEffect, useRef } from 'react';

// Componente cliente que vigila la sesión del usuario en páginas protegidas.
//
// Comportamiento:
//   1. Marca de tab (sessionStorage): cuando el usuario inicia sesión
//      legítimamente, la página de login/welcome/reset-password redirige con
//      ?session=new. Acá lo detectamos y guardamos un marker en sessionStorage.
//   2. sessionStorage muere al cerrar la pestaña. Si el usuario reabre la URL
//      en una pestaña nueva, no hay marker → cerramos sesión y mandamos a
//      /login. Esto cubre el caso "cerré pestaña y volví".
//   3. Idle timeout: 15 min sin actividad → signout + /login?reason=idle.
//   4. Cierre de pestaña/navegador: best-effort vía navigator.sendBeacon.
//
// Render: nada visible. Solo monta listeners.

const IDLE_MS = 15 * 60 * 1000; // 15 minutos
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
const TAB_MARKER = 'viraladn_tab';

export default function SessionGuard() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signedOutRef = useRef(false);

  useEffect(() => {
    function signOutAndRedirect(reason: 'idle' | 'tab') {
      if (signedOutRef.current) return;
      signedOutRef.current = true;
      try { sessionStorage.removeItem(TAB_MARKER); } catch {}
      fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' })
        .catch(() => {})
        .finally(() => {
          window.location.href = `/login?reason=${reason}`;
        });
    }

    // ── 1. Marker de tab ──────────────────────────────────────
    // Si la URL trae ?session=new, venimos de /login o /app/welcome:
    // guardamos el marker y limpiamos la query para que no quede sucia.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('session')) {
        sessionStorage.setItem(TAB_MARKER, '1');
        url.searchParams.delete('session');
        const cleaned = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '');
        window.history.replaceState({}, '', cleaned);
      }

      // Si NO hay marker en este tab pero estamos en una página protegida,
      // significa que el usuario reabrió la URL después de cerrar la pestaña.
      // → cerramos sesión.
      const hasMarker = sessionStorage.getItem(TAB_MARKER);
      if (!hasMarker) {
        signOutAndRedirect('tab');
        return;
      }
    } catch {
      // Algunos navegadores en privado bloquean sessionStorage. En ese caso
      // dejamos que el flujo siga normalmente — no rompemos.
    }

    // ── 2. Idle timer ─────────────────────────────────────────
    function resetIdleTimer() {
      if (signedOutRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => signOutAndRedirect('idle'), IDLE_MS);
    }

    // ── 3. Cierre de pestaña/navegador ────────────────────────
    function signOutOnExit() {
      try {
        const blob = new Blob([''], { type: 'application/json' });
        navigator.sendBeacon('/api/auth/signout', blob);
      } catch {
        fetch('/api/auth/signout', { method: 'POST', keepalive: true }).catch(() => {});
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        signOutOnExit();
      } else {
        resetIdleTimer();
      }
    }

    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, resetIdleTimer, { passive: true }),
    );
    window.addEventListener('pagehide', signOutOnExit);
    document.addEventListener('visibilitychange', onVisibilityChange);

    resetIdleTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, resetIdleTimer));
      window.removeEventListener('pagehide', signOutOnExit);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}
