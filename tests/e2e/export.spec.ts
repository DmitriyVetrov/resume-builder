// P12 through the Vite build in three browsers. Byte comparisons use the Node writer from the rendering bundle (AC-P12-14).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EditorApi, RESUME_ID } from './editor-fixture';

const ROOT = resolve(import.meta.dirname, '../..');
const EDIT = `/resumes/${RESUME_ID}/edit`;
const UPDATED_AT = '2026-11-01T10:00:00.000Z';
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const JPEG = readFileSync(resolve(ROOT, 'tests/fixtures/resumes/photo.jpg'));
const PHOTO = { id: '01934f6e-7a2b-7c3d-8e4f-200000000070', mime: 'image/jpeg', width: 600, height: 600, bytes: JPEG.length, crop: { x: 0, y: 0, width: 600, height: 600 }, updatedAt: '2026-11-01T09:00:00.000Z' };
type Doc = ReturnType<typeof import('./editor-fixture').document>;
const fixture = (name: string, templateId = 'T1'): Doc => ({ ...JSON.parse(readFileSync(resolve(ROOT, `tests/fixtures/resumes/${name}.json`), 'utf8')), templateId });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const sha = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

async function nodeFiles(document: Doc, photo: Uint8Array | null) {
  const engine = await import(resolve(ROOT, 'tests/rendering/build/engine.mjs'));
  const fonts = engine.createFontBook(Object.fromEntries(['roboto', 'ibm-plex-sans', 'pt-serif'].map(id => [id, Object.fromEntries(['regular', 'italic', 'bold', 'bold-italic'].map(face => [face, new Uint8Array(readFileSync(resolve(ROOT, `frontend/src/assets/fonts/${id}/${face}.ttf`)))]))])));
  const model = engine.layout(document, fonts, { photo: photo !== null, engineVersion: 'node' });
  return { pdf: await engine.writePdf({ model, document, fonts, photo, updatedAt: UPDATED_AT }) as Uint8Array, txt: engine.serializeTxt(document) as string, crlf: engine.serializeTxt(document, { lineEnding: 'crlf' }) as string };
}
const bytesOf = async (download: Download) => new Uint8Array(readFileSync(await download.path()));
async function click(page: Page, name: string) {
  const [download] = await Promise.all([page.waitForEvent('download'), button(page, name).click()]);
  return download;
}
async function open(page: Page, api: EditorApi, path = EDIT) {
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(path);
  if (path === EDIT) await expect(page.locator('[data-page-sheet]').first()).toBeVisible({ timeout: 20_000 });
}
const withPhoto = (document: Doc) => {
  const api = new EditorApi(document);
  api.main.photo = PHOTO;
  api.rendition = JPEG;
  return api;
};

for (const templateId of ['T1', 'T2', 'T3']) {
  test(`E01 ${templateId}: one click gives a file equal to Node's, one snapshot and no dialog (FR-PDF-01, AC-P12-14)`, async ({ page }) => {
    const document = fixture('four-pages', templateId);
    const api = withPhoto(document);
    const requests: string[] = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await open(page, api);
    expect(requests.filter(path => /\/assets\/pdf-/.test(path)), 'PDFKit stays out of the preview').toEqual([]);
    const version = api.main.version;
    const download = await click(page, 'Export PDF');
    expect(download.suggestedFilename()).toBe(`${document.title.replaceAll(' ', '-')}.pdf`);
    const bytes = await bytesOf(download);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const expected = await nodeFiles(document, templateId === 'T2' ? null : new Uint8Array(JPEG));
    expect(sha(bytes), 'the real route writes the bytes the rendering gate checked').toBe(sha(expected.pdf));
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(api.snapshots).toEqual(['before_export']);
    expect(requests.filter(path => /\/assets\/pdf-/.test(path))).toHaveLength(1);
    const again = await click(page, 'Export PDF');
    expect(sha(await bytesOf(again)), 'two clicks, the same bytes').toBe(sha(bytes));
    expect(api.main.version).toBe(version);
    expect(api.violations).toEqual([]);
  });
}

test('E02 one click on Export TXT gives exactly the serializer\'s bytes, with no BOM (FR-TXT-01, FR-TXT-04)', async ({ page }) => {
  const document = fixture('reference-cv');
  await open(page, new EditorApi(document));
  const download = await click(page, 'Export TXT');
  expect(download.suggestedFilename()).toBe('SWE-Dmytro-Vietrov.txt');
  const bytes = await bytesOf(download);
  expect(Array.from(bytes.slice(0, 3))).not.toEqual([0xef, 0xbb, 0xbf]);
  expect(Buffer.from(bytes).toString('utf8')).toBe(readFileSync(resolve(ROOT, 'tests/fixtures/txt/reference-cv.txt'), 'utf8'));
  await expect(page.locator('.export-note').getByText('Exported SWE-Dmytro-Vietrov.txt.')).toBeVisible();
});

test('E03 no full name: nothing downloads, the reason shows, and typing the name enables export (FR-TYP-03)', async ({ page }) => {
  const document = fixture('one-page');
  const api = new EditorApi({ ...document, header: { ...document.header, fullName: '' } } as Doc);
  let downloads = 0;
  page.on('download', () => { downloads++; });
  await open(page, api);
  await expect(button(page, 'Export PDF')).toHaveAttribute('aria-disabled', 'true');
  await button(page, 'Export PDF').click({ force: true });
  await button(page, 'Export TXT').click({ force: true });
  await expect(page.getByText(/add your full name to export/i)).toBeVisible();
  await button(page, 'Edit header').click();
  await expect(page.getByRole('textbox', { name: 'Full name' })).toBeFocused();
  await page.keyboard.type('Ana Núñez');
  await expect(button(page, 'Export TXT')).toHaveAttribute('aria-disabled', 'false');
  expect(downloads).toBe(0);
  const download = await click(page, 'Export TXT');
  expect(Buffer.from(await bytesOf(download)).toString('utf8').split('\n')[0]).toBe('Ana Núñez');
});

test('E04 an unverified address: a reason and a link, and nothing downloads (ADR-013)', async ({ page }) => {
  const api = new EditorApi(fixture('one-page'));
  api.emailVerified = false;
  let downloads = 0;
  page.on('download', () => { downloads++; });
  await open(page, api);
  await expect(button(page, 'Export PDF')).toHaveAttribute('aria-disabled', 'true');
  await button(page, 'Export PDF').click({ force: true });
  await expect(page.getByText(/verify your e-mail address to export/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Resend verification' })).toHaveAttribute('href', '/verify-email');
  await page.waitForTimeout(100);
  expect(downloads).toBe(0);
  expect(api.snapshots).toEqual([]);
  api.emailVerified = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(button(page, 'Export PDF')).toHaveAttribute('aria-disabled', 'false');
});

test('E05 Copy as text writes the same content (FR-TXT-06)', async ({ page }) => {
  const document = fixture('reference-cv');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as unknown as { copied: string }).copied = text; } } });
  });
  await open(page, new EditorApi(document));
  await page.getByText('Text options').click();
  await button(page, 'Copy as text').click();
  await expect(page.locator('.export-note').getByText('Copied as text.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(readFileSync(resolve(ROOT, 'tests/fixtures/txt/reference-cv.txt'), 'utf8'));
});

test('E06 the CRLF option persists over a reload (FR-TXT-05)', async ({ page }) => {
  const document = fixture('reference-cv');
  await open(page, new EditorApi(document));
  await page.getByText('Text options').click();
  await page.getByRole('checkbox', { name: /windows line endings/i }).check();
  await page.reload();
  await expect(page.locator('[data-page-sheet]').first()).toBeVisible({ timeout: 20_000 });
  await page.getByText('Text options').click();
  await expect(page.getByRole('checkbox', { name: /windows line endings/i })).toBeChecked();
  const bytes = await bytesOf(await click(page, 'Export TXT'));
  expect(Buffer.from(bytes).toString('utf8')).toBe((await nodeFiles(document, null)).crlf);
});

test('E07 failures: an alert and an event, no file, the editor still saves, and a retry works (NFR-13)', async ({ page, context }) => {
  const document = fixture('one-page');
  const api = withPhoto(document);
  let downloads = 0;
  page.on('download', () => { downloads++; });
  await open(page, api);
  await page.route('**/photo/rendition**', route => route.fulfill({ status: 500 }));
  await button(page, 'Export PDF').click();
  await expect(page.getByRole('alert')).toContainText(/photo could not be loaded/i);
  expect(downloads).toBe(0);
  await expect.poll(() => api.clientEvents).toContainEqual(expect.objectContaining({ type: 'export_failed', code: 'photo_load', resumeId: RESUME_ID }));
  await page.getByRole('textbox', { name: 'Resume title' }).fill('Still saving');
  await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 10_000 });
  await page.unroute('**/photo/rendition**');
  const download = await click(page, 'Export PDF');
  expect(download.suggestedFilename()).toBe('Still-saving.pdf');
  await expect(page.getByRole('alert')).toHaveCount(0);
  // A later reload, offline before the PDF tools ever loaded: an alert rather than a broken page.
  await page.reload();
  await expect(page.locator('[data-page-sheet]').first()).toBeVisible({ timeout: 20_000 });
  await context.setOffline(true);
  await button(page, 'Export PDF').click();
  await expect(page.getByRole('alert')).toContainText(/could not|connection/i);
  await expect(page.getByRole('textbox', { name: 'Resume title' })).toBeEditable();
  await context.setOffline(false);
});

test('E08 the library exports the same bytes as the editor (FR-LIB-06)', async ({ page }) => {
  const document = fixture('two-pages');
  const api = withPhoto(document);
  api.listed = true;
  await open(page, api);
  const fromEditor = { pdf: await bytesOf(await click(page, 'Export PDF')), txt: await bytesOf(await click(page, 'Export TXT')) };
  await page.goto('/resumes');
  const name = (kind: string) => page.getByRole('button', { name: `${kind} ${document.title}` });
  const [pdf] = await Promise.all([page.waitForEvent('download'), name('Export PDF').click()]);
  expect(pdf.suggestedFilename()).toBe(`${document.title.replaceAll(' ', '-')}.pdf`);
  expect(sha(await bytesOf(pdf))).toBe(sha(fromEditor.pdf));
  const [txt] = await Promise.all([page.waitForEvent('download'), name('Export TXT').click()]);
  expect(sha(await bytesOf(txt))).toBe(sha(fromEditor.txt));
  await page.goto('/resumes/trash');
  await expect(page.getByRole('button', { name: /^Export/ })).toHaveCount(0);
});

test('E11 PT Serif with its gap letters: painted from the fallback, the same bytes as Node, nothing reported (NFR-07, DD-P12-22)', async ({ page }) => {
  const base = fixture('minimal');
  const resume = { ...base, title: 'Gaps', layout: { ...(base as unknown as { layout: Record<string, unknown> }).layout, bodyFont: 'pt-serif' }, header: { ...(base as unknown as { header: Record<string, unknown> }).header, headline: 'Ŵales Ѝово' } } as unknown as Doc;
  await open(page, new EditorApi(resume));
  const families = await page.locator('[data-page-sheet="1"] [data-role="headline"]').evaluateAll(runs => runs.map(run => getComputedStyle(run).fontFamily));
  expect(families.some(family => /roboto/i.test(family))).toBe(true);
  expect(families.some(family => /pt-serif/i.test(family))).toBe(true);
  await expect.poll(() => page.evaluate(() => [...document.fonts].some(face => /doc-roboto/.test(face.family) && face.status === 'loaded'))).toBe(true);
  const bytes = await bytesOf(await click(page, 'Export PDF'));
  expect(sha(bytes)).toBe(sha((await nodeFiles(resume, null)).pdf));
  await expect(page.locator('.export-note').getByText('Exported Gaps.pdf.', { exact: true })).toBeVisible();
});

test('E09 no wizard, DOCX, e-mail or share, and a click only asks for the snapshot and the photo (§3.2, ADR-010 §5)', async ({ page, baseURL }) => {
  const document = fixture('one-page');
  const api = withPhoto(document);
  api.listed = true;
  await open(page, api);
  const forbidden = /docx|word|e-?mail(?! address)|share|publish|send|wizard/i;
  await page.getByText('Text options').click();
  const names = (await page.locator('.editor-topbar').getByRole('button').allTextContents()).concat(await page.locator('.editor-topbar').getByRole('link').allTextContents());
  expect(names.filter(name => forbidden.test(name))).toEqual([]);
  const requests: { method: string; url: string }[] = [];
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  await click(page, 'Export PDF');
  await expect(page.locator('.export-note').getByText(/^Exported /)).toBeVisible();
  expect(requests.every(request => request.url.startsWith(baseURL!) || request.url.startsWith('blob:')), JSON.stringify(requests)).toBe(true);
  const api_ = requests.filter(request => request.url.includes('/api/v1/')).map(request => `${request.method} ${new URL(request.url).pathname}`);
  expect(api_.sort()).toEqual([`GET /api/v1/resumes/${RESUME_ID}/photo/rendition`, `POST /api/v1/resumes/${RESUME_ID}/snapshots`]);
  await page.goto('/resumes');
  const card = page.locator('article').first();
  await expect(card.getByRole('button', { name: /^Export PDF/ })).toBeVisible();
  expect((await card.getByRole('button').allTextContents()).filter(name => forbidden.test(name))).toEqual([]);
});

test('E10 accessible in every state: axe, keyboard, and no overflow at 390 px (NFR-06, FR-EDT-07)', async ({ page }) => {
  const document = fixture('one-page');
  const axe = async () => expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations).toEqual([]);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const blocked = new EditorApi({ ...document, header: { ...document.header, fullName: '' } } as Doc);
  blocked.emailVerified = false;
  await open(page, blocked);
  await axe();
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  blocked.listed = true;
  await page.goto('/resumes');
  await expect(page.getByRole('button', { name: /^Export PDF/ })).toHaveAttribute('aria-disabled', 'true');
  await axe();
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.unrouteAll();
  const api = new EditorApi(document);
  await open(page, api);
  await page.getByText('Text options').click();
  await axe();
  await page.getByText('Text options').click();
  await button(page, 'Export TXT').focus();
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
  await expect(page.locator('.export-note').getByText(/^Exported /)).toBeVisible();
  await axe();
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByText('Text options').click();
  expect(await overflow()).toBeLessThanOrEqual(0);
  const panel = await page.locator('.export-options-panel').boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(390);
  await axe();
});
