import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import {
  bulkCreateTeams,
  createSession,
  createTeam,
  loginAdmin,
  loginTeam,
  newAgent,
  request,
  resetDb,
  updateSession,
  updateTeam,
} from './helpers.js';

beforeEach(() => {
  resetDb();
});

test('lists only open sessions and blocks login for setup/closed sessions', async () => {
  const admin = newAgent();
  await loginAdmin(admin);

  const openSession = await createSession(admin, { name: 'Open Session' });
  const setupSession = await createSession(admin, { name: 'Setup Session' });
  const closedSession = await createSession(admin, { name: 'Closed Session' });

  await createTeam(admin, openSession.id, { name: 'Alpha', password: 'alpha' });
  await createTeam(admin, setupSession.id, { name: 'Bravo', password: 'bravo' });
  await createTeam(admin, closedSession.id, { name: 'Charlie', password: 'charlie' });

  await updateSession(admin, openSession.id, { status: 'open' });
  await updateSession(admin, closedSession.id, { status: 'closed' });

  const open = await request.get('/api/sessions/open').expect(200);
  assert.deepEqual(
    open.body.sessions.map((session: { name: string }) => session.name),
    ['Open Session']
  );

  const closed = await request.get('/api/sessions/results').expect(200);
  assert.deepEqual(
    closed.body.sessions.map((session: { name: string }) => session.name),
    ['Closed Session']
  );

  await loginTeam(newAgent(), openSession.id, 'Alpha', 'alpha').expect(200);
  await loginTeam(newAgent(), setupSession.id, 'Bravo', 'bravo')
    .expect(409)
    .expect(({ body }) => {
      assert.equal(body.error, 'session is setup');
    });
  await loginTeam(newAgent(), closedSession.id, 'Charlie', 'charlie')
    .expect(409)
    .expect(({ body }) => {
      assert.equal(body.error, 'session is closed');
    });
});

test('enforces duplicate-team, single-commissioner, and credential-edit rules', async () => {
  const admin = newAgent();
  await loginAdmin(admin);

  const session = await createSession(admin, {
    name: 'Validation Session',
    pointsPerTeam: 5,
    judgePoints: 15,
  });
  const alpha = await createTeam(admin, session.id, {
    name: 'Alpha',
    password: 'alpha-pass',
  });
  const listedTeams = await admin.get(`/api/admin/sessions/${session.id}/teams`).expect(200);
  const commissioner = listedTeams.body.teams.find(
    (team: { kind: string }) => team.kind === 'judge'
  ) as { id: number; name: string };
  assert.equal(commissioner.name, 'Commissioner');

  await admin
    .post(`/api/admin/sessions/${session.id}/teams`)
    .send({ name: 'Alpha', password: 'dup-pass' })
    .expect(409);
  await admin
    .post(`/api/admin/sessions/${session.id}/teams`)
    .send({ name: 'Commissioner 2', password: 'commissioner-2', kind: 'judge' })
    .expect(409);
  await admin.delete(`/api/admin/teams/${commissioner.id}`).expect(409);

  await updateSession(admin, session.id, { status: 'open' });
  await loginTeam(newAgent(), session.id, 'Alpha', 'alpha-pass').expect(200);

  await updateTeam(admin, alpha.id, {
    name: 'Alpha Prime',
    password: 'alpha-new',
  });

  await loginTeam(newAgent(), session.id, 'Alpha', 'alpha-pass').expect(401);
  await loginTeam(newAgent(), session.id, 'Alpha Prime', 'alpha-new').expect(200);
});

test('keeps sessions isolated, rejects invalid targets, and clears votes on budget changes', async () => {
  const admin = newAgent();
  await loginAdmin(admin);

  const sessionA = await createSession(admin, {
    name: 'Session A',
    pointsPerTeam: 5,
    judgePoints: 15,
  });
  const sessionB = await createSession(admin, {
    name: 'Session B',
    pointsPerTeam: 5,
    judgePoints: 15,
  });

  const alpha = await createTeam(admin, sessionA.id, {
    name: 'Alpha',
    password: 'alpha-pass',
  });
  const bravo = await createTeam(admin, sessionA.id, {
    name: 'Bravo',
    password: 'bravo-pass',
  });
  const delta = await createTeam(admin, sessionB.id, {
    name: 'Delta',
    password: 'delta-pass',
  });

  await updateSession(admin, sessionA.id, { status: 'open' });
  await updateSession(admin, sessionB.id, { status: 'open' });

  const alphaAgent = newAgent();
  await loginTeam(alphaAgent, sessionA.id, 'Alpha', 'alpha-pass').expect(200);

  await alphaAgent
    .put('/api/votes/mine')
    .send({
      allocations: [{ teamId: bravo.id, points: 5 }],
    })
    .expect(200);

  await alphaAgent
    .put('/api/votes/mine')
    .send({
      allocations: [{ teamId: delta.id, points: 5 }],
    })
    .expect(400);

  await updateSession(admin, sessionA.id, { pointsPerTeam: 7 });
  const mineAfterBudgetChange = await alphaAgent.get('/api/votes/mine').expect(200);
  assert.equal(mineAfterBudgetChange.body.budget, 7);
  assert.deepEqual(mineAfterBudgetChange.body.allocations, []);

  await request.get(`/api/sessions/${sessionA.id}/results`).expect(403);
  await updateSession(admin, sessionA.id, { status: 'closed' });
  const publicResults = await request
    .get(`/api/sessions/${sessionA.id}/results`)
    .expect(200);
  assert.deepEqual(publicResults.body.results, [
    { id: alpha.id, name: 'Alpha', total: 0 },
    { id: bravo.id, name: 'Bravo', total: 0 },
  ]);
});

test('bulk generation creates unique animal teams with passwords', async () => {
  const admin = newAgent();
  await loginAdmin(admin);

  const session = await createSession(admin, { name: 'Bulk Teams' });
  await createTeam(admin, session.id, {
    name: 'Fox',
    password: 'fox-pass',
  });

  const teams = await bulkCreateTeams(admin, session.id, 5);

  assert.equal(teams.length, 5);
  assert.ok(teams.every((team) => team.kind === 'team'));
  assert.ok(teams.every((team) => team.password.length > 0));
  assert.equal(new Set(teams.map((team) => team.name.toLowerCase())).size, 5);
  assert.ok(!teams.some((team) => team.name.toLowerCase() === 'fox'));

  const listed = await admin.get(`/api/admin/sessions/${session.id}/teams`).expect(200);
  assert.equal(
    listed.body.teams.filter((team: { kind: string }) => team.kind === 'team').length,
    6
  );
});
