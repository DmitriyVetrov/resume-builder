import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EditorApi, RESUME_ID } from './editor-fixture';

const ROOT = resolve(import.meta.dirname, '../..');
const EDIT = `/resumes/${RESUME_ID}/edit`;
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
type Doc = ReturnType<typeof import('./editor-fixture').document>;
const fixture = (name: string, templateId = 'T1'): Doc => ({ ...JSON.parse(readFileSync(resolve(ROOT, `tests/fixtures/resumes/${name}.json`), 'utf8')), templateId });
const region = (page: Page) => page.getByRole('region', { name: 'Preview' });
const pages = (page: Page) => region(page).locator('.preview-pages');
const painted = (page: Page) => pages(page).locator('[data-page-sheet]').first();
const design = (page: Page) => page.getByRole('region', { name: 'Design' });

async function open(page: Page, api: EditorApi) {
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(EDIT);
  await expect(painted(page)).toBeVisible({ timeout: 20_000 });
}

test('Q01 separate pages at the page size, a visible gap, and numbers (FR-PRV-01)', async ({ page }) => {
  await open(page, new EditorApi(fixture('four-pages')));
  await expect(region(page).getByText('draft view', { exact: false })).toHaveCount(0);
  const groups = region(page).getByRole('group', { name: /^Page \d of \d$/ });
  const count = await groups.count();
  expect(count).toBe(4);
  for (let index = 0; index < count; index++) await expect(groups.nth(index).getByText(`${index + 1} / ${count}`)).toBeVisible();
  const sheet = (index: number) => region(page).locator('.page-frame').nth(index).evaluate(node => { const box = node.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, width: box.width, height: box.height }; });
  const [first, second] = [await sheet(0), await sheet(1)];
  expect(first.height / first.width).toBeCloseTo(842 / 595, 2);
  expect(second.top - first.bottom).toBeGreaterThanOrEqual(16);
});

for (const templateId of ['T1', 'T2', 'T3']) {
  test(`Q02 ${templateId}: what the real route paints equals the engine run in Node (FR-PRV-02)`, async ({ page }) => {
    const engine = await import(resolve(ROOT, 'tests/rendering/build/engine.mjs'));
    const fonts = engine.createFontBook(Object.fromEntries(['roboto', 'ibm-plex-sans', 'pt-serif'].map(id => [id, Object.fromEntries(['regular', 'italic', 'bold', 'bold-italic'].map(face => [face, new Uint8Array(readFileSync(resolve(ROOT, `frontend/src/assets/fonts/${id}/${face}.ttf`)))]))])));
    const document = fixture('four-pages', templateId);
    const model = engine.layout(document, fonts, { photo: false, engineVersion: 'node' });
    await open(page, new EditorApi(document));
    const seen = await region(page).locator('[data-page-sheet]').evaluateAll(sheets => sheets.map(sheet => Array.from(sheet.querySelectorAll<HTMLElement>('[data-role]')).map(run => ({ text: run.textContent, left: parseFloat(run.style.left), top: parseFloat(run.style.top), size: parseFloat(run.style.fontSize), family: run.style.fontFamily }))));
    expect(seen.length).toBe(model.pages.length);
    model.pages.forEach((modelPage: { lines: { x: number; baseline: number; runs: { text: string; x: number; size: number; face: string }[] }[] }, index: number) => {
      const expected = modelPage.lines.flatMap(line => line.runs.map(run => ({ text: run.text, left: line.x + run.x, top: line.baseline - run.size * 2, size: run.size, family: run.face.replace('/', '-') })));
      expect(seen[index]!.map(run => run.text), `page ${index + 1}`).toEqual(expected.map(run => run.text));
      seen[index]!.forEach((run, at) => {
        expect(run.left, run.text!).toBeCloseTo(expected[at]!.left, 2);
        expect(run.top, run.text!).toBeCloseTo(expected[at]!.top, 2);
        expect(run.size).toBe(expected[at]!.size);
        expect(run.family).toContain(expected[at]!.family);
      });
    });
  });
}

test('Q03 a keystroke in a form reaches the painted page (FR-PRV-03)', async ({ page }) => {
  await open(page, new EditorApi(fixture('two-pages')));
  await page.getByRole('textbox', { name: 'Full name' }).fill('Ana Núñez');
  await page.getByRole('textbox', { name: 'Full name' }).press('End');
  await page.keyboard.type('!');
  await expect(pages(page).locator('[data-role="name"]').first()).toHaveText('ANA NÚÑEZ!');
});

test('Q04 the counter sits with the sliders and changes as one moves (FR-PRV-04)', async ({ page }) => {
  await open(page, new EditorApi(fixture('four-pages')));
  await page.locator('#right-tab-Design').click();
  const count = design(page).getByTestId('page-count');
  await expect(count).toHaveText('4 pages');
  const slider = design(page).getByRole('slider', { name: 'Line spacing' });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(count).not.toHaveText('4 pages');
  await page.keyboard.press('Home');
  await expect(count).toHaveText('4 pages');
});

test('Q05 zoom by real clicks changes the size and not the line breaks (FR-PRV-06)', async ({ page }) => {
  await open(page, new EditorApi(fixture('two-pages')));
  const text = () => pages(page).locator('[data-role]').allTextContents();
  const widthOf = () => region(page).locator('.page-frame').first().evaluate(node => node.getBoundingClientRect().width);
  const before = await text();
  const zoom = region(page).getByRole('radiogroup', { name: 'Zoom' });
  const scroller = region(page).locator('[data-preview-scroller]');
  const inner = await scroller.evaluate(node => node.clientWidth - parseFloat(getComputedStyle(node).paddingLeft) - parseFloat(getComputedStyle(node).paddingRight));
  expect(await widthOf()).toBeCloseTo(inner, 0);
  for (const [name, width] of [['75%', 595], ['100%', 793.33], ['125%', 991.67]] as const) {
    await zoom.getByRole('radio', { name }).click();
    await expect.poll(widthOf).toBeCloseTo(width, 0);
    expect(await text()).toEqual(before);
  }
  await zoom.getByRole('radio', { name: 'Fit width' }).click();
  await expect.poll(widthOf).toBeCloseTo(inner, 0);
});

test('Q06 an item longer than a page breaks by lines and shows the hint (FR-PRV-07, PG-09)', async ({ page }) => {
  await open(page, new EditorApi(fixture('oversized')));
  await expect(region(page).getByRole('status', { name: 'Layout hints' })).toContainText('longer than a page');
  expect(await region(page).locator('[data-hint="oversized"]').count()).toBeGreaterThanOrEqual(2);
  expect(await region(page).locator('[data-hint="oversized"]').first().evaluate(node => getComputedStyle(node).outlineStyle)).toBe('dashed');
});

test('Q07 click, keyboard and scroll: selection lands within one line at any zoom (FR-PRV-08, FR-EDT-03, FR-EDT-04)', async ({ page }) => {
  const document = fixture('four-pages');
  await open(page, new EditorApi(document));
  const edit = page.getByRole('region', { name: 'Edit' });
  const last = (document.sections as { id: string; title: string }[]).at(-1)!;
  const offset = () => page.evaluate(id => {
    const target = window.document.querySelector(`[data-section-id="${id}"]`) as HTMLElement;
    const scroller = target.closest('[data-preview-scroller]') as HTMLElement;
    const sheet = target.parentElement!.querySelector('[data-page-sheet]') as HTMLElement;
    return { delta: Math.abs(target.getBoundingClientRect().top - scroller.getBoundingClientRect().top), line: 17.5 * (sheet.getBoundingClientRect().width / 595) };
  }, last.id);
  for (const name of ['75%', '125%', 'Fit width']) {
    await region(page).getByRole('radiogroup', { name: 'Zoom' }).getByRole('radio', { name }).click();
    await page.getByRole('list', { name: 'Resume sections' }).getByRole('button', { name: /^Header/ }).click();
    await page.getByRole('list', { name: 'Resume sections' }).getByRole('button', { name: new RegExp(`^${last.title}`) }).click();
    await expect.poll(async () => { const { delta, line } = await offset(); return delta <= line; }, name).toBe(true);
  }
  // An entry click reveals that entry; the mouse lands on real text, so the anchor is the real one.
  const second = pages(page).locator('[data-role="entryTitle"]').nth(1);
  await second.scrollIntoViewIfNeeded();
  await second.click({ force: true });
  await expect(edit.getByRole('button', { name: /^Edit entry 2:/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(edit.locator('.is-revealed')).toHaveCount(1);
  await region(page).getByRole('button', { name: 'Edit Languages' }).focus();
  await page.keyboard.press('Enter');
  await expect(edit.getByRole('heading', { level: 2, name: 'Languages' })).toBeVisible();
  await region(page).getByRole('button', { name: 'Edit Header' }).focus();
  await page.keyboard.press('Space');
  await expect(edit.getByRole('heading', { level: 2, name: 'Header' })).toBeVisible();
});

test('Q08 library cards paint page 1, and a reload paints from the cache (FR-LIB-01, ADR-010 §9)', async ({ page }) => {
  const api = new EditorApi(fixture('one-page'));
  api.listed = true;
  await api.install(page);
  await page.goto('/resumes');
  const sheet = page.locator('.page-thumb [data-page-sheet]');
  await expect(sheet).toContainText('LUCÍA', { timeout: 20_000 });
  expect(api.documentReads).toBe(1);
  await page.reload();
  await expect(sheet).toContainText('LUCÍA', { timeout: 20_000 });
  expect(api.documentReads).toBe(1);
  await expect(page.locator('.page-thumb').first()).toHaveAttribute('aria-hidden', 'true');
});

test('Q09 a page with no resume loads no engine and no font, and nothing leaves the origin (AC-P11-12, NFR-09)', async ({ page, baseURL }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  const api = new EditorApi(fixture('one-page'));
  await api.install(page);
  await page.goto('/resumes');
  await expect(page.getByRole('heading', { level: 2, name: 'No resumes yet' })).toBeVisible();
  await page.waitForTimeout(300);
  expect(requests.filter(url => url.endsWith('.ttf'))).toEqual([]);
  expect(requests.filter(url => /\/assets\/.*\.js/.test(url))).toHaveLength(1);
  await page.goto(EDIT);
  await expect(painted(page)).toBeVisible({ timeout: 20_000 });
  expect(requests.filter(url => /\.ttf/.test(url)).length).toBeGreaterThan(0);
  expect(requests.filter(url => /\/assets\/.*\.js/.test(url)).length).toBeGreaterThan(1);
  for (const url of requests) expect(url.startsWith(baseURL!) || url.startsWith('data:') || url.startsWith('blob:'), url).toBe(true);
});

test('Q10 a forced 422 sends one contract-valid, content-free event (ADR-037 §4, NFR-13)', async ({ page }) => {
  const api = new EditorApi(fixture('one-page'));
  await open(page, api);
  let refused = false;
  await page.route('**/api/v1/resumes/*/document', route => {
    if (refused) return route.fallback();
    refused = true;
    return route.fulfill({ status: 422, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'Error', status: 422, code: 'idempotency_key_reused', traceId: 'synthetic' }) });
  });
  await page.getByRole('textbox', { name: 'Resume title' }).fill('Secret title');
  await expect.poll(() => api.clientEvents.length, { timeout: 8000 }).toBe(1);
  const [event] = api.clientEvents;
  expect(Object.keys(event!).sort()).toEqual(['code', 'engineVersion', 'occurredAt', 'resumeId', 'type']);
  expect(event).toMatchObject({ type: 'idempotency_key_reused', code: 'document_write', resumeId: RESUME_ID });
  expect(JSON.stringify(event)).not.toContain('Secret');
  await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 8000 });
  expect(api.clientEvents).toHaveLength(1);
});

test('Q11 axe is clean per template, Tab reaches the toolbar and sections with a ring, no overflow at 390 px or 200% (NFR-06)', async ({ page }) => {
  for (const templateId of ['T1', 'T2', 'T3']) {
    const scoped = new EditorApi(fixture('rich-marks', templateId));
    await open(page, scoped);
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations.map(violation => `${violation.id}: ${violation.nodes[0]?.target}`), templateId).toEqual([]);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
  const api = new EditorApi(fixture('rich-marks'));
  await open(page, api);
  await region(page).getByRole('radiogroup', { name: 'Zoom' }).getByRole('radio', { name: 'Fit width' }).focus();
  await page.keyboard.press('Tab');
  await expect(region(page).locator('[data-preview-scroller]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(region(page).getByRole('button', { name: 'Edit Header' })).toBeFocused();
  expect(await page.locator(':focus').evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Tab');
  await expect(region(page).getByRole('button', { name: 'Edit Marcas' })).toBeFocused();
  for (const size of [{ width: 390, height: 844 }, { width: 640, height: 450 }]) {
    await page.setViewportSize(size);
    await page.locator('#tab-Preview').click();
    await expect(painted(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${size.width}px`).toBe(true);
    const frame = await region(page).locator('.page-frame').first().evaluate(node => node.getBoundingClientRect().width);
    expect(frame).toBeLessThanOrEqual(size.width);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('Q12 a blocked font shows Retry, editing still works, and Retry recovers (AC-P11-16)', async ({ page }) => {
  const api = new EditorApi(fixture('one-page'));
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('**/*.ttf', route => route.abort());
  await page.goto(EDIT);
  const alert = region(page).getByRole('alert');
  await expect(alert).toContainText('could not load', { timeout: 20_000 });
  await page.getByRole('textbox', { name: 'Resume title' }).fill('Still editable');
  await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 8000 });
  expect(api.main.document.title).toBe('Still editable');
  await expect.poll(() => api.clientEvents.map(event => event.code)).toEqual(['font_load']);
  await page.unroute('**/*.ttf');
  await alert.getByRole('button', { name: 'Retry' }).click();
  await expect(painted(page)).toBeVisible({ timeout: 20_000 });
  await expect(alert).toHaveCount(0);
});
