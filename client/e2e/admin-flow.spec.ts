import { expect, test } from '@playwright/test';
import {
  addTeam,
  adminLogin,
  bulkGenerateTeams,
  clearSessions,
  createSession,
  editTeamPassword,
  loginTeam,
  openVoting,
  readCommissionerPassword,
  uniqueSession,
} from './helpers';

test.beforeEach(async ({ baseURL }) => {
  await clearSessions(baseURL!);
});

test('setup sessions stay hidden until opened and team password edits still work', async ({
  page,
}) => {
  const sessionName = uniqueSession('Admin Smoke');

  await adminLogin(page);
  await createSession(page, { name: sessionName, pointsPerTeam: 5, judgePoints: 15 });

  await page.goto('/login');
  await expect(
    page.getByText('No voting sessions are available yet. Check back soon!')
  ).toBeVisible();

  await adminLogin(page);
  await bulkGenerateTeams(page, 2);
  await expect(page.getByRole('heading', { name: new RegExp(`${sessionName} — teams \\(2\\)`) })).toBeVisible();
  await expect(page.getByTestId('commissioner-credentials')).toContainText('Commissioner');
  expect(await readCommissionerPassword(page)).toBeTruthy();
  await addTeam(page, { name: 'Alpha', password: 'alpha-pass' });
  await editTeamPassword(page, 'Alpha', 'alpha-new');
  await openVoting(page);

  await loginTeam(page, {
    sessionName,
    teamName: 'Alpha',
    password: 'alpha-new',
  });
  await expect(page.getByText('Alpha')).toBeVisible();
  await expect(page.getByText(sessionName)).toBeVisible();
});
