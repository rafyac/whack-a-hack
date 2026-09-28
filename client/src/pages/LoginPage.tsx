import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Session } from '../api';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  getDefaultLoginSessionId,
  getLoginSessions,
} from '../sessionSelection';
import { SessionPicker } from '../components/SessionPicker';
import { ArcadeCabinet } from '../components/ArcadeCabinet';

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
    <div className="join-layout">
      <section className="space-y-5">
        <div className="section-kicker">The after-hours hackers club</div>
        <div className="space-y-4">
          <h1 className="poster-title join-title">
            Small teams.<br /><span className="text-cobalt">Big swings.</span>
          </h1>
          <p className="section-copy max-w-sm">
            The demos are done. The night is yours.<br />
            Give your points to the ideas you love.
          </p>
        </div>
        <ArcadeCabinet />
      </section>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="poster-card w-full lg:justify-self-end"
      >
        <div className="admit-label"><span>Player check-in</span><span>Admit one team</span></div>
        <h2 className="mb-2 text-3xl font-bold">You're up, player.</h2>
        <p className="mb-6 text-muted">Choose your session and sign in to vote.</p>
        {error && <div role="alert" className="feedback-banner feedback-error mb-4">{error}</div>}

        {sessions === null ? (
          <div className="subtle-card py-6 text-muted">Loading sessions…</div>
        ) : openSessions.length === 0 ? (
          <div className="subtle-card py-6 text-muted">
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
            <p className="text-sm text-muted">
              Only open sessions appear here. Closed events stay discoverable on the
              Results page.
            </p>
            <label className="field-label" htmlFor="voter-name">Team or commissioner name</label>
            <input id="voter-name"
              className="input"
              placeholder="team name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="username"
              spellCheck={false}
            />
            <div>
              <label className="field-label" htmlFor="voter-password">Password</label>
              <input
                id="voter-password"
                className="input"
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
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
                <><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> Signing in...</>
              ) : (
                'Sign in to vote'
              )}
            </button>
          </form>
        )}
        <p className="mt-5 text-center text-sm text-muted">
          Here for the finish? <Link className="underline underline-offset-4" to="/results">See final results</Link>.
        </p>
      </motion.div>
    </div>
  );
}
