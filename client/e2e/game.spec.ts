import { expect, test, type Page } from '@playwright/test';

async function openGame(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /After\s*Hours\./ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tape Run game' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Insert coin' }).click();
  return page.getByRole('region', { name: 'Tape Run game' });
}

test('game starts with lagged frame timestamps, double jumps, pauses, restarts and never writes votes', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => requestFrame(time => callback(time - 20));
  });
  const mutations: string[] = [];
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.url());
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const game = await openGame(page);
  const field = game.getByRole('img', { name: /Tape Run playfield/ });
  await expect(field).toHaveAttribute('data-state', 'idle');
  await page.clock.runFor(1000);
  await expect(game.getByTestId('game-score')).toHaveText('0000 M / 0 TAPES');
  await game.getByRole('button', { name: 'Start run' }).click();
  await page.clock.runFor(1800);
  await expect(game.getByTestId('game-score')).toContainText(/[1-9] TAPES?$/);
  await field.press('Space');
  await expect(game.getByTestId('game-boosts')).toContainText('1/2');
  await field.dispatchEvent('keydown', { code: 'Space', repeat: true });
  await expect(game.getByTestId('game-boosts')).toContainText('1/2');
  await page.clock.runFor(100);
  await field.press('ArrowUp');
  await expect(game.getByTestId('game-boosts')).toContainText('0/2');
  await field.press('Space');
  await expect(game.getByTestId('game-boosts')).toContainText('0/2');
  await field.press('p');
  await expect(field).toHaveAttribute('data-state', 'paused');
  const score = await game.getByTestId('game-score').innerText();
  await page.clock.runFor(2000);
  await expect(game.getByTestId('game-score')).toHaveText(score);
  await game.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor(100);
  await expect(game.getByTestId('game-score')).not.toHaveText(score);
  await game.getByRole('button', { name: 'Run again' }).click();
  await page.clock.runFor(6000);
  await expect(field).toHaveAttribute('data-state', 'over');
  await expect(game.getByRole('status')).toContainText('rooftop');
  await game.getByRole('button', { name: 'Run again' }).click();
  await expect(field).toHaveAttribute('data-state', 'running');
  await field.press('Escape');
  await expect(game).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Insert coin' })).toBeFocused();
  expect(mutations).toEqual([]);
  expect(errors).toEqual([]);
});

test('game pauses when hidden, closed or navigating and leaves credential keys alone', async ({ page }) => {
  await page.clock.install();
  let game = await openGame(page);
  await game.getByRole('button', { name: 'Start run' }).click();
  await page.clock.runFor(500);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(game.getByRole('button', { name: 'Resume' })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(game.getByRole('img')).toHaveAttribute('data-state', 'paused');
  await game.getByRole('button', { name: 'Resume' }).click();
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(game).toHaveCount(0);
  await page.getByRole('button', { name: 'Insert coin' }).click();
  game = page.getByRole('region', { name: 'Tape Run game' });
  await expect(game.getByRole('img')).toHaveAttribute('data-state', 'paused');
  await game.getByRole('button', { name: 'Resume' }).click();
  const input = page.getByPlaceholder('admin code');
  await input.fill('a');
  await input.press('Space');
  await input.press('p');
  await expect(input).toHaveValue('a p');
  await expect(game.getByRole('img')).toHaveAttribute('data-state', 'running');
  await game.getByRole('button', { name: 'Close game' }).click();
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Insert coin' }).click();
  await expect(game.getByRole('img')).toHaveAttribute('data-state', 'paused');
});

test('touch controls and reduced-motion narrow layouts remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  const game = await openGame(page);
  await game.getByRole('button', { name: 'Start run' }).click();
  await game.getByRole('button', { name: 'Jump', exact: true }).click();
  await expect(game.getByTestId('game-boosts')).toContainText('1/2');
  await page.clock.runFor(150);
  await game.getByRole('button', { name: 'Jump', exact: true }).click();
  await expect(game.getByTestId('game-boosts')).toContainText('0/2');
  await expect(game.getByRole('button', { name: 'Jump', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await game.getByRole('img').evaluate(canvas => canvas.getBoundingClientRect().height)).toBeGreaterThan(150);
});

test('canvas failure is contained and recoverable without blocking the app', async ({ page }) => {
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: function (this: HTMLCanvasElement, ...args: Parameters<HTMLCanvasElement['getContext']>) {
        if (this.classList.contains('game-canvas')) return null;
        return Reflect.apply(native, this, args);
      },
    });
  });
  const game = await openGame(page);
  await expect(game.getByRole('alert')).toContainText('voting is unaffected');
  await expect(game.getByRole('button', { name: 'Retry game' })).toBeVisible();
  await page.getByRole('link', { name: 'Results', exact: true }).click();
  await expect(game).toHaveCount(0);
  await expect(page.getByRole('main')).toBeVisible();
});
