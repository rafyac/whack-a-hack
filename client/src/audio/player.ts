import { Synth } from './synth';
import type { TrackId } from './score';

export type PlayerState = { playing: TrackId | null; busy: boolean; message: string; error: boolean };
const lockName = 'whack-a-hack-soundtrack';

export class MusicController {
  private synth: Synth | null = null;
  private release?: () => void;
  private channel?: BroadcastChannel;
  private abort?: AbortController;
  private generation = 0;
  private disposed = false;
  private busy = false;
  private volume = .12;
  private closing: Promise<void> = Promise.resolve();
  private state: PlayerState = { playing: null, busy: false, message: 'Sound off.', error: false };

  constructor(private readonly onState: (state: PlayerState) => void) {}

  private report(playing: TrackId | null, message = '', error = false) {
    this.state = { playing, busy: this.busy, message, error };
    if (!this.disposed) this.onState(this.state);
  }

  setVolume(value: number) {
    this.volume = Math.min(.3, Math.max(0, value));
    this.synth?.setVolume(this.volume);
  }

  async stop(message = 'Sound off.') {
    this.generation++;
    this.abort?.abort();
    const synth = this.synth, release = this.release;
    this.synth = null; this.release = undefined;
    const previous = this.closing;
    const stopped = synth?.stop() ?? Promise.resolve();
    this.closing = Promise.all([previous, stopped]).then(() => undefined).finally(() => release?.());
    await this.closing;
    this.report(null, message);
  }

  async play(track: TrackId) {
    if (this.busy || this.disposed) return;
    this.busy = true; this.report(null, 'Starting soundtrack...');
    try {
      await this.stop();
      if (this.disposed || document.hidden) return;
      if (!window.AudioContext || !navigator.locks || !window.BroadcastChannel) {
        throw new Error('Optional music needs Web Audio, Web Locks and BroadcastChannel on HTTPS or localhost. Voting is still available.');
      }
      const generation = ++this.generation;
      this.channel ??= new BroadcastChannel(lockName);
      this.channel.onmessage = () => {
        void this.stop('Music moved to another tab.').catch(error => this.report(null, String(error), true));
      };
      this.channel.postMessage('takeover');
      const abort = new AbortController();
      this.abort = abort;
      const release = await new Promise<() => void>((resolve, reject) => {
        const timeout = setTimeout(() => abort.abort(), 2500);
        void navigator.locks.request(lockName, { signal: abort.signal }, async () => {
          clearTimeout(timeout);
          await new Promise<void>(unlock => resolve(unlock));
        }).catch(error => { clearTimeout(timeout); reject(error); });
      });
      if (this.disposed || document.hidden || generation !== this.generation) { release(); return; }
      this.release = release;
      const synth = new Synth(track, this.volume);
      this.synth = synth;
      await synth.start();
      if (this.synth === synth && generation === this.generation) this.report(track);
    } catch (error) {
      await this.stop();
      this.report(null, error instanceof DOMException && error.name === 'AbortError'
        ? 'Playback cancelled or another tab is busy. Press play to try again.'
        : error instanceof Error ? error.message : 'Unable to play music.', true);
    } finally {
      this.busy = false;
      this.report(this.state.playing, this.state.message, this.state.error);
    }
  }

  async dispose() {
    this.disposed = true;
    try { await this.stop(); }
    finally { this.channel?.close(); }
  }
}
