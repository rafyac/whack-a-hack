import { motion } from 'framer-motion';
import { Trophy, Sparkles } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-carnival-gradient">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-[-8%] h-72 w-72 rounded-full bg-carnival-cyan/20 blur-3xl" />
        <div className="absolute top-20 right-[-6%] h-96 w-96 rounded-full bg-carnival-pink/20 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-80 w-80 rounded-full bg-carnival-purple/25 blur-3xl" />
        <div className="absolute inset-x-10 top-28 h-56 rounded-[3rem] border border-white/10 bg-white/[0.04] blur-3xl" />
      </div>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-carnival-deep/40 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl group-hover:animate-wiggle">🏆</span>
            <div className="leading-tight">
              <span className="bg-gradient-to-r from-white via-carnival-cyan to-carnival-pink bg-clip-text font-display text-xl font-bold text-transparent">
                Whack-A-Hack
              </span>
              <div className="text-[0.68rem] uppercase tracking-[0.26em] text-white/35">
                Whack-A-Hack voting
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-sm shadow-[0_14px_40px_-24px_rgba(15,23,42,0.95)]">
            <NavTab to="/vote">Vote</NavTab>
            <NavTab to="/results">Results</NavTab>
            <NavTab to="/admin">Admin</NavTab>
          </nav>
        </div>
      </header>
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10"
      >
        {children}
      </motion.main>
      <footer className="relative z-10 mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-10 text-center text-xs text-white/45 md:px-6">
        <Sparkles className="h-3 w-3" />
        Whack-A-Hack • Clear sessions, crisp scoring
        <Trophy className="h-3 w-3" />
      </footer>
    </div>
  );
}

function NavTab({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `pill ${
          isActive
            ? 'bg-white text-slate-900 shadow-[0_12px_30px_-18px_rgba(255,255,255,0.95)]'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
