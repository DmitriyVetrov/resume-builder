import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { document as seedDocument, EditorApi, RESUME_ID, run } from './editor-fixture';

const EDIT = `/resumes/${RESUME_ID}/edit`;
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
type Fixture = { name: string; html: string; blocks: unknown[] };
const clipboard = JSON.parse(readFileSync(new URL('../fixtures/rich-text/clipboard.json', import.meta.url), 'utf8')) as Fixture[];
const fixture = (name: string) => clipboard.find(item => item.name === name)!;
const t = (value: string, marks: Partial<Record<'bold' | 'italic' | 'underline', boolean>> = {}) => run(value, marks);

const status = (page: Page) => page.getByTestId('save-status');
const row = (page: Page, name: string) => page.getByRole('list', { name: 'Resume sections' }).getByRole('button', { name: new RegExp(`^${name}`) });
const field = (page: Page, name = 'Text') => page.getByRole('region', { name: 'Edit' }).getByRole('textbox', { name, exact: true });

async function open(page: Page, section = 'Summary', api = new EditorApi()) {
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(EDIT);
  await expect(page.getByRole('textbox', { name: 'Resume title' })).toBeVisible();
  await row(page, section).click();
  return api;
}
async function saved(page: Page) { await expect(status(page)).toHaveText('Saved', { timeout: 5000 }); }
const sectionOf = (api: EditorApi, title: string) => api.main.document.sections.find(section => section.title === title)!;
const bodyOf = (api: EditorApi, title = 'Summary') => sectionOf(api, title).content.body;
async function replaceAll(page: Page, text: string, name = 'Text') {
  await field(page, name).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(text);
}
/** A real `paste` event with real `DataTransfer` data (Firefox has no `clipboardData` in the event constructor). */
async function paste(page: Page, data: { html?: string; text?: string }, name = 'Text') {
  await field(page, name).evaluate((node, { html, text }) => {
    const transfer = new DataTransfer();
    if (html) transfer.setData('text/html', html);
    transfer.setData('text/plain', text ?? '');
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: transfer });
    node.dispatchEvent(event);
  }, data);
}

test('T01 formats by shortcut and toolbar; saved AST and preview agree', async ({ page }) => {
  const api = await open(page);
  await replaceAll(page, 'one two three');
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ControlOrMeta+b');
  const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
  await expect(toolbar.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ControlOrMeta+i');
  await toolbar.getByRole('button', { name: 'Underline' }).click();
  await expect(field(page)).toBeFocused();
  await saved(page);
  expect(bodyOf(api)).toEqual([{ kind: 'paragraph', inlines: [t('one', { bold: true, italic: true, underline: true }), t(' two three')] }]);
  const one = page.getByRole('region', { name: 'Preview' }).locator('[data-role="body"]', { hasText: /^one$/ });
  await expect(one).toHaveCSS('font-family', /bold-italic/);
  await expect(one).toHaveCSS('text-decoration-line', 'underline');
  await page.keyboard.press('ControlOrMeta+b');
  await saved(page);
  expect(bodyOf(api)).toEqual([{ kind: 'paragraph', inlines: [t('one', { italic: true, underline: true }), t(' two three')] }]);
  expect(api.violations).toEqual([]);
});

test('T02 a paragraph then bullets, Enter out of the list, and toggling', async ({ page }) => {
  const api = await open(page);
  await replaceAll(page, 'Intro');
  await page.keyboard.press('Enter');
  await page.getByRole('toolbar', { name: 'Text formatting' }).getByRole('button', { name: 'Bullet list' }).click();
  await page.keyboard.type('first');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Outro');
  await saved(page);
  expect(bodyOf(api)).toEqual([
    { kind: 'paragraph', inlines: [t('Intro')] },
    { kind: 'bulletList', items: [[t('first')], [t('second')]] },
    { kind: 'paragraph', inlines: [t('Outro')] },
  ]);
  await page.keyboard.press('ControlOrMeta+a');
  await page.getByRole('toolbar', { name: 'Text formatting' }).getByRole('button', { name: 'Bullet list' }).click();
  await saved(page);
  expect(bodyOf(api)).toEqual([{ kind: 'bulletList', items: [[t('Intro')], [t('first')], [t('second')], [t('Outro')]] }]);
  await expect(page.getByRole('region', { name: 'Preview' }).locator('[data-role="body"]', { hasText: 'Outro' })).toBeVisible();
  // Four here and the two of the seeded Skills list.
  await expect(page.getByRole('region', { name: 'Preview' }).locator('[data-shape="marker"]')).toHaveCount(6);
  expect(api.violations).toEqual([]);
});

test('T02b a key right after collapsing a selection acts on the new caret, and loses no text', async ({ page }) => {
  const api = await open(page);
  await replaceAll(page, 'Keep me');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('!');
  await saved(page);
  expect(bodyOf(api)).toEqual([{ kind: 'paragraph', inlines: [t('Keep me!')] }]);
});

test('T03 adds, edits and removes a link, refuses javascript:, and returns focus', async ({ page }) => {
  const api = await open(page);
  await replaceAll(page, 'my site');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: /link/i });
  const url = dialog.getByRole('textbox', { name: /URL/ });
  await expect(url).toBeFocused();
  await url.fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog.getByText(/web address, an e-mail address or a phone number/i)).toBeVisible();
  await url.fill('example.invalid/me');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(field(page)).toBeFocused();
  await saved(page);
  expect(bodyOf(api)).toEqual([{ kind: 'paragraph', inlines: [t('my '), { kind: 'link', url: 'https://example.invalid/me', children: [t('site')] }] }]);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(url).toHaveValue('https://example.invalid/me');
  await url.fill('https://example.invalid/new');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await saved(page);
  expect(JSON.stringify(bodyOf(api))).toContain('https://example.invalid/new');
  await page.keyboard.press('ControlOrMeta+k');
  await dialog.getByRole('button', { name: 'Remove link' }).click();
  await saved(page);
  expect(bodyOf(api)).toEqual([{ kind: 'paragraph', inlines: [t('my site')] }]);
  expect(api.violations).toEqual([]);
});

for (const name of ['word', 'google docs', 'web page']) {
  test(`T04 paste from ${name} keeps only supported formatting`, async ({ page }) => {
    const api = await open(page);
    await replaceAll(page, 'x');
    await page.keyboard.press('ControlOrMeta+a');
    await paste(page, { html: fixture(name).html, text: 'ignored' });
    await saved(page);
    expect(bodyOf(api)).toEqual(fixture(name).blocks);
    expect(api.violations).toEqual([]);
  });
}

test('T05 undo and redo in the field; typing continues at the caret; a format is its own step', async ({ page }) => {
  await open(page);
  await replaceAll(page, 'alpha');
  await page.waitForTimeout(1100);
  await page.keyboard.type(' beta');
  await expect(field(page)).toHaveText('alpha beta');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(field(page)).toHaveText('alpha');
  await expect(field(page)).toBeFocused();
  await page.keyboard.type(' gamma');
  await expect(field(page)).toHaveText('alpha gamma');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(field(page)).toHaveText('alpha');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(field(page)).toHaveText('alpha gamma');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+b');
  const bold = page.getByRole('toolbar', { name: 'Text formatting' }).getByRole('button', { name: 'Bold' });
  await expect(bold).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(bold).toHaveAttribute('aria-pressed', 'false');
  await expect(field(page)).toHaveText('alpha gamma');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(field(page)).toHaveText('alpha');
});

test('T06 Shift+Enter is stored as a line break', async ({ page }) => {
  const api = await open(page);
  await replaceAll(page, 'one');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('two');
  await saved(page);
  expect(bodyOf(api)).toEqual([{ kind: 'paragraph', inlines: [t('one'), { kind: 'lineBreak' }, t('two')] }]);
});

test('T07 list items stay one line: Enter adds, pasted lines become items; inline stays one paragraph', async ({ page }) => {
  const api = await open(page, 'Skills');
  await field(page, 'Item 2').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(field(page, 'Item 3')).toBeFocused();
  await page.keyboard.type('Rust');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type(' lang');
  await paste(page, { html: '<ul><li>Docker</li><li><b>K8s</b></li></ul>', text: 'Docker\nK8s' }, 'Item 3');
  await saved(page);
  const items = (sectionOf(api, 'Skills').content.items as { text: unknown[] }[]).map(item => item.text);
  expect(items).toEqual([[t('Go')], [t('SQL')], [t('Rust lang')], [t('Docker')], [t('K8s', { bold: true })]]);
  await row(page, 'Languages').click();
  await field(page).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(' and');
  await paste(page, { text: ' two\nlines' });
  await saved(page);
  expect(sectionOf(api, 'Languages').content.body).toEqual([{ kind: 'paragraph', inlines: [t('English and two lines')] }]);
  expect(api.violations).toEqual([]);
});

test('T08 hostile paste and hostile stored text do not execute', async ({ page }) => {
  const seed = seedDocument();
  const hostileStored = '<img src=x onerror="window.__pwned=9"><script>window.__pwned=8</script>';
  seed.sections[0]!.content = { body: [{ kind: 'paragraph', inlines: [run(hostileStored)] }] };
  const api = new EditorApi(seed);
  const fetched: string[] = [];
  page.on('request', request => { const url = new URL(request.url()); if (url.hostname.endsWith('.invalid') || url.pathname === '/x') fetched.push(request.url()); });
  await open(page, 'Summary', api);
  await expect(field(page)).toHaveText(hostileStored);
  await expect(page.getByRole('region', { name: 'Preview' })).toContainText(hostileStored);
  await field(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await paste(page, { html: fixture('hostile').html, text: 'x' });
  await saved(page);
  expect(bodyOf(api)).toEqual(fixture('hostile').blocks);
  await paste(page, { html: fixture('web page').html, text: 'x' });
  await page.waitForTimeout(500);
  expect(fetched).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(await field(page).locator('img, script, iframe, svg').count()).toBe(0);
});

test('T09 Unicode survives typing, formatting and reload; spell check is on in every text field', async ({ page }) => {
  const api = await open(page);
  const text = 'Muñoz Шевченко Ľubomír 😀';
  await replaceAll(page, text);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+i');
  await saved(page);
  expect(bodyOf(api)).toEqual([{ kind: 'paragraph', inlines: [t(text, { italic: true })] }]);
  await page.reload();
  await expect(field(page)).toHaveText(text);
  for (const section of ['Summary', 'Experience', 'Skills', 'Languages']) {
    await row(page, section).click();
    const unchecked = await page.locator('[role=region] input:not([type]), [role=region] [contenteditable], .editor-topbar input:not([type])').evaluateAll(nodes => nodes.filter(node => node.getAttribute('spellcheck') !== 'true').map(node => node.getAttribute('aria-label') ?? node.id));
    expect(unchecked, section).toEqual([]);
  }
  await row(page, 'Header').click();
  await expect(page.getByRole('textbox', { name: 'Full name' })).toHaveAttribute('spellcheck', 'true');
});

test('T10 toolbar by keyboard, Tab leaves the field, axe with toolbar and dialog; opening writes nothing', async ({ page }) => {
  const seed = seedDocument();
  seed.sections[0]!.content = { body: [{ kind: 'paragraph', inlines: [run('a'), run('b')] }] };
  const api = new EditorApi(seed);
  await open(page, 'Summary', api);
  await expect(field(page)).toHaveText('ab');
  await page.waitForTimeout(1200);
  expect(api.writes).toEqual([]);
  await field(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Shift+Tab');
  const toolbar = page.getByRole('toolbar', { name: 'Text formatting' });
  await expect(toolbar.getByRole('button', { name: 'Bold' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(toolbar.getByRole('button', { name: 'Italic' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toolbar.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'true');
  await expect(field(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(field(page)).not.toBeFocused();
  let results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(results.violations).toEqual([]);
  await toolbar.getByRole('button', { name: 'Link' }).click();
  await expect(page.getByRole('dialog', { name: /link/i })).toBeVisible();
  results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await row(page, 'Skills').click();
  await field(page, 'Item 1').click();
  await expect(page.getByRole('toolbar', { name: 'Item 1 formatting' })).toBeVisible();
  results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  expect(results.violations).toEqual([]);
});
