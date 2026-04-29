export type SessionStatus = 'setup' | 'open' | 'closed';
export type TeamKind = 'team' | 'judge';

export interface Session {
  id: number;
  name: string;
  status: SessionStatus;
  pointsPerTeam: number;
  judgePoints: number;
}

export interface Team {
  id: number;
  name: string;
  kind?: TeamKind;
  sessionId?: number;
}

export interface AdminTeam {
  id: number;
  sessionId: number;
  name: string;
  password: string;
  kind: TeamKind;
  createdAt: number;
}

export interface Allocation {
  teamId: number;
  points: number;
}

export interface ResultRow {
  id: number;
  name: string;
  total: number;
  voters?: number;
}

async function http<T>(
  url: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const opts: RequestInit = {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    body:
      init?.json !== undefined ? JSON.stringify(init.json) : (init?.body as any),
  };
  const res = await fetch(url, opts);
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const message = data?.error || `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  // ---------- Public / team ----------
  me: () =>
    http<{
      team: Team | null;
      admin: boolean;
      session: Session | null;
    }>('/api/me'),

  openSessions: () =>
    http<{ sessions: Session[] }>('/api/sessions/open'),

  resultSessions: () =>
    http<{ sessions: Session[] }>('/api/sessions/results'),

  sessionTeams: (sessionId: number) =>
    http<{ teams: Team[]; session: Session }>(
      `/api/sessions/${sessionId}/teams`
    ),

  login: (sessionId: number, name: string, password: string) =>
    http<{ team: Team; session: Session }>('/api/auth/login', {
      method: 'POST',
      json: { sessionId, name, password },
    }),

  logout: () => http<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

  myVotes: () =>
    http<{
      allocations: Allocation[];
      budget: number;
      session: Session;
      team: Team;
    }>('/api/votes/mine'),

  saveVotes: (allocations: Allocation[]) =>
    http<{ ok: true }>('/api/votes/mine', {
      method: 'PUT',
      json: { allocations },
    }),

  publicResults: (sessionId: number) =>
    http<{ results: ResultRow[]; session: Session }>(
      `/api/sessions/${sessionId}/results`
    ),

  // ---------- Admin ----------
  adminLogin: (adminCode: string) =>
    http<{ ok: true }>('/api/admin/login', {
      method: 'POST',
      json: { adminCode },
    }),
  adminLogout: () =>
    http<{ ok: true }>('/api/admin/logout', { method: 'POST' }),

  adminSessions: () =>
    http<{ sessions: Session[] }>('/api/admin/sessions'),
  adminCreateSession: (payload: {
    name: string;
    pointsPerTeam?: number;
    judgePoints?: number;
  }) =>
    http<{ session: Session; judge: AdminTeam }>('/api/admin/sessions', {
      method: 'POST',
      json: payload,
    }),
  adminUpdateSession: (
    id: number,
    patch: Partial<{
      name: string;
      status: SessionStatus;
      pointsPerTeam: number;
      judgePoints: number;
    }>
  ) =>
    http<{ session: Session }>(`/api/admin/sessions/${id}`, {
      method: 'PATCH',
      json: patch,
    }),
  adminDeleteSession: (id: number) =>
    http<{ ok: true }>(`/api/admin/sessions/${id}`, { method: 'DELETE' }),
  adminResetSession: (id: number) =>
    http<{ ok: true }>(`/api/admin/sessions/${id}/reset`, { method: 'POST' }),

  adminSessionTeams: (sessionId: number) =>
    http<{ teams: AdminTeam[] }>(`/api/admin/sessions/${sessionId}/teams`),
  adminCreateTeam: (
    sessionId: number,
    payload: { name: string; password?: string; kind?: TeamKind }
  ) =>
    http<{ team: AdminTeam }>(`/api/admin/sessions/${sessionId}/teams`, {
      method: 'POST',
      json: payload,
    }),
  adminBulkCreateTeams: (sessionId: number, count: number) =>
    http<{ teams: AdminTeam[] }>(`/api/admin/sessions/${sessionId}/teams/bulk`, {
      method: 'POST',
      json: { count },
    }),
  adminUpdateTeam: (
    teamId: number,
    patch: { name?: string; password?: string }
  ) =>
    http<{ team: AdminTeam }>(`/api/admin/teams/${teamId}`, {
      method: 'PATCH',
      json: patch,
    }),
  adminDeleteTeam: (teamId: number) =>
    http<{ ok: true }>(`/api/admin/teams/${teamId}`, { method: 'DELETE' }),

  adminSessionResults: (sessionId: number) =>
    http<{
      results: ResultRow[];
      submitted: number;
      totalVoters: number;
      session: Session;
    }>(`/api/admin/sessions/${sessionId}/results`),
};
