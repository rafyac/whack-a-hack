import { expect, test } from '@playwright/test';
import {
  addTeam,
  adminLogin,
  adminLogout,
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

test('admin can log out back to the login gate', async ({ page }) => {
  await adminLogin(page);
  await adminLogout(page);
  await expect(page.getByRole('button', { name: 'Sessions' })).not.toBeVisible();
});

for (const width of [390, 1280]) {
  test(`team roster follows keyboard order and feedback stays visible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await adminLogin(page);
    await createSession(page, { name: uniqueSession('Roster accessibility') });
    await bulkGenerateTeams(page, 18);

    const success = page.getByRole('status').filter({ hasText: 'Generated 18 animal-themed teams.' });
    await expect(success).toBeFocused();
    await expect(success).toBeInViewport({ ratio: 1 });

    const picker = page.getByTestId('admin-active-session-picker').getByRole('button');
    await picker.focus();
    await page.keyboard.press('Tab');
    const firstTeam = page.getByRole('listitem').first();
    await expect(firstTeam.getByTitle('Show', { exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(firstTeam.getByTitle('Copy password')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(firstTeam.getByTitle('Edit', { exact: true })).toBeFocused();

    const roster = page.getByRole('heading', { name: /teams \(18\)/ });
    const commissioner = page.getByTestId('commissioner-credentials');
    const rosterBounds = await roster.boundingBox();
    const commissionerBounds = await commissioner.boundingBox();
    expect(rosterBounds!.y).toBeLessThan(commissionerBounds!.y);

    await page.route(/\/api\/admin\/sessions\/\d+\/teams(?:\/bulk)?$/, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 400,
        json: { error: 'Team creation failed. Please try again.' },
      });
    });

    await page.getByRole('textbox', { name: 'Team name', exact: true }).fill('Another team');
    for (const action of ['Add', 'Generate']) {
      await page.getByRole('button', { name: action, exact: true }).click();
      const error = page.getByRole('alert');
      await expect(error).toHaveText('Team creation failed. Please try again.');
      await expect(error).toBeFocused();
      await expect(error).toBeInViewport({ ratio: 1 });
    }
  });
}
