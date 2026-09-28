import { describe, expect, it } from 'vitest';
import { scoreStep, tracks, type TrackId } from './score';

describe('original soundtracks', () => {
  it('keeps Midnight Tokens entirely free of percussion', () => {
    const sounds = Array.from({ length: 128 }, (_, step) => scoreStep('midnight', step)).flat();
    expect(sounds.length).toBeGreaterThan(0);
    expect(sounds.every(sound => sound.kind === 'note')).toBe(true);
  });
  it('gives Miami its own drum-machine voices and score', () => {
    const sounds = Array.from({ length: 128 }, (_, step) => scoreStep('miami', step)).flat();
    expect(new Set(sounds.filter(sound => sound.kind === 'drum').map(sound => sound.voice)))
      .toEqual(new Set(['kick', 'snare', 'clap', 'hat', 'openhat', 'cowbell', 'tom-high', 'tom-low']));
    expect(scoreStep('miami', 0)).not.toEqual(scoreStep('midnight', 0));
  });
  it.each<TrackId>(['midnight', 'miami'])('%s loops every eight bars with bounded finite notes', track => {
    expect(tracks[track].bpm).toBeGreaterThan(0);
    for (let step = 0; step < 128; step++) {
      expect(scoreStep(track, step + 128)).toEqual(scoreStep(track, step));
      for (const sound of scoreStep(track, step)) {
        if (sound.kind === 'note') {
          expect(Number.isFinite(sound.midi)).toBe(true);
          expect(sound.duration).toBeGreaterThan(.012);
          expect(sound.level).toBeGreaterThan(0);
          expect(sound.level).toBeLessThan(.5);
        }
      }
    }
  });
});
