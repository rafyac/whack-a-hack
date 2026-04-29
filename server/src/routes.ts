import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import {
  db,
  type SessionRow,
  type TeamRow,
  type VoteRow,
  type TeamKind,
} from './db.js';
import {
  ADMIN_CODE,
  sign,
  unsign,
  generateAnimalTeamNames,
  generatePassword,
} from './auth.js';
import { budgetForTeam, validateAllocations } from './vote-logic.js';

const TEAM_COOKIE = 'team_session';
const ADMIN_COOKIE = 'admin_session';
const DEFAULT_JUDGE_NAME = 'Commissioner';

// ---------- helpers ----------
function getSession(id: number): SessionRow | null {
  return (
    (db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | SessionRow
      | undefined) ?? null
  );
}

function publicSession(s: SessionRow) {
  return {
    id: s.id,
    name: s.name,
    status: s.status,
    pointsPerTeam: s.points_per_team,
    judgePoints: s.judge_points,
  };
}

function publicTeam(t: TeamRow) {
  return { id: t.id, name: t.name, kind: t.kind, sessionId: t.session_id };
}

function adminTeamRow(t: TeamRow) {
  return {
    id: t.id,
    sessionId: t.session_id,
    name: t.name,
    password: t.password,
    kind: t.kind,
    createdAt: t.created_at,
  };
}

function teamFromCookie(req: Request): TeamRow | null {
  const raw = req.cookies?.[TEAM_COOKIE];
  if (!raw) return null;
  const v = unsign(raw);
  if (!v) return null;
  const id = Number(v);
  if (!Number.isFinite(id)) return null;
  return (
    (db.prepare('SELECT * FROM teams WHERE id = ?').get(id) as
      | TeamRow
      | undefined) ?? null
  );
}

function isAdmin(req: Request): boolean {
  const raw = req.cookies?.[ADMIN_COOKIE];
  if (!raw) return false;
  return unsign(raw) === 'admin';
}

function requireTeam(req: Request, res: Response, next: NextFunction) {
  const t = teamFromCookie(req);
  if (!t) {
    res.status(401).json({ error: 'not authenticated' });
    return;
  }
  (req as any).team = t;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdmin(req)) {
    res.status(401).json({ error: 'admin auth required' });
    return;
  }
  next();
}

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 1000 * 60 * 60 * 12,
};

const clearCookieOpts = {
  httpOnly: cookieOpts.httpOnly,
  sameSite: cookieOpts.sameSite,
  secure: cookieOpts.secure,
  path: cookieOpts.path,
};

function getSessionTeams(sessionId: number): TeamRow[] {
  return db
    .prepare(
      `SELECT * FROM teams WHERE session_id = ?
       ORDER BY kind = 'judge' DESC, created_at`
    )
    .all(sessionId) as TeamRow[];
}

function createTeamRow(
  sessionId: number,
  payload: { name: string; password?: string; kind?: TeamKind }
): TeamRow | { error: string; status: number } {
  const name = payload.name.trim();
  const kind = payload.kind ?? 'team';
  const password = payload.password?.trim() || generatePassword();

  if (kind === 'judge') {
    const existingJudge = db
      .prepare("SELECT id FROM teams WHERE session_id = ? AND kind = 'judge'")
      .get(sessionId);
    if (existingJudge) {
      return { error: 'this session already has a commissioner entry', status: 409 };
    }
  }

  const nameClash = db
    .prepare(
      'SELECT id FROM teams WHERE session_id = ? AND name = ? COLLATE NOCASE'
    )
    .get(sessionId, name);
  if (nameClash) {
    return { error: 'team name already exists in this session', status: 409 };
  }

  try {
    const info = db
      .prepare(
        'INSERT INTO teams (session_id, name, password, kind) VALUES (?, ?, ?, ?)'
      )
      .run(sessionId, name, password, kind);
    return db
      .prepare('SELECT * FROM teams WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as TeamRow;
  } catch (e: any) {
    console.error('create-team failed', e);
    return { error: 'failed to create team', status: 500 };
  }
}

export const api = Router();

// ===========================================================================
// Session-aware "me"
// ===========================================================================
api.get('/me', (req, res) => {
  const t = teamFromCookie(req);
  let session: SessionRow | null = null;
  if (t) session = getSession(t.session_id);
  res.json({
    team: t ? publicTeam(t) : null,
    admin: isAdmin(req),
    session: session ? publicSession(session) : null,
  });
});

// ===========================================================================
// Public — list open sessions, list voteable teams in a session
// ===========================================================================
api.get('/sessions/open', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM sessions WHERE status = 'open' ORDER BY name COLLATE NOCASE`
    )
    .all() as SessionRow[];
  res.json({ sessions: rows.map(publicSession) });
});

api.get('/sessions/results', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM sessions WHERE status = 'closed' ORDER BY updated_at DESC, name COLLATE NOCASE`
    )
    .all() as SessionRow[];
  res.json({ sessions: rows.map(publicSession) });
});

api.get('/sessions/:id/teams', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  const session = getSession(id);
  if (!session) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  // Public listing only shows voteable teams (kind='team'). Commissioners are excluded.
  const rows = db
    .prepare(
      `SELECT id, name, kind FROM teams
       WHERE session_id = ? AND kind = 'team'
       ORDER BY name COLLATE NOCASE`
    )
    .all(id);
  res.json({ teams: rows, session: publicSession(session) });
});

// ===========================================================================
// Auth — team login / logout
// ===========================================================================
api.post('/auth/login', (req, res) => {
  const parsed = z
    .object({
      sessionId: z.number().int().positive(),
      name: z.string().trim().min(1),
      password: z.string().min(1),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'sessionId, name and password required' });
    return;
  }
  const { sessionId, name, password } = parsed.data;
  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  if (session.status !== 'open') {
    res.status(409).json({ error: `session is ${session.status}` });
    return;
  }
  const team = db
    .prepare(
      'SELECT * FROM teams WHERE session_id = ? AND name = ? COLLATE NOCASE'
    )
    .get(sessionId, name) as TeamRow | undefined;
  if (!team || team.password !== password) {
    res.status(401).json({ error: 'invalid name or password' });
    return;
  }
  res.cookie(TEAM_COOKIE, sign(String(team.id)), cookieOpts);
  res.json({ team: publicTeam(team), session: publicSession(session) });
});

api.post('/auth/logout', (_req, res) => {
  res.clearCookie(TEAM_COOKIE, clearCookieOpts);
  res.json({ ok: true });
});

// ===========================================================================
// Voting (team-scoped, uses logged-in team's session)
// ===========================================================================
api.get('/votes/mine', requireTeam, (req, res) => {
  const team = (req as any).team as TeamRow;
  const session = getSession(team.session_id)!;
  const rows = db
    .prepare(
      'SELECT target_team_id, points FROM votes WHERE voter_team_id = ?'
    )
    .all(team.id) as Pick<VoteRow, 'target_team_id' | 'points'>[];
  const allocations = rows.map((r) => ({
    teamId: r.target_team_id,
    points: r.points,
  }));
  res.json({
    allocations,
    budget: budgetForTeam(team.kind, {
      pointsPerTeam: session.points_per_team,
      judgePoints: session.judge_points,
    }),
    session: publicSession(session),
    team: publicTeam(team),
  });
});

const allocSchema = z.object({
  allocations: z
    .array(
      z.object({
        teamId: z.number().int().positive(),
        points: z.number().int().nonnegative(),
      })
    )
    .max(500),
});

api.put('/votes/mine', requireTeam, (req, res) => {
  const voter = (req as any).team as TeamRow;
  const session = getSession(voter.session_id)!;
  if (session.status !== 'open') {
    res.status(409).json({ error: `voting is ${session.status}` });
    return;
  }
  const parsed = allocSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid allocations' });
    return;
  }
  const { allocations } = parsed.data;

  // Validate every target is a vote-eligible team in the same session.
  const targets = db
    .prepare(
      `SELECT id, kind, session_id FROM teams WHERE session_id = ?`
    )
    .all(voter.session_id) as Pick<TeamRow, 'id' | 'kind' | 'session_id'>[];
  const valid = new Map<number, TeamKind>();
  for (const t of targets) valid.set(t.id, t.kind);
  const budget = budgetForTeam(voter.kind, {
    pointsPerTeam: session.points_per_team,
    judgePoints: session.judge_points,
  });
  const validationError = validateAllocations({
    allocations,
    voterTeamId: voter.id,
    validTargets: valid,
    budget,
  });
  if (validationError) {
    res.status(400).json({
      error: validationError,
    });
    return;
  }

  const tx = db.transaction((items: typeof allocations) => {
    db.prepare('DELETE FROM votes WHERE voter_team_id = ?').run(voter.id);
    const ins = db.prepare(
      'INSERT INTO votes (voter_team_id, target_team_id, points) VALUES (?, ?, ?)'
    );
    for (const a of items) {
      if (a.points > 0) ins.run(voter.id, a.teamId, a.points);
    }
  });
  tx(allocations);

  res.json({ ok: true });
});

// ===========================================================================
// Public results (only when session is closed)
// ===========================================================================
api.get('/sessions/:id/results', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  const session = getSession(id);
  if (!session) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  if (session.status !== 'closed') {
    res.status(403).json({ error: 'results are not yet public' });
    return;
  }
  const rows = db
    .prepare(
      `SELECT t.id, t.name, COALESCE(SUM(v.points), 0) AS total
       FROM teams t
       LEFT JOIN votes v ON v.target_team_id = t.id
       WHERE t.session_id = ? AND t.kind = 'team'
       GROUP BY t.id
       ORDER BY total DESC, t.name`
    )
    .all(id);
  res.json({ results: rows, session: publicSession(session) });
});

// ===========================================================================
// Admin auth
// ===========================================================================
api.post('/admin/login', (req, res) => {
  const parsed = z.object({ adminCode: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'adminCode required' });
    return;
  }
  if (parsed.data.adminCode !== ADMIN_CODE) {
    res.status(401).json({ error: 'invalid admin code' });
    return;
  }
  res.cookie(ADMIN_COOKIE, sign('admin'), cookieOpts);
  res.json({ ok: true });
});

api.post('/admin/logout', (_req, res) => {
  res.clearCookie(ADMIN_COOKIE, clearCookieOpts);
  res.json({ ok: true });
});

// ===========================================================================
// Admin — sessions CRUD
// ===========================================================================
api.get('/admin/sessions', requireAdmin, (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM sessions ORDER BY created_at DESC')
    .all() as SessionRow[];
  res.json({ sessions: rows.map(publicSession) });
});

api.post('/admin/sessions', requireAdmin, (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      pointsPerTeam: z.number().int().min(1).max(1000).default(10),
      judgePoints: z.number().int().min(1).max(10000).default(30),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid session payload' });
    return;
  }
  const exists = db
    .prepare('SELECT id FROM sessions WHERE name = ? COLLATE NOCASE')
    .get(parsed.data.name);
  if (exists) {
    res.status(409).json({ error: 'session name already exists' });
    return;
  }
  try {
    const created = db.transaction(() => {
      const info = db
        .prepare(
          'INSERT INTO sessions (name, points_per_team, judge_points) VALUES (?, ?, ?)'
        )
        .run(
          parsed.data.name,
          parsed.data.pointsPerTeam,
          parsed.data.judgePoints
        );
      const session = getSession(Number(info.lastInsertRowid))!;
      const judge = createTeamRow(session.id, {
        name: DEFAULT_JUDGE_NAME,
        kind: 'judge',
      });
      if ('error' in judge) {
        throw new Error(judge.error);
      }
      return { session, judge };
    })();
    res.json({
      session: publicSession(created.session),
      judge: adminTeamRow(created.judge),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed to create session' });
  }
});

api.patch('/admin/sessions/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  const cur = getSession(id);
  if (!cur) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      status: z.enum(['setup', 'open', 'closed']).optional(),
      pointsPerTeam: z.number().int().min(1).max(1000).optional(),
      judgePoints: z.number().int().min(1).max(10000).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid update' });
    return;
  }
  if (parsed.data.name && parsed.data.name !== cur.name) {
    const taken = db
      .prepare(
        'SELECT id FROM sessions WHERE name = ? COLLATE NOCASE AND id <> ?'
      )
      .get(parsed.data.name, id);
    if (taken) {
      res.status(409).json({ error: 'session name already exists' });
      return;
    }
  }
  const next = {
    name: parsed.data.name ?? cur.name,
    status: parsed.data.status ?? cur.status,
    points_per_team: parsed.data.pointsPerTeam ?? cur.points_per_team,
    judge_points: parsed.data.judgePoints ?? cur.judge_points,
  };
  // Changing either budget invalidates votes for that session.
  if (
    next.points_per_team !== cur.points_per_team ||
    next.judge_points !== cur.judge_points
  ) {
    db.prepare(
      `DELETE FROM votes
       WHERE voter_team_id IN (SELECT id FROM teams WHERE session_id = ?)`
    ).run(id);
  }
  db.prepare(
    `UPDATE sessions
     SET name = ?, status = ?, points_per_team = ?, judge_points = ?,
         updated_at = strftime('%s','now')
     WHERE id = ?`
  ).run(
    next.name,
    next.status,
    next.points_per_team,
    next.judge_points,
    id
  );
  res.json({ session: publicSession(getSession(id)!) });
});

api.delete('/admin/sessions/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  res.json({ ok: true });
});

api.post('/admin/sessions/:id/reset', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  if (!getSession(id)) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  db.prepare(
    `DELETE FROM votes
     WHERE voter_team_id IN (SELECT id FROM teams WHERE session_id = ?)`
  ).run(id);
  res.json({ ok: true });
});

// ===========================================================================
// Admin — teams (scoped under a session)
// ===========================================================================
api.get('/admin/sessions/:id/teams', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  if (!getSession(id)) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  res.json({ teams: getSessionTeams(id).map(adminTeamRow) });
});

api.post('/admin/sessions/:id/teams', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  if (!getSession(id)) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(60),
      password: z.string().trim().min(1).max(120).optional(),
      kind: z.enum(['team', 'judge']).default('team'),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid team payload' });
    return;
  }
  const created = createTeamRow(id, parsed.data);
  if ('error' in created) {
    res.status(created.status).json({ error: created.error });
    return;
  }
  res.json({ team: adminTeamRow(created) });
});

api.post('/admin/sessions/:id/teams/bulk', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  if (!getSession(id)) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  const parsed = z
    .object({
      count: z.number().int().min(1).max(100),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid bulk payload' });
    return;
  }

  const existingNames = getSessionTeams(id)
    .filter((team) => team.kind === 'team')
    .map((team) => team.name);
  const names = generateAnimalTeamNames(parsed.data.count, existingNames);
  const inserted: TeamRow[] = [];

  const tx = db.transaction((generatedNames: string[]) => {
    for (const name of generatedNames) {
      const created = createTeamRow(id, { name, kind: 'team' });
      if ('error' in created) {
        throw new Error(created.error);
      }
      inserted.push(created);
    }
  });

  try {
    tx(names);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'failed to generate teams' });
    return;
  }

  res.json({
    teams: inserted.map(adminTeamRow),
  });
});

api.patch('/admin/teams/:teamId', requireAdmin, (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!Number.isFinite(teamId)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  const team = db
    .prepare('SELECT * FROM teams WHERE id = ?')
    .get(teamId) as TeamRow | undefined;
  if (!team) {
    res.status(404).json({ error: 'team not found' });
    return;
  }
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(60).optional(),
      password: z.string().trim().min(1).max(120).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid update' });
    return;
  }
  if (parsed.data.name && parsed.data.name !== team.name) {
    const taken = db
      .prepare(
        'SELECT id FROM teams WHERE session_id = ? AND name = ? COLLATE NOCASE AND id <> ?'
      )
      .get(team.session_id, parsed.data.name, teamId);
    if (taken) {
      res
        .status(409)
        .json({ error: 'team name already exists in this session' });
      return;
    }
  }
  const next = {
    name: parsed.data.name ?? team.name,
    password: parsed.data.password ?? team.password,
  };
  db.prepare('UPDATE teams SET name = ?, password = ? WHERE id = ?').run(
    next.name,
    next.password,
    teamId
  );
  const updated = db
    .prepare('SELECT * FROM teams WHERE id = ?')
    .get(teamId) as TeamRow;
  res.json({ team: adminTeamRow(updated) });
});

api.delete('/admin/teams/:teamId', requireAdmin, (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!Number.isFinite(teamId)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  const team = db
    .prepare('SELECT * FROM teams WHERE id = ?')
    .get(teamId) as TeamRow | undefined;
  if (!team) {
    res.status(404).json({ error: 'team not found' });
    return;
  }
  if (team.kind === 'judge') {
    res.status(409).json({ error: 'commissioner account cannot be deleted' });
    return;
  }
  db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);
  res.json({ ok: true });
});

// ===========================================================================
// Admin — live results per session
// ===========================================================================
api.get('/admin/sessions/:id/results', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  const session = getSession(id);
  if (!session) {
    res.status(404).json({ error: 'session not found' });
    return;
  }
  const rows = db
    .prepare(
      `SELECT t.id, t.name,
              COALESCE(SUM(v.points), 0) AS total,
              COUNT(v.voter_team_id) AS voters
       FROM teams t
       LEFT JOIN votes v ON v.target_team_id = t.id
       WHERE t.session_id = ? AND t.kind = 'team'
       GROUP BY t.id
       ORDER BY total DESC, t.name`
    )
    .all(id);
  const submitted = db
    .prepare(
      `SELECT COUNT(DISTINCT v.voter_team_id) AS n
       FROM votes v
       JOIN teams t ON t.id = v.voter_team_id
       WHERE t.session_id = ?`
    )
    .get(id) as { n: number };
  const totalVoters = db
    .prepare(
      `SELECT COUNT(*) AS n FROM teams WHERE session_id = ?`
    )
    .get(id) as { n: number };
  res.json({
    results: rows,
    submitted: submitted.n,
    totalVoters: totalVoters.n,
    session: publicSession(session),
  });
});
