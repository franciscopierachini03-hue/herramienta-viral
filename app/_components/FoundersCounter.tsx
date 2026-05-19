'use client';

import { useEffect, useState } from 'react';

// Contador visible de cupos de fundadores. Se monta en la landing, /precios y
// el banner de trial vencido. Fetchea /api/founders-count que ya cachea 5 min.
//
// Variantes:
//   variant="pill"     — chip pequeño, va dentro de una pricing card
//   variant="banner"   — bloque ancho con barra de progreso
//
// Colores del semáforo según remaining:
//   > 30% del total → verde
//   10-30%          → amarillo
//   <= 10%          → rojo (urgencia máxima)
//
// Si la API falla, no renderiza nada (no muestra info inventada).

type Data = { taken: number; total: number; remaining: number };

export default function FoundersCounter({ variant = 'pill' }: { variant?: 'pill' | 'banner' }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/founders-count', { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch { /* silencio */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!data) return null;
  if (data.remaining <= 0) {
    // Cupos llenos: igual mostramos algo, pero sin presión falsa
    return (
      <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full"
        style={{ background: '#92400e22', border: '1px solid #92400e44', color: '#fde68a' }}>
        ⚠️ Cupos de lanzamiento agotados — sumate a la lista de espera
      </div>
    );
  }

  const pct = data.remaining / data.total;
  const palette =
    pct > 0.3 ? { fg: '#4ade80', bg: '#22c55e22', border: '#22c55e55', bar: '#22c55e' }
    : pct > 0.1 ? { fg: '#fde68a', bg: '#92400e22', border: '#92400e55', bar: '#f59e0b' }
    : { fg: '#fca5a5', bg: '#7f1d1d22', border: '#7f1d1d55', bar: '#ef4444' };

  const urgencyText = pct <= 0.1 ? '🔥 Últimos lugares' : pct <= 0.3 ? '⏳ Quedan pocos' : '🎯 Lugares disponibles';

  if (variant === 'pill') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
        style={{ background: palette.bg, border: `1px solid ${palette.border}`, color: palette.fg }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: palette.bar }} />
        Quedan <span className="font-bold tabular-nums">{data.remaining}</span> de {data.total} lugares con este precio
      </div>
    );
  }

  // Banner con barra de progreso
  const filledPct = ((data.total - data.remaining) / data.total) * 100;
  return (
    <div className="rounded-2xl p-4"
      style={{ background: palette.bg, border: `1px solid ${palette.border}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: palette.fg }}>
          {urgencyText}
        </span>
        <span className="text-xs font-semibold tabular-nums" style={{ color: palette.fg }}>
          {data.remaining}/{data.total} disponibles
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#0a0a0a' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${filledPct}%`, background: `linear-gradient(90deg, ${palette.bar}, ${palette.bar}aa)` }}
        />
      </div>
      <p className="text-[11px] mt-2 leading-relaxed" style={{ color: palette.fg, opacity: 0.85 }}>
        Tu precio de fundador queda bloqueado mientras mantengas la suscripción activa.
      </p>
    </div>
  );
}
