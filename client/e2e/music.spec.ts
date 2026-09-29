import { expect, test, type Page } from '@playwright/test';

async function openMusic(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('region', { name: 'Optional cassette soundtracks' })).toBeVisible();
  // Do not play audible music on a developer's workstation.
  await page.getByRole('slider', { name: 'Volume' }).fill('0');
}

test('music is opt-in, switches exclusively, mutes, and does not autoplay on reload', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext;
    const contexts: AudioContext[] = [];
    Object.defineProperty(window, 'testAudioContexts', { value: contexts });
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) { super(options); contexts.push(this); }
    };
  });
  const running = () => page.evaluate(() => {
    const contexts = Reflect.get(window, 'testAudioContexts') as AudioContext[];
    return contexts.filter(context => context.state !== 'closed').length;
  });
  await openMusic(page);
  expect(await running()).toBe(0);
  await page.getByRole('button', { name: 'Play Midnight Tokens', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Playing: Midnight Tokens');
  expect(await running()).toBe(1);
  await page.getByRole('link', { name: 'Results', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Playing: Midnight Tokens');
  expect(await running()).toBe(1);
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /Ocean Drive '86/ }).click();
    await expect(page.getByRole('status')).toContainText("Playing: Ocean Drive '86");
    expect(await running()).toBe(1);
    await page.getByRole('button', { name: /Midnight Tokens.*Mystic/ }).click();
    await expect(page.getByRole('status')).toContainText('Playing: Midnight Tokens');
    expect(await running()).toBe(1);
  }
  await page.getByRole('button', { name: 'Mute music' }).click();
  await expect.poll(running).toBe(0);
  await page.getByRole('button', { name: /Ocean Drive '86/ }).click();
  expect(await running()).toBe(0);
  await page.reload();
  expect(await running()).toBe(0);
});

test('another same-origin tab takes over without overlapping music', async ({ page, context }) => {
  // Keep both pages logically visible to exercise the lock rather than the visibility fallback.
  await context.addInitScript(() => Object.defineProperty(document, 'hidden', { get: () => false }));
  await openMusic(page);
  await page.getByRole('button', { name: 'Play Midnight Tokens', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Playing: Midnight Tokens');
  const other = await context.newPage();
  await openMusic(other);
  await other.getByRole('button', { name: /Ocean Drive '86/ }).click();
  await other.getByRole('button', { name: "Play Ocean Drive '86", exact: true }).click();
  await expect(other.getByRole('status')).toContainText("Playing: Ocean Drive '86");
  await expect(page.getByRole('status')).toContainText('Music moved to another tab');
  await expect(page.getByRole('button', { name: 'Mute music' })).toHaveCount(0);
  await other.getByRole('button', { name: 'Mute music' }).click();
  await other.close();
});

test('hidden page stops playback and unsupported audio is recoverable', async ({ page }) => {
  await openMusic(page);
  await page.getByRole('button', { name: 'Play Midnight Tokens', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Playing: Midnight Tokens');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('status')).toContainText('Paused');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
  });
  await page.getByRole('button', { name: 'Play Midnight Tokens', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Voting is still available');
  await expect(page.getByRole('button', { name: 'Play Midnight Tokens', exact: true })).toBeEnabled();
});
