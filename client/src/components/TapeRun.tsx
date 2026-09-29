import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { createRun, frameDelta, jumpRun, stepRun, type GameMode } from '../game/runner';
import { drawGame } from '../game/renderer';

type GameView = {
  mode: GameMode; metres: number; tapes: number; boosts: number;
  grounded: boolean; width: number; message: string;
};

export function TapeRun() {
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<GameView>({
    mode: 'idle', metres: 0, tapes: 0, boosts: 2, grounded: true, width: 960,
    message: 'Follow the cassette trail. Two jumps, short stairs, and rooftop gaps.',
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coinRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const run = useRef(createRun());
  const controls = useRef<{ start: () => void; pause: () => void; jump: () => void } | null>(null);
  const reducedMotion = useReducedMotion();
  const { pathname } = useLocation();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0, last: number | null = null, disposed = false;
    let context: CanvasRenderingContext2D | null = null;
    const stopFrames = () => { cancelAnimationFrame(frame); last = null; };
    const publish = () => {
      const current = run.current;
      const message = current.mode === 'running'
        ? 'Stairs climb automatically. Jump again in mid-air for a second boost. Landing restores both jumps.'
        : current.mode === 'paused' ? 'Paused. Resume when ready.'
        : current.mode === 'over' ? `${current.reason} ${Math.floor(current.distance / 15)} metres and ${current.collected} tapes collected.`
        : current.mode === 'error' ? current.reason
        : 'Follow the cassette trail. Two jumps, short stairs, and rooftop gaps.';
      const next: GameView = {
        mode: current.mode, metres: Math.floor(current.distance / 15), tapes: current.collected,
        boosts: current.jumpsLeft, grounded: current.grounded, width: canvas.width, message,
      };
      if (!disposed) setView(previous =>
        previous.mode === next.mode && previous.metres === next.metres && previous.tapes === next.tapes &&
        previous.boosts === next.boosts && previous.grounded === next.grounded &&
        previous.width === next.width && previous.message === next.message ? previous : next);
    };
    const fail = (error: unknown) => {
      stopFrames();
      console.error('Tape Run unavailable:', error);
      run.current.mode = 'error';
      run.current.reason = 'The optional game could not start. Retry or close it; voting is unaffected.';
      publish();
    };
    const draw = () => {
      try {
        if (!context) throw new Error('Canvas 2D is unavailable.');
        drawGame(context, canvas.width, run.current, Boolean(reducedMotion));
        publish();
      } catch (error) { fail(error); }
    };
    const tick = (time: number) => {
      if (disposed || run.current.mode !== 'running') return;
      try {
        stepRun(run.current, frameDelta(last, time));
        last = time;
        draw();
        if (run.current.mode === 'running') frame = requestAnimationFrame(tick);
      } catch (error) { fail(error); }
    };
    const pause = () => {
      if (run.current.mode !== 'running') return;
      stopFrames(); run.current.mode = 'paused'; draw();
    };
    const jump = () => {
      if (jumpRun(run.current)) draw();
    };
    controls.current = {
      start: () => {
        if (!context || document.hidden) return;
        stopFrames(); run.current = createRun(); run.current.mode = 'running';
        draw(); frame = requestAnimationFrame(tick); canvas.focus({ preventScroll: true });
      },
      pause: () => {
        if (run.current.mode === 'running') pause();
        else if (run.current.mode === 'paused' && !document.hidden) {
          last = null; run.current.mode = 'running'; draw();
          frame = requestAnimationFrame(tick); canvas.focus({ preventScroll: true });
        }
      },
      jump: () => { jump(); canvas.focus({ preventScroll: true }); },
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault(); if (!event.repeat) jump();
      }
      if (event.code === 'KeyP') {
        event.preventDefault(); if (!event.repeat) controls.current?.pause();
      }
    };
    const pointer = () => { canvas.focus({ preventScroll: true }); jump(); };
    const visibility = () => { if (document.hidden) pause(); };
    const resize = () => {
      const width = canvas.clientWidth < 600 ? 480 : 960;
      if (canvas.width !== width) canvas.width = width;
      if (context) context.imageSmoothingEnabled = false;
      draw();
    };
    try {
      context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D is unavailable.');
      if (run.current.mode === 'error') run.current = createRun();
      resize();
    } catch (error) { fail(error); }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener('keydown', keydown);
    canvas.addEventListener('pointerdown', pointer);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pause);
    startRef.current?.focus({ preventScroll: true });
    canvas.closest('section')?.scrollIntoView({ block: 'center' });
    return () => {
      disposed = true; stopFrames(); observer.disconnect(); controls.current = null;
      if (run.current.mode === 'running') run.current.mode = 'paused';
      canvas.removeEventListener('keydown', keydown);
      canvas.removeEventListener('pointerdown', pointer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pause);
    };
  }, [open, retry, reducedMotion]);

  function close() {
    setOpen(false); coinRef.current?.focus({ preventScroll: true });
  }

  return <>
    <footer className="app-footer">
      <span>KEEP THE GOOD IDEAS ALIVE.</span>
      <button ref={coinRef} className="coin-button" aria-expanded={open} aria-controls="tape-run"
        onClick={() => { if (open) close(); else setOpen(true); }}>Insert coin</button>
      <span>Whack-A-Hack / After Hours</span>
    </footer>
    {open && <div className="mx-auto max-w-6xl px-4 pb-8 md:px-6">
      <section id="tape-run" className="game-drawer" aria-label="Tape Run game"
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
        <div className="game-top">
          <h2 className="poster-title text-2xl">Tape Run <span className="mt-1 block font-mono text-xs text-cobalt">THE ROOFTOP MIX</span></h2>
          <span data-testid="game-score" className="font-mono text-xs text-muted">{String(view.metres).padStart(4, '0')} M / {view.tapes} {view.tapes === 1 ? 'TAPE' : 'TAPES'}</span>
          <button className="btn-ghost" onClick={close} aria-label="Close game">Close [Esc]</button>
        </div>
        <canvas ref={canvasRef} width={960} height={320} tabIndex={0} className="game-canvas"
          style={{ aspectRatio: `${view.width}/320` }} data-state={view.mode}
          role="img" aria-label="Tape Run playfield. Space or Up to jump; press again in the air to double jump. P to pause."
          aria-describedby="game-instructions">The optional game requires Canvas. Voting does not depend on it.</canvas>
        <div className="game-controls">
          <button ref={startRef} className="btn-primary" disabled={view.mode === 'error'} onClick={() => controls.current?.start()}>
            {view.mode === 'idle' ? 'Start run' : 'Run again'}
          </button>
          <button className="btn-ghost" disabled={view.mode !== 'running' && view.mode !== 'paused'} onClick={() => controls.current?.pause()}>
            {view.mode === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button className="btn-ghost" disabled={view.mode !== 'running' || view.boosts === 0} onClick={() => controls.current?.jump()}>Jump</button>
          <span data-testid="game-boosts" className="font-mono text-xs text-carnival-yellow">BOOSTS {view.boosts}/2 / {view.grounded ? 'READY' : 'AIR'}</span>
          <span className="game-hint">SPACE / UP / TAP &nbsp; AGAIN = DOUBLE JUMP &nbsp; P PAUSE</span>
        </div>
        <p id="game-instructions" role={view.mode === 'error' ? 'alert' : 'status'} className="mt-4 text-sm text-carnival-cyan">{view.message}</p>
        {view.mode === 'error' && <button className="btn-ghost mt-3" onClick={() => setRetry(value => value + 1)}>Retry game</button>}
      </section>
    </div>}
  </>;
}
