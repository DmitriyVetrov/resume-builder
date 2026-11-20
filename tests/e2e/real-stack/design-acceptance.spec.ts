import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { choose } from '../select';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const evidence = process.env.RESUMISER_QA_EVIDENCE;
const PASSWORD = 'correct-horse-battery-9';
const EMAIL = `qa-design-${Date.now()}@example.invalid`;
let registered = false;
const title = (page: Page) => page.getByRole('textbox', { name: 'Resume title' });
const status = (page: Page) => page.getByTestId('save-status');
const saved = (page: Page) => expect(status(page)).toHaveText('Saved', { timeout: 10_000 });
const design = (page: Page) => page.getByRole('region', { name: 'Design' });
const radio = (page: Page, name: string) => design(page).getByRole('radio', { name });
const sheet = (page: Page) => page.getByRole('region', { name: 'Preview' }).locator('.preview-pages');
const showDesign = (page: Page) => page.locator('#right-tab-Design').click();
const showPreview = (page: Page) => page.locator('#right-tab-Preview').click();
const row = (page: Page, name: string) => page.getByRole('list', { name: 'Resume sections' }).getByRole('button', { name: new RegExp(`^${name}`) });
const csrf = async (page: Page) => (await page.context().cookies()).find(cookie => cookie.name.endsWith('XSRF-TOKEN'))?.value ?? '';
const stored = async (page: Page, id: string) => (await page.request.get(`/api/v1/resumes/${id}`)).json();
const shot = async (page: Page, name: string, width = 1280, height = 900) => {
  await page.setViewportSize({ width, height });
  if (evidence) await page.screenshot({ path: `${evidence}/${name}-${width}.png` });
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

/** A blank resume with synthetic content, written through the real API, then opened. */
async function createResume(page: Page, change: (document: Record<string, any>) => void = () => {}) {
  await page.goto('/resumes');
  await page.getByRole('button', { name: /create (new resume|your first resume)/i }).first().click();
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) await dialog.getByRole('button', { name: /start from scratch/i }).click();
  await page.waitForURL(/\/resumes\/[^/]+\/edit$/);
  await expect(title(page)).toBeVisible();
  const id = page.url().match(/resumes\/([^/]+)\/edit/)![1]!;
  const resume = await stored(page, id);
  const run = (value: string, bold = false) => ({ kind: 'text', value, bold, italic: false, underline: false });
  const document = resume.document;
  document.header = { ...document.header, fullName: 'Lucía Ñáñez', headline: 'Ingeniera | Інженерка', contacts: [{ id: crypto.randomUUID(), text: 'lucia@example.invalid', url: null, kind: 'email' }, { id: crypto.randomUUID(), text: 'València', url: null, kind: 'location' }] };
  for (const section of document.sections) {
    if (section.type === 'text') section.content = { body: [{ kind: 'paragraph', inlines: [run('Migración de servicios y міграція застарілих систем.')] }] };
    if (section.type === 'list') section.content = { items: ['Go', 'SQL', 'Kubernetes', 'Azure'].map(text => ({ id: crypto.randomUUID(), text: [run(text)] })) };
    if (section.type === 'inline') section.content = { body: [{ kind: 'paragraph', inlines: [run('Español', true), run(' - nativo')] }] };
    if (section.type === 'entries' && !section.content.labels) section.content.entries = [0, 1].map(index => ({ id: crypto.randomUUID(), title: index ? 'Розробниця' : 'Ingeniera', organization: 'Ñandú Sistemas', location: 'València', start: { kind: 'date', year: 2020 + index, month: 1 }, end: { kind: 'present' }, dateText: '', description: [{ kind: 'bulletList', items: [[run('Redujo la latencia')], [run('Скоротила інциденти')]] }], pageBreakBefore: false }));
  }
  change(document);
  const response = await page.request.put(`/api/v1/resumes/${id}/document`, { data: document, headers: { 'If-Match': `"${resume.version}"`, 'Idempotency-Key': crypto.randomUUID(), 'X-XSRF-TOKEN': await csrf(page) } });
  expect(response.status(), await response.text()).toBe(200);
  await page.reload();
  await expect(title(page)).toBeVisible();
  return id;
}

test('D01 every setting survives a reload and a new tab, as a real stored document (AC-P10-13)', async ({ page, context }) => {
  await signIn(page);
  const id = await createResume(page);
  await showDesign(page);
  await radio(page, 'Sidebar').click();
  await radio(page, 'Forest').click();
  await radio(page, 'Large').click();
  await radio(page, 'US Letter').click();
  await radio(page, 'Wide').click();
  await design(page).getByRole('slider', { name: 'Section spacing' }).fill('14');
  await design(page).getByRole('slider', { name: 'Entry spacing' }).fill('3');
  await design(page).getByRole('slider', { name: 'Line spacing' }).fill('5');
  await choose(design(page).getByRole('combobox', { name: 'Body font' }), 'pt-serif');
  await choose(design(page).getByRole('combobox', { name: 'Language', exact: true }), 'es');
  await choose(design(page).getByRole('combobox', { name: 'Date format' }), 'MonthYearShort');
  await saved(page);
  const expected = { fontPreset: 'L', sectionSpacing: 14, entrySpacing: 3, lineSpacing: 5, pageSize: 'Letter', margins: { top: 36, right: 36, bottom: 36, left: 36 }, bodyFont: 'pt-serif' };
  const { document } = await stored(page, id);
  expect(document).toMatchObject({ templateId: 'T3', accentPreset: 1, language: 'es', dateFormat: 'MonthYearShort', layout: expected });
  await page.reload();
  await expect(sheet(page)).toHaveAttribute('data-template', 'T3');
  await showDesign(page);
  await expect(radio(page, 'Forest')).toBeChecked();
  await expect(design(page).getByRole('slider', { name: 'Line spacing' })).toHaveValue('5');
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.getByRole('region', { name: 'Preview' }).locator('.preview-pages')).toHaveAttribute('data-template', 'T3');
  await expect(other.getByRole('region', { name: 'Preview' }).locator('.preview-pages').getByText('ene 2020 - Actualidad').first()).toBeVisible();
  await other.close();
});

test('D02 a snapshot restore brings the design back, and undo returns it (AC-P10-13, FR-PER-05)', async ({ page }) => {
  await signIn(page);
  const id = await createResume(page);
  await showDesign(page);
  await radio(page, 'Navy').click();
  await saved(page);
  await radio(page, 'Compact').click();
  await saved(page);
  await page.getByRole('button', { name: 'Version history' }).click();
  const dialog = page.getByRole('dialog', { name: 'Version history' });
  await expect(dialog.getByRole('button', { name: /^Restore/ }).first()).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('button', { name: /^Restore/ }).first().click();
  await expect(radio(page, 'Classic Timeline')).toBeChecked();
  await expect.poll(async () => (await stored(page, id)).document.templateId, { timeout: 10_000 }).toBe('T1');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(radio(page, 'Compact')).toBeChecked();
  await expect.poll(async () => (await stored(page, id)).document.templateId, { timeout: 10_000 }).toBe('T2');
});

test('D03 a font the template does not offer, written through the API, does not break the draft or get rewritten (AC-P10-11)', async ({ page }) => {
  await signIn(page);
  const id = await createResume(page, document => { document.layout.bodyFont = 'comic-sans-unbundled'; });
  await expect(sheet(page).locator('[data-role="body"]').first()).toHaveCSS('font-family', /doc-roboto/);
  await expect(sheet(page).getByText('LUCÍA ÑÁÑEZ').first()).toBeVisible();
  await showDesign(page);
  await expect(design(page).getByRole('combobox', { name: 'Body font' })).toHaveAttribute('data-value', 'roboto');
  await radio(page, 'Navy').click();
  await saved(page);
  expect((await stored(page, id)).document.layout.bodyFont).toBe('comic-sans-unbundled');
});

test('D04 the three templates over real content, with screenshots, and axe clean (AC-P10-03, 15, 17)', async ({ page }) => {
  await signIn(page);
  await createResume(page);
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith(new URL(page.url()).origin) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) external.push(request.url()); });
  for (const [name, file] of [['Classic Timeline', 't1'], ['Compact', 't2'], ['Sidebar', 't3']] as const) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await showDesign(page);
    await radio(page, name).click();
    await page.evaluate(() => document.fonts.ready);
    await saved(page);
    await shot(page, `design-tab-${file}`);
    expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations.map(violation => violation.id), name).toEqual([]);
    await showPreview(page);
    await page.evaluate(() => document.fonts.ready);
    await shot(page, `draft-${file}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#tab-Design').click();
    await shot(page, `design-tab-${file}`, 390, 844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${name} 390`).toBe(true);
    await page.locator('#tab-Preview').click();
    await shot(page, `draft-${file}`, 390, 844);
  }
  expect(external).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await row(page, 'Skills').click();
  await expect(page.getByRole('region', { name: 'Edit' }).getByRole('combobox', { name: /list columns/i })).toBeVisible();
});

test('D05 a section the user moved in T3 stays where it is after a switch to T1 and back (AC-P10-04, 05)', async ({ page }) => {
  await signIn(page);
  const id = await createResume(page);
  await showDesign(page);
  await radio(page, 'Sidebar').click();
  await choose(design(page).getByRole('group', { name: 'Column for each section' }).getByRole('combobox', { name: 'Skills' }), 'main');
  await saved(page);
  const before = (await stored(page, id)).document;
  await radio(page, 'Classic Timeline').click();
  await radio(page, 'Sidebar').click();
  await saved(page);
  expect((await stored(page, id)).document).toEqual(before);
  await showPreview(page);
  expect(await sheet(page).getByRole('button', { name: 'Edit Skills' }).evaluate(node => parseFloat((node as HTMLElement).style.left))).toBeLessThan(100);
});
