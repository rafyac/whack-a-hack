import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import {
  createSession,
  createTeam,
  getCsrfToken,
  loginAdmin,
  loginTeam,
  newAgent,
  request,
  resetDb,
  updateSession,
} from './helpers.js';

beforeEach(async () => {
  await resetDb();
});

test('runs the team + commissioner flow end to end', async () => {
  const admin = newAgent();
  await loginAdmin(admin);

  const session = await createSession(admin, {
    name: 'Hack Finals',
    pointsPerTeam: 5,
    judgePoints: 15,
  });
  const alpha = await createTeam(admin, session.id, {
    name: 'Alpha',
    password: 'alpha-pass',
  });
  const bravo = await createTeam(admin, session.id, {
    name: 'Bravo',
    password: 'bravo-pass',
  });
  const charlie = await createTeam(admin, session.id, {
    name: 'Charlie',
    password: 'charlie-pass',
  });
  const teamListing = await admin.get(`/api/admin/sessions/${session.id}/teams`).expect(200);
  const commissioner = teamListing.body.teams.find(
    (team: { kind: string }) => team.kind === 'judge'
  ) as { name: string; password: string };
  assert.equal(commissioner.name, 'Commissioner');
  assert.ok(commissioner.password.length > 0);

  const publicTeams = await request.get(`/api/sessions/${session.id}/teams`).expect(200);
  assert.deepEqual(
    publicTeams.body.teams.map((team: { name: string }) => team.name),
    ['Alpha', 'Bravo', 'Charlie']
  );

  await request.get(`/api/sessions/${session.id}/results`).expect(403);
  await updateSession(admin, session.id, { status: 'open' });

  const teamAgent = newAgent();
  await loginTeam(teamAgent, session.id, alpha.name, 'alpha-pass').expect(200);
  const teamCsrfToken = await getCsrfToken(teamAgent);
  const mine = await teamAgent.get('/api/votes/mine').expect(200);
  assert.equal(mine.body.budget, 5);
  await teamAgent
    .put('/api/votes/mine')
    .set('x-csrf-token', teamCsrfToken)
    .send({
      allocations: [
        { teamId: bravo.id, points: 3 },
        { teamId: charlie.id, points: 2 },
      ],
    })
    .expect(200);

  const commissionerAgent = newAgent();
  await loginTeam(commissionerAgent, session.id, commissioner.name, commissioner.password).expect(200);
  const commissionerCsrfToken = await getCsrfToken(commissionerAgent);
  const commissionerMine = await commissionerAgent.get('/api/votes/mine').expect(200);
  assert.equal(commissionerMine.body.budget, 15);
  await commissionerAgent
    .put('/api/votes/mine')
    .set('x-csrf-token', commissionerCsrfToken)
    .send({
      allocations: [
        { teamId: alpha.id, points: 5 },
        { teamId: bravo.id, points: 5 },
        { teamId: charlie.id, points: 5 },
      ],
    })
    .expect(200);

  const live = await admin.get(`/api/admin/sessions/${session.id}/results`).expect(200);
  assert.equal(live.body.submitted, 2);
  assert.equal(live.body.totalVoters, 4);
  assert.deepEqual(
    live.body.results.map((row: { name: string; total: number }) => ({
      name: row.name,
      total: row.total,
    })),
    [
      { name: 'Bravo', total: 8 },
      { name: 'Charlie', total: 7 },
      { name: 'Alpha', total: 5 },
    ]
  );

  await updateSession(admin, session.id, { status: 'closed' });
  const publicResults = await request
    .get(`/api/sessions/${session.id}/results`)
    .expect(200);
  assert.deepEqual(
    publicResults.body.results.map((row: { name: string; total: number }) => ({
      name: row.name,
      total: row.total,
    })),
    [
      { name: 'Bravo', total: 8 },
      { name: 'Charlie', total: 7 },
      { name: 'Alpha', total: 5 },
    ]
  );
});
