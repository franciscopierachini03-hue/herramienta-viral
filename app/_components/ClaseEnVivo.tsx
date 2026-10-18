'use client';

// 🔴 EL CARTEL DE LA CLASE — aparece en TODA la plataforma el día de la clase.
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// El 18 de octubre de 2026, con la clase ya en vivo, la gente no encontraba
// por dónde entrar. El banner que había en /app era solo texto: avisaba del
// cambio de día y no daba ningún botón. El link vivía en /comunidad, a dos
// clics de distancia, y en el correo — que para entonces muchos ya no tenían
// a mano.
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

import { useEffect, useState } from 'react';
import { CLASE, claseEnFecha } from '../comunidad/clase-config';

type Estado = 'vivo' | 'hoy' | null;

export default function ClaseEnVivo() {
  // null hasta que el navegador calcule la hora de CDMX: así el servidor y el
  // cliente pintan lo mismo en el primer render (sin hydration mismatch).
  const [estado, setEstado] = useState<Estado>(null);

  useEffect(() => {
    function revisar() {
      try {
        const cdmx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
        if (cdmx.getDay() !== CLASE.diaSemana) return setEstado(null);

        const min = cdmx.getHours() * 60 + cdmx.getMinutes();
        const abre = CLASE.horaInicio.h * 60 + CLASE.horaInicio.m;
        const cierra = CLASE.finVentanaHoy.h * 60 + CLASE.finVentanaHoy.m;

        // La sala se abre 15 min antes: quien llega temprano ya puede entrar.
        if (min >= abre - 15 && min <= cierra) return setEstado('vivo');
        if (min < abre - 15) return setEstado('hoy');
        setEstado(null);          // ya terminó: el cartel se apaga solo
      } catch { setEstado(null); }
    }
    revisar();
    const id = setInterval(revisar, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!estado) return null;

  const vivo = estado === 'vivo';
  const hoyCDMX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  const C = claseEnFecha(hoyCDMX);

  return (
    <div className="rounded-2xl p-4 sm:p-5 mb-5"
      style={{
        background: vivo ? 'linear-gradient(145deg, #2a0a0e, #1a0608)' : 'linear-gradient(145deg, #2a1206, #1a0d0d)',
        border: `2px solid ${vivo ? '#ef4444' : '#f59e0b'}`,
        boxShadow: `0 0 30px ${vivo ? '#ef444433' : '#f59e0b33'}`,
      }}>

      <div className="flex items-center gap-2 mb-2">
        {vivo && <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#ef4444', boxShadow: '0 0 10px #ef4444' }} />}
        <p className="text-base sm:text-lg font-extrabold" style={{ color: vivo ? '#fca5a5' : '#fcd34d' }}>
          {vivo ? 'La clase está EN VIVO ahora mismo' : `Hoy es la clase — ${CLASE.horaCDMX} (Ciudad de México)`}
        </p>
      </div>

      <p className="text-sm mb-4" style={{ color: '#e8d8b4' }}>
        {vivo
          ? 'Entra con el botón. Si no te abre, usa el ID y el código desde la app de Zoom.'
          : `Te esperamos en la ${CLASE.sala}. El botón se queda aquí todo el día.`}
      </p>

      {/* Sin target="_blank" a propósito: el navegador de Instagram lo bloquea. */}
      <a href={C.zoomUrl} rel="noopener noreferrer"
        className="block w-full py-4 rounded-2xl text-base font-extrabold text-center transition-transform hover:-translate-y-0.5"
        style={{
          background: vivo ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #f59e0b, #ef4444)',
          color: '#fff',
          boxShadow: `0 0 30px ${vivo ? '#ef444455' : '#f59e0b44'}`,
        }}>
        {vivo ? '🔴 Entrar a la clase AHORA →' : '🚀 Entrar a la clase (Zoom) →'}
      </a>

      <p className="text-xs mt-3 text-center" style={{ color: '#b9a98a' }}>
        ¿No te abre? App de Zoom → Unirse · ID{' '}
        <b style={{ color: '#fff', fontFamily: 'monospace' }}>{C.zoomId}</b>
        {C.zoomCodigo && <> · Código <b style={{ color: '#fff', fontFamily: 'monospace' }}>{C.zoomCodigo}</b></>}
      </p>
    </div>
  );
}
