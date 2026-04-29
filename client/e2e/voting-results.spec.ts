import { expect, test } from '@playwright/test';
import {
  addTeam,
  adminLogin,
  clearSessions,
  closeVoting,
  createSession,
  loginTeam,
  logout,
  openVoting,
  readCommissionerPassword,
  saveVote,
  uniqueSession,
} from './helpers';

test.beforeEach(async ({ baseURL }) => {
  await clearSessions(baseURL!);
});

test('team and commissioner votes produce a discoverable public leaderboard', async ({
  page,
}) => {
  const sessionName = uniqueSession('Results Smoke');

  await adminLogin(page);
  await createSession(page, { name: sessionName, pointsPerTeam: 5, judgePoints: 15 });
  await addTeam(page, { name: 'Alpha', password: 'alpha-pass' });
  await addTeam(page, { name: 'Bravo', password: 'bravo-pass' });
  await addTeam(page, { name: 'Charlie', password: 'charlie-pass' });
  const commissionerPassword = await readCommissionerPassword(page);
  await openVoting(page);

  await loginTeam(page, {
    sessionName,
    teamName: 'Alpha',
    password: 'alpha-pass',
  });
  await saveVote(page, { Bravo: 3, Charlie: 2 });
  await logout(page);

  await loginTeam(page, {
    sessionName,
    teamName: 'Commissioner',
    password: commissionerPassword,
  });
  await expect(page.getByText(/You are voting as the Commissioner/)).toBeVisible();
  await saveVote(page, { Alpha: 5, Bravo: 5, Charlie: 5 });
  await logout(page);

  await adminLogin(page);
  await closeVoting(page);

  await page.goto('/results');
  await expect(page.getByText('Final Leaderboard')).toBeVisible();
  await expect(page.getByText('Bravo')).toBeVisible();
  await expect(page.getByText('Charlie')).toBeVisible();
  await expect(page.getByText('Alpha')).toBeVisible();
  await expect(page.getByText('Commissioner', { exact: true })).toHaveCount(0);

  const rows = page.locator('.neon-card').filter({ hasText: /pts/ });
  await expect(rows.nth(0)).toContainText('Bravo');
  await expect(rows.nth(1)).toContainText('Charlie');
  await expect(rows.nth(2)).toContainText('Alpha');
});
