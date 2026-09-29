import { Gavel } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { MusicPlayer } from './MusicPlayer';
import { TapeRun } from './TapeRun';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <a className="sr-only focus:not-sr-only focus:block focus:p-3" href="#main">Skip to content</a>
      <header className="app-header">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-4 py-5 md:px-6">
          <Link to="/" className="app-brand">
            <span className="brand-mark"><Gavel aria-hidden="true" className="h-6 w-6" /></span>
            <span>Whack-A-Hack
              <span className="mt-1 block font-mono text-[0.6rem] font-normal uppercase tracking-[0.2em]">The after hours club</span>
            </span>
          </Link>
          <nav aria-label="Main navigation" className="flex gap-2">
            <NavLink className="nav-link" to="/vote">Vote</NavLink>
            <NavLink className="nav-link" to="/results">Results</NavLink>
            <NavLink className="nav-link" to="/admin">Admin</NavLink>
          </nav>
        </div>
      </header>
      <div className="event-strip">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2">
          <span>BUILD SOMETHING WORTH STAYING UP FOR.</span>
          <span>ONE TEAM. ONE BALLOT.</span>
        </div>
      </div>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">{children}</main>
      <div className="club-lower mx-auto max-w-6xl px-4 md:px-6">
        <section className="club-note">
          <div className="section-kicker">B-side / Built for the room</div>
          <h2>Less chrome.<br />More character.</h2>
          <p>A room full of makers. A handful of points. Give credit to the ideas that deserve to be heard.</p>
        </section>
        <MusicPlayer />
      </div>
      <TapeRun />
    </MotionConfig>
  );
}
