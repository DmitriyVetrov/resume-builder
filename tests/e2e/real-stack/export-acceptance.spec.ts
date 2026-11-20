// P12 step 7: the export against the real API, Mongo, Azurite and Mailpit. A real upload gives the real rendition.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const evidence = process.env.RESUMISER_QA_EVIDENCE;
const MAILPIT = process.env.RESUMISER_MAILPIT_URL ?? 'http://127.0.0.1:8025';
const PASSWORD = 'correct-horse-battery-9';
const STAMP = Date.now();
const VERIFIED = `qa-export-${STAMP}@example.invalid`;
const UNVERIFIED = `qa-export-new-${STAMP}@example.invalid`;
const registered = new Set<string>();
test.setTimeout(240_000);
const fixture = (name: string, templateId = 'T1') => ({ ...JSON.parse(readFileSync(resolve(ROOT, `tests/fixtures/resumes/${name}.json`), 'utf8')), templateId });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const csrf = async (page: Page) => (await page.context().cookies()).find(cookie => cookie.name.endsWith('XSRF-TOKEN'))?.value ?? '';
const keep = (name: string, bytes: Uint8Array) => { if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(`${evidence}/${name}`, bytes); } };
const shot = async (page: Page, name: string) => { if (evidence) { mkdirSync(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/${name}.png` }); } };

async function signIn(page: Page, email: string) {
  if (!registered.has(email)) {
    await page.goto('/sign-up');
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByLabel(/^password/i).first().fill(PASSWORD);
    await page.getByRole('button', { name: /sign up|create account/i }).click();
    await page.waitForURL(/verify|login|resumes|account/);
    registered.add(email);
  }
  await page.goto('/login');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByLabel(/^password/i).first().fill(PASSWORD);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/resumes/);
}

/** The mailed link, as a person would follow it. */
async function verify(page: Page, email: string) {
  let token: string | undefined;
  await expect.poll(async () => {
    const list = await (await page.request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    const message = list.messages?.[0];
    if (!message) return false;
    const body = await (await page.request.get(`${MAILPIT}/api/v1/message/${message.ID}`)).json();
    token = /verify-email#t=([^\s"<]+)/.exec(`${body.Text}\n${body.HTML}`)?.[1];
    return !!token;
  }, { timeout: 90_000, intervals: [2000] }).toBe(true); // The e-mail worker runs once a minute.
  await page.goto(`/verify-email#t=${token}`);
  await expect(page.getByText(/verified/i).first()).toBeVisible({ timeout: 15_000 });
}

const verifiedAccount = new Set<string>();
async function ready(page: Page) {
  await signIn(page, VERIFIED);
  if (!verifiedAccount.has(VERIFIED)) { await verify(page, VERIFIED); verifiedAccount.add(VERIFIED); }
}

async function create(page: Page, document: Record<string, unknown>): Promise<{ id: string; version: number }> {
  const response = await page.request.post('/api/v1/resumes', { data: { source: 'document', document, copyPhotoFromResumeId: null }, headers: { 'Idempotency-Key': crypto.randomUUID(), 'X-XSRF-TOKEN': await csrf(page) } });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}
async function upload(page: Page, id: string, version: number) {
  const response = await page.request.post(`/api/v1/resumes/${id}/photo`, {
    multipart: { file: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: readFileSync(resolve(ROOT, 'tests/fixtures/resumes/photo-600.jpg')) } },
    headers: { 'If-Match': `"${version}"`, 'Idempotency-Key': crypto.randomUUID(), 'X-XSRF-TOKEN': await csrf(page) },
  });
  expect(response.status(), await response.text()).toBe(200);
}
const openEditor = async (page: Page, id: string) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/resumes/${id}/edit`);
  await expect(page.locator('[data-page-sheet]').first()).toBeVisible({ timeout: 20_000 });
};
async function exported(page: Page, name: string) {
  const [download] = await Promise.all([page.waitForEvent('download'), button(page, name).click()]);
  return { name: download.suggestedFilename(), bytes: new Uint8Array(readFileSync(await download.path())) };
}

const ZIGZAG_LUMA = [16, 11, 12, 14, 12, 10, 16, 14, 13, 14, 18, 17, 16, 19, 24, 40, 26, 24, 22, 22, 24, 49, 35, 37, 29, 40, 58, 51, 61, 60, 57, 51, 56, 55, 64, 72, 92, 78, 64, 68, 87, 69, 55, 56, 80, 109, 81, 87, 95, 98, 103, 104, 103, 62, 77, 113, 121, 112, 100, 120, 92, 101, 103, 99];
/** The libjpeg quality that gives this file's first quantization table, and the image size. */
function jpegFacts(bytes: Uint8Array) {
  let at = 2;
  let quality = 0;
  let width = 0;
  while (at < bytes.length) {
    const marker = bytes[at + 1]!;
    const length = (bytes[at + 2]! << 8) + bytes[at + 3]!;
    if (marker === 0xdb && !quality) {
      const scale = ZIGZAG_LUMA.reduce((sum, base, index) => sum + bytes[at + 5 + index]! * 100 / base, 0) / 64;
      quality = scale <= 100 ? (200 - scale) / 2 : 5000 / scale;
    }
    if (marker >= 0xc0 && marker <= 0xc2) width = (bytes[at + 7]! << 8) + bytes[at + 8]!;
    if (marker === 0xda) break;
    at += 2 + length;
  }
  return { quality, width };
}

test('A05 an unverified account is blocked, and exports after following the mailed link (ADR-013, AC-P12-12)', async ({ page }) => {
  await signIn(page, UNVERIFIED);
  const { id } = await create(page, fixture('one-page'));
  await openEditor(page, id);
  await expect(button(page, 'Export PDF')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText(/verify your e-mail address to export/i)).toBeVisible();
  await shot(page, 'export-unverified');
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations.map(violation => violation.id)).toEqual([]);
  await verify(page, UNVERIFIED);
  await openEditor(page, id);
  await expect(button(page, 'Export PDF')).toHaveAttribute('aria-disabled', 'false');
  expect((await exported(page, 'Export TXT')).name).toMatch(/\.txt$/);
});

test('A01 PDF, TXT and copy through the real API on each template (AC-P12-01, 10, 11, 18)', async ({ page, context }) => {
  await ready(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  for (const templateId of ['T1', 'T2', 'T3']) {
    const document = fixture('four-pages', templateId);
    const { id } = await create(page, document);
    await openEditor(page, id);
    const pdf = await exported(page, 'Export PDF');
    expect(pdf.name).toBe(`${document.title.replaceAll(' ', '-')}.pdf`);
    expect(Buffer.from(pdf.bytes.slice(0, 5)).toString()).toBe('%PDF-');
    keep(`export-${templateId}.pdf`, pdf.bytes);
    const txt = await exported(page, 'Export TXT');
    keep(`export-${templateId}.txt`, txt.bytes);
    expect(Buffer.from(txt.bytes).toString('utf8'), templateId).toBe(readFileSync(resolve(ROOT, 'tests/fixtures/txt/four-pages.txt'), 'utf8'));
    await page.getByText('Text options').click();
    await shot(page, `export-${templateId.toLowerCase()}-topbar`);
    if (templateId === 'T1') {
      await button(page, 'Copy as text').click();
      await expect(page.locator('.export-note').getByText('Copied as text.')).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(Buffer.from(txt.bytes).toString('utf8'));
    }
    expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations.map(violation => violation.id), templateId).toEqual([]);
  }
});

test('A02 a real upload: the rendition\'s bytes are in the PDF, at ≥ 200 dpi and quality ≥ 85 (FR-PDF-07, FR-PDF-09)', async ({ page }) => {
  await ready(page);
  for (const [templateId, box] of [['T1', 70], ['T3', 64]] as const) {
    const created = await create(page, fixture('four-pages', templateId));
    await upload(page, created.id, created.version);
    await openEditor(page, created.id);
    const stored = await (await page.request.get(`/api/v1/resumes/${created.id}`)).json();
    const rendition = new Uint8Array(await (await page.request.get(`/api/v1/resumes/${created.id}/photo/rendition`)).body());
    const { quality, width } = jpegFacts(rendition);
    console.log(`A02 ${templateId}: rendition ${width} px, quality ${quality.toFixed(1)}, ${(width * 72 / box).toFixed(0)} dpi`);
    expect(stored.photo).not.toBeNull();
    expect(quality).toBeGreaterThanOrEqual(85);
    expect(width * 72 / box).toBeGreaterThanOrEqual(200);
    const pdf = await exported(page, 'Export PDF');
    keep(`export-${templateId}-photo.pdf`, pdf.bytes);
    expect(Buffer.from(pdf.bytes).indexOf(Buffer.from(rendition)), 'embedded unchanged').toBeGreaterThan(0);
    expect(pdf.bytes.length).toBeLessThanOrEqual(1_000_000);
    console.log(`A02 ${templateId}: PDF ${pdf.bytes.length} bytes`);
  }
});

test('A03 an export takes a snapshot, it shows in Version history, and the version does not move (FR-PER-05)', async ({ page }) => {
  await ready(page);
  const { id, version } = await create(page, fixture('one-page'));
  await openEditor(page, id);
  const answered = page.waitForResponse(response => response.url().endsWith(`/api/v1/resumes/${id}/snapshots`) && response.request().method() === 'POST');
  await exported(page, 'Export PDF');
  expect([200, 201]).toContain((await answered).status());
  const list = await (await page.request.get(`/api/v1/resumes/${id}/snapshots`)).json();
  expect(list.items.map((item: { reason: string }) => item.reason)).toContain('before_export');
  expect((await (await page.request.get(`/api/v1/resumes/${id}`)).json()).version).toBe(version);
  await button(page, 'Version history').click();
  await expect(page.getByText('Before an export')).toBeVisible();
});

test('A04 a blocked rendition: an alert, no file, and an event the real API accepts (NFR-13, AC-P12-15)', async ({ page }) => {
  await ready(page);
  const created = await create(page, fixture('one-page'));
  await upload(page, created.id, created.version);
  await openEditor(page, created.id);
  await page.route('**/photo/rendition**', route => route.fulfill({ status: 503 }));
  const accepted = page.waitForResponse(response => response.url().endsWith('/api/v1/client-events'));
  let downloads = 0;
  page.on('download', () => { downloads++; });
  await button(page, 'Export PDF').click();
  const answer = await accepted;
  expect(answer.status()).toBe(202);
  expect(answer.request().postDataJSON().events[0]).toMatchObject({ type: 'export_failed', code: 'photo_load', resumeId: created.id });
  await expect(page.getByRole('alert')).toContainText(/photo could not be loaded/i);
  expect(downloads).toBe(0);
  await shot(page, 'export-failed');
});

test('A07 PT Serif with its gap letters prints from the fallback on real data (NFR-07, DD-P12-22)', async ({ page }) => {
  await ready(page);
  const base = fixture('one-page');
  const { id } = await create(page, { ...base, layout: { ...base.layout, bodyFont: 'pt-serif' }, header: { ...base.header, headline: 'Ŵales Ĳsselmeer Ѝово' } });
  await openEditor(page, id);
  const pdf = await exported(page, 'Export PDF');
  keep('export-pt-serif-gaps.pdf', pdf.bytes);
  await expect(page.locator('.export-note').getByText(/^Exported [^.]+\.pdf\.$/)).toBeVisible();
  await shot(page, 'export-pt-serif');
});

test('A06 the library exports the same bytes as the editor, for a saved resume with a photo (FR-LIB-06)', async ({ page }) => {
  await ready(page);
  const document = { ...fixture('two-pages'), title: `Library check ${STAMP}` };
  const created = await create(page, document);
  await upload(page, created.id, created.version);
  await openEditor(page, created.id);
  const editor = { pdf: await exported(page, 'Export PDF'), txt: await exported(page, 'Export TXT') };
  await page.goto('/resumes');
  await page.setViewportSize({ width: 1280, height: 900 });
  const name = (kind: string) => page.getByRole('button', { name: `${kind} ${document.title}` });
  const [pdf] = await Promise.all([page.waitForEvent('download'), name('Export PDF').click()]);
  expect(Buffer.from(readFileSync(await pdf.path())).equals(Buffer.from(editor.pdf.bytes))).toBe(true);
  expect(pdf.suggestedFilename()).toBe(editor.pdf.name);
  const [txt] = await Promise.all([page.waitForEvent('download'), name('Export TXT').click()]);
  expect(Buffer.from(readFileSync(await txt.path())).equals(Buffer.from(editor.txt.bytes))).toBe(true);
  await shot(page, 'export-library');
  expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations.map(violation => violation.id)).toEqual([]);
});
