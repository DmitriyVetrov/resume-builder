// IMP-01 (ADR-055): CV import from the library — extraction in the browser, a mocked structuring call, review and create.
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Request } from '@playwright/test';
import { document as seedDocument, EditorApi } from './editor-fixture';

const FIXTURES = resolve(import.meta.dirname, '../fixtures/imports');
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const draft = {
  fullName: 'Alex Sample',
  headline: 'Platform Engineer',
  contacts: [{ text: 'alex.sample@example.com', kind: 'email' }, { text: 'Springfield', kind: 'location' }],
  language: 'en',
  sections: [
    { title: '', type: 'text', placement: 'main', blocks: [{ kind: 'paragraph', text: 'Builds platforms that product teams enjoy using.' }], items: [], entries: [] },
    { title: 'Work Experience', type: 'entries', placement: 'main', blocks: [], items: [], entries: [{ title: 'Platform Engineer', organization: 'Example Systems', location: 'Springfield', start: { year: 2024, month: null }, end: null, present: true, dateText: null, blocks: [{ kind: 'bullet', text: 'Ran the platform for twelve teams.' }, { kind: 'bullet', text: 'Cut build times in half.' }] }] },
    { title: 'Skills', type: 'entries', placement: 'sidebar', blocks: [], items: [], entries: [{ title: 'Kubernetes', organization: 'Advanced', location: null, start: null, end: null, present: false, dateText: null, blocks: [] }] },
  ],
};

async function open(page: Page, structure: 'draft' | 'unavailable' = 'draft') {
  const api = new EditorApi(seedDocument());
  await api.install(page);
  const requests: Request[] = [];
  await page.route('**/api/v1/resume-imports/structure', route => {
    requests.push(route.request());
    return structure === 'draft'
      ? route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ draft, escalated: false, warnings: [] }) })
      : route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: 'about:blank', title: 'Import unavailable', status: 503, code: 'import_unavailable', traceId: 'synthetic-trace' }) });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/resumes');
  await page.getByRole('link', { name: 'Import CV' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Import a CV' })).toBeVisible();
  return { api, requests };
}
const pick = (page: Page, name: string) => page.getByLabel('CV file (PDF or TXT)').setInputFiles(resolve(FIXTURES, name));
const review = (page: Page) => page.getByRole('heading', { level: 2, name: 'Review the import' });

test('I-01 Library → Import CV → review with a painted preview and the report → Create opens the editor (AC-IMP-06)', async ({ page }) => {
  const { api, requests } = await open(page);
  await pick(page, 'synthetic-cv.pdf');
  await expect(review(page)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Import preview' }).locator('[data-page-sheet]').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Import report' })).toContainText('Work Experience');
  const sent = JSON.parse(requests[0]!.postData()!) as { sourceText: string; sourceFormat: string; layoutHint: unknown };
  expect(sent.sourceFormat).toBe('pdf');
  expect(sent.layoutHint).toEqual({ columns: 2, sidebarSide: 'left' });
  expect(sent.sourceText).toContain('Alex Sample');
  expect(sent.sourceText).not.toContain('%PDF');
  await page.getByRole('button', { name: 'Create resume' }).click();
  await expect(page).toHaveURL(/\/resumes\/[^/]+\/edit$/);
  await expect(page.getByRole('textbox', { name: 'Resume title' })).toHaveValue('Alex Sample');
  const created = [...api.resumes.values()].find(item => item.document.title === 'Alex Sample')!;
  expect(created.document).toMatchObject({ templateId: 'T4', header: { fullName: 'Alex Sample' } });
  expect(api.violations).toEqual([]);
});

test('I-02 own TXT export imports as text with a one-column hint (AC-IMP-10)', async ({ page }) => {
  const { requests } = await open(page);
  await pick(page, 'synthetic-cv.txt');
  await expect(review(page)).toBeVisible();
  const sent = JSON.parse(requests[0]!.postData()!) as { sourceFormat: string; layoutHint: unknown };
  expect(sent).toMatchObject({ sourceFormat: 'txt', layoutHint: { columns: 1, sidebarSide: null } });
});

test('I-03 a PDF without a text layer is refused before anything is sent (AC-IMP-07)', async ({ page }) => {
  const { requests } = await open(page);
  await pick(page, 'no-text.pdf');
  await expect(page.getByText('This PDF has no text layer. Export it again with selectable text, or import a TXT file.')).toBeVisible();
  expect(requests).toEqual([]);
});

test('I-04 the import page and the review are axe-clean in light and dark, and reachable by keyboard (NFR-06)', async ({ page }) => {
  test.setTimeout(60_000);
  // The scheme switches in place: without reduced motion axe reads the 150 ms colour transition (as account.spec does).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'unavailable');
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations.map(item => item.id), `picker ${scheme}`).toEqual([]);
  }
  await pick(page, 'synthetic-cv.pdf');
  await expect(review(page)).toBeVisible();
  await expect(page.getByText(/Basic import:/)).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations.map(item => item.id), `review ${scheme}`).toEqual([]);
  }
  const reached: string[] = [];
  await page.locator('body').focus();
  for (let index = 0; index < 40 && !reached.includes('Create resume'); index++) {
    await page.keyboard.press('Tab');
    reached.push(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? ''));
  }
  expect(reached).toContain('Create resume');
});
