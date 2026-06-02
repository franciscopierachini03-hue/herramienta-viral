import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';
import type { CaptionsProps } from './types';
import { chunkWords } from './chunk';

const { fontFamily } = loadFont('normal', { weights: ['800', '900'] });

export const Captions: React.FC<CaptionsProps> = ({
  videoSrc,
  words,
  headline,
  style,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps; // tiempo actual en segundos

  const chunks = chunkWords(words);
  // Chunk activo: el que contiene el tiempo actual (o el último ya mostrado).
  const activeChunk =
    chunks.find((c) => t >= c.start && t <= c.end) ||
    [...chunks].reverse().find((c) => t >= c.start) ||
    chunks[0];

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {/* Fondo: video del cliente o degradado de marca si no hay video */}
      {videoSrc ? (
        <OffthreadVideo src={videoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <AbsoluteFill
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 30%, #2a1248 0%, #0a0a0a 70%)',
          }}
        />
      )}

      {/* Capa oscura sutil para legibilidad de subtítulos */}
      <AbsoluteFill
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)' }}
      />

      {/* HEADLINE arriba */}
      {headline ? (
        <div
          style={{
            position: 'absolute',
            top: 140,
            left: 0,
            right: 0,
            textAlign: 'center',
            padding: '0 80px',
          }}
        >
          <span
            style={{
              fontFamily,
              fontWeight: 900,
              fontSize: 64,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: 1,
              lineHeight: 1.05,
              background: accent,
              padding: '14px 26px',
              borderRadius: 18,
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
              textShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            {headline}
          </span>
        </div>
      ) : null}

      {/* SUBTÍTULOS centrados-abajo */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 360,
          paddingLeft: 70,
          paddingRight: 70,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '20px 34px',
            maxWidth: width - 140,
          }}
        >
          {activeChunk?.words.map((w, i) => {
            const isActive = t >= w.start && t <= w.end;
            const spoken = t > w.end;

            // Pop de entrada: cada palabra del chunk aparece con un pequeño salto.
            const appear = spring({
              frame: frame - Math.round(w.start * fps),
              fps,
              config: { damping: 200, stiffness: 220, mass: 0.6 },
              durationInFrames: 8,
            });
            const appearScale = interpolate(appear, [0, 1], [0.7, 1]);

            // Color según estilo.
            let color = '#ffffff';
            let bg = 'transparent';
            let scale = appearScale;

            if (style === 'pop') {
              if (isActive) {
                color = accent;
                scale = appearScale * 1.12;
              }
            } else if (style === 'highlight') {
              if (isActive) {
                color = '#0a0a0a';
                bg = accent;
              }
            } else if (style === 'karaoke') {
              color = spoken || isActive ? accent : '#ffffff';
              if (isActive) scale = appearScale * 1.08;
            }

            return (
              <span
                key={i}
                style={{
                  fontFamily,
                  fontWeight: 800,
                  fontSize: 84,
                  lineHeight: 1.0,
                  color,
                  background: bg,
                  padding: bg === 'transparent' ? 0 : '4px 16px',
                  borderRadius: 14,
                  transform: `scale(${scale})`,
                  transformOrigin: 'center',
                  textTransform: 'uppercase',
                  // Borde negro grueso para legibilidad sobre cualquier video
                  WebkitTextStroke: bg === 'transparent' ? '8px #000' : '0',
                  paintOrder: 'stroke fill',
                  textShadow: '0 6px 18px rgba(0,0,0,0.55)',
                  display: 'inline-block',
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
