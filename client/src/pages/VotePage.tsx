import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { motion, useReducedMotion } from 'framer-motion';
import { LogOut, Save, Sparkles, Lock, Gavel } from 'lucide-react';
import { api, type Session, type Team } from '../api';
import { AnimatedNumber } from '../components/AnimatedNumber';

export default function VotePage() {
  const nav = useNavigate();
  const reducedMotion = useReducedMotion();
  const [me, setMe] = useState<Team | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [budget, setBudget] = useState<number>(0);
  const [teams, setTeams] = useState<Team[]>([]);
  const [alloc, setAlloc] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const meData = await api.me();
        if (!meData.team || !meData.session) {
          nav('/login', { replace: true });
          return;
        }
        setMe(meData.team);
        setSession(meData.session);
        const [{ teams }, mine] = await Promise.all([
          api.sessionTeams(meData.session.id),
          api.myVotes(),
        ]);
        setTeams(teams);
        if (mine) {
          const a: Record<number, number> = {};
          for (const x of mine.allocations) a[x.teamId] = x.points;
          setAlloc(a);
          setSession(mine.session);
          setBudget(mine.budget);
          setSaved(mine.allocations.length > 0);
          setLoaded(true);
        }
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  // Targets are voteable teams in the session, excluding self.
  // Server already filters out the commissioner account; we still drop self defensively.
  const otherTeams = useMemo(
    () => teams.filter((t) => t.id !== me?.id),
    [teams, me]
  );
  const used = Object.values(alloc).reduce((s, n) => s + (n || 0), 0);
  const remaining = budget - used;
  const isJudge = me?.kind === 'judge';

  function setPoints(id: number, val: number) {
    const n = Number.isFinite(val) ? Math.max(0, Math.min(budget, Math.floor(val))) : 0;
    setAlloc((a) => ({ ...a, [id]: n }));
    setMsg(null);
    setSaved(false);
  }

  async function logout() {
    try {
      await api.logout();
      nav('/login', { replace: true });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Unable to log out.');
    }
  }

  async function save() {
    setErr(null);
    setMsg(null);
    if (!loaded || saving) return;
    if (remaining !== 0) {
      setErr(
        remaining > 0
          ? `You still have ${remaining} points to give out.`
          : `You've allocated ${-remaining} too many points.`
      );
      return;
    }
    setSaving(true);
    try {
      const allocations = otherTeams.map((t) => ({
        teamId: t.id,
        points: alloc[t.id] || 0,
      }));
      await api.saveVotes(allocations);
      setSaved(true);
      setMsg('Saved! You can edit and save again while voting is open.');
      if (!reducedMotion) confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.7 },
        colors: ['#2549eb', '#b43d29', '#f3d575'],
        disableForReducedMotion: true,
      });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center text-muted py-10">Loading…</div>;
  if (!loaded) return (
    <div className="poster-card space-y-4">
      <h1 className="text-2xl font-bold">Unable to load your ballot</h1>
      <p role="alert" className="feedback-banner feedback-error">{err || 'Please sign in again.'}</p>
      <button className="btn-ghost" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  if (session && session.status !== 'open') {
    return (
      <div className="poster-card text-center max-w-xl mx-auto">
        <Lock className="h-10 w-10 mx-auto text-carnival-yellow mb-3" />
        <h2 className="text-2xl font-bold mb-1">
          Voting is {session.status === 'setup' ? 'not open yet' : 'closed'}
        </h2>
        <p className="text-muted">
          {session.status === 'setup'
            ? 'Hold tight — the admin will open voting when presentations start.'
            : 'Thanks for voting! Check the Results tab.'}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-ghost" onClick={logout}>
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-3">
          <div className="section-kicker">{session?.name ?? 'Live session'}</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-display font-bold">
              {me?.name}
            </h1>
            <span
              className={`pill ${
                isJudge
                  ? 'border border-carnival-yellow/35 bg-carnival-yellow/10 text-carnival-yellow'
                  : 'border border-carnival-cyan/35 bg-carnival-cyan/10 text-carnival-cyan'
              }`}
            >
              {isJudge ? 'Commissioner vote' : 'Team vote'}
            </span>
          </div>
          <p className="section-copy max-w-2xl">
            Spend exactly <span className="font-semibold text-ink">{budget}</span>{' '}
            points across the teams below, then save once your total is balanced.
          </p>
        </div>
        <button className="btn-ghost" onClick={logout}>
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>

      {isJudge && (
        <div className="feedback-banner feedback-warning flex items-center gap-2">
          <Gavel className="h-4 w-4" /> You are voting as the Commissioner — spread
          your <strong className="ml-1">{budget}</strong> points across the teams below.
        </div>
      )}

      <motion.div
        layout
        className="poster-card ballot-summary"
      >
        <div>
          <div className="section-kicker">Points remaining</div>
          <div
            className={`text-5xl font-display font-bold tabular-nums ${
              remaining === 0
                ? 'text-carnival-lime'
                : remaining < 0
                ? 'text-carnival-pink'
                : 'text-carnival-yellow'
            }`}
          >
            <AnimatedNumber value={remaining} />
            <span className="text-muted text-2xl"> / {budget}</span>
          </div>
          <div className="mt-2 text-sm text-muted" role="status" aria-live="polite">
            {remaining < 0 ? `Remove ${-remaining} points before saving.` : remaining > 0
              ? `${remaining} points left to allocate.` : 'All points allocated.'}
            {' '}{saving ? 'Saving...' : saved ? 'Ballot saved.' : 'Unsaved changes.'}
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={save}
          disabled={saving || remaining !== 0 || otherTeams.length === 0}
        >
          <Save className="h-5 w-5" />
          {saving ? 'Saving…' : 'Save vote'}
        </button>
      </motion.div>

      {msg && (
        <div role="status" className="feedback-banner feedback-success flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> {msg}
        </div>
      )}
      {err && (
        <div role="alert" className="feedback-banner feedback-error">
          {err}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-3">
          <div className="section-kicker">Ballot</div>
          <h2 className="text-2xl font-display font-bold">Allocate your score</h2>
        </div>
        <div className="text-sm text-muted">
          {otherTeams.length} eligible {otherTeams.length === 1 ? 'team' : 'teams'}
        </div>
      </div>

      <div className="grid gap-3">
        {otherTeams.map((t) => {
          const v = alloc[t.id] || 0;
          return (
            <motion.div
              key={t.id}
              data-testid={`ballot-team-${t.id}`}
              layout
              className={`poster-card ballot-row ${
                v > 0 ? 'ring-1 ring-carnival-cyan/60' : ''
              }`}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-lg font-semibold">{t.name}</div>
                  {v > 0 && (
                    <span className="pill border border-carnival-cyan/35 bg-carnival-cyan/10 text-carnival-cyan">
                      {v} pts assigned
                    </span>
                  )}
                </div>
                <label htmlFor={`points-${t.id}`} className="text-sm text-muted">Points for {t.name}</label>
              </div>
              <div className="ballot-stepper">
                <button
                  className="icon-button text-xl font-bold"
                  onClick={() => setPoints(t.id, v - 1)}
                  aria-label={`Remove one point from ${t.name}`}
                  disabled={saving || v <= 0}
                >
                  −
                </button>
                <input
                  type="number"
                  id={`points-${t.id}`}
                  min={0}
                  max={budget}
                  value={v}
                  disabled={saving}
                  onChange={(e) => setPoints(t.id, Number(e.target.value))}
                  className="w-16 text-center input !py-2 !px-1 font-display text-xl"
                />
                <button
                  className="icon-button text-xl font-bold"
                  onClick={() => setPoints(t.id, v + 1)}
                  aria-label={`Add one point to ${t.name}`}
                  disabled={saving || v >= budget}
                >
                  +
                </button>
              </div>
            </motion.div>
          );
        })}
        {otherTeams.length === 0 && (
          <div className="poster-card text-muted col-span-full text-center">
            No other teams to vote for yet.
          </div>
        )}
      </div>
    </div>
  );
}
