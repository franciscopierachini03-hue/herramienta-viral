'use client';

// 🔴 EL CARTEL DE LA CLASE — aparece en TODA la plataforma el día que hay clase.
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// El 18 de octubre de 2026, con la clase ya en vivo, la gente no encontraba
// por dónde entrar. El banner que había en /app era solo texto: avisaba y no
// daba ningún botón. El link vivía en /comunidad, a dos clics de distancia.
//
// Ahora el botón viaja con la persona: este cartel se monta en ProductNav, o
// sea en todas las pantallas (ViralADN, TOPCUT, guiones, formatos…).
//
// ── Dos detalles que importan ──────────────────────────────────────────────
// 1. El enlace NO abre pestaña nueva. Mucha gente entra a la plataforma desde
//    el navegador interno de Instagram, que se come los target="_blank" y deja
//    el botón muerto. En la misma pestaña siempre funciona.
// 2. Debajo del botón van el ID y el código a la vista. Si el enlace falla,
//    entran a mano desde la app de Zoom sin tener que buscar nada.
//
// Desde el 19-oct-2026 hay dos clases por semana, así que el cartel elige la
// que toca hoy: si una está en vivo gana esa, si no, la que empieza más tarde.

import { useEffect, useState } from 'react';
import { CLASES, claseEnFecha, estadoClase, horaTexto, type Clase, type EstadoClase } from '../comunidad/clase-config';

export default function ClaseEnVivo() {
  // null hasta que el navegador calcule la hora de CDMX: así el servidor y el
  // cliente pintan lo mismo en el primer render (sin hydration mismatch).
  const [hoy, setHoy] = useState<{ clase: Clase; estado: EstadoClase } | null>(null);

  useEffect(() => {
    function revisar() {
      const ahora = new Date();
      const candidatas = CLASES
        .map(clase => ({ clase, estado: estadoClase(clase, ahora) }))
        .filter(x => x.estado !== null);
      // Si hay una en vivo, esa manda sobre una que solo "es hoy".
      const vivo = candidatas.find(x => x.estado === 'vivo');
      setHoy(vivo || candidatas[0] || null);
    }
    revisar();
    const id = setInterval(revisar, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!hoy) return null;

  const { clase, estado } = hoy;
  const vivo = estado === 'vivo';
  const hoyCDMX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const C = claseEnFecha(hoyCDMX, clase);

  return (
    <div className="rounded-2xl p-4 sm:p-5 mb-5"
      style={{
        background: vivo ? 'linear-gradient(145deg, #2a0a0e, #1a0608)' : 'linear-gradient(145deg, #15161f, #0d0d16)',
        border: `2px solid ${vivo ? '#ef4444' : clase.acento}`,
        boxShadow: `0 0 30px ${vivo ? '#ef444433' : `${clase.acento}33`}`,
      }}>

      <div className="flex items-center gap-2 mb-1 flex-wrap">
        {vivo && <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#ef4444', boxShadow: '0 0 10px #ef4444' }} />}
        <p className="text-base sm:text-lg font-extrabold" style={{ color: vivo ? '#fca5a5' : clase.acento }}>
          {vivo ? `EN VIVO ahora: ${clase.nombre}` : `Hoy: ${clase.nombre}`}
        </p>
      </div>

      <p className="text-sm mb-4" style={{ color: '#b4b4c0' }}>
        {vivo
          ? `Con ${clase.con}. Entra con el botón; si no te abre, usa el ID desde la app de Zoom.`
          : `Con ${clase.con} · ${horaTexto(clase)} (Ciudad de México). El botón se queda aquí todo el día.`}
      </p>

      {/* Sin target="_blank" a propósito: el navegador de Instagram lo bloquea. */}
      <a href={C.zoomUrl} rel="noopener noreferrer"
        className="block w-full py-4 rounded-2xl text-base font-extrabold text-center transition-transform hover:-translate-y-0.5"
        style={{
          background: vivo ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : `linear-gradient(135deg, ${clase.acento}, #ef4444)`,
          color: '#fff',
          boxShadow: `0 0 30px ${vivo ? '#ef444455' : `${clase.acento}55`}`,
        }}>
        {vivo ? '🔴 Entrar a la clase AHORA →' : '🚀 Entrar a la clase (Zoom) →'}
      </a>

      <p className="text-xs mt-3 text-center" style={{ color: '#9a9aa6' }}>
        ¿No te abre? App de Zoom → Unirse · ID{' '}
        <b style={{ color: '#fff', fontFamily: 'monospace' }}>{C.zoomId}</b>
        {C.zoomCodigo && <> · Código <b style={{ color: '#fff', fontFamily: 'monospace' }}>{C.zoomCodigo}</b></>}
      </p>
    </div>
  );
}
