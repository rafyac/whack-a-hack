import {
  expect,
  type APIRequestContext,
  type Page,
  request as playwrightRequest,
} from '@playwright/test';

export async function clearSessions(baseURL: string) {
  const api = await playwrightRequest.newContext({ baseURL });
  try {
    await api.post('/api/admin/login', {
      data: { adminCode: 'admin-dev-code' },
    });
    const sessions = await api.get('/api/admin/sessions');
    const body = (await sessions.json()) as {
      sessions: Array<{ id: number }>;
    };
    for (const session of body.sessions) {
      await api.delete(`/api/admin/sessions/${session.id}`);
    }
  } finally {
    await api.dispose();
  }
}

export function uniqueSession(name: string) {
  return `${name} ${Date.now()} ${Math.random().toString(36).slice(2, 6)}`;
}

export async function adminLogin(page: Page) {
  await page.goto('/admin');
  if (await page.getByPlaceholder('admin code').isVisible()) {
    await page.getByPlaceholder('admin code').fill('admin-dev-code');
    await page.getByRole('button', { name: 'Unlock' }).click();
  }
  await expect(page.getByRole('button', { name: 'Sessions' })).toBeVisible();
}

export async function createSession(
  page: Page,
  {
    name,
    pointsPerTeam = 5,
    judgePoints = 15,
  }: { name: string; pointsPerTeam?: number; judgePoints?: number }
) {
  await page.getByRole('button', { name: 'Sessions' }).click();
  await page
    .getByPlaceholder('e.g. Spring Hackathon 2026')
    .fill(name);
  const numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill(String(pointsPerTeam));
  await numbers.nth(1).fill(String(judgePoints));
  await page.getByRole('button', { name: /^Create$/ }).click();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();
}

export async function addTeam(
  page: Page,
  {
    name,
    password,
  }: { name: string; password: string }
) {
  await page.getByRole('button', { name: 'Teams' }).click();
  const form = page.locator('form').filter({
    has: page.getByRole('button', { name: /^Add$/ }),
  });
  await form.locator('input[placeholder="Team name"]').fill(name);
  await form.getByPlaceholder('auto-generated if blank').fill(password);
  await form.getByRole('button', { name: /^Add$/ }).click();
  await expect(page.locator('li').filter({ hasText: name }).first()).toBeVisible();
}

export async function bulkGenerateTeams(page: Page, count: number) {
  await page.getByRole('button', { name: 'Teams' }).click();
  const form = page.locator('form').filter({
    has: page.getByRole('button', { name: /^Generate$/ }),
  });
  await form.locator('input[type="number"]').fill(String(count));
  await form.getByRole('button', { name: /^Generate$/ }).click();
  await expect(page.getByText(new RegExp(`Generated ${count} animal-themed`))).toBeVisible();
}

export async function editTeamPassword(page: Page, teamName: string, newPassword: string) {
  const row = page.locator('li').filter({ hasText: teamName }).first();
  await row.getByTitle('Edit').click();
  const editingRow = page.locator('li:has(button:has-text("Save"))').first();
  await expect(editingRow.getByRole('button', { name: /Save/ })).toBeVisible();
  await editingRow.locator('input').nth(1).fill(newPassword);
  await editingRow.getByRole('button', { name: /Save/ }).click();
  await page.locator('li').filter({ hasText: teamName }).first().getByTitle('Show').click();
  await expect(page.locator('li').filter({ hasText: teamName }).first()).toContainText(newPassword);
}

export async function openVoting(page: Page) {
  await page.getByRole('button', { name: 'Event' }).click();
  await page.getByRole('button', { name: /Open voting/ }).click();
  await expect(page.getByRole('button', { name: /Close voting/ })).toBeEnabled();
}

export async function closeVoting(page: Page) {
  await page.getByRole('button', { name: 'Event' }).click();
  await page.getByRole('button', { name: /Close voting/ }).click();
  await expect(page.getByRole('button', { name: /Open voting/ })).toBeEnabled();
}

export async function loginTeam(
  page: Page,
  {
    sessionName,
    teamName,
    password,
  }: { sessionName: string; teamName: string; password: string }
) {
  await page.goto('/login');
  const picker = page.getByTestId('login-session-picker');
  await expect(
    picker.getByRole('button', { name: new RegExp(sessionName) })
  ).toBeVisible();
  await picker.getByRole('button', { name: new RegExp(sessionName) }).click();
  await page.getByPlaceholder('team name').fill(teamName);
  await page.getByPlaceholder('password').fill(password);
  await page.getByRole('button', { name: 'Enter the arena' }).click();
}

export async function readCommissionerPassword(page: Page) {
  await page.getByRole('button', { name: 'Teams' }).click();
  const commissionerCard = page.getByTestId('commissioner-credentials');
  await expect(commissionerCard).toBeVisible();
  await commissionerCard.getByTitle('Show commissioner password').click();
  return (await commissionerCard.locator('code').innerText()).trim();
}

export async function saveVote(page: Page, allocations: Record<string, number>) {
  for (const [teamName, points] of Object.entries(allocations)) {
    const card = page.locator('.neon-card').filter({ hasText: teamName }).first();
    await card.locator('input[type="number"]').fill(String(points));
  }
  await page.getByRole('button', { name: 'Save vote' }).click();
  await expect(page.getByText(/Saved!/)).toBeVisible();
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: /Log out/ }).first().click();
}
