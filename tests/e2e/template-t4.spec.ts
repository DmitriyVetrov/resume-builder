// TPL-01 (ADR-054): template T4 "Panel" in the Design tab — lossless switching, placement for a left sidebar, axe.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { document as seedDocument, EditorApi, RESUME_ID } from './editor-fixture';
import { choose } from './select';

const EDIT = `/resumes/${RESUME_ID}/edit`;
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const design = (page: Page) => page.getByRole('region', { name: 'Design' });
const radio = (page: Page, name: string) => design(page).getByRole('radio', { name });
const sheet = (page: Page) => page.getByRole('region', { name: 'Preview' }).locator('.preview-pages');
const showPreview = (page: Page) => page.locator('#right-tab-Preview').click();
const showDesign = (page: Page) => page.locator('#right-tab-Design').click();
const lastWrite = (api: EditorApi) => JSON.parse(api.writes.at(-1)!.body);

async function open(page: Page, api = new EditorApi(seedDocument())) {
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(EDIT);
  await expect(page.getByRole('textbox', { name: 'Resume title' })).toBeVisible();
  await showDesign(page);
  return api;
}

test('E-01 T1 to Panel to Sidebar to T1 by clicks changes only the template and restores the painted page (FR-TPL-03, AC-TPL-06)', async ({ page }) => {
  const api = await open(page);
  await showPreview(page);
  await expect(sheet(page).locator('[data-page-sheet]').first()).toBeVisible();
  const before = await sheet(page).innerHTML();
  await showDesign(page);
  for (const [name, id] of [['Panel', 'T4'], ['Sidebar', 'T3'], ['Classic Timeline', 'T1']] as const) {
    await radio(page, name).click();
    await expect(radio(page, name)).toBeChecked();
    await expect.poll(() => api.writes.length ? lastWrite(api).templateId : null, { timeout: 8000 }).toBe(id);
    expect(lastWrite(api)).toEqual({ ...seedDocument(), templateId: id });
    if (id === 'T4') {
      await showPreview(page);
      await expect(sheet(page)).toHaveAttribute('data-template', 'T4');
      await expect(sheet(page).locator('[data-shape="panel"]').first()).toBeVisible();
      await showDesign(page);
    }
  }
  await showPreview(page);
  await expect(sheet(page)).toHaveAttribute('data-template', 'T1');
  await expect.poll(() => sheet(page).innerHTML()).toBe(before);
  expect(api.violations).toEqual([]);
});

test('E-02 under Panel the placement control applies: Skills sits in the left sidebar until moved to main (ADR-025, AC-TPL-06)', async ({ page }) => {
  const api = await open(page);
  await expect(design(page).getByRole('group', { name: 'Column for each section' })).toHaveCount(0);
  await radio(page, 'Panel').click();
  const skills = design(page).getByRole('group', { name: 'Column for each section' }).getByRole('combobox', { name: 'Skills' });
  await expect(skills).toHaveAttribute('data-value', '');
  await showPreview(page);
  const left = (name: string) => sheet(page).getByRole('button', { name: `Edit ${name}` }).evaluate(node => parseFloat((node as HTMLElement).style.left));
  await expect(sheet(page)).toHaveAttribute('data-template', 'T4');
  expect(await left('Skills')).toBeLessThan(await left('Summary') - 100);
  await showDesign(page);
  await choose(skills, 'main');
  await showPreview(page);
  await expect.poll(() => left('Skills')).toBe(await left('Summary'));
  await expect.poll(() => api.writes.length ? (lastWrite(api).sections as { title: string; placement: string | null }[]).find(section => section.title === 'Skills')!.placement : null, { timeout: 8000 }).toBe('main');
});

test('E-03 axe is clean with Panel selected, in the light and the dark scheme (AC-TPL-06)', async ({ page }) => {
  await open(page);
  await radio(page, 'Panel').click();
  await expect(radio(page, 'Panel')).toBeChecked();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const tab of [showDesign, showPreview]) {
      await tab(page);
      const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
      expect(results.violations.map(violation => violation.id), scheme).toEqual([]);
    }
  }
});
