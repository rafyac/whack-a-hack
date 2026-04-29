import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Session } from '../api';
import { KeyRound, Loader2, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  getDefaultLoginSessionId,
  getLoginSessions,
} from '../sessionSelection';
import { SessionPicker } from '../components/SessionPicker';

export default function LoginPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [sessionId, setSessionId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { sessions } = await api.openSessions();
        setSessions(sessions);
        const openSessions = getLoginSessions(sessions);
        const defaultSessionId = getDefaultLoginSessionId(openSessions);
        if (defaultSessionId != null) setSessionId(defaultSessionId);
      } catch (e: any) {
        setError(e.message);
        setSessions([]);
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (typeof sessionId !== 'number') return;
    setError(null);
    setLoading(true);
    try {
      await api.login(sessionId, name.trim(), password);
      nav('/vote', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const openSessions = getLoginSessions(sessions ?? []);

  return (
    <div className="grid gap-6 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <section className="space-y-6">
        <div className="section-kicker">
          <Trophy className="h-4 w-4 text-carnival-cyan" />
          Whack-A-Hack
        </div>
        <div className="space-y-4">
          <h1 className="max-w-2xl text-5xl font-bold leading-tight text-white md:text-6xl">
            Whack-A-Hack keeps voting fast, clear, and ready for demo night.
          </h1>
          <p className="section-copy max-w-xl text-lg">
            Pick a live session, sign in with your team or commissioner credentials, and
            score the projects without digging through a clunky form.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="subtle-card">
            <div className="text-sm uppercase tracking-[0.22em] text-white/45">
              Multi-session
            </div>
            <div className="mt-2 text-lg font-semibold">One app, many hack nights</div>
          </div>
          <div className="subtle-card">
            <div className="text-sm uppercase tracking-[0.22em] text-white/45">
              Commissioner ready
            </div>
            <div className="mt-2 text-lg font-semibold">
              Commissioners vote with their own budget
            </div>
          </div>
          <div className="subtle-card">
            <div className="text-sm uppercase tracking-[0.22em] text-white/45">
              Local & cloud ready
            </div>
            <div className="mt-2 text-lg font-semibold">Single-container deploy, wherever you run it</div>
          </div>
        </div>
      </section>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="neon-card w-full max-w-xl lg:justify-self-end"
      >
        <div className="section-kicker">Sign in</div>
        <div className="mb-3 mt-4 text-5xl">🚀</div>
        <h2 className="mb-1 text-3xl font-bold">Welcome, hackers!</h2>
        <p className="mb-6 text-white/60">
          Pick a voting session, then enter your{' '}
          <span className="text-carnival-yellow font-semibold">credentials</span>.
        </p>

        {sessions === null ? (
          <div className="subtle-card py-6 text-white/60">Loading sessions…</div>
        ) : openSessions.length === 0 ? (
          <div className="subtle-card py-6 text-white/60">
            No voting sessions are available yet. Check back soon!
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <SessionPicker
              label="Voting sessions"
              sessions={openSessions}
              value={typeof sessionId === 'number' ? sessionId : null}
              onChange={setSessionId}
              testId="login-session-picker"
            />
            <p className="text-sm text-white/45">
              Only open sessions appear here. Closed events stay discoverable on the
              Results page.
            </p>
            <input
              className="input"
              placeholder="team name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
              <input
                className="input pl-10"
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="feedback-banner feedback-error">
                {error}
              </div>
            )}
            <button
              className="btn-primary w-full"
              disabled={
                loading ||
                typeof sessionId !== 'number' ||
                !name.trim() ||
                !password
              }
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Enter the arena'
              )}
            </button>
            <p className="text-center text-sm text-white/45">
              Need final standings instead? Head to <span className="text-white/70">Results</span>.
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}
