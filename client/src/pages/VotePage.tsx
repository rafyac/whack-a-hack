import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { LogOut, Save, Sparkles, Lock, Gavel } from 'lucide-react';
import { api, type Session, type Team } from '../api';
import { AnimatedNumber } from '../components/AnimatedNumber';

export default function VotePage() {
  const nav = useNavigate();
  const [me, setMe] = useState<Team | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [budget, setBudget] = useState<number>(0);
  const [teams, setTeams] = useState<Team[]>([]);
  const [alloc, setAlloc] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
          api.myVotes().catch(() => null),
        ]);
        setTeams(teams);
        if (mine) {
          const a: Record<number, number> = {};
          for (const x of mine.allocations) a[x.teamId] = x.points;
          setAlloc(a);
          setSession(mine.session);
          setBudget(mine.budget);
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
    const n = Math.max(0, Math.floor(val || 0));
    setAlloc((a) => ({ ...a, [id]: n }));
    setMsg(null);
  }

  async function logout() {
    await api.logout();
    nav('/login', { replace: true });
  }

  async function save() {
    setErr(null);
    setMsg(null);
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
      setMsg('Saved! 🎉');
      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.7 },
        colors: ['#7C3AED', '#EC4899', '#06B6D4', '#A3E635', '#FACC15'],
      });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center text-white/60 py-10">Loading…</div>;

  if (session && session.status !== 'open') {
    return (
      <div className="neon-card text-center max-w-xl mx-auto">
        <Lock className="h-10 w-10 mx-auto text-carnival-yellow mb-3" />
        <h2 className="text-2xl font-bold mb-1">
          Voting is {session.status === 'setup' ? 'not open yet' : 'closed'}
        </h2>
        <p className="text-white/60">
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
              {me?.name}{' '}
              {isJudge ? (
                <span className="text-2xl">⚖️</span>
              ) : (
                <span className="text-2xl">⚡</span>
              )}
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
            Spend exactly <span className="font-semibold text-white">{budget}</span>{' '}
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
        className="neon-card flex items-center justify-between sticky top-[64px] z-10"
      >
        <div>
          <div className="text-sm text-white/60">Points remaining</div>
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
            <span className="text-white/30 text-2xl"> / {budget}</span>
          </div>
          <div className="mt-2 text-sm text-white/45">
            Use every point before saving this ballot.
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={save}
          disabled={saving || remaining !== 0}
        >
          <Save className="h-5 w-5" />
          {saving ? 'Saving…' : 'Save vote'}
        </button>
      </motion.div>

      {msg && (
        <div className="feedback-banner feedback-success flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> {msg}
        </div>
      )}
      {err && (
        <div className="feedback-banner feedback-error">
          {err}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-3">
          <div className="section-kicker">Ballot</div>
          <h2 className="text-2xl font-display font-bold">Allocate your score</h2>
        </div>
        <div className="text-sm text-white/45">
          {otherTeams.length} eligible {otherTeams.length === 1 ? 'team' : 'teams'}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {otherTeams.map((t) => {
          const v = alloc[t.id] || 0;
          return (
            <motion.div
              key={t.id}
              layout
              className={`neon-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
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
                <div className="text-sm text-white/50">Give them some love 💜</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="icon-button text-xl font-bold"
                  onClick={() => setPoints(t.id, v - 1)}
                  disabled={v <= 0}
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={budget}
                  value={v}
                  onChange={(e) => setPoints(t.id, Number(e.target.value))}
                  className="w-16 text-center input !py-2 !px-1 font-display text-xl"
                />
                <button
                  className="icon-button text-xl font-bold"
                  onClick={() => setPoints(t.id, v + 1)}
                >
                  +
                </button>
              </div>
            </motion.div>
          );
        })}
        {otherTeams.length === 0 && (
          <div className="neon-card text-white/60 col-span-full text-center">
            No other teams to vote for yet.
          </div>
        )}
      </div>
    </div>
  );
}
