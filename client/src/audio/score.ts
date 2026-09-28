export const tracks = {
  midnight: { name: 'Midnight Tokens', bpm: 104, description: 'Mystic synths. Warm bass. No drums.',
    chords: [[48, 55, 58, 62], [44, 51, 55, 60], [51, 58, 62, 65], [46, 53, 60, 62]] },
  miami: { name: "Ocean Drive '86", bpm: 118, description: 'Miami chords, bouncing bass and drum machines.',
    chords: [[53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67]] },
} as const;
export type TrackId = keyof typeof tracks;
export type Drum = 'kick' | 'snare' | 'clap' | 'hat' | 'openhat' | 'cowbell' | 'tom-high' | 'tom-low';
export type Sound =
  | { kind: 'note'; midi: number; duration: number; level: number; wave: OscillatorType; cutoff: number; detune: number }
  | { kind: 'drum'; voice: Drum };

/** One sixteenth-note step of an original eight-bar loop. */
export function scoreStep(trackId: TrackId, position: number): Sound[] {
  const track = tracks[trackId], step = position % 16, bar = Math.floor(position / 16);
  const chord = track.chords[Math.floor(bar / 2) % 4];
  const sounds: Sound[] = [];
  const note = (midi: number, duration: number, level: number, wave: OscillatorType = 'triangle', cutoff = 1600, detune = 0) =>
    sounds.push({ kind: 'note', midi, duration, level, wave, cutoff, detune });
  const drum = (voice: Drum) => sounds.push({ kind: 'drum', voice });
  if (trackId === 'midnight') {
    const pattern = [0, 2, 1, 3, 2, 1, 3, 1];
    if (step % 2 === 0) note(chord[pattern[step / 2]] + 12, .24, .075, 'sawtooth', 2100);
    if (step % 8 === 0) note(chord[0] - 12, .38, .23, 'triangle', 650);
    if (step === 0 && bar % 2 === 0) chord.forEach(n => note(n + 12, 2.9, .021, 'sine', 1400));
  } else {
    if ([0, 3, 6, 8, 10, 14].includes(step)) {
      const octave = step === 3 || step === 10 ? 0 : -12;
      note(chord[0] + octave, .20, .18, 'sawtooth', 720);
      note(chord[0] + octave, .23, .10, 'sine', 700);
    }
    if ([0, 6, 10].includes(step)) chord.forEach(n => {
      note(n + 12, .52, .028, 'sawtooth', 3200, -7);
      note(n + 12, .52, .028, 'sawtooth', 3200, 7);
    });
    if ([2, 5, 9, 14].includes(step)) {
      const n = chord[[2, 3, 1, 2][[2, 5, 9, 14].indexOf(step)]] + 24;
      note(n, .5, .065, 'sine', 5000);
      note(n + 12, .14, .026, 'sine', 6500);
    }
    if ([0, 6, 8, 11].includes(step)) drum('kick');
    if (step === 4 || step === 12) { drum('snare'); drum('clap'); }
    if (step % 2 === 0) drum(step === 2 || step === 10 ? 'openhat' : 'hat');
    if (step === 7 || step === 15) drum('hat');
    if (step === 3 || step === 10 || (bar % 2 === 1 && step === 14)) drum('cowbell');
    if (bar % 4 === 3 && step >= 14) drum(step === 14 ? 'tom-high' : 'tom-low');
  }
  return sounds;
}
