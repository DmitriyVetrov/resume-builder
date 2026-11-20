import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { EditorApi, RESUME_ID } from './editor-fixture';

// UI-01, ADR-053: the theme reaches the controls, follows the OS by default, can be switched,
// stays accessible in the dark scheme, and never reaches the resume document.
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const EDIT = `/resumes/${RESUME_ID}/edit`;
const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('dark'));
const signedOut = (page: Page) => page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":false,"user":null}' }));
const axeClean = async (page: Page) => expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);

/** The computed value of a token, resolved the way the browser resolves a property that uses it. */
const token = (page: Page, name: string) => page.evaluate(variable => {
  const probe = document.body.appendChild(document.createElement('span'));
  probe.style.color = `var(${variable})`;
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}, name);

test('E-01 a dark OS gives the dark scheme on first load', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await signedOut(page);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible();
  expect(await isDark(page)).toBe(true);
});

test('E-02 the primary action shows the theme tokens', async ({ page }) => {
  await signedOut(page);
  await page.goto('/login');
  const button = page.getByRole('button', { name: 'Log in' });
  await expect(button).toBeVisible();
  const colors = await button.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, text: getComputedStyle(element).color }));
  expect(colors.background).toBe(await token(page, '--primary'));
  expect(colors.text).toBe(await token(page, '--primary-foreground'));
});

test('E-03 the header switch overrides the OS and survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await signedOut(page);
  await page.goto('/login');
  const trigger = page.getByRole('banner').getByRole('button', { name: /theme/i });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole('menuitemradio', { name: 'Light' }).click();
  expect(await isDark(page)).toBe(false);
  await page.reload();
  await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible();
  expect(await isDark(page)).toBe(false);
  await page.getByRole('banner').getByRole('button', { name: /theme/i }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemradio', { name: 'System' }).click();
  expect(await isDark(page)).toBe(true);
});

test('E-04 axe is clean in the dark scheme on login, library and editor', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ colorScheme: 'dark' });
  await signedOut(page);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible();
  expect(await isDark(page)).toBe(true);
  await axeClean(page);
  await page.unrouteAll();
  const api = new EditorApi();
  api.listed = true;
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/resumes');
  await expect(page.getByRole('heading', { name: 'Synthetic resume' })).toBeVisible();
  await axeClean(page);
  await page.goto(EDIT);
  await expect(page.getByRole('textbox', { name: 'Resume title' })).toBeVisible();
  await expect(page.locator('[data-page-sheet]').first()).toBeVisible();
  await axeClean(page);
  expect(api.violations).toEqual([]);
});

test('E-05 the resume page stays white in the dark scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const api = new EditorApi();
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(EDIT);
  const sheet = page.locator('[data-page-sheet]').first();
  await expect(sheet).toBeVisible();
  expect(await isDark(page)).toBe(true);
  expect(await sheet.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
});
