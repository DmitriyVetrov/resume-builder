import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

type Summary = { id: string; version: number; title: string; templateId: string; createdAt: string; updatedAt: string; deletedAt: string | null; purgeAt: string | null };
type Stored = Summary & { document: Record<string, unknown> };

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const signedIn = { authenticated: true, user: { id: '00000000-0000-4000-8000-000000000001', email: 'person-a@example.invalid', emailVerified: true, createdAt: '2026-10-01T08:00:00Z' } };
const blank = (title: string) => ({
  title, templateId: 'T1', accentPreset: 0, language: 'en', dateFormat: 'MonthYearLong',
  layout: { fontPreset: 'M', sectionSpacing: 10, entrySpacing: 10, lineSpacing: 1, pageSize: 'A4', margins: { top: 23, right: 23, bottom: 23, left: 23 }, bodyFont: null },
  header: { fullName: '', headline: '', showPhoto: true, contacts: [] }, sections: [],
});

/** A stateful same-origin API that enforces the rules the client must follow: CSRF, If-Match and Idempotency-Key. */
class FixtureApi {
  readonly resumes = new Map<string, Stored>();
  readonly violations: string[] = [];
  private next = 1;
  constructor(titles: string[] = []) { for (const title of titles) this.seed(title); }

  seed(title: string, trashed = false) {
    const id = `01934f6e-7a2b-7c3d-8e4f-${String(this.next++).padStart(12, '0')}`;
    const at = `2026-11-0${Math.min(this.next, 9)}T10:00:00.000Z`;
    this.resumes.set(id, { id, version: 1, title, templateId: 'T1', createdAt: at, updatedAt: at, deletedAt: trashed ? at : null, purgeAt: trashed ? '2026-12-20T10:00:00.000Z' : null, document: blank(title) });
    return id;
  }

  private problem(route: Route, status: number, code: string) {
    return route.fulfill({ status, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'Error', status, code, traceId: 'synthetic-trace' }) });
  }

  async install(page: Page) {
    await page.context().addCookies([{ name: 'XSRF-TOKEN', value: 'synthetic-csrf', url: 'http://127.0.0.1:4173' }]);
    await page.route('**/api/v1/**', route => this.handle(route));
  }

  private handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(signedIn) });
    const headers = request.headers();
    if (method !== 'GET') {
      if (headers['x-xsrf-token'] !== 'synthetic-csrf') { this.violations.push(`csrf ${method} ${path}`); return this.problem(route, 403, 'csrf_token_invalid'); }
      if (!headers['idempotency-key']) { this.violations.push(`key ${method} ${path}`); return this.problem(route, 400, 'idempotency_key_required'); }
    }
    if (path === '/resumes' && method === 'GET') {
      const trashed = url.searchParams.get('state') === 'trashed';
      const items = [...this.resumes.values()].filter(item => (item.deletedAt !== null) === trashed).map(({ document: _document, ...item }) => item);
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ items, nextCursor: null }) });
    }
    if (path === '/resumes' && method === 'POST') {
      const body = request.postDataJSON();
      const source = body.source === 'copy' ? this.resumes.get(body.sourceResumeId) : undefined;
      const title = body.source === 'copy' ? body.title : body.document.title;
      const id = this.seed(title);
      const created = this.resumes.get(id)!;
      created.document = body.source === 'copy' ? { ...source!.document, title } : body.document;
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { ETag: '"1"', Location: `/api/v1/resumes/${id}` }, body: JSON.stringify(this.full(created)) });
    }
    const match = /^\/resumes\/([^/]+)(\/[a-z]+)?$/.exec(path);
    const stored = match ? this.resumes.get(match[1]!) : undefined;
    if (!stored) return this.problem(route, 404, 'not_found');
    if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: `"${stored.version}"` }, body: JSON.stringify(this.full(stored)) });
    if (!headers['if-match']) { this.violations.push(`if-match ${method} ${path}`); return this.problem(route, 428, 'precondition_required'); }
    if (headers['if-match'] !== `"${stored.version}"`) return this.problem(route, 412, 'version_mismatch');
    stored.version++;
    stored.updatedAt = '2026-11-20T10:00:00.000Z';
    if (match?.[2] === '/document') {
      stored.document = request.postDataJSON();
      stored.title = String(stored.document.title);
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: `"${stored.version}"` }, body: JSON.stringify({ id: stored.id, version: stored.version, updatedAt: stored.updatedAt, warnings: [] }) });
    }
    if (match?.[2] === '/purge') { this.resumes.delete(stored.id); return route.fulfill({ status: 204 }); }
    stored.deletedAt = match?.[2] === '/restore' ? null : stored.updatedAt;
    stored.purgeAt = match?.[2] === '/restore' ? null : '2026-12-20T10:00:00.000Z';
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: `"${stored.version}"` }, body: JSON.stringify({ id: stored.id, version: stored.version, updatedAt: stored.updatedAt, deletedAt: stored.deletedAt, purgeAt: stored.purgeAt }) });
  }

  private full({ title: _title, templateId: _template, document, ...rest }: Stored) { return { ...rest, photo: null, document }; }
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}
async function axeClean(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(results.violations).toEqual([]);
}

test('E01 library deep link survives a reload and opens the editor route', async ({ page }) => {
  const api = new FixtureApi(['Backend engineer', 'Product manager']);
  await api.install(page);
  await page.goto('/resumes');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Resumes' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Backend engineer' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Product manager' })).toBeVisible();
  await page.getByRole('link', { name: 'Open Backend engineer' }).click();
  await expect(page).toHaveURL(/\/resumes\/[0-9a-f-]{36}\/edit$/);
  await expect(page.getByRole('heading', { level: 1, name: /editor/i })).toBeVisible();
  expect(api.violations).toEqual([]);
});

test('E02 create from scratch and copy, rename, with the blank default set', async ({ page }) => {
  const api = new FixtureApi(['Backend engineer']);
  await api.install(page);
  await page.goto('/resumes');
  await page.getByRole('button', { name: 'Create new resume' }).click();
  await page.getByRole('dialog', { name: /create/i }).getByRole('button', { name: 'Start from scratch' }).click();
  await expect(page).toHaveURL(/\/edit$/);
  const created = [...api.resumes.values()].at(-1)!;
  expect((created.document.sections as { title: string }[]).map(section => section.title)).toEqual(['Professional Summary', 'Professional Experience', 'Education', 'Skills', 'Languages']);

  await page.goto('/resumes');
  await page.getByRole('button', { name: 'Create new resume' }).click();
  const dialog = page.getByRole('dialog', { name: /create/i });
  await expect(dialog.getByRole('button', { name: 'Copy selected' })).toBeDisabled();
  await dialog.getByRole('radio', { name: /Backend engineer/ }).check();
  await dialog.getByRole('button', { name: 'Copy selected' }).click();
  await expect(page).toHaveURL(/\/edit$/);
  expect([...api.resumes.values()].at(-1)!.title).toBe('Backend engineer (copy)');

  await page.goto('/resumes');
  await page.getByRole('button', { name: 'Rename Backend engineer', exact: true }).click();
  const rename = page.getByRole('textbox', { name: 'Name' });
  await expect(rename).toHaveValue('Backend engineer');
  await rename.fill('Lead engineer');
  await rename.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'Lead engineer' })).toBeVisible();
  expect(api.violations).toEqual([]);
});

test('E03 trash, restore and permanent delete', async ({ page }) => {
  const api = new FixtureApi(['Backend engineer', 'Old CV']);
  await api.install(page);
  await page.goto('/resumes');
  for (const title of ['Backend engineer', 'Old CV']) {
    await page.getByRole('button', { name: `Delete ${title}` }).click();
    await page.getByRole('dialog', { name: /delete/i }).getByRole('button', { name: 'Move to trash' }).click();
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeHidden();
  }
  await expect(page.getByText('No resumes yet')).toBeVisible();
  await page.getByRole('link', { name: 'Trash' }).first().click();
  await expect(page).toHaveURL(/\/resumes\/trash$/);
  await expect(page.getByText(/days? left/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Restore Backend engineer' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Backend engineer' })).toBeHidden();
  await page.getByRole('button', { name: 'Delete permanently Old CV' }).click();
  await page.getByRole('dialog', { name: /delete permanently/i }).getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByText('Trash is empty')).toBeVisible();
  expect([...api.resumes.values()].map(item => item.title)).toEqual(['Backend engineer']);
  await page.getByRole('link', { name: 'My resumes' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Backend engineer' })).toBeVisible();
  expect(api.violations).toEqual([]);
});

for (const width of [1280, 1024, 390]) {
  test(`E04 design measurements and screenshots at ${width}px`, async ({ page }, testInfo) => {
    const api = new FixtureApi(['Backend engineer', 'Product manager', 'A long title '.repeat(11).trim(), 'Unbroken'.repeat(18)]);
    await api.install(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/resumes');
    const cards = page.getByRole('article');
    await expect(cards).toHaveCount(4);
    const columns = await cards.evaluateAll(items => new Set(items.map(item => Math.round(item.getBoundingClientRect().left))).size);
    expect(columns).toBe(width >= 1024 ? 2 : 1);
    await noHorizontalOverflow(page);
    for (const target of await page.getByRole('main').getByRole('button').all()) {
      const box = await target.boundingBox();
      // DD-UI-16: the theme's sizes on the desktop layout, 44 px targets below it.
      expect(box?.height).toBeGreaterThanOrEqual(width < 1024 ? 44 : 32);
    }
    const placeholder = await cards.first().locator('[aria-hidden="true"]').first().boundingBox();
    expect(Math.round(placeholder!.width)).toBe(112);
    expect(Math.round(placeholder!.height)).toBe(158);
    await page.screenshot({ path: testInfo.outputPath(`library-idle-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Create new resume' }).click();
    await expect(page.getByRole('dialog', { name: /create/i })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`library-create-${width}.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Delete Backend engineer' }).click();
    await expect(page.getByRole('dialog', { name: /delete/i })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`library-delete-${width}.png`), animations: 'disabled' });
  });
}

test('E04 empty and trash screenshots hold at the 640px zoom proxy', async ({ page }, testInfo) => {
  const api = new FixtureApi();
  api.seed('Old CV', true);
  await api.install(page);
  for (const width of [1280, 640, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/resumes');
    await expect(page.getByText('No resumes yet')).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`library-empty-${width}.png`), animations: 'disabled' });
    await page.goto('/resumes/trash');
    await expect(page.getByRole('heading', { level: 2, name: 'Old CV' })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`library-trash-${width}.png`), animations: 'disabled' });
  }
});

test('E05 shows no excluded affordance, no sample content and makes no third-party request', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.hostname !== '127.0.0.1') external.push(request.url());
  });
  const api = new FixtureApi(['Backend engineer']);
  await api.install(page);
  await page.goto('/resumes');
  await expect(page.getByRole('heading', { level: 2, name: 'Backend engineer' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Import CV' })).toHaveAttribute('href', '/resumes/import');
  await page.getByRole('button', { name: 'Create new resume' }).click();
  // ADR-055 lifts X8 for the one "Import CV" entry point (IMP-01 DD-IMP-24): exactly that library link, once; any other import affordance still fails.
  const pageText = (await page.getByRole('dialog').innerText()) + (await page.locator('body').innerText());
  expect(pageText.match(/Import CV/g) ?? []).toHaveLength(1);
  const text = pageText.replace('Import CV', '');
  for (const excluded of [/upgrade/i, /publish/i, /share/i, /import/i, /cover letter/i, /\bAI\b/, /score/i, /claim your/i, /wizard/i, /sample resume/i, /e-?mail this/i, /job board/i]) expect(text).not.toMatch(excluded);
  expect(external).toEqual([]);
});

test('E06 keyboard alone creates, renames, deletes, restores and purges', async ({ page }) => {
  const api = new FixtureApi(['Backend engineer']);
  await api.install(page);
  await page.goto('/resumes');
  const activate = async (name: string) => {
    const control = page.getByRole('button', { name, exact: true });
    await control.focus();
    await page.keyboard.press('Enter');
  };

  await activate('Rename Backend engineer');
  const field = page.getByRole('textbox', { name: 'Name' });
  await expect(field).toHaveValue('Backend engineer');
  await expect(field).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Lead engineer');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'Lead engineer' })).toBeVisible();

  await activate('Delete Lead engineer');
  const confirm = page.getByRole('dialog', { name: /delete/i });
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  // Focus stays inside the dialog.
  await page.keyboard.press('Tab');
  await expect(confirm.getByRole('button', { name: 'Move to trash' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/moved to trash/i)).toBeFocused();

  await page.goto('/resumes/trash');
  await activate('Restore Lead engineer');
  await expect(page.getByRole('status')).toHaveText('Restored.');
  await expect(page.getByRole('status')).toBeFocused();
  await page.goto('/resumes');
  await activate('Delete Lead engineer');
  await page.getByRole('dialog', { name: /delete/i }).getByRole('button', { name: 'Move to trash' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/moved to trash/i)).toBeFocused();
  await page.goto('/resumes/trash');
  await activate('Delete permanently Lead engineer');
  const purge = page.getByRole('dialog', { name: /delete permanently/i });
  await expect(purge.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Delete permanently Lead engineer' })).toBeFocused();
  await page.keyboard.press('Enter');
  await purge.getByRole('button', { name: 'Delete permanently' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Trash is empty')).toBeVisible();

  await page.goto('/resumes');
  await activate('Create your first resume');
  const create = page.getByRole('dialog', { name: /create/i });
  await expect(create.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await create.getByRole('button', { name: 'Start from scratch' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/edit$/);
  expect(api.violations).toEqual([]);
});

test('E07 axe finds nothing on idle, empty, error, trash and each dialog', async ({ page }) => {
  const api = new FixtureApi(['Backend engineer']);
  api.seed('Old CV', true);
  await api.install(page);
  await page.goto('/resumes');
  await expect(page.getByRole('heading', { level: 2, name: 'Backend engineer' })).toBeVisible();
  await axeClean(page);
  await page.getByRole('button', { name: 'Create new resume' }).click();
  await expect(page.getByRole('dialog', { name: /create/i })).toBeVisible();
  await axeClean(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Rename Backend engineer' }).click();
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Backend engineer');
  await axeClean(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Delete Backend engineer' }).click();
  await expect(page.getByRole('dialog', { name: /delete/i })).toBeVisible();
  await axeClean(page);
  await page.keyboard.press('Escape');
  await page.goto('/resumes/trash');
  await expect(page.getByRole('heading', { level: 2, name: 'Old CV' })).toBeVisible();
  await axeClean(page);
  await page.getByRole('button', { name: 'Delete permanently Old CV' }).click();
  await expect(page.getByRole('dialog', { name: /delete permanently/i })).toBeVisible();
  await axeClean(page);
  await page.keyboard.press('Escape');

  const empty = new FixtureApi();
  await page.unroute('**/api/v1/**');
  await empty.install(page);
  await page.goto('/resumes');
  await expect(page.getByText('No resumes yet')).toBeVisible();
  await axeClean(page);

  await page.unroute('**/api/v1/**');
  await page.route('**/api/v1/resumes*', route => route.fulfill({ status: 500, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'Error', status: 500, code: 'internal_error', traceId: 'synthetic-trace' }) }));
  await page.goto('/resumes');
  await expect(page.getByRole('alert')).toBeVisible();
  await axeClean(page);
});

test('E08 reduced motion removes card and dialog transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const api = new FixtureApi(['Backend engineer']);
  await api.install(page);
  await page.goto('/resumes');
  const card = page.getByRole('article').first();
  await expect(card).toBeVisible();
  for (const target of [card, page.getByRole('button', { name: 'Create new resume' })]) {
    const motion = await target.evaluate(element => ({ transition: getComputedStyle(element).transitionDuration, animation: getComputedStyle(element).animationDuration }));
    expect(motion.transition).toMatch(/^(0s|0ms)$/);
    expect(motion.animation).toMatch(/^(0s|0ms)$/);
  }
});
