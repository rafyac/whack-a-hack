import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Lock } from 'lucide-react';
import { api, type ResultRow, type Session } from '../api';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { parseSessionId, resolveResultsSessionId } from '../sessionSelection';
import { SessionPicker } from '../components/SessionPicker';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function ResultsPage() {
  const [params, setParams] = useSearchParams();
  const initialId = parseSessionId(params.get('sessionId'));
  const [sessionId, setSessionId] = useState<number | null>(
    initialId
  );
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session list (for the picker) and auto-resolve current session.
  useEffect(() => {
    (async () => {
      try {
        const { sessions } = await api.resultSessions();
        setAllSessions(sessions);
        const resolvedSessionId = resolveResultsSessionId(sessions, sessionId);
        if (resolvedSessionId != null) {
          setSessionId(resolvedSessionId);
          if (resolvedSessionId !== sessionId) {
            setParams({ sessionId: String(resolvedSessionId) }, { replace: true });
          }
        } else {
          setLoading(false);
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionId == null) return;
    setLoading(true);
    setErr(null);
    setRows(null);
    (async () => {
      try {
        const data = await api.publicResults(sessionId);
        setRows(data.results);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  function pickSession(id: number) {
    setSessionId(id);
    setParams({ sessionId: String(id) }, { replace: true });
  }

  const activeSession = allSessions.find((session) => session.id === sessionId) ?? null;

  const sessionPicker = allSessions.length > 1 && (
    <div className="mx-auto w-full max-w-3xl">
      <SessionPicker
        label="Finished sessions"
        sessions={allSessions}
        value={sessionId}
        onChange={pickSession}
        testId="results-session-picker"
      />
    </div>
  );

  if (sessionId == null && !loading) {
    return (
      <div className="neon-card text-center max-w-xl mx-auto">
        <Trophy className="h-10 w-10 mx-auto text-carnival-yellow mb-3" />
        <h2 className="text-2xl font-bold mb-1">No public results yet</h2>
        <p className="text-white/60">
          Results appear here once an admin closes a voting session.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        {sessionPicker}
        <div className="subtle-card mx-auto mt-4 max-w-3xl text-center text-white/60">
          Loading…
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div>
        {sessionPicker}
        <div className="neon-card text-center max-w-xl mx-auto">
          <Lock className="h-10 w-10 mx-auto text-carnival-yellow mb-3" />
          <h2 className="text-2xl font-bold mb-1">Results not available yet</h2>
          <p className="text-white/60">
            Results will appear once voting is closed by the admin.
          </p>
        </div>
      </div>
    );
  }

  const max = Math.max(1, ...(rows || []).map((r) => r.total));

  return (
    <div className="space-y-6">
      {sessionPicker}
      <div className="neon-card mx-auto max-w-3xl text-center">
        <div className="section-kicker mx-auto">Public results</div>
        <div className="mb-2 mt-4 text-5xl">🏁</div>
        <h1 className="bg-gradient-to-r from-carnival-pink via-carnival-yellow to-carnival-cyan bg-clip-text text-4xl font-bold text-transparent">
          Final Leaderboard
        </h1>
        <p className="mt-3 text-white/60">
          {activeSession
            ? `Final standings for ${activeSession.name} in Whack-A-Hack. Compare the sessions and see who came out on top.`
            : 'The crowd has spoken. Compare the sessions and see who came out on top in Whack-A-Hack.'}
        </p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-3">
          <div className="section-kicker">Leaderboard</div>
          <h2 className="text-2xl font-display font-bold">How the teams finished</h2>
        </div>
        <div className="text-sm text-white/45">
          {(rows || []).length} ranked {(rows || []).length === 1 ? 'team' : 'teams'}
        </div>
      </div>
      <div className="space-y-3">
        {(rows || []).map((r, i) => (
          <motion.div
            key={r.id}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="neon-card"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl w-8 text-center">
                  {MEDALS[i] ?? <span className="text-white/40 text-base">#{i + 1}</span>}
                </span>
                <div>
                  <div className="text-xl font-semibold">{r.name}</div>
                  <div className="text-sm text-white/45">
                    {i === 0 ? 'Current crowd favourite' : `Place #${i + 1}`}
                  </div>
                </div>
              </div>
              <div className="text-2xl font-display font-bold text-carnival-yellow">
                <AnimatedNumber value={r.total} />
                <span className="text-white/40 text-sm font-sans"> pts</span>
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(r.total / max) * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.04 }}
                className="h-full bg-gradient-to-r from-carnival-pink via-carnival-purple to-carnival-cyan"
              />
            </div>
          </motion.div>
        ))}
        {(rows || []).length === 0 && (
          <div className="neon-card text-center text-white/60">
            <Trophy className="h-8 w-8 mx-auto mb-2 text-carnival-yellow" />
            No results yet.
          </div>
        )}
      </div>
    </div>
  );
}
