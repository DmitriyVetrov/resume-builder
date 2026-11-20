// ADR-010 §6 G3 and G4, on the machine this runs on. Separate from the phase suite: a timing limit there would fail on load, not on code.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SETUP } from './in-page';
import { OUT, UPDATED_AT } from './shared.mjs';

type Gate = { gate: Promise<any> };
const G3_RUNS = 50;
const G4_RUNS = 20;
const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] as number;
const record = (name: string, value: unknown) => { mkdirSync(OUT, { recursive: true }); writeFileSync(resolve(OUT, `${name}.json`), JSON.stringify(value, null, 1)); };

test.setTimeout(600_000);
test.beforeEach(async ({ page }) => {
  await page.goto('/page');
  await page.evaluate(SETUP);
  await page.evaluate(() => (window as unknown as Gate).gate.then(() => undefined));
});

test('G3 one keystroke re-layout plus paint, four pages', async ({ page, browserName }) => {
  const document = await (await page.request.get('/fixtures/four-pages.json')).json();
  const times: number[] = await page.evaluate(async ({ document, runs }) => {
    const { engine, fonts } = await (window as unknown as Gate).gate;
    const summary = document.sections[0];
    const paragraph = summary.content.body[0].inlines[0];
    const host = window.document.createElement('div');
    window.document.body.replaceChildren(host);
    const once = (value: string) => {
      const edited = { ...document, sections: [{ ...summary, content: { body: [{ kind: 'paragraph', inlines: [{ ...paragraph, value }] }, ...summary.content.body.slice(1)] } }, ...document.sections.slice(1)] };
      const model = engine.layout(edited, fonts, { photo: true, engineVersion: 'bench' });
      host.replaceChildren();
      for (const item of model.pages) engine.paintPage(item, '/fixtures/photo.jpg', host);
      return host.getBoundingClientRect().height;
    };
    once(paragraph.value); // A warm cache, as after the first render of a session.
    const measured: number[] = [];
    for (let run = 0; run < runs; run++) {
      const start = performance.now();
      once(`${paragraph.value}${'x'.repeat(run % 7)}`);
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      measured.push(performance.now() - start);
    }
    return measured;
  }, { document, runs: G3_RUNS });
  const result = p95(times);
  record(`g3-${browserName}`, { runs: times.length, p95: result, max: Math.max(...times) });
  console.log(`G3 ${browserName}: p95 ${result.toFixed(1)} ms over ${times.length} runs`);
  if (browserName !== 'firefox') expect(result).toBeLessThanOrEqual(300); // Firefox is measured and reported (ADR-010 G3).
});

test('G4 PDF and TXT, four pages with a photo', async ({ page, browserName }) => {
  const document = await (await page.request.get('/fixtures/four-pages.json')).json();
  const { pdf, txt, bytes } = await page.evaluate(async ({ document, runs, UPDATED_AT }) => {
    const { engine, fonts, photo } = await (window as unknown as Gate).gate;
    const model = engine.layout(document, fonts, { photo: true, engineVersion: 'bench' });
    const pdf: number[] = [];
    const txt: number[] = [];
    let bytes = 0;
    for (let run = 0; run < runs; run++) {
      let start = performance.now();
      bytes = (await engine.writePdf({ model, document, fonts, photo, updatedAt: UPDATED_AT })).length;
      pdf.push(performance.now() - start);
      start = performance.now();
      engine.serializeTxt(document);
      txt.push(performance.now() - start);
    }
    return { pdf, txt, bytes };
  }, { document, runs: G4_RUNS, UPDATED_AT });
  record(`g4-${browserName}`, { runs: pdf.length, pdfP95: p95(pdf), txtP95: p95(txt), pdfBytes: bytes });
  console.log(`G4 ${browserName}: PDF p95 ${p95(pdf).toFixed(1)} ms, TXT p95 ${p95(txt).toFixed(2)} ms, ${bytes} bytes`);
  expect(bytes).toBeLessThanOrEqual(1024 * 1024);
  if (browserName !== 'firefox') {
    expect(p95(pdf)).toBeLessThanOrEqual(5000);
    expect(p95(txt)).toBeLessThanOrEqual(1000);
  }
});
