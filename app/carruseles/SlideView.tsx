'use client';

// Render de UNA slide a tamaño completo (1080×1350). El MISMO componente se usa
// para el preview escalado y para el export a PNG — lo que ves es lo que baja.
//
// Layouts: centrado (frase protagonista), lista (puntos numerados), stat (cifra
// gigante), cita (frase citable). El resumen siempre se dibuja como lista con ▸.
// Si la slide tiene "fondo" (imagen), va debajo con un velo oscuro para que el
// texto siga siendo legible en cualquier tema.
//
// Temas clonados pueden traer "diseno" (composición de la referencia): texto
// centrado, palabras con ==marcador== o __subrayado a mano__, y muebles
// (kicker/progreso/pie) apagados si la referencia no los usa.

import type { CSSProperties, ReactNode } from 'react';
import { CARRUSEL_W, CARRUSEL_H, type Slide, type Tema, type BrandKit } from '@/lib/carruseles';

// ── Realce de palabras: ==marcador== y __subrayado a mano__ ────────────────
function estiloMarcador(color: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(${color}, ${color})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: '100% 46%',
    backgroundPosition: '0 66%',
  };
}
function estiloSubrayado(color: string): CSSProperties {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='14' viewBox='0 0 56 14'><path d='M2 9 Q 16 3 28 9 T 54 9' fill='none' stroke='${color}' stroke-width='4.5' stroke-linecap='round'/></svg>`;
  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: '0 100%',
    backgroundSize: '56px 14px',
    paddingBottom: 10,
  };
}

// Convierte "los ==errores== que __nadie__ ve" en spans realzados.
function marcado(texto: string, colorMarcador: string, colorSubrayado: string): ReactNode {
  const partes = texto.split(/(==[^=\n]+==|__[^_\n]+__)/g).filter(Boolean);
  if (partes.length <= 1 && !/==|__/.test(texto)) return texto;
  return partes.map((p, i) => {
    if (/^==[^=\n]+==$/.test(p)) return <span key={i} style={estiloMarcador(colorMarcador)}>{p.slice(2, -2)}</span>;
    if (/^__[^_\n]+__$/.test(p)) return <span key={i} style={estiloSubrayado(colorSubrayado)}>{p.slice(2, -2)}</span>;
    return <span key={i}>{p}</span>;
  });
}
// Para medir largo/mostrar sin tokens.
const sinTokens = (t: string) => t.replace(/==|__/g, '');

export default function SlideView({ slide, tema, accent, brand, idx, total }: {
  slide: Slide; tema: Tema; accent: string; brand: BrandKit; idx: number; total: number;
}) {
  const esUltima = idx === total - 1;
  const conFondo = !!slide.fondo;
  const dis = tema.diseno;

  // Con imagen de fondo forzamos texto claro sobre velo oscuro (siempre legible).
  const fg = conFondo ? '#ffffff' : tema.fg;
  const muted = conFondo ? 'rgba(255,255,255,0.8)' : tema.muted;
  const panel = conFondo ? 'rgba(255,255,255,0.16)' : tema.panel;

  const layout: NonNullable<Slide['layout']> | 'resumen' =
    slide.tipo === 'resumen' ? 'resumen' : (slide.layout ?? 'centrado');

  // Diseño clonado: composición centrada sólo en layouts de frase (no en listas).
  const centrar = dis?.composicion === 'centrado' && (layout === 'centrado' || layout === 'cita' || layout === 'stat');
  const verKicker = (dis?.mostrarKicker ?? true) && !!slide.kicker;
  const verProgreso = dis?.mostrarProgreso ?? true;
  const verPie = dis?.mostrarPie ?? true;
  const colorMarcador = dis?.colorResaltado || accent;
  const colorSubrayado = dis?.colorSubrayado || accent;

  const lineas = (slide.cuerpo || '').split('\n').map(b => b.replace(/^[\s•\-–▸\d.)]+/, '').trim()).filter(Boolean);

  // Título: base por tipo, con achique si el texto viene largo.
  const base = slide.tipo === 'hook' ? 96 : slide.tipo === 'cta' ? 76 : layout === 'resumen' ? 56 : 64;
  const len = sinTokens(slide.titulo || '').length;
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

      {/* Header: kicker + progreso (según el diseño de la referencia) */}
      {(verKicker || verProgreso) ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, position: 'relative' }}>
          {verKicker ? (
            <span style={{
              fontSize: 26, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
              color: conFondo ? '#ffffff' : accent, background: panel, padding: '12px 22px', borderRadius: 999, fontFamily: tema.body,
            }}>{slide.kicker}</span>
          ) : <span />}
          {verProgreso && (
            <div style={{ display: 'flex', gap: 8, paddingTop: 14 }}>
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} style={{
                  width: i === idx ? 30 : 12, height: 12, borderRadius: 999,
                  background: i === idx ? accent : (conFondo || tema.dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)'),
                }} />
              ))}
            </div>
          )}
        </div>
      ) : <div />}

      {/* Cuerpo principal según layout */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28,
        position: 'relative', alignItems: centrar ? 'center' : 'stretch', textAlign: centrar ? 'center' : 'left',
      }}>

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
          fontFamily: tema.display, fontWeight: tema.diseno && !tema.dark ? 700 : 800,
          lineHeight: layout === 'cita' ? 1.16 : 1.08, letterSpacing: -1,
          fontSize: layout === 'stat' ? Math.min(tituloSize, 56) : tituloSize,
          fontStyle: layout === 'cita' ? 'italic' : 'normal',
          margin: 0, whiteSpace: 'pre-wrap',
        }}>{marcado(slide.titulo, colorMarcador, colorSubrayado)}</h1>

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
                <span style={{ color: fg, paddingTop: 8 }}>{marcado(b, colorMarcador, colorSubrayado)}</span>
              </li>
            ))}
          </ul>
        ) : (layout === 'resumen' && lineas.length > 0) ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
            {lineas.map((b, i) => (
              <li key={i} style={{ display: 'flex', gap: 18, alignItems: 'flex-start', fontSize: 34, lineHeight: 1.3 }}>
                <span style={{ color: accent, fontWeight: 800 }}>▸</span>
                <span style={{ color: fg }}>{marcado(b, colorMarcador, colorSubrayado)}</span>
              </li>
            ))}
          </ul>
        ) : slide.cuerpo ? (
          <p style={{
            fontSize: layout === 'cita' ? 32 : 36, lineHeight: 1.42, color: muted, margin: 0, whiteSpace: 'pre-wrap',
            maxWidth: centrar ? 780 : undefined,
          }}>{layout === 'cita' ? <>— {marcado(slide.cuerpo, colorMarcador, colorSubrayado)}</> : marcado(slide.cuerpo, colorMarcador, colorSubrayado)}</p>
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
        {!esUltima && verPie && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, fontWeight: 700, color: conFondo ? '#fff' : accent, whiteSpace: 'nowrap' }}>
            {slide.pie || 'Desliza'} <span style={{ fontSize: 36 }}>→</span>
          </span>
        )}
      </div>
    </div>
  );
}
