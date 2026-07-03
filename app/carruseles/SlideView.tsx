'use client';

// Render de UNA slide a tamaño completo (1080×1350). El MISMO componente se usa
// para el preview escalado y para el export a PNG — lo que ves es lo que baja.
//
// Layouts: centrado (frase protagonista), lista (puntos numerados), stat (cifra
// gigante), cita (frase citable). El resumen siempre se dibuja como lista con ▸.
// Si la slide tiene "fondo" (imagen), va debajo con un velo oscuro para que el
// texto siga siendo legible en cualquier tema.

import { CARRUSEL_W, CARRUSEL_H, type Slide, type Tema, type BrandKit } from '@/lib/carruseles';

export default function SlideView({ slide, tema, accent, brand, idx, total }: {
  slide: Slide; tema: Tema; accent: string; brand: BrandKit; idx: number; total: number;
}) {
  const esUltima = idx === total - 1;
  const conFondo = !!slide.fondo;

  // Con imagen de fondo forzamos texto claro sobre velo oscuro (siempre legible).
  const fg = conFondo ? '#ffffff' : tema.fg;
  const muted = conFondo ? 'rgba(255,255,255,0.8)' : tema.muted;
  const panel = conFondo ? 'rgba(255,255,255,0.16)' : tema.panel;

  const layout: NonNullable<Slide['layout']> | 'resumen' =
    slide.tipo === 'resumen' ? 'resumen' : (slide.layout ?? 'centrado');

  const lineas = (slide.cuerpo || '').split('\n').map(b => b.replace(/^[\s•\-–▸\d.)]+/, '').trim()).filter(Boolean);

  // Título: base por tipo, con achique si el texto viene largo.
  const base = slide.tipo === 'hook' ? 96 : slide.tipo === 'cta' ? 76 : layout === 'resumen' ? 56 : 64;
  const len = (slide.titulo || '').length;
  const tituloSize = Math.round(base * (len > 110 ? 0.74 : len > 80 ? 0.86 : 1));

  return (
    <div style={{
      width: CARRUSEL_W, height: CARRUSEL_H, background: conFondo ? '#0a0a0a' : tema.bg, color: fg,
      fontFamily: tema.body, padding: 92, display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
    }}>
      {/* Imagen de fondo + velo para legibilidad */}
      {conFondo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.fondo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.38) 45%, rgba(0,0,0,0.72) 100%)' }} />
        </>
      )}

      {/* Header: kicker + progreso */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, position: 'relative' }}>
        {slide.kicker ? (
          <span style={{
            fontSize: 26, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
            color: conFondo ? '#ffffff' : accent, background: panel, padding: '12px 22px', borderRadius: 999, fontFamily: tema.body,
          }}>{slide.kicker}</span>
        ) : <span />}
        <div style={{ display: 'flex', gap: 8, paddingTop: 14 }}>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} style={{
              width: i === idx ? 30 : 12, height: 12, borderRadius: 999,
              background: i === idx ? accent : (conFondo || tema.dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)'),
            }} />
          ))}
        </div>
      </div>

      {/* Cuerpo principal según layout */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, position: 'relative' }}>

        {layout === 'stat' && (slide.stat || '').trim() && (
          <div style={{
            fontFamily: tema.display, fontWeight: 900, lineHeight: 0.95, letterSpacing: -4,
            fontSize: 210, color: accent, wordBreak: 'break-word',
          }}>{slide.stat}</div>
        )}

        {layout === 'cita' && (
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 160, lineHeight: 0.6, color: accent, height: 90 }}>“</div>
        )}

        <h1 style={{
          fontFamily: tema.display, fontWeight: 800,
          lineHeight: layout === 'cita' ? 1.16 : 1.04, letterSpacing: -1,
          fontSize: layout === 'stat' ? Math.min(tituloSize, 56) : tituloSize,
          fontStyle: layout === 'cita' ? 'italic' : 'normal',
          margin: 0, whiteSpace: 'pre-wrap',
        }}>{slide.titulo}</h1>

        {/* Apoyo: lista (numerada), resumen (▸), o párrafo */}
        {(layout === 'lista' && lineas.length > 0) ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {lineas.slice(0, 6).map((b, i) => (
              <li key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start', fontSize: 34, lineHeight: 1.3 }}>
                <span style={{
                  width: 52, height: 52, borderRadius: 999, flexShrink: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800,
                  background: accent, color: tema.onAccent,
                }}>{i + 1}</span>
                <span style={{ color: fg, paddingTop: 8 }}>{b}</span>
              </li>
            ))}
          </ul>
        ) : (layout === 'resumen' && lineas.length > 0) ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
            {lineas.map((b, i) => (
              <li key={i} style={{ display: 'flex', gap: 18, alignItems: 'flex-start', fontSize: 34, lineHeight: 1.3 }}>
                <span style={{ color: accent, fontWeight: 800 }}>▸</span>
                <span style={{ color: fg }}>{b}</span>
              </li>
            ))}
          </ul>
        ) : slide.cuerpo ? (
          <p style={{
            fontSize: layout === 'cita' ? 32 : 36, lineHeight: 1.42, color: muted, margin: 0, whiteSpace: 'pre-wrap',
          }}>{layout === 'cita' ? `— ${slide.cuerpo}` : slide.cuerpo}</p>
        ) : null}
      </div>

      {/* Footer: marca + swipe */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          {brand.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
          )}
          {brand.handle && (
            <span style={{ fontSize: 28, fontWeight: 600, color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {brand.handle.startsWith('@') ? brand.handle : '@' + brand.handle}
            </span>
          )}
        </div>
        {!esUltima && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, fontWeight: 700, color: conFondo ? '#fff' : accent, whiteSpace: 'nowrap' }}>
            {slide.pie || 'Desliza'} <span style={{ fontSize: 36 }}>→</span>
          </span>
        )}
      </div>
    </div>
  );
}
