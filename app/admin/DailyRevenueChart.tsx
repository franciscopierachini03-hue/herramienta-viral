'use client';

// Gráfico de ingreso diario con tooltip al pasar el mouse.
// Eje X = días del mes, eje Y = $ cobrados ese día. Al hover sobre un día,
// muestra una etiqueta con la fecha y lo que entró ese día.

import { useState } from 'react';

const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DailyRevenueChart({
  daily, year, month, daysInMonth,
}: { daily: number[]; year: number; month: number; daysInMonth: number }) {
  const [hover, setHover] = useState<number | null>(null);

  const CW = 720, CH = 220, padL = 46, padR = 14, padT = 16, padB = 28;
  const plotW = CW - padL - padR, plotH = CH - padT - padB;
  const dailyMax = Math.max(...daily, 1);
  const xFor = (i: number) => padL + (daysInMonth <= 1 ? plotW / 2 : (i / (daysInMonth - 1)) * plotW);
  const yFor = (v: number) => padT + plotH - (v / dailyMax) * plotH;
  const linePts = daily.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');
  const areaPts = `${padL.toFixed(1)},${(padT + plotH).toFixed(1)} ${linePts} ${xFor(daysInMonth - 1).toFixed(1)},${(padT + plotH).toFixed(1)}`;
  const yTicks = [0, 0.5, 1].map(f => ({ v: dailyMax * f, y: yFor(dailyMax * f) }));
  const xTickDays = Array.from(new Set([1, 5, 10, 15, 20, 25, daysInMonth].filter(d => d >= 1 && d <= daysInMonth)));
  const colW = plotW / Math.max(1, daysInMonth);

  // Tooltip
  const boxW = 108, boxH = 40;
  let tip: { bx: number; by: number; amount: number; date: string } | null = null;
  if (hover != null) {
    const amount = daily[hover];
    const px = xFor(hover), py = yFor(amount);
    let bx = Math.max(padL, Math.min(px - boxW / 2, CW - padR - boxW));
    let by = py - boxH - 12;
    if (by < padT) by = py + 12;
    const date = new Date(year, month - 1, hover + 1).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
    tip = { bx, by, amount, date };
  }

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="revLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>

      {/* eje Y */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={t.y} x2={CW - padR} y2={t.y} stroke="#222" strokeWidth="1" />
          <text x={padL - 6} y={t.y + 3} textAnchor="end" fontSize="10" fill="#666">{fmtUSD(t.v)}</text>
        </g>
      ))}

      {/* área + línea */}
      <polygon points={areaPts} fill="url(#revArea)" />
      <polyline points={linePts} fill="none" stroke="url(#revLine)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {daily.map((v, i) => v > 0 ? <circle key={i} cx={xFor(i)} cy={yFor(v)} r="3" fill="#ec4899" /> : null)}

      {/* eje X */}
      {xTickDays.map(d => (
        <text key={d} x={xFor(d - 1)} y={CH - 8} textAnchor="middle" fontSize="10" fill="#666">{d}</text>
      ))}

      {/* hover: guía vertical + punto grande */}
      {hover != null && (
        <>
          <line x1={xFor(hover)} y1={padT} x2={xFor(hover)} y2={padT + plotH} stroke="#7c3aed77" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={xFor(hover)} cy={yFor(daily[hover])} r="5" fill="#ec4899" stroke="#fff" strokeWidth="1.5" />
        </>
      )}

      {/* tooltip */}
      {tip && (
        <g pointerEvents="none">
          <rect x={tip.bx} y={tip.by} width={boxW} height={boxH} rx="8" fill="#0c0c0c" stroke="#7c3aed99" strokeWidth="1" />
          <text x={tip.bx + boxW / 2} y={tip.by + 16} textAnchor="middle" fontSize="11" fill="#aaa" style={{ textTransform: 'capitalize' }}>{tip.date}</text>
          <text x={tip.bx + boxW / 2} y={tip.by + 31} textAnchor="middle" fontSize="13" fontWeight={700} fill={tip.amount > 0 ? '#86efac' : '#777'}>{fmtUSD(tip.amount)}</text>
        </g>
      )}

      {/* zonas de hover por día (transparentes, arriba de todo) */}
      {daily.map((_, i) => (
        <rect key={i} x={xFor(i) - colW / 2} y={padT} width={colW} height={plotH}
          fill="transparent" style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)} />
      ))}
    </svg>
  );
}
