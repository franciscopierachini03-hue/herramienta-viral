import React from 'react';
import { Composition } from 'remotion';
import { Captions } from './Captions';
import type { CaptionsProps } from './types';
import sample from '../sample-words.json';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Captions"
      component={Captions}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      // La duración se calcula a partir de la última palabra (+1s de cola).
      calculateMetadata={({ props }) => {
        const words = props.words ?? [];
        const lastEnd = words.length ? words[words.length - 1].end : 5;
        return {
          durationInFrames: Math.ceil((lastEnd + 1) * FPS),
        };
      }}
      defaultProps={
        {
          videoSrc: sample.videoSrc,
          words: sample.words,
          headline: sample.headline,
          style: 'pop',
          accent: '#c13584',
        } as CaptionsProps
      }
    />
  );
};
