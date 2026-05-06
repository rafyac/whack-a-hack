import csurf from 'csurf';
import {
  Router,
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z } from 'zod';
import {
  db,
  type SessionRow,
  type TeamKind,
  type TeamRow,
  type VoteRow,
} from './db.js';
import {
  ADMIN_CODE,
  generateAnimalTeamNames,
  generatePassword,
  sign,
  unsign,
} from './auth.js';
import { budgetForTeam, validateAllocations } from './vote-logic.js';

const TEAM_COOKIE = 'team_session';
const ADMIN_COOKIE = 'admin_session';
const CSRF_COOKIE = 'csrf_session';
const CSRF_HEADER = 'x-csrf-token';
const DEFAULT_JUDGE_NAME = 'Commissioner';
const cookieSecure =
  process.env.COOKIE_SECURE === undefined
    ? process.env.NODE_ENV === 'production'
    : process.env.COOKIE_SECURE === 'true';

type AuthedRequest = Request & { team?: TeamRow };

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

async function getSession(id: number): Promise<SessionRow | null> {
  return db.maybeOne<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
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

async function teamFromCookie(req: Request): Promise<TeamRow | null> {
  const raw = req.cookies?.[TEAM_COOKIE];
  if (!raw) return null;
  const value = unsign(raw);
  if (!value) return null;
  const id = Number(value);
  if (!Number.isFinite(id)) return null;
  return db.maybeOne<TeamRow>('SELECT * FROM teams WHERE id = ?', [id]);
}

function isAdmin(req: Request): boolean {
  const raw = req.cookies?.[ADMIN_COOKIE];
  if (!raw) return false;
  return unsign(raw) === 'admin';
}

const requireTeam: RequestHandler = asyncHandler(async (req, res, next) => {
  const team = await teamFromCookie(req);
  if (!team) {
    res.status(401).json({ error: 'not authenticated' });
    return;
  }
  (req as AuthedRequest).team = team;
  next();
});

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
  secure: cookieSecure,
  path: '/',
  maxAge: 1000 * 60 * 60 * 12,
};

const clearCookieOpts = {
  httpOnly: cookieOpts.httpOnly,
  sameSite: cookieOpts.sameSite,
  secure: cookieOpts.secure,
  path: cookieOpts.path,
};

const csrfCookieOpts = {
  key: CSRF_COOKIE,
  httpOnly: true,
  sameSite: cookieOpts.sameSite,
  secure: cookieOpts.secure,
  path: cookieOpts.path,
  maxAge: cookieOpts.maxAge,
};

const clearCsrfCookieOpts = {
  ...clearCookieOpts,
  sameSite: csrfCookieOpts.sameSite,
  secure: csrfCookieOpts.secure,
  path: csrfCookieOpts.path,
};

const issueCsrfToken = csurf({
  cookie: csrfCookieOpts,
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS', 'POST'],
});

const requireCsrf = csurf({
  cookie: csrfCookieOpts,
  value: (req) => req.get(CSRF_HEADER) || '',
});

async function getSessionTeams(sessionId: number): Promise<TeamRow[]> {
  return db.many<TeamRow>(
    `SELECT * FROM teams
     WHERE session_id = ?
     ORDER BY CASE WHEN kind = 'judge' THEN 0 ELSE 1 END, created_at`,
    [sessionId]
  );
}

async function createTeamRow(
  executor: Pick<typeof db, 'maybeOne' | 'one'>,
  sessionId: number,
  payload: { name: string; password?: string; kind?: TeamKind }
): Promise<TeamRow | { error: string; status: number }> {
  const name = payload.name.trim();
  const kind = payload.kind ?? 'team';
  const password = payload.password?.trim() || generatePassword();

  if (kind === 'judge') {
    const existingJudge = await executor.maybeOne<{ id: number }>(
      "SELECT id FROM teams WHERE session_id = ? AND kind = 'judge'",
      [sessionId]
    );
    if (existingJudge) {
      return { error: 'this session already has a commissioner entry', status: 409 };
    }
  }

  const nameClash = await executor.maybeOne<{ id: number }>(
    'SELECT id FROM teams WHERE session_id = ? AND lower(name) = lower(?)',
    [sessionId, name]
  );
  if (nameClash) {
    return { error: 'team name already exists in this session', status: 409 };
  }

  try {
    return await executor.one<TeamRow>(
      `INSERT INTO teams (session_id, name, password, kind)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
      [sessionId, name, password, kind]
    );
  } catch (error) {
    console.error('create-team failed', error);
    return { error: 'failed to create team', status: 500 };
  }
}

export const api = Router();

api.get(
  '/me',
  issueCsrfToken,
  asyncHandler(async (req, res) => {
    const team = await teamFromCookie(req);
    const session = team ? await getSession(team.session_id) : null;
    const admin = isAdmin(req);
    const csrfToken = team || admin ? req.csrfToken() : null;
    res.json({
      team: team ? publicTeam(team) : null,
      admin,
      session: session ? publicSession(session) : null,
      csrfToken,
    });
  })
);

api.get(
  '/sessions/open',
  asyncHandler(async (_req, res) => {
    const rows = await db.many<SessionRow>(
      `SELECT * FROM sessions
       WHERE status = 'open'
       ORDER BY lower(name)`
    );
    res.json({ sessions: rows.map(publicSession) });
  })
);

api.get(
  '/sessions/results',
  asyncHandler(async (_req, res) => {
    const rows = await db.many<SessionRow>(
      `SELECT * FROM sessions
       WHERE status = 'closed'
       ORDER BY updated_at DESC, lower(name)`
    );
    res.json({ sessions: rows.map(publicSession) });
  })
);

api.get(
  '/sessions/:id/teams',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'bad id' });
      return;
    }
    const session = await getSession(id);
    if (!session) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    const teams = await db.many<Pick<TeamRow, 'id' | 'name' | 'kind'>>(
      `SELECT id, name, kind
       FROM teams
       WHERE session_id = ? AND kind = 'team'
       ORDER BY lower(name)`,
      [id]
    );
    res.json({ teams, session: publicSession(session) });
  })
);

api.post(
  '/auth/login',
  issueCsrfToken,
  asyncHandler(async (req, res) => {
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
    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    if (session.status !== 'open') {
      res.status(409).json({ error: `session is ${session.status}` });
      return;
    }

    const team = await db.maybeOne<TeamRow>(
      'SELECT * FROM teams WHERE session_id = ? AND lower(name) = lower(?)',
      [sessionId, name]
    );
    if (!team || team.password !== password) {
      res.status(401).json({ error: 'invalid name or password' });
      return;
    }

    res.cookie(TEAM_COOKIE, sign(String(team.id)), cookieOpts);
    const csrfToken = req.csrfToken();
    res.json({ team: publicTeam(team), session: publicSession(session), csrfToken });
  })
);

api.post('/auth/logout', requireCsrf, (_req, res) => {
  res.clearCookie(TEAM_COOKIE, clearCookieOpts);
  res.clearCookie(CSRF_COOKIE, clearCsrfCookieOpts);
  res.json({ ok: true, csrfToken: null });
});

api.get(
  '/votes/mine',
  requireTeam,
  asyncHandler(async (req, res) => {
    const team = (req as AuthedRequest).team!;
    const session = await getSession(team.session_id);
    if (!session) {
      res.status(404).json({ error: 'session not found' });
      return;
    }

    const rows = await db.many<Pick<VoteRow, 'target_team_id' | 'points'>>(
      'SELECT target_team_id, points FROM votes WHERE voter_team_id = ?',
      [team.id]
    );
    const allocations = rows.map((row) => ({
      teamId: row.target_team_id,
      points: row.points,
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
  })
);

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

api.put(
  '/votes/mine',
  requireTeam,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const voter = (req as AuthedRequest).team!;
    const session = await getSession(voter.session_id);
    if (!session) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    if (session.status !== 'open') {
      res.status(409).json({ error: `voting is ${session.status}` });
      return;
    }

    const parsed = allocSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid allocations' });
      return;
    }

    const targets = await db.many<Pick<TeamRow, 'id' | 'kind'>>(
      'SELECT id, kind FROM teams WHERE session_id = ?',
      [voter.session_id]
    );
    const validTargets = new Map<number, TeamKind>();
    for (const target of targets) validTargets.set(target.id, target.kind);

    const validationError = validateAllocations({
      allocations: parsed.data.allocations,
      voterTeamId: voter.id,
      validTargets,
      budget: budgetForTeam(voter.kind, {
        pointsPerTeam: session.points_per_team,
        judgePoints: session.judge_points,
      }),
    });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    await db.withTransaction(async (tx) => {
      await tx.query('DELETE FROM votes WHERE voter_team_id = ?', [voter.id]);
      for (const allocation of parsed.data.allocations) {
        if (allocation.points > 0) {
          await tx.query(
            `INSERT INTO votes (voter_team_id, target_team_id, points)
             VALUES (?, ?, ?)`,
            [voter.id, allocation.teamId, allocation.points]
          );
        }
      }
    });

    res.json({ ok: true });
  })
);

api.get(
  '/sessions/:id/results',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'bad id' });
      return;
    }

    const session = await getSession(id);
    if (!session) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    if (session.status !== 'closed') {
      res.status(403).json({ error: 'results are not yet public' });
      return;
    }

    const results = await db.many<{ id: number; name: string; total: number }>(
      `SELECT t.id, t.name, COALESCE(SUM(v.points), 0) AS total
       FROM teams t
       LEFT JOIN votes v ON v.target_team_id = t.id
       WHERE t.session_id = ? AND t.kind = 'team'
       GROUP BY t.id, t.name
       ORDER BY total DESC, lower(t.name)`,
      [id]
    );
    res.json({ results, session: publicSession(session) });
  })
);

api.post('/admin/login', issueCsrfToken, (req, res) => {
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
  const csrfToken = req.csrfToken();
  res.json({ ok: true, csrfToken });
});

api.post('/admin/logout', requireCsrf, (_req, res) => {
  res.clearCookie(ADMIN_COOKIE, clearCookieOpts);
  res.clearCookie(CSRF_COOKIE, clearCsrfCookieOpts);
  res.json({ ok: true, csrfToken: null });
});

api.get(
  '/admin/sessions',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await db.many<SessionRow>('SELECT * FROM sessions ORDER BY created_at DESC');
    res.json({ sessions: rows.map(publicSession) });
  })
);

api.post(
  '/admin/sessions',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
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

    const exists = await db.maybeOne<{ id: number }>(
      'SELECT id FROM sessions WHERE lower(name) = lower(?)',
      [parsed.data.name]
    );
    if (exists) {
      res.status(409).json({ error: 'session name already exists' });
      return;
    }

    try {
      const created = await db.withTransaction(async (tx) => {
        const session = await tx.one<SessionRow>(
          `INSERT INTO sessions (name, points_per_team, judge_points)
           VALUES (?, ?, ?)
           RETURNING *`,
          [parsed.data.name, parsed.data.pointsPerTeam, parsed.data.judgePoints]
        );
        const judge = await createTeamRow(tx, session.id, {
          name: DEFAULT_JUDGE_NAME,
          kind: 'judge',
        });
        if ('error' in judge) {
          throw new Error(judge.error);
        }
        return { session, judge };
      });

      res.json({
        session: publicSession(created.session),
        judge: adminTeamRow(created.judge),
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'failed to create session' });
    }
  })
);

api.patch(
  '/admin/sessions/:id',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'bad id' });
      return;
    }

    const current = await getSession(id);
    if (!current) {
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

    if (parsed.data.name && parsed.data.name !== current.name) {
      const taken = await db.maybeOne<{ id: number }>(
        'SELECT id FROM sessions WHERE lower(name) = lower(?) AND id <> ?',
        [parsed.data.name, id]
      );
      if (taken) {
        res.status(409).json({ error: 'session name already exists' });
        return;
      }
    }

    const next = {
      name: parsed.data.name ?? current.name,
      status: parsed.data.status ?? current.status,
      points_per_team: parsed.data.pointsPerTeam ?? current.points_per_team,
      judge_points: parsed.data.judgePoints ?? current.judge_points,
    };

    if (
      next.points_per_team !== current.points_per_team ||
      next.judge_points !== current.judge_points
    ) {
      await db.query(
        `DELETE FROM votes
         WHERE voter_team_id IN (SELECT id FROM teams WHERE session_id = ?)`,
        [id]
      );
    }

    const updated = await db.one<SessionRow>(
      `UPDATE sessions
       SET name = ?, status = ?, points_per_team = ?, judge_points = ?,
           updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT
       WHERE id = ?
       RETURNING *`,
      [next.name, next.status, next.points_per_team, next.judge_points, id]
    );

    res.json({ session: publicSession(updated) });
  })
);

api.delete(
  '/admin/sessions/:id',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'bad id' });
      return;
    }
    await db.query('DELETE FROM sessions WHERE id = ?', [id]);
    res.json({ ok: true });
  })
);

api.post(
  '/admin/sessions/:id/reset',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'bad id' });
      return;
    }
    if (!(await getSession(id))) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    await db.query(
      `DELETE FROM votes
       WHERE voter_team_id IN (SELECT id FROM teams WHERE session_id = ?)`,
      [id]
    );
    res.json({ ok: true });
  })
);

api.get(
  '/admin/sessions/:id/teams',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'bad id' });
      return;
    }
    if (!(await getSession(id))) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    res.json({ teams: (await getSessionTeams(id)).map(adminTeamRow) });
  })
);

api.post(
  '/admin/sessions/:id/teams',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'bad id' });
      return;
    }
    if (!(await getSession(id))) {
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

    const created = await createTeamRow(db, id, parsed.data);
    if ('error' in created) {
      res.status(created.status).json({ error: created.error });
      return;
    }
    res.json({ team: adminTeamRow(created) });
  })
);

api.post(
  '/admin/sessions/:id/teams/bulk',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'bad id' });
      return;
    }
    if (!(await getSession(id))) {
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

    const existingNames = (await getSessionTeams(id))
      .filter((team) => team.kind === 'team')
      .map((team) => team.name);
    const names = generateAnimalTeamNames(parsed.data.count, existingNames);

    try {
      const inserted = await db.withTransaction(async (tx) => {
        const created: TeamRow[] = [];
        for (const name of names) {
          const team = await createTeamRow(tx, id, { name, kind: 'team' });
          if ('error' in team) {
            throw new Error(team.error);
          }
          created.push(team);
        }
        return created;
      });

      res.json({ teams: inserted.map(adminTeamRow) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'failed to generate teams' });
    }
  })
);

api.patch(
  '/admin/teams/:teamId',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const teamId = Number(req.params.teamId);
    if (!Number.isFinite(teamId)) {
      res.status(400).json({ error: 'bad id' });
      return;
    }

    const team = await db.maybeOne<TeamRow>('SELECT * FROM teams WHERE id = ?', [teamId]);
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
      const taken = await db.maybeOne<{ id: number }>(
        'SELECT id FROM teams WHERE session_id = ? AND lower(name) = lower(?) AND id <> ?',
        [team.session_id, parsed.data.name, teamId]
      );
      if (taken) {
        res.status(409).json({ error: 'team name already exists in this session' });
        return;
      }
    }

    const updated = await db.one<TeamRow>(
      `UPDATE teams
       SET name = ?, password = ?
       WHERE id = ?
       RETURNING *`,
      [parsed.data.name ?? team.name, parsed.data.password ?? team.password, teamId]
    );
    res.json({ team: adminTeamRow(updated) });
  })
);

api.delete(
  '/admin/teams/:teamId',
  requireAdmin,
  requireCsrf,
  asyncHandler(async (req, res) => {
    const teamId = Number(req.params.teamId);
    if (!Number.isFinite(teamId)) {
      res.status(400).json({ error: 'bad id' });
      return;
    }

    const team = await db.maybeOne<TeamRow>('SELECT * FROM teams WHERE id = ?', [teamId]);
    if (!team) {
      res.status(404).json({ error: 'team not found' });
      return;
    }
    if (team.kind === 'judge') {
      res.status(409).json({ error: 'commissioner account cannot be deleted' });
      return;
    }

    await db.query('DELETE FROM teams WHERE id = ?', [teamId]);
    res.json({ ok: true });
  })
);

api.get(
  '/admin/sessions/:id/results',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'bad id' });
      return;
    }

    const session = await getSession(id);
    if (!session) {
      res.status(404).json({ error: 'session not found' });
      return;
    }

    const results = await db.many<{ id: number; name: string; total: number; voters: number }>(
      `SELECT t.id, t.name,
              COALESCE(SUM(v.points), 0) AS total,
              COUNT(v.voter_team_id) AS voters
       FROM teams t
       LEFT JOIN votes v ON v.target_team_id = t.id
       WHERE t.session_id = ? AND t.kind = 'team'
       GROUP BY t.id, t.name
       ORDER BY total DESC, lower(t.name)`,
      [id]
    );

    const submitted = await db.one<{ n: number }>(
      `SELECT COUNT(DISTINCT v.voter_team_id) AS n
       FROM votes v
       JOIN teams t ON t.id = v.voter_team_id
       WHERE t.session_id = ?`,
      [id]
    );
    const totalVoters = await db.one<{ n: number }>(
      'SELECT COUNT(*) AS n FROM teams WHERE session_id = ?',
      [id]
    );

    res.json({
      results,
      submitted: submitted.n,
      totalVoters: totalVoters.n,
      session: publicSession(session),
    });
  })
);

api.use(((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if ((error as { code?: string }).code === 'EBADCSRFTOKEN') {
    res.status(403).json({ error: 'csrf validation failed' });
    return;
  }
  console.error('api error', error);
  if (!res.headersSent) {
    res.status(500).json({ error: 'internal server error' });
  }
}) as ErrorRequestHandler);
