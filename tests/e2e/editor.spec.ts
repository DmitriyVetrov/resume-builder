import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { document as seedDocument, EditorApi, PNG, RESUME_ID, run, USER_A, USER_B } from './editor-fixture';
import { choose } from './select';

const EDIT = `/resumes/${RESUME_ID}/edit`;
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const title = (page: Page) => page.getByRole('textbox', { name: 'Resume title' });
const status = (page: Page) => page.getByTestId('save-status');
const row = (page: Page, name: string) => page.getByRole('list', { name: 'Resume sections' }).getByRole('button', { name: new RegExp(`^${name}`) });
const panelOrder = (page: Page) => page.locator('[data-section-row]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-section-row')));
const previewOrder = (page: Page) => page.locator('[data-section-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')?.replace('Edit ', '')));

async function open(page: Page, api = new EditorApi()) {
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(EDIT);
  await expect(title(page)).toBeVisible();
  return api;
}

test('E01 an edit is sent within a second of the last keystroke and survives a reload', async ({ page }) => {
  const api = await open(page);
  const started = page.waitForRequest(request => request.method() === 'PUT', { timeout: 1500 });
  await title(page).fill('Fresh title');
  await expect(status(page)).toHaveText(/Saving/);
  await started;
  await expect(status(page)).toHaveText('Saved');
  expect(api.writes.at(-1)?.title).toBe('Fresh title');
  expect(api.writes.at(-1)?.ifMatch).toBe('"7"');
  await page.reload();
  await expect(title(page)).toHaveValue('Fresh title');
  expect(api.main.version).toBe(8);
  expect(api.violations).toEqual([]);
});

test('E02 offline edits are kept and sync once on reconnect', async ({ page, context }) => {
  const api = await open(page);
  await context.setOffline(true);
  await title(page).fill('Offline one');
  await expect(status(page)).toHaveText('Offline, changes kept locally');
  await title(page).fill('Offline two');
  await page.waitForTimeout(1200);
  expect(api.writes).toEqual([]);
  await context.setOffline(false);
  await expect(status(page)).toHaveText('Saved', { timeout: 15_000 });
  expect(api.writes.map(write => write.title)).toEqual(['Offline two']);
  expect(api.main.document.title).toBe('Offline two');
  expect(api.violations).toEqual([]);
});

test('E03 an unacknowledged edit survives a reload through the local draft and then syncs', async ({ page }) => {
  const api = await open(page);
  await page.route(`**/api/v1/resumes/${RESUME_ID}/document`, route => route.abort('connectionrefused'));
  await title(page).fill('Draft title');
  await expect(status(page)).toHaveText(/Offline/, { timeout: 5000 });
  await page.waitForTimeout(100);
  await page.unroute(`**/api/v1/resumes/${RESUME_ID}/document`);
  await page.reload();
  await expect(title(page)).toHaveValue('Draft title');
  await expect(status(page)).toHaveText('Saved', { timeout: 15_000 });
  expect(api.main.document.title).toBe('Draft title');
  expect(api.creates).toEqual([]);
  expect(api.violations).toEqual([]);
});

test('E04 a response lost after the server applied replays one version and shows no conflict', async ({ page }) => {
  const api = await open(page);
  api.applyThenAbortNext = true;
  await title(page).fill('Lost response');
  await expect(status(page)).toHaveText(/Offline/, { timeout: 5000 });
  await title(page).fill('Newer text');
  await expect(status(page)).toHaveText('Saved', { timeout: 15_000 });
  expect(api.main.version).toBe(9);
  expect(api.main.document.title).toBe('Newer text');
  expect(api.writes[0]!.key).toBe(api.writes[1]!.key);
  expect(api.writes[1]!.body).toBe(api.writes[0]!.body);
  expect(api.writes.at(-1)!.key).not.toBe(api.writes[0]!.key);
  expect(api.creates).toEqual([]);
  expect(api.violations).toEqual([]);
});

test('E05 a stale write keeps the edits as one conflict copy and shows the latest', async ({ page }) => {
  const api = await open(page);
  api.writeElsewhere('From another device');
  await title(page).fill('Mine');
  const link = page.getByRole('link', { name: 'Mine (conflict copy)' });
  await expect(link).toBeVisible({ timeout: 5000 });
  await expect(title(page)).toHaveValue('From another device');
  expect(api.creates).toHaveLength(1);
  expect(api.creates[0]!.body).toMatchObject({ source: 'document', copyPhotoFromResumeId: RESUME_ID });
  await link.click();
  await expect(title(page)).toHaveValue('Mine (conflict copy)');
  expect(api.violations).toEqual([]);
});

test('E06 a clean tab reloads with a notice when another tab saves', async ({ context }) => {
  const api = new EditorApi();
  const first = await context.newPage();
  const second = await context.newPage();
  await open(first, api);
  await open(second, api);
  await title(first).fill('Saved in tab one');
  await expect(status(first)).toHaveText('Saved', { timeout: 5000 });
  await expect(title(second)).toHaveValue('Saved in tab one', { timeout: 5000 });
  await expect(second.getByText('This resume was changed in another tab or device. Showing the latest version.')).toBeVisible();
  expect(api.creates).toEqual([]);
  expect(api.violations).toEqual([]);
});

test('E07 a refused copy offers retry and discard and keeps the edits until the choice', async ({ page }) => {
  const api = await open(page);
  api.writeElsewhere('Elsewhere');
  api.limitReached = true;
  await title(page).fill('Mine');
  await expect(page.getByRole('button', { name: 'Retry saving as a copy' })).toBeVisible({ timeout: 5000 });
  await expect(title(page)).toHaveValue('Mine');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry saving as a copy' })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Discard my changes' }).click();
  await expect(title(page)).toHaveValue('Elsewhere', { timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Retry saving as a copy' })).toBeHidden();
  await page.reload();
  await expect(title(page)).toHaveValue('Elsewhere');
  expect(api.creates).toEqual([]);
  expect(api.violations).toEqual([]);
});

test('E08 undo and redo cover 50 steps across content and structure', async ({ page }) => {
  // About 100 key presses: ~23 s alone in WebKit on main and on P13, past 30 s under the full parallel run (DD-P13-28).
  test.setTimeout(60_000);
  await open(page);
  await row(page, 'Skills').click();
  for (let step = 0; step < 25; step++) {
    await page.getByRole('button', { name: 'Hide Skills' }).click();
    await page.getByRole('button', { name: 'Show Skills' }).click();
  }
  await title(page).click();
  const undo = page.getByRole('button', { name: 'Undo' });
  for (let step = 0; step < 49; step++) await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByRole('button', { name: 'Show Skills' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByRole('button', { name: 'Hide Skills' })).toBeVisible();
  await expect(undo).toBeDisabled();
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(page.getByRole('button', { name: 'Show Skills' })).toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('button', { name: 'Hide Skills' })).toBeVisible();
  await title(page).fill('After');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(title(page)).toHaveValue('Synthetic resume');
});

test('E09 sections reorder by pointer and by keyboard, and the saved order matches', async ({ page }) => {
  const api = await open(page);
  await row(page, 'Skills').click();
  await page.getByRole('button', { name: 'Move up Skills' }).click();
  await expect.poll(() => panelOrder(page)).toEqual(['Summary', 'Skills', 'Experience', 'Languages']);
  await row(page, 'Languages').focus();
  await page.keyboard.press('Enter');
  const up = page.getByRole('button', { name: 'Move up Languages' });
  await up.focus();
  await page.keyboard.press('Enter');
  await expect(up).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const expected = ['Languages', 'Summary', 'Skills', 'Experience'];
  await expect.poll(() => panelOrder(page)).toEqual(expected);
  await expect(page.getByTestId('announcer')).toHaveText('Moved Languages to position 1 of 4');
  // The preview repaints after its debounce (P11), so it reaches the order shortly after the panel does (DD-P13-27).
  await expect.poll(() => previewOrder(page)).toEqual(expected);
  await expect(status(page)).toHaveText('Saved', { timeout: 5000 });
  expect(api.main.document.sections.map(section => section.title)).toEqual(expected);
  expect(api.violations).toEqual([]);
});

test('E10 entries are added, filled and moved; list items move with buttons', async ({ page }) => {
  const api = await open(page);
  await row(page, 'Experience').click();
  await page.getByRole('button', { name: 'Add entry' }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeFocused();
  await page.keyboard.type('Third job');
  await page.getByRole('textbox', { name: 'Organization' }).fill('Núñez & Co');
  await choose(page.getByRole('combobox', { name: 'Start month' }), '3');
  await page.getByRole('spinbutton', { name: 'Start year' }).fill('2021');
  await page.getByRole('checkbox', { name: 'Present' }).check();
  await page.getByRole('button', { name: /^Edit entry 3: Third job/ }).click();
  await page.getByRole('button', { name: 'Move up entry 3' }).click();
  await page.getByRole('button', { name: 'Move up entry 2' }).click();
  await expect(page.getByRole('button', { name: /^Edit entry 1: Third job/ })).toBeVisible();
  await row(page, 'Skills').click();
  await page.getByRole('button', { name: 'Move down item 1' }).click();
  await expect(status(page)).toHaveText('Saved', { timeout: 5000 });
  const [, experience, skills] = api.main.document.sections;
  expect((experience!.content.entries as { title: string; start: unknown; end: unknown }[])[0]).toMatchObject({ title: 'Third job', start: { kind: 'date', year: 2021, month: 3 }, end: { kind: 'present' } });
  expect((skills!.content.items as { text: { value: string }[] }[]).map(item => item.text[0]?.value)).toEqual(['SQL', 'Go']);
  expect(api.violations).toEqual([]);
});

test('E11 keyboard only: add, rename, hide, delete and undo', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Add section' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Add section' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Section title' }).focus();
  await page.keyboard.type('Interests');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('region', { name: 'Edit' }).getByRole('textbox', { name: 'Section title' })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Hobbies');
  await expect(row(page, 'Hobbies')).toBeVisible();
  await page.getByRole('button', { name: 'Hide Hobbies' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Show Hobbies' })).toBeFocused();
  await page.getByRole('button', { name: 'Delete Hobbies' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Delete Hobbies' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Undo delete' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(row(page, 'Hobbies')).toBeVisible();
});

test('E12 selecting scrolls the preview within a line; a preview click selects; reopening restores', async ({ page }) => {
  const seed = seedDocument();
  const long = Array.from({ length: 14 }, (_, n) => ({ ...seed.sections[0]!, id: `01934f6e-7a2b-7c3d-8e4f-3000000000${String(n).padStart(2, '0')}`, title: `Block ${n}`, content: { body: Array.from({ length: 6 }, () => ({ kind: 'paragraph', inlines: [run(`Text of block ${n}`)] })) } }));
  const api = new EditorApi({ ...seed, sections: long });
  await open(page, api);
  await row(page, 'Block 9').click();
  await expect(page.getByRole('region', { name: 'Edit' }).getByRole('heading', { level: 2, name: 'Block 9' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const target = document.querySelector('[aria-label="Edit Block 9"]') as HTMLElement;
    const scroller = target.closest('[data-preview-scroller]') as HTMLElement;
    // One line of the section title, in pixels at the current zoom.
    const sheet = target.parentElement!.querySelector('[data-page-sheet]') as HTMLElement;
    const line = 17.5 * (sheet.getBoundingClientRect().width / 595);
    const delta = Math.abs(target.getBoundingClientRect().top - scroller.getBoundingClientRect().top);
    return delta <= line;
  })).toBe(true);
  await page.getByRole('button', { name: 'Edit Block 10' }).click();
  await expect(page.getByRole('region', { name: 'Edit' }).getByRole('heading', { level: 2, name: 'Block 10' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Edit' }).getByRole('heading', { level: 2, name: 'Block 10' })).toBeVisible();
});

test('E13 leaving warns only with unacknowledged edits', async ({ page, context }) => {
  const api = await open(page);
  let prompted = 0;
  page.on('dialog', async dialog => { prompted++; expect(dialog.type()).toBe('beforeunload'); await dialog.dismiss(); });
  await title(page).click();
  await page.reload();
  await expect(title(page)).toBeVisible();
  expect(prompted).toBe(0);
  api.blockWrites = true;
  await title(page).click();
  await page.keyboard.type('Unsaved');
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => prompted).toBe(1);
  api.release();
  await context.close();
});

test('E14 photo: oversize refused locally, upload opens the crop, the crop saves, remove confirms', async ({ page }) => {
  const api = await open(page);
  const input = page.getByLabel('Upload photo');
  await input.setInputFiles({ name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(5 * 1_048_576 + 1) });
  await expect(page.getByText(/larger than 5 MB/i)).toBeVisible();
  expect(api.photoCalls).toEqual([]);
  await input.setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  const dialog = page.getByRole('dialog', { name: /crop/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('slider', { name: 'Zoom' }).focus();
  await page.keyboard.press('ArrowRight');
  await dialog.getByRole('button', { name: 'Save crop' }).click();
  await expect(dialog).toBeHidden();
  expect(api.photoCalls).toEqual(['POST /photo', 'PUT /photo/crop']);
  await expect(page.getByRole('region', { name: 'Edit' }).getByRole('img', { name: /your photo/i })).toBeVisible();
  await title(page).fill('After the photo');
  await expect(status(page)).toHaveText('Saved', { timeout: 5000 });
  expect(api.writes.at(-1)?.ifMatch).toBe('"9"');
  await page.getByRole('button', { name: 'Remove photo' }).click();
  await page.getByRole('dialog', { name: /remove/i }).getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByLabel('Upload photo')).toBeAttached();
  expect(api.main.photo).toBeNull();
  expect(api.violations).toEqual([]);
});

test('E15 version history restores as an undoable, saved edit', async ({ page }) => {
  const api = await open(page);
  await page.getByRole('button', { name: 'Version history' }).click();
  const dialog = page.getByRole('dialog', { name: 'Version history' });
  await dialog.getByRole('button', { name: /^Restore/ }).click();
  await expect(title(page)).toHaveValue('Restored title');
  await expect(status(page)).toHaveText('Saved', { timeout: 5000 });
  expect(api.main.document.title).toBe('Restored title');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(title(page)).toHaveValue('Synthetic resume');
  expect(api.violations).toEqual([]);
});

// DD-P08-12: moved from shell.spec.ts, every assertion kept, on a fixture resume.
test('E16 editor desktop regions and narrow keyboard panels', async ({ page }) => {
  await open(page);
  for (const name of ['Sections', 'Edit', 'Preview']) {
    await expect(page.getByRole('region', { name })).toBeVisible();
    await expect(page.getByRole('tabpanel', { name })).toBeVisible();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('tablist', { name: 'Editor panels' })).toBeHidden();
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.getByRole('tablist', { name: 'Editor panels' })).toBeVisible();
  await page.getByRole('tab', { name: 'Preview' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Preview' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: 'Sections', hidden: true })).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Sections', 'Edit', 'Preview', 'Design']) {
    const tab = page.getByRole('tab', { name });
    await tab.focus();
    await page.keyboard.press('Enter');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  await page.getByRole('tab', { name: 'Sections' }).click();
  await row(page, 'Skills').click();
  await expect(page.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Add item' })).toBeVisible();
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  const pageWidth = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth);
});

test('E17 accessibility, exclusions, privacy and evidence on the main states', async ({ page, browserName }, info) => {
  // Ten full axe analyses: about 21 s on an idle machine in each browser, so the default 30 s fails under parallel workers.
  test.setTimeout(90_000);
  const logged: string[] = [];
  page.on('console', message => logged.push(message.text()));
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173')) external.push(request.url()); });
  const seed = seedDocument();
  seed.title = 'CANARY-title-Z9';
  const api = await open(page, new EditorApi(seed));
  const check = async (state: string) => {
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze();
    expect(results.violations, state).toEqual([]);
    if (browserName === 'chromium') await page.screenshot({ path: info.outputPath(`${state}.png`) });
  };
  await check('workspace-1280');
  await row(page, 'Experience').click();
  await check('entry-form-1280');
  await page.getByRole('button', { name: 'Add section' }).click();
  await check('add-dialog-1280');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Delete Experience' }).click();
  await check('delete-dialog-1280');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Version history' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^Restore/ })).toBeVisible();
  await check('version-history-1280');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await page.getByRole('tab', { name: 'Design' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Design' })).toBeVisible();
  await check('design-tab-1280');
  await page.getByRole('tab', { name: 'Preview' }).click();
  await page.context().setOffline(true);
  await title(page).fill('Offline CANARY-title-Z9');
  await expect(status(page)).toHaveText(/Offline/);
  await check('offline-1280');
  await page.context().setOffline(false);
  await expect(status(page)).toHaveText('Saved', { timeout: 15_000 });
  api.writeElsewhere('Elsewhere');
  await title(page).fill('Conflict CANARY-title-Z9');
  await expect(page.getByRole('link', { name: /conflict copy/ })).toBeVisible({ timeout: 5000 });
  await check('conflict-1280');
  await page.setViewportSize({ width: 390, height: 844 });
  await check('workspace-390');
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const term of ['resume score', 'ai assistant', 'publish', 'cover letter', 'suggest', 'upgrade']) expect(body).not.toContain(term);
  expect(external).toEqual([]);
  expect(logged.join(' ')).not.toContain('CANARY');
  expect(page.url()).not.toContain('CANARY');
  expect(api.violations).toEqual([]);
});

test('E18 local data is namespaced by user and sign-out removes it on request', async ({ page }) => {
  const api = await open(page);
  await row(page, 'Skills').click();
  api.blockWrites = true;
  await page.route(`**/api/v1/resumes/${RESUME_ID}/document`, route => route.abort('connectionrefused'));
  await title(page).fill('Private draft of A');
  await expect(status(page)).toHaveText(/Offline/, { timeout: 5000 });
  const rows = () => page.evaluate(() => new Promise<{ userId: string }[]>((resolve, reject) => {
    const opening = indexedDB.open('resumiser-local');
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const all = opening.result.transaction('drafts').objectStore('drafts').getAll();
      all.onsuccess = () => { opening.result.close(); resolve(all.result); };
    };
  }));
  await expect.poll(async () => (await rows()).map(item => item.userId)).toEqual([USER_A]);
  const stored = await page.evaluate(() => Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]));
  for (const [key, value] of stored) {
    expect(key).toMatch(/^resumiser:last-section:/);
    expect(value).toMatch(/^[0-9a-f-]{36}$|^header$/);
  }
  api.user = USER_B;
  await page.reload();
  await expect(title(page)).toHaveValue('Synthetic resume');
  await expect(page.getByRole('region', { name: 'Edit' }).getByRole('heading', { level: 2, name: 'Header' })).toBeVisible();
  api.user = USER_A;
  await page.getByRole('link', { name: 'Account' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Log out' }).click();
  const dialog = page.getByRole('dialog', { name: /local data/i });
  await expect(dialog.getByText(/not been saved/i)).toBeVisible();
  await dialog.getByRole('button', { name: 'Remove and log out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect.poll(async () => rows()).toEqual([]);
  const left = await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('00000000-0000-4000-8000-000000000001')));
  expect(left).toEqual([]);
});
