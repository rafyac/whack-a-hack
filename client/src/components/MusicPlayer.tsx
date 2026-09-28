import { useEffect, useRef, useState } from 'react';
import { tracks, type TrackId } from '../audio/score';
import { MusicController, type PlayerState } from '../audio/player';

export function MusicPlayer() {
  const [selected, setSelected] = useState<TrackId>('midnight');
  const [volume, setVolume] = useState(12);
  const [state, setState] = useState<PlayerState>({ playing: null, busy: false, message: 'Original music. Sound off.', error: false });
  const controller = useRef<MusicController | null>(null);
  useEffect(() => {
    const player = new MusicController(setState);
    controller.current = player;
    const stop = () => {
      void player.stop('Paused. Press play to resume.').catch(error =>
        setState({ playing: null, busy: false, message: String(error), error: true }));
    };
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', stop);
    return () => {
      controller.current = null;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', stop);
      void player.dispose().catch(error => console.error('Unable to dispose soundtrack:', error));
    };
  }, []);
  function select(track: TrackId) {
    if (state.busy || selected === track) return;
    setSelected(track);
    if (state.playing) void controller.current?.play(track);
  }
  return (
    <details className="music-panel">
      <summary>Optional arcade mixtapes {state.playing ? '/ Playing' : '/ Sound off'}</summary>
      <div className="mixtapes" role="group" aria-label="Soundtrack">
        {(Object.keys(tracks) as TrackId[]).map(track => (
          <button type="button" key={track} className={`mixtape ${track}`} aria-pressed={selected === track}
            disabled={state.busy} onClick={() => select(track)}>
            <span className="cassette" aria-hidden="true"><i /><i /></span>
            <span className="min-w-0"><strong className="block">{tracks[track].name}</strong>
              <span className="mt-1 block text-xs text-muted">{tracks[track].description}</span>
              <span className="mt-1 block font-mono text-xs text-muted">{tracks[track].bpm} BPM / Original</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button className="btn-ghost" disabled={state.busy} onClick={() => {
          if (state.playing) void controller.current?.stop().catch(error =>
            setState({ playing: null, busy: false, message: String(error), error: true }));
          else void controller.current?.play(selected);
        }}>{state.busy ? 'Starting...' : state.playing ? 'Mute music' : `Play ${tracks[selected].name}`}</button>
        <label className="flex items-center gap-3 text-sm">Volume
          <input type="range" min={0} max={30} value={volume} onChange={event => {
            const value = Number(event.target.value);
            setVolume(value); controller.current?.setVolume(value / 100);
          }} />
        </label>
        <p role={state.error ? 'alert' : 'status'} className={state.error ? 'feedback-banner feedback-error' : 'text-sm text-muted'}>
          {state.playing ? `Playing: ${tracks[state.playing].name}` : state.message || 'Sound off.'}
        </p>
      </div>
    </details>
  );
}
