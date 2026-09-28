import { expect, test } from '@playwright/test';
import { addTeam, adminLogin, clearSessions, closeVoting, createSession, loginTeam, openVoting, saveVote, uniqueSession } from './helpers';

test.beforeEach(async ({ baseURL }) => { await clearSessions(baseURL!); });

test('mobile poster supports labelled allocations, save state and tied leaders', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sessionName = uniqueSession('Mobile Poster');
  await adminLogin(page);
  await createSession(page, { name: sessionName, pointsPerTeam: 6 });
  for (const name of ['Alpha', 'Bravo', 'Charlie']) await addTeam(page, { name, password: 'team-pass' });
  await openVoting(page);
  await loginTeam(page, { sessionName, teamName: 'Alpha', password: 'team-pass' });
  await expect(page.getByRole('spinbutton', { name: 'Points for Alpha', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add one point to Bravo', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Points for Bravo', exact: true })).toHaveValue('1');
  await expect(page.getByRole('button', { name: 'Save vote' })).toBeDisabled();
  await saveVote(page, { Bravo: 3, Charlie: 3 });
  await page.reload();
  await expect(page.getByText('Ballot saved.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Remove one point from Bravo', exact: true }).click();
  await expect(page.getByText('Unsaved changes.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save vote' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await adminLogin(page);
  await closeVoting(page);
  await page.goto('/results');
  await expect(page.getByTestId('result-row').filter({ hasText: 'Joint place #1' })).toHaveCount(2);
  await expect(page.getByTestId('result-row').filter({ hasText: 'Place #3' })).toHaveCount(1);
  await expect(page.getByText('Winning team', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('session load errors are visible rather than an empty sign-in form', async ({ page }) => {
  await page.route('**/api/sessions/open', route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Session service unavailable' }),
  }));
  await page.goto('/login');
  await expect(page.getByRole('alert')).toContainText('Session service unavailable');
  await expect(page.getByRole('button', { name: 'Sign in to vote' })).toHaveCount(0);
});

test('failed ballot restoration does not allow a zero-budget vote', async ({ page }) => {
  const sessionName = uniqueSession('Ballot failure');
  await adminLogin(page);
  await createSession(page, { name: sessionName });
  await addTeam(page, { name: 'Alpha', password: 'team-pass' });
  await addTeam(page, { name: 'Bravo', password: 'team-pass' });
  await openVoting(page);
  await page.route('**/api/votes/mine', route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Ballot service unavailable' }),
  }));
  await loginTeam(page, { sessionName, teamName: 'Alpha', password: 'team-pass' });
  await expect(page.getByRole('heading', { name: 'Unable to load your ballot' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Ballot service unavailable');
  await expect(page.getByRole('button', { name: 'Save vote' })).toHaveCount(0);
});

test('long names fit narrow screens and allocations cannot change during save', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const sessionName = 'S'.repeat(80), teamName = 'T'.repeat(60);
  await adminLogin(page);
  await createSession(page, { name: sessionName, pointsPerTeam: 5 });
  await addTeam(page, { name: 'Alpha', password: 'team-pass' });
  await addTeam(page, { name: teamName, password: 'team-pass' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await openVoting(page);
  await loginTeam(page, { sessionName, teamName: 'Alpha', password: 'team-pass' });
  const points = page.getByRole('spinbutton', { name: `Points for ${teamName}`, exact: true });
  await points.fill('5');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/votes/mine', async route => {
    if (route.request().method() === 'PUT') await gate;
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: 'Save vote' }).click();
    await expect(points).toBeDisabled();
    await expect(page.getByRole('button', { name: `Remove one point from ${teamName}`, exact: true })).toBeDisabled();
  } finally { release(); }
  await expect(page.getByText(/Saved! You can edit/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await adminLogin(page);
  await closeVoting(page);
  await page.goto('/results');
  await expect(page.getByTestId('result-row').first()).toContainText(teamName);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
