import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { choose } from '../select';

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const evidence = process.env.RESUMISER_QA_EVIDENCE;
const PASSWORD = 'correct-horse-battery-9';
const title = (page: Page) => page.getByRole('textbox', { name: 'Resume title' });
const status = (page: Page) => page.getByTestId('save-status');
const row = (page: Page, name: string) => page.getByRole('list', { name: 'Resume sections' }).getByRole('button', { name: new RegExp(`^${name}`) });
const text = (page: Page) => page.getByRole('region', { name: 'Edit' }).getByRole('textbox', { name: 'Text', exact: true });
const saved = (page: Page) => expect(status(page)).toHaveText('Saved', { timeout: 10_000 });
const shot = async (page: Page, name: string, width = 1280, height = 900) => {
  await page.setViewportSize({ width, height });
  if (evidence) await page.screenshot({ path: `${evidence}/${name}-${width}.png` });
};
const csrf = async (page: Page) => (await page.context().cookies()).find(cookie => cookie.name.endsWith('XSRF-TOKEN'))?.value ?? '';

// One account for the file: the real `auth-email` limit allows 5 sign-ups per 10 minutes per address.
const EMAIL = `qa-${Date.now()}@example.invalid`;
let registered = false;

async function signIn(page: Page) {
  const email = EMAIL;
  if (!registered) {
    await page.goto('/sign-up');
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('textbox', { name: /^password/i }).or(page.getByLabel(/^password/i)).first().fill(PASSWORD);
    await page.getByRole('button', { name: /sign up|create account/i }).click();
    await page.waitForURL(/verify|login|resumes|account/);
    registered = true;
  }
  await page.goto('/login');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByLabel(/^password/i).first().fill(PASSWORD);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/resumes/);
}
async function createResume(page: Page) {
  await page.goto('/resumes');
  await page.getByRole('button', { name: /create (new resume|your first resume)/i }).first().click();
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) await dialog.getByRole('button', { name: /start from scratch/i }).click();
  await page.waitForURL(/\/resumes\/[^/]+\/edit$/);
  await expect(title(page)).toBeVisible();
  return page.url().match(/resumes\/([^/]+)\/edit/)![1]!;
}
const stored = async (page: Page, id: string) => (await page.request.get(`/api/v1/resumes/${id}`)).json();

test('R01 typed and formatted content is stored as the contract AST and survives a reload', async ({ page }) => {
  await signIn(page);
  const id = await createResume(page);
  await expect(row(page, 'Professional Summary')).toContainText('Empty');
  await page.getByRole('textbox', { name: 'Full name' }).fill('Олександр Núñez | Ľubomír');
  await row(page, 'Professional Summary').click();
  await text(page).click();
  await page.keyboard.type('Bold part');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.press('Enter');
  await page.getByRole('toolbar', { name: 'Text formatting' }).getByRole('button', { name: 'Bullet list' }).click();
  await page.keyboard.type('a bullet');
  await saved(page);
  const resume = await stored(page, id);
  expect(resume.document.header.fullName).toBe('Олександр Núñez | Ľubomír');
  const run = (value: string, bold = false) => ({ kind: 'text', value, bold, italic: false, underline: false });
  expect(resume.document.sections[0].content.body).toEqual([{ kind: 'paragraph', inlines: [run('Bold part', true)] }, { kind: 'bulletList', items: [[run('a bullet')]] }]);
  await page.reload();
  await row(page, 'Professional Summary').click();
  await expect(text(page)).toContainText('a bullet');
  await expect(text(page).locator('strong')).toHaveText('Bold part');
  await expect(text(page).locator('strong')).toHaveCSS('font-weight', '700');
  await expect(page.getByRole('region', { name: 'Preview' }).locator('[data-role="body"]', { hasText: 'Bold part' })).toHaveCSS('font-family', /bold/);
  await expect(page.getByTestId('save-status').locator('.status-dot')).toHaveCSS('background-color', 'rgb(15, 106, 91)');
  await text(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+k');
  await shot(page, 'rich-text-link-dialog');
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await row(page, 'Skills').click();
  await page.getByRole('button', { name: 'Add item' }).click();
  await shot(page, 'list-item-compact-toolbar');
  await shot(page, 'list-item-compact-toolbar', 390, 844);
  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, 'workspace-rich-text');
  await shot(page, 'workspace-rich-text', 390, 844);
});

test('R02 a real 412 keeps both versions: the copy exists on the server with the edits', async ({ page }) => {
  await signIn(page);
  const id = await createResume(page);
  await title(page).fill('Base');
  await saved(page);
  const current = await stored(page, id);
  const answer = await page.request.put(`/api/v1/resumes/${id}/document`, { data: { ...current.document, title: 'From elsewhere' }, headers: { 'If-Match': `"${current.version}"`, 'Idempotency-Key': crypto.randomUUID(), 'X-XSRF-TOKEN': await csrf(page) } });
  expect(answer.status()).toBe(200);
  await title(page).fill('Mine');
  const link = page.getByRole('link', { name: 'Mine (conflict copy)' });
  await expect(link).toBeVisible({ timeout: 10_000 });
  await expect(title(page)).toHaveValue('From elsewhere');
  await shot(page, 'conflict-notice');
  await page.getByRole('button', { name: 'Dismiss notice' }).click();
  const list = await (await page.request.get('/api/v1/resumes?state=active')).json();
  expect(list.items.map((item: { title: string }) => item.title)).toEqual(expect.arrayContaining(['From elsewhere', 'Mine (conflict copy)']));
});

test('R03 real offline keeps edits and syncs on reconnect', async ({ page, context }) => {
  await signIn(page);
  const id = await createResume(page);
  await context.setOffline(true);
  await title(page).fill('Written offline');
  await expect(status(page)).toHaveText('Offline, changes kept locally');
  await shot(page, 'offline-status');
  await context.setOffline(false);
  await saved(page);
  expect((await stored(page, id)).document.title).toBe('Written offline');
});

test('R04 photo: real upload, crop and removal with real bytes', async ({ page }) => {
  await signIn(page);
  const id = await createResume(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 400;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#336699'; context.fillRect(0, 0, 640, 400);
    context.fillStyle = '#ffcc00'; context.fillRect(100, 100, 200, 200);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  await page.getByLabel('Upload photo').setInputFiles({ name: 'me.png', mimeType: 'text/plain', buffer: Buffer.from(png, 'base64') });
  const dialog = page.getByRole('dialog', { name: /crop/i });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.locator('img')).toHaveJSProperty('complete', true);
  expect(await dialog.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(640);
  await dialog.getByRole('slider', { name: 'Zoom' }).fill('2');
  await dialog.getByRole('slider', { name: 'Horizontal position' }).fill('0');
  await shot(page, 'crop-dialog');
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.getByRole('button', { name: 'Save crop' }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  const resume = await stored(page, id);
  expect(resume.photo).toMatchObject({ mime: 'image/png', width: 640, height: 400, crop: { x: 0, y: 100, width: 200, height: 200 } });
  const rendition = await page.request.get(`/api/v1/resumes/${id}/photo/rendition`);
  expect(rendition.status()).toBe(200);
  expect(rendition.headers()['content-type']).toBe('image/jpeg');
  await expect(page.getByRole('img', { name: /your photo/i })).toHaveJSProperty('complete', true);
  await title(page).fill('After the photo');
  await saved(page);
  expect((await stored(page, id)).version).toBe(resume.version + 1);
  await page.getByRole('button', { name: 'Remove photo' }).click();
  await page.getByRole('dialog', { name: /remove/i }).getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByLabel('Upload photo')).toBeAttached({ timeout: 10_000 });
  expect((await stored(page, id)).photo).toBeNull();
});

test('R05 version history lists a real snapshot and restores it', async ({ page }) => {
  await signIn(page);
  const id = await createResume(page);
  await title(page).fill('First save');
  await saved(page);
  await title(page).fill('Second save');
  await saved(page);
  await page.getByRole('button', { name: 'Version history' }).click();
  const dialog = page.getByRole('dialog', { name: 'Version history' });
  await expect(dialog.getByRole('button', { name: /^Restore/ }).first()).toBeVisible({ timeout: 10_000 });
  await shot(page, 'version-history');
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.getByRole('button', { name: /^Restore/ }).first().click();
  await expect(title(page)).toHaveValue('First save');
  await saved(page);
  expect((await stored(page, id)).document.title).toBe('First save');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(title(page)).toHaveValue('Second save');
  await saved(page);
});

test('R06 the server refusing a body shows where, keeps the edits and recovers', async ({ page }) => {
  await signIn(page);
  const id = await createResume(page);
  await row(page, 'Professional Summary').click();
  await text(page).click();
  const paste = (plain: string) => text(page).evaluate((node, value) => {
    const transfer = new DataTransfer();
    transfer.setData('text/plain', value);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: transfer });
    node.dispatchEvent(event);
  }, plain);
  // One run over its own limit names the field; two runs within theirs but over the total name the total (R-12).
  await paste('x'.repeat(50_001));
  await expect(status(page)).toHaveText('Not saved: check "Professional Summary"', { timeout: 10_000 });
  expect((await stored(page, id)).version).toBe(1);
  await page.keyboard.press('ControlOrMeta+z');
  await saved(page);
  await paste(`${'x'.repeat(30_000)}\n${'y'.repeat(30_000)}`);
  await expect(status(page)).toHaveText(/Not saved.*50,000/, { timeout: 10_000 });
  expect((await stored(page, id)).version).toBe(1);
  await page.keyboard.press('ControlOrMeta+z');
  await saved(page);
  expect((await stored(page, id)).version).toBe(1);
});

test('R07 axe on the real workspace, every section type and the design views', async ({ page }) => {
  await signIn(page);
  await createResume(page);
  const started = Date.now();
  await page.reload();
  await expect(title(page)).toBeVisible();
  console.log(`Local editor load, reload to title visible: ${Date.now() - started} ms`);
  const check = async (state: string) => expect((await new AxeBuilder({ page }).withTags(axeTags).analyze()).violations, state).toEqual([]);
  await check('header');
  await shot(page, 'workspace-header');
  await shot(page, 'workspace-header', 390, 844);
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const name of ['Professional Summary', 'Professional Experience', 'Skills', 'Languages']) {
    await row(page, name).click();
    await check(name);
  }
  await row(page, 'Professional Experience').click();
  await page.getByRole('button', { name: 'Add entry' }).click();
  await check('entry open');
  await shot(page, 'entry-form');
  await shot(page, 'entry-form', 390, 844);
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await shot(page, 'entry-form', 1024, 768);
  // 200% zoom of a 1280 px window: 640 CSS px at device scale 2.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 450, deviceScaleFactor: 2, mobile: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByRole('tablist', { name: 'Editor panels' })).toBeVisible();
  await expect(title(page)).toBeVisible();
  await cdp.send('Emulation.clearDeviceMetricsOverride');
});

const titles = (resume: { document: { sections: { title: string }[] } }) => resume.document.sections.map(section => section.title);

test('R08 structure, header and forms: every edit reaches the stored document in the shown order', async ({ page }) => {
  await signIn(page);
  const id = await createResume(page);
  const edit = page.getByRole('region', { name: 'Edit' });
  await edit.getByRole('button', { name: 'Add contact' }).click();
  await page.keyboard.type('person@example.invalid');
  await expect(edit.getByText('Links to mailto:person@example.invalid')).toBeVisible();
  await edit.getByRole('button', { name: 'Add contact' }).click();
  await page.keyboard.type('@handle');
  await expect(edit.getByText(/Links to .*handle/)).toBeHidden();
  await edit.getByRole('textbox', { name: 'Contact 2 link' }).fill('example.invalid/me');
  await edit.getByRole('textbox', { name: 'Contact 2 link' }).blur();
  await choose(edit.getByRole('combobox', { name: 'Contact 2 kind' }), 'link');
  await edit.getByRole('button', { name: 'Move up contact 2' }).click();
  await saved(page);
  let resume = await stored(page, id);
  expect(resume.document.header.contacts).toMatchObject([{ text: '@handle', url: 'https://example.invalid/me', kind: 'link' }, { text: 'person@example.invalid', url: null, kind: 'other' }]);

  await page.getByRole('button', { name: 'Add section' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add section' });
  await dialog.getByRole('radio', { name: /^List/ }).check();
  await dialog.getByRole('textbox', { name: 'Section title' }).fill('interests AND More');
  await dialog.getByRole('button', { name: 'Add' }).click();
  await expect(edit.getByRole('textbox', { name: 'Section title' })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Hobbies');
  await edit.getByRole('button', { name: 'Add item' }).click();
  await page.keyboard.type('Chess');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Go');
  await edit.getByRole('button', { name: 'Move up item 2' }).click();
  await choose(edit.getByRole('combobox', { name: 'List columns' }), '2');
  await row(page, 'Skills').click();
  const skillsUp = page.getByRole('button', { name: 'Move up Skills' });
  while (await skillsUp.isEnabled()) await skillsUp.click();
  await expect(page.locator('[data-section-row]').first()).toHaveAttribute('data-section-row', 'Skills');
  await saved(page);
  resume = await stored(page, id);
  expect(titles(resume)).toEqual(['Skills', 'Professional Summary', 'Professional Experience', 'Education', 'Languages', 'Hobbies']);
  const hobbies = resume.document.sections[5];
  expect(hobbies.listColumns).toBe(2);
  expect(hobbies.content.items.map((item: { text: { value: string }[] }) => item.text[0]?.value)).toEqual(['Go', 'Chess']);
  const previewed = () => page.locator('[data-section-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
  expect(await previewed()).toEqual(['Edit Hobbies']);

  await row(page, 'Hobbies').click();
  await page.getByRole('button', { name: 'Add section' }).click();
  await dialog.getByRole('radio', { name: /^List/ }).check();
  await dialog.getByRole('textbox', { name: 'Section title' }).fill('Hobbies');
  await dialog.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Hide Hobbies' }).click();
  await expect(row(page, 'Hobbies').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Hobbies.*Hidden/ })).toBeVisible();
  await page.getByRole('button', { name: 'Show Hobbies' }).click();
  await page.getByRole('button', { name: 'Delete Hobbies' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'Undo delete' })).toBeFocused();
  await page.keyboard.press('Enter');
  await saved(page);
  resume = await stored(page, id);
  expect(titles(resume).filter((name: string) => name === 'Hobbies')).toHaveLength(2);
  await edit.getByRole('combobox', { name: 'Section type' }).click();
  await expect(page.getByRole('option', { name: /Entries/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await choose(edit.getByRole('combobox', { name: 'Section type' }), 'text');
  await saved(page);
  resume = await stored(page, id);
  expect(resume.document.sections.filter((section: { type: string; title: string }) => section.title === 'Hobbies').map((section: { type: string }) => section.type).sort()).toEqual(['list', 'text']);

  await row(page, 'Education').click();
  await edit.getByRole('button', { name: 'Add entry' }).click();
  await expect(edit.getByRole('textbox', { name: 'Degree' })).toBeFocused();
  await page.keyboard.type('MSc');
  await edit.getByRole('textbox', { name: 'Institution' }).fill('Núñez University');
  await choose(edit.getByRole('combobox', { name: 'Start month' }), '9');
  await edit.getByRole('spinbutton', { name: 'Start year' }).fill('2020');
  await choose(edit.getByRole('combobox', { name: 'End month' }), '6');
  await edit.getByRole('spinbutton', { name: 'End year' }).fill('2019');
  await expect(edit.getByText(/start date is after the end date/i)).toBeVisible();
  await saved(page);
  await edit.getByText('Customize field names').click();
  await edit.getByRole('textbox', { name: 'Field name for Location' }).fill('City');
  await expect(edit.getByRole('textbox', { name: 'City' })).toBeVisible();
  await saved(page);
  resume = await stored(page, id);
  const education = resume.document.sections.find((section: { title: string }) => section.title === 'Education');
  expect(education.content.labels).toEqual({ title: 'Degree', organization: 'Institution', location: 'City' });
  expect(education.content.entries[0]).toMatchObject({ title: 'MSc', organization: 'Núñez University', start: { kind: 'date', year: 2020, month: 9 }, end: { kind: 'date', year: 2019, month: 6 } });
  await expect(page.getByRole('region', { name: 'Preview' })).not.toContainText('City');
  await shot(page, 'entry-filled');
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.reload();
  await expect(edit.getByRole('heading', { level: 2, name: 'Education' })).toBeVisible();
});

test('R09 fifty undo steps, leave warning, and local data at sign-out on the real session', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://localhost:4190')) external.push(request.url()); });
  const logged: string[] = [];
  page.on('console', message => logged.push(message.text()));
  await signIn(page);
  const id = await createResume(page);
  await row(page, 'Skills').click();
  for (let step = 0; step < 25; step++) {
    await page.getByRole('button', { name: 'Hide Skills' }).click();
    await page.getByRole('button', { name: 'Show Skills' }).click();
  }
  await title(page).click();
  for (let step = 0; step < 50; step++) await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await saved(page);
  const leaving = () => page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
  expect(await leaving()).toBe(false);
  await page.route(`**/api/v1/resumes/${id}/document`, route => route.abort('connectionrefused'));
  await title(page).fill('CANARY-unsynced-title');
  expect(await leaving()).toBe(true);
  await expect(status(page)).toHaveText(/Offline/, { timeout: 10_000 });
  await page.reload({ waitUntil: 'load' }).catch(() => {});
  await expect(title(page)).toHaveValue('CANARY-unsynced-title');
  expect(page.url()).not.toContain('CANARY');
  expect(logged.join(' ')).not.toContain('CANARY');
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const term of ['resume score', 'ai assistant', 'publish', 'cover letter', 'suggest', 'upgrade']) expect(body).not.toContain(term);
  const stores = await page.evaluate(() => Object.entries(localStorage));
  for (const [key, value] of stores) {
    expect(key).toMatch(/^resumiser:last-section:/);
    expect(value).toMatch(/^[0-9a-f-]{36}$|^header$/);
  }
  await page.getByRole('link', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  const dialog = page.getByRole('dialog', { name: /local data/i });
  await expect(dialog.getByText(/not been saved/i)).toBeVisible();
  await shot(page, 'sign-out-local-data');
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.getByRole('button', { name: 'Remove and log out' }).click();
  await expect(page).toHaveURL(/\/login/);
  const left = () => page.evaluate(() => new Promise<number>((resolve, reject) => {
    const opening = indexedDB.open('resumiser-local');
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const count = opening.result.transaction('drafts').objectStore('drafts').count();
      count.onsuccess = () => { opening.result.close(); resolve(count.result); };
    };
  }));
  await expect.poll(left).toBe(0);
  expect(await page.evaluate(() => Object.keys(localStorage).length)).toBe(0);
  expect(external).toEqual([]);
});

test('R10 rich text against the real API: paste sources, links, hostile input, Unicode, no write on open', async ({ page }) => {
  type Fixture = { name: string; html: string; blocks: unknown[] };
  const clipboard = JSON.parse(readFileSync(new URL('../../fixtures/rich-text/clipboard.json', import.meta.url), 'utf8')) as Fixture[];
  const fetched: string[] = [];
  page.on('request', request => { if (new URL(request.url()).hostname.endsWith('.invalid')) fetched.push(request.url()); });
  await signIn(page);
  const id = await createResume(page);
  await row(page, 'Professional Summary').click();
  const body = async () => (await stored(page, id)).document.sections[0].content.body;
  const paste = (html: string) => text(page).evaluate((node, value) => {
    const transfer = new DataTransfer();
    transfer.setData('text/html', value);
    transfer.setData('text/plain', 'ignored');
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: transfer });
    node.dispatchEvent(event);
  }, html);
  for (const fixture of clipboard) {
    await text(page).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await paste(fixture.html);
    await saved(page);
    expect(await body(), fixture.name).toEqual(fixture.blocks);
  }
  expect(fetched).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();

  await text(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Muñoz Шевченко Ľubomír 😀 site');
  for (let step = 0; step < 4; step++) await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: /link/i });
  const url = dialog.getByRole('textbox', { name: /URL/ });
  await url.fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog.getByText(/web address, an e-mail address or a phone number/i)).toBeVisible();
  await url.fill('example.invalid/x');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(text(page)).toBeFocused();
  await page.keyboard.press('Shift+Enter');
  await saved(page);
  const run = (value: string) => ({ kind: 'text', value, bold: false, italic: false, underline: false });
  expect(await body()).toEqual([{ kind: 'paragraph', inlines: [run('Muñoz Шевченко Ľubomír 😀 '), { kind: 'lineBreak' }] }]);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(text(page)).toContainText('site');
  await saved(page);
  expect(await body()).toEqual([{ kind: 'paragraph', inlines: [run('Muñoz Шевченко Ľubomír 😀 '), { kind: 'link', url: 'https://example.invalid/x', children: [run('site')] }] }]);

  const before = (await stored(page, id)).version;
  await page.reload();
  await row(page, 'Professional Summary').click();
  await expect(text(page).locator('a')).toHaveText('site');
  await page.waitForTimeout(1200);
  expect((await stored(page, id)).version).toBe(before);
  await expect(page.getByRole('toolbar', { name: 'Text formatting' }).getByRole('button', { name: 'Link' })).toBeVisible();
});
