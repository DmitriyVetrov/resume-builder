// NFR-01 through the real editor: from the input event to the changed text in the painted page, then two frames for the paint.
// Outside the phase suite: a timing limit there would fail on machine load, not on code (`bash scripts/ci/rendering.sh bench`).
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EditorApi, RESUME_ID } from './editor-fixture';

const RUNS = 50;
const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(ROOT, 'tests/rendering/out');
const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] as number;
const record = (name: string, value: unknown) => { mkdirSync(OUT, { recursive: true }); writeFileSync(resolve(OUT, `${name}.json`), JSON.stringify(value, null, 1)); };

async function open(page: Page, tab: 'Preview' | 'Design') {
  const api = new EditorApi(JSON.parse(readFileSync(resolve(ROOT, 'tests/fixtures/resumes/four-pages.json'), 'utf8')));
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/resumes/${RESUME_ID}/edit`);
  await expect(page.locator('[data-page-sheet]').first()).toBeAttached({ timeout: 30_000 });
  await page.locator(`#right-tab-${tab}`).click();
}

/** Each run sets a value the way a keystroke or a slider step does, and waits for its effect in the page. */
const measure = (page: Page, selector: string, values: string[], changed: string) => page.evaluate(async ({ selector, values, changed }) => {
  const field = document.querySelector(selector) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  const frame = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  const read = () => document.querySelector(changed)?.textContent ?? '';
  const times: number[] = [];
  for (const value of values) {
    const before = read();
    const start = performance.now();
    setter.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    while (read() === before && performance.now() - start < 3000) await new Promise(done => setTimeout(done, 1));
    await frame();
    times.push(performance.now() - start);
  }
  return times;
}, { selector, values, changed });

const keystrokes = Array.from({ length: RUNS }, (_, run) => `Lucía ${'x'.repeat(run % 7 + 1)}${run}`);

test.setTimeout(600_000);

test('NFR-01 keystroke to painted page, four pages', async ({ page, browserName }) => {
  await open(page, 'Preview');
  const fullName = page.getByRole('textbox', { name: 'Full name' });
  const id = await fullName.getAttribute('id');
  await measure(page, `[id="${id}"]`, ['warm cache'], '[data-page-sheet="1"] [data-role="name"]');
  const times = await measure(page, `[id="${id}"]`, keystrokes, '[data-page-sheet="1"] [data-role="name"]');
  const result = p95(times);
  record(`nfr01-keystroke-${browserName}`, { runs: times.length, p95: result, max: Math.max(...times) });
  console.log(`NFR-01 keystroke ${browserName}: p95 ${result.toFixed(1)} ms over ${times.length} runs`);
  if (browserName !== 'firefox') expect(result).toBeLessThanOrEqual(300);
});

test('NFR-01 slider step to painted page, four pages', async ({ page, browserName }) => {
  await open(page, 'Design');
  const slider = page.getByRole('slider', { name: 'Section spacing' });
  const id = await slider.getAttribute('id');
  const values = Array.from({ length: RUNS }, (_, run) => String(run % 21));
  await page.evaluate(id => { (document.getElementById(id!) as HTMLElement).dataset.bench = '1'; }, id);
  const times = await page.evaluate(async ({ id, values }) => {
    const field = document.getElementById(id!) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    const frame = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const key = () => Array.from(document.querySelectorAll<HTMLElement>('[data-role="sectionTitle"]')).map(node => node.style.top).join();
    const measured: number[] = [];
    for (const value of values) {
      if (field.value === value) continue;
      const before = key();
      const start = performance.now();
      setter.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      while (key() === before && performance.now() - start < 3000) await new Promise(done => setTimeout(done, 1));
      await frame();
      measured.push(performance.now() - start);
    }
    return measured;
  }, { id, values });
  const result = p95(times);
  record(`nfr01-slider-${browserName}`, { runs: times.length, p95: result, max: Math.max(...times) });
  console.log(`NFR-01 slider ${browserName}: p95 ${result.toFixed(1)} ms over ${times.length} runs`);
  if (browserName !== 'firefox') expect(result).toBeLessThanOrEqual(300);
});

test('NFR-01 margin check at 4x CPU throttle, Chromium only', async ({ page, browserName, context }) => {
  test.skip(browserName !== 'chromium', 'CPU throttling is a Chromium protocol feature.');
  await open(page, 'Preview');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const id = await page.getByRole('textbox', { name: 'Full name' }).getAttribute('id');
  const times = await measure(page, `[id="${id}"]`, keystrokes, '[data-page-sheet="1"] [data-role="name"]');
  const result = p95(times);
  record('nfr01-keystroke-chromium-4x', { runs: times.length, p95: result, max: Math.max(...times) });
  console.log(`NFR-01 keystroke chromium at 4x: p95 ${result.toFixed(1)} ms over ${times.length} runs (recorded, not gating)`);
});

// AC-P12-09, NFR-03, FR-PDF-09: from the real click to the finished download, with the worst-case photo. The first run also loads PDFKit's chunk.
test('NFR-03 PDF and TXT through the real route, four pages with a photo', async ({ page, browserName }) => {
  const api = new EditorApi(JSON.parse(readFileSync(resolve(ROOT, 'tests/fixtures/resumes/four-pages.json'), 'utf8')));
  const rendition = readFileSync(resolve(ROOT, 'tests/fixtures/resumes/photo-600.jpg'));
  api.main.photo = { id: '01934f6e-7a2b-7c3d-8e4f-200000000070', mime: 'image/jpeg', width: 600, height: 600, bytes: rendition.length, crop: { x: 0, y: 0, width: 600, height: 600 }, updatedAt: '2026-11-01T09:00:00.000Z' };
  api.rendition = rendition;
  await api.install(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/resumes/${RESUME_ID}/edit`);
  await expect(page.locator('[data-page-sheet]').first()).toBeAttached({ timeout: 30_000 });
  const once = async (name: string) => {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toHaveAttribute('aria-disabled', 'false');
    const start = performance.now();
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    const path = await download.path();
    return { time: performance.now() - start, bytes: readFileSync(path).length };
  };
  const pdf: number[] = [];
  const txt: number[] = [];
  let bytes = 0;
  for (let run = 0; run < 20; run++) {
    const result = await once('Export PDF');
    pdf.push(result.time);
    bytes = result.bytes;
    txt.push((await once('Export TXT')).time);
  }
  record(`nfr03-${browserName}`, { runs: pdf.length, pdfP95: p95(pdf), pdfMax: Math.max(...pdf), txtP95: p95(txt), pdfBytes: bytes });
  console.log(`NFR-03 ${browserName}: PDF p95 ${p95(pdf).toFixed(0)} ms (max ${Math.max(...pdf).toFixed(0)}), TXT p95 ${p95(txt).toFixed(0)} ms, ${bytes} bytes`);
  expect(bytes).toBeLessThanOrEqual(1_000_000);
  if (browserName !== 'firefox') {
    expect(p95(pdf)).toBeLessThanOrEqual(5000);
    expect(p95(txt)).toBeLessThanOrEqual(1000);
  }
});
