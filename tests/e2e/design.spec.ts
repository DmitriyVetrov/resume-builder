import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { document as seedDocument, EditorApi, RESUME_ID, run } from './editor-fixture';
import { choose } from './select';

const EDIT = `/resumes/${RESUME_ID}/edit`;
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const status = (page: Page) => page.getByTestId('save-status');
const design = (page: Page) => page.getByRole('region', { name: 'Design' });
const radio = (page: Page, name: string) => design(page).getByRole('radio', { name });
const slider = (page: Page, name: string) => design(page).getByRole('slider', { name });
const sheet = (page: Page) => page.getByRole('region', { name: 'Preview' }).locator('.preview-pages');
const firstRun = (page: Page, role: string) => sheet(page).locator(`[data-role="${role}"]`).first();
const headerLeft = (page: Page) => sheet(page).locator('[data-preview-header]').evaluate(node => parseFloat((node as HTMLElement).style.left));
const undo = (page: Page) => page.getByRole('button', { name: 'Undo' }).click();
const saved = (page: Page) => expect(status(page)).toHaveText('Saved', { timeout: 8000 });
const showPreview = (page: Page) => page.locator('#right-tab-Preview').click();
const showDesign = (page: Page) => page.locator('#right-tab-Design').click();

/** Synthetic, with the Spanish and Ukrainian text and the dates the design controls act on. */
function seed() {
  const base = seedDocument();
  const date = { kind: 'date', year: 2020, month: 1 };
  const sections = base.sections.map(section => section.type === 'entries'
    ? { ...section, title: 'Experiencia', content: { labels: null, entries: (section.content.entries as Record<string, unknown>[]).map((entry, index) => ({ ...entry, title: index ? 'Розробниця' : 'Ingeniera de plataforma', organization: index ? 'Приклад Софт' : 'Ñandú Sistemas', location: 'València', start: date, end: { kind: 'present' }, description: [{ kind: 'paragraph', inlines: [run('Migración de servicios y міграція застарілих систем.')] }, { kind: 'bulletList', items: [[run('Redujo la latencia')], [run('Скоротила інциденти')], [run('Mentored engineers')]] }] })) } }
    : section);
  return { ...base, language: 'es', header: { ...(base.header as object), fullName: 'Lucía Ñáñez', headline: 'Ingeniera | Інженерка', contacts: [{ id: '01934f6e-7a2b-7c3d-8e4f-300000000001', text: 'lucia@example.invalid', url: null, kind: 'email' }, { id: '01934f6e-7a2b-7c3d-8e4f-300000000002', text: 'València, España', url: null, kind: 'location' }] }, sections } as ReturnType<typeof seedDocument>;
}

async function open(page: Page, api = new EditorApi(seed())) {
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(EDIT);
  await expect(page.getByRole('textbox', { name: 'Resume title' })).toBeVisible();
  await showDesign(page);
  return api;
}

test('Y01 four thumbnails of the own text, arrows change the template, autosave carries it, reload keeps it (AC-P10-03, 13, ADR-054)', async ({ page }) => {
  const api = await open(page);
  const thumbnails = design(page).locator('.page-thumbnail');
  await expect(thumbnails).toHaveCount(4);
  for (const index of [0, 1, 2, 3]) await expect(thumbnails.nth(index)).toContainText('Lucía Ñáñez', { ignoreCase: true });
  await radio(page, 'Classic Timeline').focus();
  await page.keyboard.press('ArrowRight');
  await expect(radio(page, 'Compact')).toBeChecked();
  await expect(radio(page, 'Compact')).toBeFocused();
  await saved(page);
  expect(JSON.parse(api.writes.at(-1)!.body).templateId).toBe('T2');
  await showPreview(page);
  await expect(sheet(page)).toHaveAttribute('data-template', 'T2');
  await page.reload();
  await expect(sheet(page)).toHaveAttribute('data-template', 'T2');
  expect(api.violations).toEqual([]);
});

test('Y02 T1 to T2 to T3 to T1 by clicks restores the painted page and changes nothing else (AC-P10-04)', async ({ page }) => {
  const api = await open(page);
  await showPreview(page);
  await expect(sheet(page).locator('[data-page-sheet]').first()).toBeVisible();
  const before = await sheet(page).innerHTML();
  const order = await page.locator('[data-section-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-section-id')));
  await showDesign(page);
  for (const [name, id] of [['Compact', 'T2'], ['Sidebar', 'T3'], ['Classic Timeline', 'T1']] as const) {
    await radio(page, name).click();
    await expect(radio(page, name)).toBeChecked();
    await expect.poll(() => api.writes.length ? JSON.parse(api.writes.at(-1)!.body).templateId : null, { timeout: 8000 }).toBe(id);
    expect(JSON.parse(api.writes.at(-1)!.body)).toEqual({ ...seed(), templateId: id });
  }
  await saved(page);
  await showPreview(page);
  await expect(sheet(page)).toHaveAttribute('data-template', 'T1');
  await expect.poll(() => sheet(page).innerHTML()).toBe(before);
  expect(await page.locator('[data-section-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-section-id')))).toEqual(order);
  expect(api.violations).toEqual([]);
});

test('Y03 a swatch repaints the name and leaves the body, and undo returns (AC-P10-06, 13)', async ({ page }) => {
  await open(page);
  const color = (role: string) => firstRun(page, role).evaluate(node => getComputedStyle(node).color);
  await showPreview(page);
  const [name, body] = [await color('name'), await color('body')];
  await showDesign(page);
  await radio(page, 'Graphite').click();
  await showPreview(page);
  await expect.poll(() => color('name')).toBe('rgb(51, 51, 51)');
  expect(name).not.toBe('rgb(51, 51, 51)');
  expect(await color('body')).toBe(body);
  await undo(page);
  await expect.poll(() => color('name')).toBe(name);
});

test('Y11 the page applies the paragraph gap and positions text at subpixels (AC-P10-16)', async ({ page }) => {
  await open(page);
  await showPreview(page);
  const top = (text: RegExp) => sheet(page).locator('[data-role="body"]', { hasText: text }).first().evaluate(node => parseFloat((node as HTMLElement).style.top));
  await expect(firstRun(page, 'body')).toBeVisible();
  expect(await top(/Redujo la latencia/) - await top(/^Migración de servicios/)).toBeCloseTo(12.5 + 6, 3);
  await expect(firstRun(page, 'body')).toHaveCSS('text-rendering', 'geometricprecision');
});

test('Y04 sliders with real keys, double-click, and one undo after a burst (AC-P10-08, 13)', async ({ page }) => {
  await open(page);
  const value = (name: string) => design(page).getByTestId(`value-${name}`);
  const section = slider(page, 'Section spacing');
  await section.focus();
  for (let index = 0; index < 3; index++) await page.keyboard.press('ArrowRight');
  await expect(value('Section spacing')).toHaveText('13');
  await undo(page);
  await expect(value('Section spacing')).toHaveText('10');
  await section.focus();
  await page.keyboard.press('Home');
  await expect(value('Section spacing')).toHaveText('0');
  await page.keyboard.press('End');
  await expect(value('Section spacing')).toHaveText('20');
  const line = slider(page, 'Line spacing');
  await line.focus();
  for (let index = 0; index < 4; index++) await page.keyboard.press('ArrowRight');
  await expect(value('Line spacing')).toHaveText('5');
  await line.dblclick();
  await expect(value('Line spacing')).toHaveText('1');
});

test('Y05 page size, margins and font size change the sheet; reset and undo (AC-P10-07, 09, 10)', async ({ page }) => {
  await open(page);
  const box = async () => { const { width, height } = await sheet(page).locator('[data-page-sheet="1"]').evaluate(node => node.getBoundingClientRect()); return { width, height, left: await headerLeft(page) }; };
  const nameSize = () => firstRun(page, 'name').evaluate(node => parseFloat((node as HTMLElement).style.fontSize));
  await showPreview(page);
  const a4 = await box();
  expect(a4.height / a4.width).toBeCloseTo(842 / 595, 2);
  expect(a4.left).toBeCloseTo(23, 3);
  const medium = await nameSize();
  await showDesign(page);
  await radio(page, 'US Letter').click();
  await radio(page, 'Wide').click();
  await radio(page, 'Large').click();
  await showPreview(page);
  const letter = await box();
  expect(letter.height / letter.width).toBeCloseTo(792 / 612, 2);
  expect(letter.left).toBeCloseTo(36, 3);
  expect(await nameSize()).toBeGreaterThan(medium * 1.1);
  await showDesign(page);
  await radio(page, 'Custom').click();
  await design(page).getByRole('spinbutton', { name: /custom margin/i }).fill('50.5');
  await design(page).getByRole('spinbutton', { name: /custom margin/i }).press('Enter');
  await expect(design(page).getByText(/between 10 and 50/i)).toBeVisible();
  await design(page).getByRole('spinbutton', { name: /custom margin/i }).fill('30');
  await design(page).getByRole('spinbutton', { name: /custom margin/i }).press('Enter');
  await showPreview(page);
  expect((await box()).left).toBeCloseTo(30, 3);
  await showDesign(page);
  await design(page).getByRole('button', { name: 'Reset design' }).click();
  await expect(page.getByTestId('announcer')).toHaveText('Design reset. Undo is available.');
  await expect(radio(page, 'A4')).toBeChecked();
  await showPreview(page);
  { const reset = await box(); expect(reset.height / reset.width).toBeCloseTo(842 / 595, 2); }
  await undo(page);
  await showDesign(page);
  await expect(radio(page, 'US Letter')).toBeChecked();
  await expect(radio(page, 'Large')).toBeChecked();
});

test('Y06 the body font loads from our own origin and nothing leaves it (AC-P10-11, 18)', async ({ page, baseURL }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await open(page);
  await choose(design(page).getByRole('combobox', { name: 'Body font' }), 'pt-serif');
  await showPreview(page);
  await expect(firstRun(page, 'body')).toHaveCSS('font-family', /doc-pt-serif-regular/);
  await page.waitForFunction(() => document.fonts.check('13px "doc-pt-serif-regular"', 'Ñі'));
  expect(requests.some(url => /\.ttf(\?|$)/.test(url))).toBe(true);
  for (const url of requests) expect(url.startsWith(baseURL!) || url.startsWith('data:') || url.startsWith('blob:'), url).toBe(true);
  expect(await page.evaluate(() => Array.from(document.fonts).filter(face => face.family.includes('pt-serif') && face.status === 'loaded').length)).toBeGreaterThan(0);
});

test('Y07 language and date format change the dates and "Present" (AC-P10-12)', async ({ page }) => {
  await open(page);
  await choose(design(page).getByRole('combobox', { name: 'Language' }), 'uk');
  await choose(design(page).getByRole('combobox', { name: 'Date format' }), 'MonthYearShort');
  await showPreview(page);
  await expect(sheet(page).getByText('січ 2020 - дотепер').first()).toBeVisible();
  await showDesign(page);
  await choose(design(page).getByRole('combobox', { name: 'Language' }), 'en');
  await choose(design(page).getByRole('combobox', { name: 'Date format' }), 'YearOnly');
  await showPreview(page);
  await expect(sheet(page).getByText('2020 - Present').first()).toBeVisible();
});

test('Y08 under T3, Skills sits in the sidebar until overridden; T1 ignores the field (AC-P10-05)', async ({ page }) => {
  const api = await open(page);
  await expect(design(page).getByRole('group', { name: 'Column for each section' })).toHaveCount(0);
  await radio(page, 'Sidebar').click();
  const skills = design(page).getByRole('group', { name: 'Column for each section' }).getByRole('combobox', { name: 'Skills' });
  await expect(skills).toHaveAttribute('data-value', '');
  await showPreview(page);
  const left = (name: string) => sheet(page).getByRole('button', { name: `Edit ${name}` }).evaluate(node => parseFloat((node as HTMLElement).style.left));
  await expect(sheet(page)).toHaveAttribute('data-template', 'T3');
  expect(await left('Skills')).toBeGreaterThan(await left('Summary') + 100);
  await showDesign(page);
  await choose(skills, 'main');
  await showPreview(page);
  await expect.poll(() => left('Skills')).toBe(await left('Summary'));
  await showDesign(page);
  await radio(page, 'Classic Timeline').click();
  await saved(page);
  await showPreview(page);
  await expect(sheet(page)).toHaveAttribute('data-template', 'T1');
  expect(await left('Skills')).toBe(await left('Summary'));
  const stored = JSON.parse(api.writes.at(-1)!.body) as { sections: { title: string; placement: string | null }[] };
  expect(stored.sections.find(section => section.title === 'Skills')!.placement).toBe('main');
});

test('Y09 axe is clean on the Design tab for each template, every control is reachable by keyboard, and no page overflow at 390 px or 200% (AC-P10-17)', async ({ page }) => {
  // Four axe passes since T4: 13.6–30.5 s across browsers in TPL-01, at the 30 s default (DD-TPL-20).
  test.setTimeout(60_000);
  await open(page);
  for (const name of ['Classic Timeline', 'Compact', 'Sidebar', 'Panel']) {
    await radio(page, name).click();
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations.map(violation => violation.id), name).toEqual([]);
  }
  await radio(page, 'Classic Timeline').click();
  await radio(page, 'Classic Timeline').focus();
  // A round trip by key, so the focus ring below is the keyboard one.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const reached: string[] = [];
  for (let index = 0; index < 14; index++) {
    reached.push(await page.evaluate(() => { const active = document.activeElement as HTMLElement; const id = active.id; return active.getAttribute('aria-label') ?? (id ? document.querySelector(`label[for="${id}"]`)?.textContent : null) ?? active.closest('label')?.textContent ?? active.textContent ?? ''; }));
    const focused = page.locator(':focus');
    // A native radio here is transparent, over its option, so the ring is on the option.
    // DD-UI-15: an outline, or the shadcn theme ring (a 3 px box-shadow spread).
    const indicated = await focused.evaluate(node => { const style = getComputedStyle(node.closest('.design-option') ?? node); return style.outlineStyle !== 'none' || /\b0px 0px 0px 3px\b/.test(style.boxShadow); });
    expect(indicated, reached.at(-1)).toBe(true);
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => !document.activeElement?.closest('[aria-label="Design"]'))) break;
  }
  for (const name of ['Classic Timeline', 'Blue', 'Medium', 'Body font', 'Section spacing', 'Entry spacing', 'Line spacing', 'A4', 'Normal', 'Language', 'Date format', 'Reset design']) expect(reached.join('|'), name).toContain(name);
  await radio(page, 'Sidebar').click();
  for (const size of [{ width: 390, height: 844 }, { width: 640, height: 450 }]) {
    await page.setViewportSize(size);
    await page.locator('#tab-Design').click();
    await expect(radio(page, 'Sidebar')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${size.width}px`).toBe(true);
    await page.locator('#tab-Preview').click();
    await expect(sheet(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${size.width}px preview`).toBe(true);
  }
  await page.locator('#tab-Design').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await design(page).locator('.design-option').first().evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
});

test('Y10 visual baselines of page 1 for each template (AC-P10-19)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Baselines are Chromium only, in the pinned image.');
  await open(page);
  // Tall enough that the scroller does not clip the page.
  await page.setViewportSize({ width: 1280, height: 1100 });
  for (const [name, file] of [['Classic Timeline', 't1'], ['Compact', 't2'], ['Sidebar', 't3']] as const) {
    await radio(page, name).click();
    await showPreview(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(sheet(page)).toHaveAttribute('data-template', file.toUpperCase());
    await page.addStyleTag({ content: '.page-region { display:none; }' });
    await expect(sheet(page).locator('.page-frame').first()).toHaveScreenshot(`${file}.png`, { maxDiffPixelRatio: 0.002 });
    await showDesign(page);
  }
});
