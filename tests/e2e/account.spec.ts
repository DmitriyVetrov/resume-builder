import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const [path, heading] of [
  ['/auth/sign-up', /sign up|create account/i],
  ['/auth/login', /log in|sign in/i],
  ['/auth/password-reset', /reset password/i],
  ['/account', /account/i],
] as const) {
  test(`${path} is keyboard reachable and accessible`, async ({ page }) => {
    await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":false,"user":null}' }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  });
}

test('verification fragment is cleared before user interaction', async ({ page }) => {
  await page.goto('/auth/verify-email#token=synthetic-marker');
  await expect(page).not.toHaveURL(/synthetic-marker/);
});

for (const width of [1280, 1024, 390]) {
  test(`P06 login layout and focus remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/login');
    const heading = page.getByRole('heading', { name: /log in/i });
    await expect(heading).toBeVisible();
    const email = page.getByRole('textbox', { name: /email/i });
    const password = page.getByLabel(/password/i);
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await email.focus();
    // DD-UI-15: the focus indicator is the theme ring, a 3 px box-shadow spread (was a 3 px outline).
    const focused = await email.evaluate(element => getComputedStyle(element).boxShadow);
    expect(focused).toMatch(/\b0px 0px 0px 3px\b/);
  });
}

test('P06 account form has reduced motion and no external assets', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const external: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') { external.push(url.hostname); return route.abort(); }
    return route.continue();
  });
  await page.goto('/login');
  const button = page.getByRole('button', { name: /log in/i });
  await expect(button).toBeVisible();
  const motion = await button.evaluate(element => ({ duration: getComputedStyle(element).transitionDuration, animation: getComputedStyle(element).animationDuration }));
  expect(motion.duration).toMatch(/^(0s|0ms)$/);
  expect(motion.animation).toMatch(/^(0s|0ms)$/);
  expect(external).toEqual([]);
});

for (const [alias, canonical] of [
  ['/auth/sign-up', '/sign-up'],
  ['/auth/login', '/login'],
  ['/auth/password-reset', '/reset-password'],
  ['/auth/verify-email', '/verify-email'],
  ['/auth/password-reset/confirm', '/reset-password/confirm'],
] as const) {
  test(`${alias} replaces browser history with ${canonical}`, async ({ page }) => {
    await page.goto(alias);
    await expect.poll(() => new URL(page.url()).pathname).toBe(canonical);
    await page.goBack();
    expect(new URL(page.url()).pathname).not.toBe(alias);
  });
}

for (const path of ['/verify-email', '/auth/verify-email', '/reset-password/confirm', '/auth/password-reset/confirm']) {
  for (const key of ['t', 'token']) {
    test(`${path} clears ${key} link fragment`, async ({ page }) => {
      await page.goto(`${path}#${key}=synthetic-marker`);
      await expect(page).not.toHaveURL(/synthetic-marker/);
    });
  }
}

test('P06 account controls reflow at 200 percent zoom proxy', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.goto('/login');
  await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

for (const width of [1280, 390]) {
  test(`P06 synthetic account surfaces are accessible at ${width}px`, async ({ page }) => {
    await page.route('**/api/v1/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":true,"user":{"id":"00000000-0000-4000-8000-000000000001","email":"person-a@example.invalid","emailVerified":true,"createdAt":"2026-11-03T12:00:00Z"}}' }));
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    for (const [path, heading] of [['/login', /log in/i], ['/verify-email', /verify email/i], ['/account', /account settings/i]] as const) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(result.violations).toEqual([]);
    }
  });
}

test('P06 deletion dialog traps focus, cancels, and does not delete', async ({ page }) => {
  const deletionRequests: string[] = [];
  await page.route('**/api/v1/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":true,"user":{"id":"00000000-0000-4000-8000-000000000001","email":"person-a@example.invalid","emailVerified":true,"createdAt":"2026-11-03T12:00:00Z"}}' }));
  await page.route('**/api/v1/account', route => {
    deletionRequests.push(route.request().method());
    return route.fulfill({ status: 202 });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/account');
  const trigger = page.getByRole('button', { name: /delete account/i });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /delete account/i });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: /cancel/i })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(deletionRequests).toEqual([]);
});

test('P06 settings and deletion remain reachable at the 1024px transition', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":true,"user":{"id":"00000000-0000-4000-8000-000000000001","email":"person-a@example.invalid","emailVerified":true,"createdAt":"2026-11-03T12:00:00Z"}}' }));
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/account');
  await expect(page.getByRole('navigation', { name: /account|settings/i })).toBeVisible();
  await page.getByRole('button', { name: /delete account/i }).click();
  await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

for (const width of [1280, 390]) {
  test(`P06 twelve synthetic visual states include ${width}px captures`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/v1/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":true,"user":{"id":"00000000-0000-4000-8000-000000000001","email":"person-a@example.invalid","emailVerified":true,"createdAt":"2026-11-03T12:00:00Z"}}' }));
    for (const state of ['login-idle', 'login-error', 'verification-success', 'verification-failure', 'settings', 'deletion-dialog'] as const) {
      if (state.startsWith('login')) await page.goto('/login');
      else if (state.startsWith('verification')) {
        await page.route('**/api/v1/auth/verify-email', route => route.fulfill({ status: state === 'verification-success' ? 204 : 400, contentType: 'application/problem+json', body: state === 'verification-success' ? '' : '{"type":"about:blank","title":"Invalid token","status":400,"code":"token_invalid","traceId":"synthetic-trace"}' }));
        await page.goto('/verify-email#t=synthetic-marker');
        await expect(page).not.toHaveURL(/synthetic-marker/);
        if (state === 'verification-success') await expect(page.getByRole('status')).toContainText(/verif/i);
        else await expect(page.getByRole('alert')).toContainText(/invalid|expired/i);
      } else await page.goto('/account');
      if (state === 'login-error') {
        await page.getByRole('button', { name: /log in/i }).click();
        await expect(page.getByRole('alert')).toBeVisible();
      }
      if (state === 'deletion-dialog') {
        await page.getByRole('button', { name: /delete account/i }).click();
        await expect(page.getByRole('dialog', { name: /delete account/i })).toBeVisible();
      }
      // DD-UI-13: behind a modal dialog the page is aria-hidden (it was inert with the native dialog); the heading must still be rendered.
      await expect(page.getByRole('heading', { level: 1, name: /log in|verify email|account settings/i, includeHidden: state === 'deletion-dialog' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`p06-${state}-${width}.png`), animations: 'disabled' });
    }
  });
}

// DD-P07-17: the default landing after login is the library.
test('P06 keyboard login reaches the resume library', async ({ page }) => {
  let authenticated = false;
  let sessionReads = 0;
  await page.route('**/api/v1/session', route => { sessionReads++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authenticated ? { authenticated: true, user: { id: "00000000-0000-4000-8000-000000000001", email: "person-a@example.invalid", emailVerified: true, createdAt: "2026-11-03T12:00:00Z" } } : { authenticated: false, user: null }) }); });
  await page.route('**/api/v1/auth/login', route => { authenticated = true; return route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":true,"user":{"id":"00000000-0000-4000-8000-000000000001","email":"person-a@example.invalid","emailVerified":true,"createdAt":"2026-11-03T12:00:00Z"}}' }); });
  await page.goto('/login');
  const email = page.getByRole('textbox', { name: /email/i });
  await expect(email).toBeVisible();
  await email.focus();
  await page.keyboard.type('person-a@example.invalid');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(/password/i)).toBeFocused();
  await page.keyboard.type('synthetic-password-123');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/resumes$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Resumes' })).toBeVisible();
  expect(sessionReads).toBeGreaterThanOrEqual(2);
});

test('P06 login rejects an external return path', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":false,"user":null}' }));
  await page.route('**/api/v1/auth/login', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":true,"user":{"id":"00000000-0000-4000-8000-000000000001","email":"person-a@example.invalid","emailVerified":true,"createdAt":"2026-11-03T12:00:00Z"}}' }));
  await page.goto('/login?returnTo=https%3A%2F%2Fexample.invalid%2Fsteal');
  await page.getByRole('textbox', { name: /email/i }).fill('person-a@example.invalid');
  await page.getByLabel(/password/i).fill('synthetic-password-123');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/resumes(?:\?|$)/);
  await expect(page).not.toHaveURL(/example\.invalid/);
});

test('P06 reset request can be submitted and recovered by keyboard', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":false,"user":null}' }));
  await page.route('**/api/v1/auth/password-reset/request', route => route.fulfill({ status: 202 }));
  await page.goto('/reset-password');
  const email = page.getByRole('textbox', { name: /email/i });
  await expect(email).toBeVisible();
  await email.focus();
  await page.keyboard.type('person-a@example.invalid');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText(/check.*email|request.*received/i);
});

// DD-P13-26: P06's provisional JSON download became the P13 archive (AC-P06-08 → AC-P13-14).
test('P06 verified data download has an accessible action and gives one archive', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":true,"user":{"id":"00000000-0000-4000-8000-000000000001","email":"person-a@example.invalid","emailVerified":true,"createdAt":"2026-11-03T12:00:00Z"}}' }));
  await page.route('**/api/v1/auth/reauthenticate', route => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/account/data-export', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: '{"account":{"id":"00000000-0000-4000-8000-000000000001","email":"person-a@example.invalid","createdAt":"2026-11-03T12:00:00Z","emailVerifiedAt":"2026-11-03T12:05:00Z"},"resumes":[],"exportedAt":"2026-11-03T12:00:00Z"}' }));
  await page.goto('/account');
  const action = page.getByRole('button', { name: /download your data/i });
  await expect(action).toBeVisible();
  await action.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /re-auth|confirm|verify/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/password/i).fill('synthetic-password-123');
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /confirm|continue/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^resumiser-data-\d{4}-\d{2}-\d{2}\.zip$/);
});
