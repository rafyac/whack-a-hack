import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Copy,
  Check,
  Plus,
  Trash2,
  Play,
  Square,
  RotateCcw,
  Settings,
  Users,
  BarChart3,
  ShieldAlert,
  Loader2,
  Layers,
  Eye,
  EyeOff,
  Pencil,
  Save,
  X,
  Gavel,
} from 'lucide-react';
import {
  api,
  type AdminTeam,
  type ResultRow,
  type Session,
  type SessionStatus,
} from '../api';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { SessionPicker, SessionStatusPill } from '../components/SessionPicker';

type Tab = 'sessions' | 'teams' | 'event' | 'results' | 'reset';
const COMMISSIONER_NAME = 'Commissioner';

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('sessions');

  // Selected session (for teams/event/results/reset tabs)
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        setAuthed(me.admin);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  async function refreshSessions() {
    const { sessions } = await api.adminSessions();
    setSessions(sessions);
    if (activeId == null && sessions.length > 0) setActiveId(sessions[0].id);
    if (activeId != null && !sessions.find((s) => s.id === activeId)) {
      setActiveId(sessions[0]?.id ?? null);
    }
  }

  useEffect(() => {
    if (authed) refreshSessions().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.adminLogin(code);
      setAuthed(true);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  if (authed === null) return <div className="text-center text-white/60 py-10">…</div>;

  if (!authed) {
    return (
      <div className="grid place-items-center pt-10">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="neon-card w-full max-w-md text-center"
        >
          <div className="section-kicker mx-auto">Admin access</div>
          <ShieldAlert className="h-10 w-10 mx-auto text-carnival-pink mb-2" />
          <h1 className="text-2xl font-bold">Admin login</h1>
          <p className="section-copy mb-4">Enter the admin code to open the control room.</p>
          <form onSubmit={login} className="space-y-3">
            <input
              type="password"
              className="input"
              placeholder="admin code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            {err && <div className="feedback-banner feedback-error text-left">{err}</div>}
            <button className="btn-primary w-full">Unlock</button>
          </form>
        </motion.div>
      </div>
    );
  }

  const needsSession = tab !== 'sessions' && active == null;

  return (
    <div className="space-y-6">
      <div className="neon-card flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="section-kicker">Control room</div>
          <h1 className="text-3xl font-display font-bold">
            Run every session from one polished dashboard.
          </h1>
          <p className="section-copy">
            Create sessions, manage teams, keep the commissioner credentials handy,
            and monitor live results without hopping between tools.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[20rem]">
          <div className="subtle-card">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">Sessions</div>
            <div className="mt-2 text-3xl font-display font-bold">{sessions.length}</div>
          </div>
          <div className="subtle-card">
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">
              Active focus
            </div>
            <div className="mt-2 text-lg font-semibold">{active?.name ?? 'Pick a session'}</div>
            <div className="mt-1 text-sm text-white/50 capitalize">
              {active?.status ?? 'No active session yet'}
            </div>
          </div>
        </div>
      </div>

      <div className="neon-card !p-2 flex flex-wrap gap-2">
        <TabBtn active={tab === 'sessions'} onClick={() => setTab('sessions')} icon={<Layers className="h-4 w-4" />}>
          Sessions
        </TabBtn>
        <TabBtn active={tab === 'teams'} onClick={() => setTab('teams')} icon={<Users className="h-4 w-4" />}>
          Teams
        </TabBtn>
        <TabBtn active={tab === 'event'} onClick={() => setTab('event')} icon={<Settings className="h-4 w-4" />}>
          Event
        </TabBtn>
        <TabBtn active={tab === 'results'} onClick={() => setTab('results')} icon={<BarChart3 className="h-4 w-4" />}>
          Live results
        </TabBtn>
        <TabBtn active={tab === 'reset'} onClick={() => setTab('reset')} icon={<RotateCcw className="h-4 w-4" />}>
          Reset
        </TabBtn>
      </div>

      {tab !== 'sessions' && sessions.length > 0 && (
        <div className="neon-card max-w-3xl !p-5">
          <SessionPicker
            label="Active session"
            sessions={sessions}
            value={activeId}
            onChange={setActiveId}
            testId="admin-active-session-picker"
          />
        </div>
      )}

      {needsSession ? (
        <div className="feedback-banner feedback-info text-center">
          Create or select a session in the <strong>Sessions</strong> tab first.
        </div>
      ) : (
        <>
          {tab === 'sessions' && (
            <SessionsTab
              sessions={sessions}
              activeId={activeId}
              setActiveId={setActiveId}
              refresh={refreshSessions}
            />
          )}
          {tab === 'teams' && active && <TeamsTab session={active} />}
          {tab === 'event' && active && (
            <EventTab session={active} onUpdated={refreshSessions} />
          )}
          {tab === 'results' && active && <ResultsTab session={active} />}
          {tab === 'reset' && active && (
            <ResetTab session={active} onReset={refreshSessions} />
          )}
        </>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`pill ${
        active
          ? 'bg-white text-slate-900 shadow-[0_18px_40px_-28px_rgba(255,255,255,0.95)]'
          : 'bg-white/5 text-white/70 hover:bg-white/10'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ============================================================================
// Sessions tab
// ============================================================================
function SessionsTab({
  sessions,
  activeId,
  setActiveId,
  refresh,
}: {
  sessions: Session[];
  activeId: number | null;
  setActiveId: (id: number) => void;
  refresh: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [pointsPerTeam, setPointsPerTeam] = useState(10);
  const [judgePoints, setJudgePoints] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      const { session, judge: commissioner } = await api.adminCreateSession({
        name: name.trim(),
        pointsPerTeam,
        judgePoints,
      });
      setName('');
      await refresh();
      setActiveId(session.id);
      setNotice(
        `Session created. "${commissioner.name}" was added automatically as the commissioner login for this session.`
      );
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Session) {
    if (
      !confirm(
        `Delete session "${s.name}"? All teams and votes for it will be removed.`
      )
    )
      return;
    await api.adminDeleteSession(s.id);
    await refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="neon-card grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
        <div className="sm:col-span-full space-y-3">
          <div className="section-kicker">New session</div>
          <p className="section-copy max-w-2xl text-sm">
            Every session gets its own team budget, commissioner budget, and
            auto-created commissioner login.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Name</div>
          <input
            className="input"
            placeholder="e.g. Spring Hackathon 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50 mb-1">
            Points/team
          </div>
          <input
            type="number"
            min={1}
            max={1000}
            className="input w-24 text-center"
            value={pointsPerTeam}
            onChange={(e) =>
              setPointsPerTeam(Math.max(1, Number(e.target.value)))
            }
          />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50 mb-1">
            Commissioner points
          </div>
          <input
            type="number"
            min={1}
            max={10000}
            className="input w-24 text-center"
            value={judgePoints}
            onChange={(e) =>
              setJudgePoints(Math.max(1, Number(e.target.value)))
            }
          />
        </div>
        <button className="btn-primary" disabled={busy || !name.trim()}>
          <Plus className="h-4 w-4" /> Create
        </button>
      </form>
      {err && <div className="feedback-banner feedback-error">{err}</div>}
      {notice && <div className="feedback-banner feedback-success">{notice}</div>}

      <div className="neon-card">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-3">
            <div className="section-kicker">Session lineup</div>
            <h3 className="font-bold text-2xl">Sessions ({sessions.length})</h3>
          </div>
          <div className="text-sm text-white/45">Pick one to focus the rest of the dashboard.</div>
        </div>
        {sessions.length === 0 ? (
          <div className="text-white/60">No sessions yet.</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="active"
                    checked={s.id === activeId}
                    onChange={() => setActiveId(s.id)}
                    className="accent-carnival-pink"
                  />
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-white/50">
                      Team budget {s.pointsPerTeam} · commissioner budget{' '}
                      {s.judgePoints}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <SessionStatusPill status={s.status} />
                  <button
                    className="text-carnival-pink hover:text-white text-sm flex items-center gap-1"
                    onClick={() => remove(s)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Teams tab
// ============================================================================
function TeamsTab({ session }: { session: Session }) {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [bulkCount, setBulkCount] = useState(4);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const commissioner = teams.find((team) => team.kind === 'judge') ?? null;
  const regularTeams = teams.filter((team) => team.kind === 'team');

  async function refresh() {
    setLoading(true);
    try {
      const { teams } = await api.adminSessionTeams(session.id);
      setTeams(teams);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    setErr(null);
    setNotice(null);
    setReveal({});
    setEditing(null);
    setName('');
    setPassword('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      await api.adminCreateTeam(session.id, {
        name: name.trim(),
        password: password.trim() || undefined,
        kind: 'team',
      });
      setName('');
      setPassword('');
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function bulkGenerate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      const { teams: created } = await api.adminBulkCreateTeams(
        session.id,
        bulkCount
      );
      setNotice(
        `${session.name}: Generated ${created.length} animal-themed ${
          created.length === 1 ? 'team' : 'teams'
        }.`
      );
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: AdminTeam) {
    if (!confirm(`Delete team "${t.name}"? Their votes are removed too.`)) return;
    await api.adminDeleteTeam(t.id);
    await refresh();
  }

  function startEdit(t: AdminTeam) {
    setEditing(t.id);
    setEditName(t.name);
    setEditPassword(t.password);
  }

  async function saveEdit(t: AdminTeam) {
    setErr(null);
    try {
      await api.adminUpdateTeam(t.id, {
        name: editName.trim(),
        password: editPassword.trim(),
      });
      setEditing(null);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function copy(id: number, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  }

  async function createCommissioner() {
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      await api.adminCreateTeam(session.id, {
        name: COMMISSIONER_NAME,
        kind: 'judge',
      });
      setNotice('Commissioner account created for this older session.');
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="neon-card flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-white/50">
            Commissioner login
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {commissioner?.name ?? 'Commissioner account missing'}
          </div>
          <p className="mt-1 text-sm text-white/60">
            Commissioners sign in through the normal login page and distribute the{' '}
            <span className="font-semibold text-white">{session.judgePoints} point</span>{' '}
            budget across teams. A commissioner account is created automatically for every
            new session.
          </p>
        </div>
        {loading ? (
          <div className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white/60">
            Loading commissioner credentials…
          </div>
        ) : commissioner ? (
          <div
            className="w-full rounded-[1.5rem] border border-white/12 bg-white/[0.05] p-4 lg:w-auto lg:min-w-[26rem]"
            data-testid="commissioner-credentials"
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center">
              {editing === commissioner.id ? (
                <input
                  className="input !py-2"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-carnival-yellow" />
                  <span className="font-semibold">{commissioner.name}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                {editing === commissioner.id ? (
                  <input
                    className="input !py-2 font-mono"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                ) : (
                  <code className="flex-1 rounded-lg bg-black/40 px-3 py-2 font-mono text-sm tracking-wide text-carnival-yellow">
                    {reveal[commissioner.id] ? commissioner.password : '••••••••••'}
                  </code>
                )}
                {editing !== commissioner.id && (
                  <>
                    <button
                      className="btn-ghost !px-2 !py-2"
                      onClick={() =>
                        setReveal((current) => ({
                          ...current,
                          [commissioner.id]: !current[commissioner.id],
                        }))
                      }
                      title="Show commissioner password"
                    >
                      {reveal[commissioner.id] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      className="btn-ghost !px-2 !py-2"
                      onClick={() => copy(commissioner.id, commissioner.password)}
                      title="Copy commissioner password"
                    >
                      {copiedId === commissioner.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                {editing === commissioner.id ? (
                  <>
                    <button
                      className="btn-primary !px-3 !py-2"
                      onClick={() => saveEdit(commissioner)}
                    >
                      <Save className="h-4 w-4" /> Save
                    </button>
                    <button
                      className="btn-ghost !px-2 !py-2"
                      onClick={() => setEditing(null)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-ghost !px-3 !py-2"
                    onClick={() => startEdit(commissioner)}
                    title="Edit commissioner credentials"
                  >
                    <Pencil className="h-4 w-4" /> Edit commissioner
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-carnival-pink/30 bg-carnival-pink/10 px-4 py-3 text-sm text-carnival-pink">
            <span>This older session does not have a commissioner account yet.</span>
            <button
              className="btn-primary !px-3 !py-2"
              onClick={createCommissioner}
              disabled={busy}
            >
              <Gavel className="h-4 w-4" /> Create commissioner
            </button>
          </div>
        )}
      </div>

      <form onSubmit={add} className="neon-card grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div className="sm:col-span-full space-y-3">
          <div className="section-kicker">Team setup</div>
          <p className="section-copy max-w-2xl text-sm">
            Keep participant access tidy, then share the commissioner login beside it.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Name</div>
          <input
            className="input"
            placeholder="Team name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50 mb-1">
            Password (optional)
          </div>
          <input
            className="input"
            placeholder="auto-generated if blank"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn-primary" disabled={busy || !name.trim()}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
      <form
        onSubmit={bulkGenerate}
        className="neon-card grid sm:grid-cols-[1fr_auto] gap-3 items-end"
      >
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50 mb-1">
            Auto-generate teams
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="number"
              min={1}
              max={100}
              className="input w-28 text-center"
              value={bulkCount}
              onChange={(e) =>
                setBulkCount(
                  Math.min(100, Math.max(1, Number(e.target.value) || 1))
                )
              }
            />
            <p className="text-sm text-white/60">
              Create that many teams with animal-kingdom names and auto-generated
              passwords.
            </p>
          </div>
        </div>
        <button className="btn-primary" disabled={busy || bulkCount < 1}>
          <Users className="h-4 w-4" /> Generate
        </button>
      </form>
      {err && <div className="feedback-banner feedback-error">{err}</div>}
      {notice && <div className="feedback-banner feedback-success">{notice}</div>}

      <div className="neon-card">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-3">
            <div className="section-kicker">Teams roster</div>
            <h3 className="font-bold text-2xl">{session.name} — teams ({regularTeams.length})</h3>
          </div>
          <div className="text-sm text-white/45">
            Passwords stay editable so you can recover fast during check-in.
          </div>
        </div>
        {loading ? (
          <div className="text-white/60">Loading…</div>
        ) : regularTeams.length === 0 ? (
          <div className="text-white/60">No teams yet.</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {regularTeams.map((t) => {
              const isEditing = editing === t.id;
              const shown = reveal[t.id];
              return (
                <li key={t.id} className="py-2 grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-center">
                  {isEditing ? (
                    <input
                      className="input !py-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  ) : (
                     <div className="flex items-center gap-2">
                       <span className="font-semibold">{t.name}</span>
                     </div>
                   )}

                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input
                        className="input !py-1 font-mono"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                      />
                    ) : (
                      <code className="flex-1 rounded-lg bg-black/40 px-2 py-1 font-mono text-sm text-carnival-yellow tracking-wide">
                        {shown ? t.password : '••••••••••'}
                      </code>
                    )}
                    {!isEditing && (
                      <>
                        <button
                          className="btn-ghost !py-1 !px-2"
                          onClick={() =>
                            setReveal((r) => ({ ...r, [t.id]: !r[t.id] }))
                          }
                          title={shown ? 'Hide' : 'Show'}
                        >
                          {shown ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          className="btn-ghost !py-1 !px-2"
                          onClick={() => copy(t.id, t.password)}
                          title="Copy password"
                        >
                          {copiedId === t.id ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    {isEditing ? (
                      <>
                        <button
                          className="btn-primary !py-1 !px-2"
                          onClick={() => saveEdit(t)}
                        >
                          <Save className="h-4 w-4" /> Save
                        </button>
                        <button
                          className="btn-ghost !py-1 !px-2"
                          onClick={() => setEditing(null)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-ghost !py-1 !px-2"
                          onClick={() => startEdit(t)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="text-carnival-pink hover:text-white text-sm flex items-center gap-1"
                          onClick={() => remove(t)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Event tab — per session settings + status controls
// ============================================================================
function EventTab({
  session,
  onUpdated,
}: {
  session: Session;
  onUpdated: () => Promise<void>;
}) {
  const [points, setPoints] = useState(session.pointsPerTeam);
  const [judgePoints, setJudgePoints] = useState(session.judgePoints);
  const [name, setName] = useState(session.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setPoints(session.pointsPerTeam);
    setJudgePoints(session.judgePoints);
    setName(session.name);
  }, [session.id, session.pointsPerTeam, session.judgePoints, session.name]);

  async function setStatus(status: SessionStatus) {
    setBusy(true);
    try {
      await api.adminUpdateSession(session.id, { status });
      await onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function applyBudgets() {
    setErr(null);
    if (
      points !== session.pointsPerTeam ||
      judgePoints !== session.judgePoints
    ) {
      if (!confirm('Changing the points budgets will reset all votes for this session. Continue?'))
        return;
    }
    setBusy(true);
    try {
      await api.adminUpdateSession(session.id, {
        name: name.trim(),
        pointsPerTeam: points,
        judgePoints,
      });
      await onUpdated();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="neon-card">
        <div className="section-kicker">Event status</div>
        <div className="text-3xl font-display font-bold capitalize">
          {session.status === 'open' ? '🟢 ' : session.status === 'closed' ? '🔴 ' : '⚪ '}
          {session.status}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn-ghost"
            disabled={busy || session.status === 'setup'}
            onClick={() => setStatus('setup')}
          >
            Setup
          </button>
          <button
            className="btn-primary"
            disabled={busy || session.status === 'open'}
            onClick={() => setStatus('open')}
          >
            <Play className="h-4 w-4" /> Open voting
          </button>
          <button
            className="btn-ghost"
            disabled={busy || session.status === 'closed'}
            onClick={() => setStatus('closed')}
          >
            <Square className="h-4 w-4" /> Close voting
          </button>
        </div>
      </div>

      <div className="neon-card space-y-3">
        <div className="space-y-3">
          <div className="section-kicker">Session settings</div>
          <p className="section-copy text-sm">
            Tune the public session name and both voting budgets in one place.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/50 mb-1">
            Session name
          </div>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-1">
              Points per team
            </div>
            <input
              type="number"
              min={1}
              max={1000}
              className="input text-center font-display text-xl"
              value={points}
              onChange={(e) => setPoints(Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50 mb-1">
              Commissioner points
            </div>
            <input
              type="number"
              min={1}
              max={10000}
              className="input text-center font-display text-xl"
              value={judgePoints}
              onChange={(e) =>
                setJudgePoints(Math.max(1, Number(e.target.value)))
              }
            />
          </div>
        </div>
        <button className="btn-primary" disabled={busy} onClick={applyBudgets}>
          Apply
        </button>
        <p className="text-xs text-white/50">
          Each team distributes their budget across the others. The commissioner
          distributes their (separate) budget across all teams.
        </p>
        {err && <div className="feedback-banner feedback-error">{err}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// Live results
// ============================================================================
function ResultsTab({ session }: { session: Session }) {
  const [data, setData] = useState<{
    results: ResultRow[];
    submitted: number;
    totalVoters: number;
    session: Session;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const d = await api.adminSessionResults(session.id);
        if (alive) setData(d);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [session.id]);

  if (!data) return <div className="text-white/60">Loading…</div>;
  const max = Math.max(1, ...data.results.map((r) => r.total));

  return (
    <div className="space-y-4">
      <div className="neon-card grid gap-3 text-center sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Status" value={data.session.status} />
        <Stat label="Submitted" value={`${data.submitted} / ${data.totalVoters}`} />
        <Stat label="Pts/team" value={String(data.session.pointsPerTeam)} />
        <Stat label="Commissioner pts" value={String(data.session.judgePoints)} />
      </div>
      <div className="space-y-3">
        {data.results.map((r, i) => (
          <motion.div key={r.id} layout className="neon-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-white/50 w-6 text-right">#{i + 1}</span>
                <span className="text-lg font-semibold">{r.name}</span>
              </div>
              <div className="text-xl font-display font-bold text-carnival-cyan">
                <AnimatedNumber value={r.total} />
                <span className="text-white/40 text-sm font-sans"> pts</span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <motion.div
                animate={{ width: `${(r.total / max) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-carnival-cyan via-carnival-purple to-carnival-pink"
              />
            </div>
          </motion.div>
        ))}
        {data.results.length === 0 && (
          <div className="neon-card text-white/60 text-center">No teams yet.</div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="subtle-card">
      <div className="text-xs uppercase tracking-widest text-white/50">{label}</div>
      <div className="text-2xl font-display font-bold capitalize">{value}</div>
    </div>
  );
}

// ============================================================================
// Reset (clears votes for the active session only)
// ============================================================================
function ResetTab({
  session,
  onReset,
}: {
  session: Session;
  onReset: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    if (
      !confirm(
        `⚠️ Clear all votes for "${session.name}"? Teams remain. This cannot be undone.`
      )
    )
      return;
    setBusy(true);
    try {
      await api.adminResetSession(session.id);
      await onReset();
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="neon-card text-center">
      <div className="section-kicker mx-auto">Reset session</div>
      <RotateCcw className="h-10 w-10 mx-auto text-carnival-pink mb-2" />
      <h2 className="text-2xl font-bold mb-1">Reset votes</h2>
      <p className="text-white/60 mb-4">
        Wipes all votes for <strong>{session.name}</strong>. Teams and session
        config are kept.
      </p>
      <button className="btn-primary" onClick={reset} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset votes'}
      </button>
      {done && <div className="feedback-banner feedback-success mt-3">Done. Fresh slate ✨</div>}
    </div>
  );
}
