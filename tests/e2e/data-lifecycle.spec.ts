// P13 through the Vite build in three browsers: the data archive (AC-P13-14, AC-P13-18) and the CSP (AC-P13-11, AC-P13-16).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crc32 } from 'node:zlib';
import { EditorApi, RESUME_ID } from './editor-fixture';

const ROOT = resolve(import.meta.dirname, '../..');
const POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const UPDATED_AT = '2026-11-01T10:00:00.000Z';
const JPEG = readFileSync(resolve(ROOT, 'tests/fixtures/resumes/photo.jpg'));
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const ACTIVE = '01934f6e-7a2b-7c3d-8e4f-000000000201';
const TRASHED = '01934f6e-7a2b-7c3d-8e4f-000000000202';
const NAMELESS = '01934f6e-7a2b-7c3d-8e4f-000000000203';
const PHOTO = (id: string) => ({ id, mime: 'image/jpeg', width: 600, height: 600, bytes: JPEG.length, crop: { x: 0, y: 0, width: 600, height: 600 }, updatedAt: '2026-11-01T09:00:00.000Z' });
type Doc = ReturnType<typeof import('./editor-fixture').document>;
const fixture = (name: string): Doc => JSON.parse(readFileSync(resolve(ROOT, `tests/fixtures/resumes/${name}.json`), 'utf8'));

async function nodePdf(document: Doc, photo: Uint8Array | null) {
  const engine = await import(resolve(ROOT, 'tests/rendering/build/engine.mjs'));
  const fonts = engine.createFontBook(Object.fromEntries(['roboto', 'ibm-plex-sans', 'pt-serif'].map(id => [id, Object.fromEntries(['regular', 'italic', 'bold', 'bold-italic'].map(face => [face, new Uint8Array(readFileSync(resolve(ROOT, `frontend/src/assets/fonts/${id}/${face}.ttf`)))]))])));
  const model = engine.layout(document, fonts, { photo: photo !== null, engineVersion: 'node' });
  return await engine.writePdf({ model, document, fonts, photo, updatedAt: UPDATED_AT }) as Uint8Array;
}

/** An independent reader (APPNOTE 4.3), every CRC checked with Node's zlib. */
function unzip(bytes: Buffer): Map<string, Buffer> {
  const end = bytes.length - 22;
  expect(bytes.readUInt32LE(end)).toBe(0x06054b50);
  const files = new Map<string, Buffer>();
  let at = bytes.readUInt32LE(end + 16);
  for (let index = 0; index < bytes.readUInt16LE(end + 10); index++) {
    expect(bytes.readUInt32LE(at)).toBe(0x02014b50);
    const crc = bytes.readUInt32LE(at + 16);
    const size = bytes.readUInt32LE(at + 24);
    const nameLength = bytes.readUInt16LE(at + 28);
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const local = bytes.readUInt32LE(at + 42);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const data = bytes.subarray(start, start + size);
    expect(crc32(data), name).toBe(crc);
    files.set(name, Buffer.from(data));
    at += 46 + nameLength + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
  }
  return files;
}

function exportBody() {
  const active = fixture('two-pages');
  const nameless = { ...fixture('two-pages'), title: 'No name yet', header: { ...fixture('two-pages').header, fullName: '' } };
  const resume = (id: string, document: Doc, extra: Record<string, unknown> = {}) => ({ id, version: 4, createdAt: '2026-10-01T08:00:00.000Z', updatedAt: UPDATED_AT, deletedAt: null, purgeAt: null, photo: null, document, ...extra });
  return {
    exportedAt: '2026-11-12T10:00:00.000Z',
    account: { id: '00000000-0000-4000-8000-000000000001', email: 'person-a@example.invalid', createdAt: '2026-10-01T08:00:00.000Z', emailVerifiedAt: '2026-10-01T08:05:00.000Z' },
    resumes: [
      resume(ACTIVE, active, { photo: PHOTO('01934f6e-7a2b-7c3d-8e4f-200000000301') }),
      resume(TRASHED, { ...active, title: 'Old copy' }, { photo: PHOTO('01934f6e-7a2b-7c3d-8e4f-200000000302'), deletedAt: '2026-11-10T10:00:00.000Z', purgeAt: '2026-12-10T10:00:00.000Z' }),
      resume(NAMELESS, nameless),
    ],
  };
}

async function account(page: Page, { holdRendition = false } = {}) {
  const held: (() => void)[] = [];
  const body = exportBody();
  await page.route('**/api/v1/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"authenticated":true,"user":{"id":"00000000-0000-4000-8000-000000000001","email":"person-a@example.invalid","emailVerified":true,"createdAt":"2026-10-01T08:00:00Z"}}' }));
  await page.route('**/api/v1/auth/reauthenticate', route => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/account/data-export', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(body) }));
  await page.route('**/api/v1/resumes/*/photo/*', async route => {
    if (holdRendition) await new Promise<void>(done => held.push(done));
    await route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG }).catch(() => {});
  });
  await page.route('**/api/v1/client-events', route => route.fulfill({ status: 202 }));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/account#data');
  return { body, release: () => held.splice(0).forEach(done => done()) };
}

async function startDownload(page: Page) {
  await page.getByRole('button', { name: /download your data/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/password/i).fill('synthetic-password-123');
  await dialog.getByRole('button', { name: /confirm/i }).click();
}

const bytesOf = async (download: Download) => readFileSync(await download.path());

test('L01 one ZIP with the JSON, photo masters, and PDF and TXT equal to Node\'s; nameless resumes listed (FR-ACC-04)', async ({ page }) => {
  const { body } = await account(page);
  const downloaded = page.waitForEvent('download');
  await startDownload(page);
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/^resumiser-data-\d{4}-\d{2}-\d{2}\.zip$/);
  const files = unzip(await bytesOf(download));
  expect(JSON.parse(files.get('account-data.json')!.toString('utf8'))).toEqual(body);
  const active = body.resumes[0]!.document as Doc;
  const name = active.title.replaceAll(' ', '-');
  expect(files.get(`resumes/${ACTIVE}/${name}.pdf`)!.equals(Buffer.from(await nodePdf(active, JPEG)))).toBe(true);
  expect(files.get(`resumes/${ACTIVE}/photo-master.jpg`)!.equals(JPEG)).toBe(true);
  expect(files.has(`resumes/${TRASHED}/Old-copy.pdf`)).toBe(true);
  expect(files.has(`resumes/${TRASHED}/Old-copy.txt`)).toBe(true);
  expect([...files.keys()].filter(file => file.startsWith(`resumes/${NAMELESS}/`))).toEqual([]);
  const manifest = JSON.parse(files.get('manifest.json')!.toString('utf8'));
  expect(manifest.resumes.find((item: { id: string }) => item.id === NAMELESS).missing.map((item: { reason: string }) => item.reason)).toEqual(['no_full_name', 'no_full_name']);
  await expect(page.getByRole('status')).toContainText(/downloaded resumiser-data-/i);
});

test('L02 Cancel downloads nothing; keyboard only, axe in every state, no overflow at 390 px, no e-mail or share (NFR-06, §3.2)', async ({ page }) => {
  const { release } = await account(page, { holdRendition: true });
  const axe = async (state: string) => expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations, state).toEqual([]);
  await axe('idle');
  let downloads = 0;
  page.on('download', () => { downloads++; });
  await page.getByRole('button', { name: /download your data/i }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel(/password/i).fill('synthetic-password-123');
  await page.keyboard.press('Enter');
  const cancel = page.getByRole('button', { name: /cancel/i });
  await expect(cancel).toBeFocused();
  await expect(page.getByRole('status')).toContainText(/preparing your archive/i);
  await axe('preparing');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.keyboard.press('Enter');
  release();
  await expect(page.getByRole('status')).toContainText(/archive cancelled\. nothing was downloaded\./i);
  await page.waitForTimeout(500);
  expect(downloads).toBe(0);
  await axe('cancelled');
  const data = page.locator('#data').locator('xpath=..');
  expect((await data.getByRole('button').allTextContents()).filter(name => /e-?mail|share|send/i.test(name))).toEqual([]);
});

test('L03 every page is served under the decided CSP and nothing violates it or leaves the origin (NFR-08, NFR-09)', async ({ page }) => {
  const external: string[] = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' && url.protocol !== 'blob:' && url.protocol !== 'data:') { external.push(url.hostname); return route.abort(); }
    return route.fallback();
  });
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => (window as unknown as { cspViolations: string[] }).cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`));
  });
  const violations = () => page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
  const api = new EditorApi(fixture('two-pages'));
  api.listed = true;
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  const home = await page.goto('/resumes');
  expect(home!.headers()['content-security-policy']).toBe(POLICY);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await violations()).toEqual([]);

  await page.goto(`/resumes/${RESUME_ID}/edit`);
  await expect(page.locator('[data-page-sheet]').first()).toBeVisible({ timeout: 20_000 });
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export PDF', exact: true }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await violations()).toEqual([]);
  expect(external).toEqual([]);
});
