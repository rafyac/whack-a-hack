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
  saveVote,
  uniqueSession,
} from './helpers';

test.beforeEach(async ({ baseURL }) => {
  await clearSessions(baseURL!);
});

test('direct links, fallback redirects, and browser history preserve navigation', async ({
  page,
}) => {
  for (const route of ['/', '/vote', '/unknown-route']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }

  await page.getByRole('link', { name: 'Results', exact: true }).click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByRole('heading', { name: 'No public results yet' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Results', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin login' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/results$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/admin$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Admin login' })).toBeVisible();
});

test('restored authentication supports voting and results query deep links', async ({
  page,
}) => {
  const sessionName = uniqueSession('Routing');
  await adminLogin(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sessions', exact: true })).toBeVisible();
  await createSession(page, { name: sessionName, pointsPerTeam: 5 });
  await addTeam(page, { name: 'Alpha', password: 'alpha-pass' });
  await addTeam(page, { name: 'Bravo', password: 'bravo-pass' });
  await openVoting(page);
  await loginTeam(page, { sessionName, teamName: 'Alpha', password: 'alpha-pass' });
  await expect(page).toHaveURL(/\/vote$/);
  await page.reload();
  await saveVote(page, { Bravo: 5 });
  await logout(page);
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/vote');
  await expect(page).toHaveURL(/\/login$/);

  await adminLogin(page);
  await closeVoting(page);
  await page.goto('/results');
  await expect(page).toHaveURL(/\/results\?sessionId=\d+$/);
  const resultsUrl = page.url();
  await page.goto('/admin');
  await page.goto(resultsUrl);
  await expect(page.getByRole('heading', { name: 'Final Leaderboard' })).toBeVisible();
  await expect(page.getByText(`Final standings for ${sessionName}`, { exact: false })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(resultsUrl);
  await expect(page.locator('.neon-card').filter({ hasText: /pts/ }).first()).toContainText('Bravo');
});
