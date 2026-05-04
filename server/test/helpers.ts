import supertest from 'supertest';

process.env.NODE_ENV = 'test';
process.env.ADMIN_CODE = 'test-admin';
process.env.COOKIE_SECRET = 'test-cookie-secret';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/whack_a_hack_test';
process.env.DATABASE_SSL_MODE = process.env.DATABASE_SSL_MODE || 'disable';

const { createApp } = await import('../src/index.js');
const { db } = await import('../src/db.js');

export const app = createApp();
export const request = supertest(app);

export function newAgent() {
  return supertest.agent(app);
}

export async function resetDb() {
  await db.resetForTests();
}

export async function loginAdmin(agent: ReturnType<typeof newAgent>) {
  await agent
    .post('/api/admin/login')
    .send({ adminCode: process.env.ADMIN_CODE })
    .expect(200);
}

export async function createSession(
  agent: ReturnType<typeof newAgent>,
  {
    name,
    pointsPerTeam = 10,
    judgePoints = 30,
  }: { name: string; pointsPerTeam?: number; judgePoints?: number }
) {
  const res = await agent
    .post('/api/admin/sessions')
    .send({ name, pointsPerTeam, judgePoints })
    .expect(200);
  return res.body.session as {
    id: number;
    name: string;
    status: 'setup' | 'open' | 'closed';
    pointsPerTeam: number;
    judgePoints: number;
  };
}

export async function createTeam(
  agent: ReturnType<typeof newAgent>,
  sessionId: number,
  {
    name,
    password,
    kind = 'team',
  }: { name: string; password?: string; kind?: 'team' | 'judge' }
) {
  const res = await agent
    .post(`/api/admin/sessions/${sessionId}/teams`)
    .send({ name, password, kind })
    .expect(200);
  return res.body.team as {
    id: number;
    sessionId: number;
    name: string;
    password: string;
    kind: 'team' | 'judge';
    createdAt: number;
  };
}

export async function bulkCreateTeams(
  agent: ReturnType<typeof newAgent>,
  sessionId: number,
  count: number
) {
  const res = await agent
    .post(`/api/admin/sessions/${sessionId}/teams/bulk`)
    .send({ count })
    .expect(200);
  return res.body.teams as Array<{
    id: number;
    sessionId: number;
    name: string;
    password: string;
    kind: 'team' | 'judge';
    createdAt: number;
  }>;
}

export async function updateSession(
  agent: ReturnType<typeof newAgent>,
  sessionId: number,
  patch: Partial<{
    name: string;
    status: 'setup' | 'open' | 'closed';
    pointsPerTeam: number;
    judgePoints: number;
  }>
) {
  const res = await agent
    .patch(`/api/admin/sessions/${sessionId}`)
    .send(patch)
    .expect(200);
  return res.body.session as {
    id: number;
    name: string;
    status: 'setup' | 'open' | 'closed';
    pointsPerTeam: number;
    judgePoints: number;
  };
}

export async function updateTeam(
  agent: ReturnType<typeof newAgent>,
  teamId: number,
  patch: { name?: string; password?: string }
) {
  const res = await agent.patch(`/api/admin/teams/${teamId}`).send(patch).expect(200);
  return res.body.team as {
    id: number;
    sessionId: number;
    name: string;
    password: string;
    kind: 'team' | 'judge';
    createdAt: number;
  };
}

export function loginTeam(
  agent: ReturnType<typeof newAgent>,
  sessionId: number,
  name: string,
  password: string
) {
  return agent
    .post('/api/auth/login')
    .send({ sessionId, name, password });
}
