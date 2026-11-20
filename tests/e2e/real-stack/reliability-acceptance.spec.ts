// P13 step 7: fault injection and the data archive against the real API, Mongo, Azurite and Mailpit (AC-P13-14, AC-P13-15, AC-P13-18).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crc32 } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '../../..');
const evidence = process.env.RESUMISER_QA_EVIDENCE;
const MAILPIT = process.env.RESUMISER_MAILPIT_URL ?? 'http://127.0.0.1:8025';
const PASSWORD = 'correct-horse-battery-9';
const EMAIL = `qa-reliability-${Date.now()}@example.invalid`;
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
let registered = false;
let verified = false;
test.setTimeout(240_000);

const fixture = (name: string) => JSON.parse(readFileSync(resolve(ROOT, `tests/fixtures/resumes/${name}.json`), 'utf8'));
const title = (page: Page) => page.getByRole('textbox', { name: 'Resume title' });
const status = (page: Page) => page.getByTestId('save-status');
const csrf = async (page: Page) => (await page.context().cookies()).find(cookie => cookie.name.endsWith('XSRF-TOKEN'))?.value ?? '';
const stored = async (page: Page, id: string) => (await page.request.get(`/api/v1/resumes/${id}`)).json();
const keep = (name: string, bytes: Uint8Array) => { if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(`${evidence}/${name}`, bytes); } };
const shot = async (page: Page, name: string) => { if (evidence) { mkdirSync(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/${name}.png` }); } };

async function signIn(page: Page) {
  if (!registered) {
    await page.goto('/sign-up');
    await page.getByRole('textbox', { name: /email/i }).fill(EMAIL);
    await page.getByLabel(/^password/i).first().fill(PASSWORD);
    await page.getByRole('button', { name: /sign up|create account/i }).click();
    await page.waitForURL(/verify|login|resumes|account/);
    registered = true;
  }
  await page.goto('/login');
  await page.getByRole('textbox', { name: /email/i }).fill(EMAIL);
  await page.getByLabel(/^password/i).first().fill(PASSWORD);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/resumes/);
}

async function verify(page: Page) {
  if (verified) return;
  let token: string | undefined;
  await expect.poll(async () => {
    const list = await (await page.request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${EMAIL}"`)}`)).json();
    const message = list.messages?.[0];
    if (!message) return false;
    const body = await (await page.request.get(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
    token = /verify-email#t=([^\s"<]+)/.exec(`${body.Text}\n${body.HTML}`)?.[1];
    return !!token;
  }, { timeout: 90_000, intervals: [2000] }).toBe(true);
  await page.goto(`/verify-email#t=${token}`);
  await expect(page.getByText(/verified/i).first()).toBeVisible({ timeout: 15_000 });
  verified = true;
}

async function create(page: Page, document: Record<string, unknown>): Promise<{ id: string; version: number }> {
  const response = await page.request.post('/api/v1/resumes', { data: { source: 'document', document, copyPhotoFromResumeId: null }, headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-XSRF-TOKEN': await csrf(page) } });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

async function openEditor(page: Page, id: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/resumes/${id}/edit`);
  await expect(page.locator('[data-page-sheet]').first()).toBeVisible({ timeout: 20_000 });
}

function unzip(bytes: Buffer): Map<string, Buffer> {
  const end = bytes.length - 22;
  expect(bytes.readUInt32LE(end)).toBe(0x06054b50);
  const files = new Map<string, Buffer>();
  let at = bytes.readUInt32LE(end + 16);
  for (let index = 0; index < bytes.readUInt16LE(end + 10); index++) {
    const crc = bytes.readUInt32LE(at + 16);
    const size = bytes.readUInt32LE(at + 24);
    const nameLength = bytes.readUInt16LE(at + 28);
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const local = bytes.readUInt32LE(at + 42);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const data = Buffer.from(bytes.subarray(start, start + size));
    expect(crc32(data), name).toBe(crc);
    files.set(name, data);
    at += 46 + nameLength + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
  }
  return files;
}

test('RS01 a response lost after the real server applied the write is replayed: Saved, no conflict, one version (ADR-037)', async ({ page }) => {
  await signIn(page);
  const { id, version } = await create(page, fixture('one-page'));
  await openEditor(page, id);
  const keys: string[] = [];
  let dropped = false;
  await page.route(`**/api/v1/resumes/${id}/document`, async route => {
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    if (dropped) return route.fallback();
    dropped = true;
    // The server applies it; the browser never hears back.
    expect((await route.fetch()).status()).toBe(200);
    await route.abort('connectionreset');
  });
  await title(page).fill('Applied, answer lost');
  await expect(status(page)).toHaveText('Saved', { timeout: 30_000 });
  await expect(page.getByText(/conflict|newer version|another tab/i)).toHaveCount(0);
  expect(keys.length).toBeGreaterThanOrEqual(2);
  expect(keys[1]).toBe(keys[0]);
  const after = await stored(page, id);
  expect(after.document.title).toBe('Applied, answer lost');
  expect(after.version).toBe(version + 1);
  await shot(page, 'rs01-saved-after-lost-ack');
});

test('RS02 a burst of 503 answers keeps the edit and saves it after recovery (NFR-10)', async ({ page }) => {
  await signIn(page);
  const { id } = await create(page, fixture('one-page'));
  await openEditor(page, id);
  let refused = 0;
  await page.route(`**/api/v1/resumes/${id}/document`, async route => {
    if (refused < 5) {
      refused++;
      return route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'Service unavailable', status: 503, code: 'service_unavailable', traceId: 'injected' }) });
    }
    return route.fallback();
  });
  await title(page).fill('Survives a burst');
  await expect(status(page)).not.toHaveText('Saved', { timeout: 2000 });
  await expect(status(page)).toHaveText('Saved', { timeout: 120_000 });
  expect(refused).toBe(5);
  expect((await stored(page, id)).document.title).toBe('Survives a burst');
});

test('RS03 the data archive against the real API: real photo master, PDF and TXT, accessible (FR-ACC-04)', async ({ page }) => {
  await signIn(page);
  await verify(page);
  const document = { ...fixture('one-page'), title: 'Archive check' };
  const { id, version } = await create(page, document);
  const upload = await page.request.post(`/api/v1/resumes/${id}/photo`, {
    multipart: { file: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: readFileSync(resolve(ROOT, 'tests/fixtures/resumes/photo-600.jpg')) } },
    headers: { 'If-Match': `"${version}"`, 'Idempotency-Key': crypto.randomUUID(), 'X-XSRF-TOKEN': await csrf(page) },
  });
  expect(upload.status(), await upload.text()).toBe(200);
  const master = await (await page.request.get(`/api/v1/resumes/${id}/photo/master`)).body();

  await page.goto('/account#data');
  await page.getByRole('button', { name: /download your data/i }).click();
  await page.getByRole('dialog').getByLabel(/password/i).fill(PASSWORD);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: /confirm/i }).click();
  const download = await downloaded;
  const bytes = readFileSync(await download.path());
  keep(download.suggestedFilename(), bytes);
  const files = unzip(bytes);
  const json = JSON.parse(files.get('account-data.json')!.toString('utf8'));
  expect(json.account.email).toBe(EMAIL);
  expect(files.get(`resumes/${id}/photo-master.jpg`)!.equals(master)).toBe(true);
  expect(files.get(`resumes/${id}/Archive-check.pdf`)!.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(files.get(`resumes/${id}/Archive-check.txt`)!.toString('utf8')).toContain(document.header.fullName);
  await expect(page.getByRole('status')).toContainText(/downloaded resumiser-data-/i);
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations.map(violation => violation.id)).toEqual([]);
  await shot(page, 'rs03-archive-downloaded');
});

test('RS04 the archive in the dark scheme at 390 px against the real API: keyboard only, axe clean, no overflow (AC-P13-18)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await signIn(page);
  await verify(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/account#data');
  const start = page.getByRole('button', { name: /download your data/i });
  await expect(start).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(await fits()).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations.map(violation => violation.id)).toEqual([]);
  await start.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByLabel(/password/i).fill(PASSWORD);
  const downloaded = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  expect((await downloaded).suggestedFilename()).toMatch(/^resumiser-data-\d{4}-\d{2}-\d{2}\.zip$/);
  await expect(page.getByRole('status')).toContainText(/downloaded resumiser-data-/i);
  expect(await fits()).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations.map(violation => violation.id)).toEqual([]);
  await shot(page, 'rs04-archive-dark-390');
});
