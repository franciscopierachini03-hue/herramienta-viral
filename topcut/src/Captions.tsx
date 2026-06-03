import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Poppins';
import type { CaptionsProps, Intro } from './types';
import { chunkWords } from './chunk';

const { fontFamily } = loadFont('normal', { weights: ['600', '700', '800'] });

// Beat de INTRO: tarjeta de título animada. Líneas que entran escalonadas
// (slide-up + fade), sobre un scrim oscuro para legibilidad, y fade-out al final.
const IntroCard: React.FC<{ intro: Intro; accent: string; fontFamily: string }> = ({ intro, accent, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const totalFrames = Math.round(intro.durationSec * fps);
  // Fade out de toda la tarjeta en los últimos 8 frames.
  const cardOpacity = interpolate(frame, [totalFrames - 8, totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity: cardOpacity }}>
      {/* Scrim para que el texto se lea sobre el video */}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.25) 100%)' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 90px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', marginTop: -height * 0.05 }}>
          {intro.lines.map((line, i) => {
            // Cada línea entra escalonada (0.12s entre líneas).
            const delay = Math.round(i * 0.12 * fps);
            const e = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 130, mass: 0.6 }, durationInFrames: 16 });
            const y = interpolate(e, [0, 1], [40, 0]);
            const op = interpolate(e, [0, 0.7, 1], [0, 1, 1]);
            const isAccent = intro.accentLine === i;
            return (
              <div
                key={i}
                style={{
                  fontFamily,
                  fontWeight: 800,
                  fontSize: 84,
                  lineHeight: 1.05,
                  color: isAccent ? accent : '#ffffff',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: -1,
                  transform: `translateY(${y}px)`,
                  opacity: op,
                  textShadow: '0 6px 24px rgba(0,0,0,0.6)',
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Un clip de b-roll a pantalla completa, muteado, con fade in/out.
const BRollClip: React.FC<{ src: string; durationInFrames: number }> = ({ src, durationInFrames }) => {
  const frame = useCurrentFrame();
  const fade = 7;
  const opacity = interpolate(
    frame,
    [0, fade, durationInFrames - fade, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return (
    <AbsoluteFill style={{ opacity }}>
      <OffthreadVideo
        src={src.startsWith('http') ? src : staticFile(src)}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  );
};

export const Captions: React.FC<CaptionsProps> = ({ videoSrc, words, headline, style, accent, broll = [], intro }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  // Mientras se muestra la intro, ocultamos los subtítulos normales.
  const introEnd = intro ? intro.durationSec : 0;
  const showCaptions = t >= introEnd;

  // Palabras por grupo según estilo.
  const maxWords = style === 'impacto' ? 2 : 3;
  const chunks = chunkWords(words, maxWords, 0.55);
  const activeChunk =
    chunks.find((c) => t >= c.start && t <= c.end) ||
    [...chunks].reverse().find((c) => t >= c.start) ||
    chunks[0];

  // Posición vertical del bloque de subtítulos.
  const blockTop = style === 'impacto' ? height * 0.62 : height * 0.64;
  const fontSize = style === 'impacto' ? 70 : 90;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {videoSrc ? (
        <OffthreadVideo
          src={videoSrc.startsWith('http') ? videoSrc : staticFile(videoSrc)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 30%, #2a1248 0%, #0a0a0a 70%)' }} />
      )}

      {/* B-ROLL: clips de stock encima del video base, en su rango de tiempo.
          Muteados (el audio del orador sigue del video base). Con un fade corto
          de entrada/salida para que no "salte". */}
      {broll.map((b, i) => {
        const from = Math.round(b.start * fps);
        const dur = Math.max(1, Math.round((b.end - b.start) * fps));
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <BRollClip src={b.src} durationInFrames={dur} />
          </Sequence>
        );
      })}

      {headline ? (
        <div style={{ position: 'absolute', top: 130, left: 0, right: 0, textAlign: 'center', padding: '0 70px' }}>
          <span style={{ fontFamily, fontWeight: 800, fontSize: 56, color: '#fff', background: accent, padding: '12px 24px', borderRadius: 16, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone', boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
            {headline}
          </span>
        </div>
      ) : null}

      {showCaptions ? (
      <AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            top: blockTop,
            left: 0,
            right: 0,
            transform: 'translateY(-50%)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px 18px',
            padding: '0 90px',
            // "glass": barra translúcida detrás de toda la frase
            ...(style === 'glass'
              ? {}
              : {}),
          }}
        >
          {/* Fondo glass detrás de la frase */}
          {style === 'glass' ? (
            <div
              style={{
                position: 'absolute',
                inset: '-22px -28px',
                background: 'rgba(10,10,12,0.55)',
                borderRadius: 28,
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
              }}
            />
          ) : null}

          {activeChunk?.words.map((w, i) => {
            const isActive = t >= w.start && t <= w.end;

            const enter = spring({
              frame: frame - Math.round((activeChunk?.start ?? 0) * fps),
              fps,
              config: { damping: 14, stiffness: 140, mass: 0.5 },
              durationInFrames: 12,
            });
            const enterY = interpolate(enter, [0, 1], [24, 0]);
            const enterOpacity = interpolate(enter, [0, 0.6, 1], [0, 1, 1]);

            const pop = isActive
              ? spring({ frame: frame - Math.round(w.start * fps), fps, config: { damping: 11, stiffness: 200, mass: 0.4 }, durationInFrames: 9 })
              : 0;

            // ── Estilos (todos: texto BLANCO, activa resaltada sin color de fondo) ──
            let scale = 1;
            let color = '#ffffff';
            let opacity = 1;
            let textShadow = '0 4px 16px rgba(0,0,0,0.65)';

            if (style === 'elegante') {
              // Inactivas levemente atenuadas; activa 100% blanco + crece un poco.
              opacity = isActive ? 1 : 0.55;
              scale = isActive ? interpolate(pop, [0, 1], [1, 1.1]) : 1;
            } else if (style === 'impacto') {
              // 1-2 palabras grandes, TODAS del mismo tamaño (sin pop de escala).
              scale = 1;
              opacity = 1;
            } else if (style === 'glass') {
              // Sobre barra translúcida; activa un poco más grande + brillo.
              scale = isActive ? interpolate(pop, [0, 1], [1, 1.06]) : 1;
              color = isActive ? '#ffffff' : 'rgba(255,255,255,0.82)';
              textShadow = 'none';
            }

            return (
              <span
                key={i}
                style={{
                  fontFamily,
                  fontWeight: 800,
                  fontSize,
                  lineHeight: 1.0,
                  letterSpacing: -1,
                  color,
                  opacity: opacity * enterOpacity,
                  transform: `translateY(${enterY}px) scale(${scale})`,
                  transformOrigin: 'center bottom',
                  display: 'inline-block',
                  position: 'relative',
                  WebkitTextStroke: style === 'glass' ? '0' : '1.5px rgba(0,0,0,0.45)',
                  paintOrder: 'stroke fill',
                  textShadow,
                }}
              >
                {w.text}
                {/* Subrayado en la activa para 'elegante' (resalte sin color de fondo) */}
                {style === 'elegante' && isActive ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: '6%',
                      right: '6%',
                      bottom: -14,
                      height: 8,
                      borderRadius: 8,
                      background: '#ffffff',
                      transform: `scaleX(${interpolate(pop, [0, 1], [0, 1])})`,
                      transformOrigin: 'center',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    }}
                  />
                ) : null}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
      ) : null}

      {/* BEAT DE INTRO (arriba de todo, al principio) */}
      {intro ? (
        <Sequence from={0} durationInFrames={Math.round(intro.durationSec * fps)} layout="none">
          <IntroCard intro={intro} accent={accent} fontFamily={fontFamily} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
