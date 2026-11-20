import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { choose } from '../select';

const ROOT = resolve(import.meta.dirname, '../../..');
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const evidence = process.env.RESUMISER_QA_EVIDENCE;
const PASSWORD = 'correct-horse-battery-9';
const EMAIL = `qa-preview-${Date.now()}@example.invalid`;
const FAST = 10 * 1000 * 1000 / 8; // 10 Mbit/s in bytes per second (NFR-02).
let registered = false;
const fixture = (name: string, templateId = 'T1') => ({ ...JSON.parse(readFileSync(resolve(ROOT, `tests/fixtures/resumes/${name}.json`), 'utf8')), templateId });
const preview = (page: Page) => page.getByRole('region', { name: 'Preview' });
const painted = (page: Page) => preview(page).locator('[data-page-sheet]').first();
const design = (page: Page) => page.getByRole('region', { name: 'Design' });
const csrf = async (page: Page) => (await page.context().cookies()).find(cookie => cookie.name.endsWith('XSRF-TOKEN'))?.value ?? '';
const shot = async (page: Page, name: string, width = 1280, height = 900) => {
  await page.setViewportSize({ width, height });
  if (evidence) { mkdirSync(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/${name}-${width}.png` }); }
};

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

async function create(page: Page, document: Record<string, unknown>): Promise<{ id: string; version: number }> {
  const response = await page.request.post('/api/v1/resumes', { data: { source: 'document', document, copyPhotoFromResumeId: null }, headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-XSRF-TOKEN': await csrf(page) } });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}
const openEditor = async (page: Page, id: string) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/resumes/${id}/edit`);
  await expect(painted(page)).toBeVisible({ timeout: 20_000 });
};

const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] as number;
const allVisibleThumbnailsPainted = () => {
  const cards = Array.from(document.querySelectorAll('.page-thumb')).filter(card => { const box = card.getBoundingClientRect(); return box.top < innerHeight && box.bottom > 0; });
  return cards.length > 0 && cards.every(card => card.querySelector('[data-page-sheet]'));
};

test('A01 a stored four-page resume on each template: pages, numbers, live update, selection (AC-P11-01, 03, 08, 10)', async ({ page }) => {
  await signIn(page);
  for (const templateId of ['T1', 'T2', 'T3']) {
    const { id } = await create(page, fixture('four-pages', templateId));
    await openEditor(page, id);
    await expect(preview(page).locator('.preview-pages')).toHaveAttribute('data-template', templateId);
    const groups = preview(page).getByRole('group', { name: /^Page \d of \d$/ });
    const count = await groups.count();
    expect(count, templateId).toBeGreaterThan(1);
    await expect(groups.first().getByText(`1 / ${count}`)).toBeVisible();
    await shot(page, `preview-${templateId.toLowerCase()}`);
    await page.getByRole('textbox', { name: 'Full name' }).fill('Ana Núñez Real');
    await expect(preview(page).locator('[data-role="name"]').first()).toHaveText(/Ana Núñez Real/i);
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 10_000 });
    expect((await (await page.request.get(`/api/v1/resumes/${id}`)).json()).document.header.fullName).toBe('Ana Núñez Real');
    await preview(page).getByRole('button', { name: 'Edit Languages' }).click();
    await expect(page.getByRole('region', { name: 'Edit' }).getByRole('heading', { level: 2, name: 'Languages' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations.map(violation => violation.id), templateId).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#tab-Preview').click();
    await expect(painted(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${templateId} at 390`).toBe(true);
    await shot(page, `preview-${templateId.toLowerCase()}`, 390, 844);
  }
});

test('A02 the Design tab: counter, Fit to pages, undo, picker of painted thumbnails, on real data (AC-P11-04, 05, 11)', async ({ page }) => {
  await signIn(page);
  const { id } = await create(page, fixture('two-pages'));
  await openEditor(page, id);
  await page.locator('#right-tab-Design').click();
  const count = design(page).getByTestId('page-count');
  await expect(count).toHaveText('2 pages');
  await expect(design(page).locator('.page-thumbnail')).toHaveCount(3, { timeout: 20_000 });
  await shot(page, 'design-tab');
  await choose(design(page).getByRole('combobox', { name: 'Fit to pages' }), '1');
  await design(page).getByRole('button', { name: 'Fit' }).click();
  await expect(design(page).getByTestId('fit-result')).toBeVisible();
  const said = await design(page).getByTestId('fit-result').textContent();
  await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 10_000 });
  const stored = (await (await page.request.get(`/api/v1/resumes/${id}`)).json()).document;
  expect(stored.sections).toEqual(fixture('two-pages').sections);
  if (/Fits on/.test(said!)) {
    await expect(count).toHaveText('1 page');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(count).toHaveText('2 pages');
  } else {
    expect(said).toMatch(/Cannot fit/);
    await expect(count).toHaveText('2 pages');
  }
});

test('A03 a real photo on T3 sits on the band (FR-HDR-06, ADR-024)', async ({ page }) => {
  await signIn(page);
  const { id, version } = await create(page, fixture('one-page', 'T3'));
  const upload = await page.request.post(`/api/v1/resumes/${id}/photo`, {
    multipart: { file: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: readFileSync(resolve(ROOT, 'tests/fixtures/resumes/photo.jpg')) } },
    headers: { 'If-Match': `"${version}"`, 'Idempotency-Key': crypto.randomUUID(), 'X-XSRF-TOKEN': await csrf(page) },
  });
  expect(upload.status(), await upload.text()).toBe(200);
  await openEditor(page, id);
  const image = preview(page).locator('[data-page-sheet="1"] img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const [zIndexOrder] = await image.evaluateAll(nodes => nodes.map(node => { const band = node.parentElement!.querySelector('[data-shape="band"]')!; return band.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING; }));
  expect(zIndexOrder).toBeTruthy();
  await shot(page, 'preview-t3-photo');
});

test('A04 a refused write reports one event, which the real API accepts (AC-P11-13)', async ({ page }) => {
  await signIn(page);
  const { id } = await create(page, fixture('one-page'));
  await openEditor(page, id);
  let refused = false;
  await page.route('**/api/v1/resumes/*/document', route => {
    if (refused) return route.fallback();
    refused = true;
    return route.fulfill({ status: 422, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'Error', status: 422, code: 'idempotency_key_reused', traceId: 'qa' }) });
  });
  const accepted = page.waitForResponse(response => response.url().endsWith('/api/v1/client-events'));
  await page.getByRole('textbox', { name: 'Resume title' }).fill('A title that never reaches a log');
  expect((await accepted).status()).toBe(202);
  await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 15_000 });
});

test('A05 library thumbnails: painted, cached, cleared with local data (AC-P11-11)', async ({ page }) => {
  await signIn(page);
  await create(page, fixture('one-page', 'T1'));
  await create(page, fixture('one-page', 'T2'));
  await create(page, fixture('one-page', 'T3'));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/resumes');
  await page.waitForFunction(allVisibleThumbnailsPainted, undefined, { timeout: 20_000 });
  await shot(page, 'library');
  const rows = () => page.evaluate(() => new Promise<number>((done, fail) => {
    const open = indexedDB.open('resumiser-thumbnails');
    open.onerror = () => fail(open.error);
    open.onsuccess = () => { const request = open.result.transaction('pages').objectStore('pages').count(); request.onsuccess = () => { open.result.close(); done(request.result); }; };
  }));
  await expect.poll(rows).toBeGreaterThanOrEqual(3);
  const reads: string[] = [];
  page.on('request', request => { if (/\/api\/v1\/resumes\/[^/?]+$/.test(request.url())) reads.push(request.url()); });
  await page.reload();
  await page.waitForFunction(allVisibleThumbnailsPainted, undefined, { timeout: 20_000 });
  expect(reads).toEqual([]);
  await page.goto('/account');
  await page.getByRole('button', { name: /log out/i }).click();
  await page.getByRole('button', { name: 'Remove and log out' }).click();
  await page.waitForURL(/\/login/);
  await expect.poll(rows).toBe(0);
});

test('A06 NFR-02 at 10 Mbit/s, cold: 12 library cards, and the editor with a four-page resume (AC-P11-11, 12)', async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page);
  for (let index = 0; index < 12; index++) await create(page, fixture('one-page', ['T1', 'T2', 'T3'][index % 3]));
  const { id } = await create(page, fixture('four-pages'));
  await page.setViewportSize({ width: 1280, height: 900 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: FAST, uploadThroughput: FAST });
  const clearThumbnails = () => page.evaluate(() => new Promise<void>(done => { const request = indexedDB.deleteDatabase('resumiser-thumbnails'); request.onsuccess = request.onerror = request.onblocked = () => done(); }));
  const library: number[] = [];
  const editor: number[] = [];
  for (let run = 0; run < 10; run++) {
    await clearThumbnails();
    let start = Date.now();
    await page.goto('/resumes');
    await page.waitForFunction(allVisibleThumbnailsPainted, undefined, { timeout: 30_000, polling: 25 });
    library.push(Date.now() - start);
    start = Date.now();
    await page.goto(`/resumes/${id}/edit`);
    await page.waitForFunction(() => document.querySelector('[data-page-sheet]') && document.querySelector('[aria-label="Full name"], input') !== null, undefined, { timeout: 30_000, polling: 25 });
    editor.push(Date.now() - start);
  }
  const result = { library: { runs: library, p95: p95(library) }, editor: { runs: editor, p95: p95(editor) } };
  console.log(`NFR-02 ${JSON.stringify(result)}`);
  if (evidence) writeFileSync(`${evidence}/nfr02.json`, JSON.stringify(result, null, 1));
  expect(result.library.p95).toBeLessThanOrEqual(2000);
  expect(result.editor.p95).toBeLessThanOrEqual(2000);
});
