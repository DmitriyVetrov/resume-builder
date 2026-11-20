import { expect, test, type Page } from '@playwright/test';

function trackExternal(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.hostname !== '127.0.0.1') {
      requests.push(request.url());
    }
  });
  return requests;
}

test('app renders in a browser without third-party traffic', async ({ page }) => {
  const external = trackExternal(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Resumiser' })).toBeVisible();
  expect(external).toEqual([]);
});

test('external request guard detects and aborts a request', async ({ page }) => {
  const external = trackExternal(page);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.setContent('<img src="http://203.0.113.7/x.png">');
  await expect.poll(() => external.length).toBe(1);
  expect(new URL(external[0]).hostname).toBe('203.0.113.7');
});
