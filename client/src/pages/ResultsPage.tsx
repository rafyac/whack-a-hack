import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Lock } from 'lucide-react';
import { api, type ResultRow, type Session } from '../api';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { parseSessionId, resolveResultsSessionId } from '../sessionSelection';
import { SessionPicker } from '../components/SessionPicker';
import { rankResults } from '../ranking';

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
      } catch (e: any) {
        setErr(e?.message || 'Unable to load results right now.');
        setLoading(false);
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

  if (loading) {
    return (
      <div>
        {sessionPicker}
        <div className="subtle-card mx-auto mt-4 max-w-3xl text-center text-muted">
          Loading…
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div>
        {sessionPicker}
        <div className="poster-card text-center max-w-xl mx-auto">
          <Lock className="h-10 w-10 mx-auto text-carnival-yellow mb-3" />
          <h2 className="text-2xl font-bold mb-1">Results are temporarily unavailable</h2>
          <p className="text-muted">
            {err}
          </p>
        </div>
      </div>
    );
  }

  if (sessionId == null) {
    return (
      <div className="poster-card text-center max-w-xl mx-auto">
        <Trophy className="h-10 w-10 mx-auto text-carnival-yellow mb-3" />
        <h2 className="text-2xl font-bold mb-1">No public results yet</h2>
        <p className="text-muted">
          Results appear here once an admin closes a voting session.
        </p>
      </div>
    );
  }

  const max = Math.max(1, ...(rows || []).map((r) => r.total));
  const ranked = rankResults(rows ?? []);

  return (
    <div className="space-y-6">
      {sessionPicker}
      <div className="poster-card mx-auto max-w-3xl text-center">
        <div className="section-kicker mx-auto">Public results</div>
        <Trophy aria-hidden="true" className="mx-auto my-4 h-10 w-10 text-coral" />
        <h1 className="poster-title page-title">
          Final Leaderboard
        </h1>
        <p className="mt-3 text-muted">
          {activeSession
            ? `Final standings for ${activeSession.name}. Totals include team and commissioner points.`
            : 'Final standings. Totals include team and commissioner points.'}
        </p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-3">
          <div className="section-kicker">Leaderboard</div>
          <h2 className="text-2xl font-display font-bold">How the teams finished</h2>
        </div>
        <div className="text-sm text-muted">
          {(rows || []).length} ranked {(rows || []).length === 1 ? 'team' : 'teams'}
        </div>
      </div>
      <div className="space-y-3">
        {ranked.map((r, i) => (
          <motion.div
            key={r.id}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="poster-card result-row"
            data-testid="result-row"
            data-leader={r.rank === 1}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="text-2xl w-8 shrink-0 text-center">
                  <span className="font-mono text-base">#{r.rank}</span>
                </span>
                <div className="min-w-0">
                  <div className="text-xl font-semibold">{r.name}</div>
                  <div className="result-muted text-sm text-muted">
                    {r.tied ? `Joint place #${r.rank}` : r.rank === 1 ? 'Winning team' : `Place #${r.rank}`}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-2xl font-mono font-bold">
                <AnimatedNumber value={r.total} />
                <span className="result-muted text-sm font-sans"> pts</span>
              </div>
            </div>
            <div className="result-bar" aria-hidden="true">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(r.total / max) * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.04 }}
                className="h-full bg-coral"
              />
            </div>
          </motion.div>
        ))}
        {(rows || []).length === 0 && (
          <div className="poster-card text-center text-muted">
            <Trophy className="h-8 w-8 mx-auto mb-2 text-carnival-yellow" />
            No results yet.
          </div>
        )}
      </div>
    </div>
  );
}
