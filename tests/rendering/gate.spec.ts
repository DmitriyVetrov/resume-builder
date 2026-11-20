// ADR-010 §6 G2 and G7 per browser, over every case (NFR-04). G3 and G4 are in bench.spec.ts. Run after reference.mjs, in the pinned Playwright image.
import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SETUP } from './in-page';

import { CASES, OUT, TEMPLATES, UPDATED_AT } from './shared.mjs';

type Case = (typeof CASES)[number];
const reference = () => JSON.parse(readFileSync(resolve(OUT, 'reference-hashes.json'), 'utf8'));
const sizedDocument = (document: Record<string, any>, { size, preset, template }: Case) => ({ ...document, templateId: template, layout: { ...document.layout, pageSize: size, fontPreset: preset } });

test.setTimeout(900_000);
test.beforeEach(async ({ page }) => {
  await page.goto('/page');
  await page.evaluate(SETUP);
  await page.evaluate(() => (window as unknown as { gate: Promise<unknown> }).gate.then(() => undefined));
});

for (const template of TEMPLATES) {
  const cases = CASES.filter(item => item.template === template);
  test(`G7 ${template}: model, PDF and TXT are identical to Node`, async ({ page }) => {
    const hashes = reference();
    for (const item of cases) {
      const document = sizedDocument(await (await page.request.get(`/fixtures/${item.name}.json`)).json(), item);
      const result = await page.evaluate(async ({ document, UPDATED_AT }) => {
        const { engine, fonts, photo, sha } = await (window as unknown as { gate: Promise<any> }).gate;
        const model = engine.layout(document, fonts, { photo: true, engineVersion: 'gate' });
        const pdf = await engine.writePdf({ model, document, fonts, photo, updatedAt: UPDATED_AT });
        const txt = new TextEncoder().encode(engine.serializeTxt(document));
        return { model: engine.canonicalHash(model), pdf: await sha(pdf), txt: await sha(txt), pages: model.pages.length };
      }, { document, UPDATED_AT });
      expect(result, item.label).toEqual(hashes[item.label]);
    }
  });

  test.describe('G2', () => {
    test.use({ deviceScaleFactor: 100 / 96 });
    test(`G2 ${template}: screenshots for the raster diff`, async ({ page }, info) => {
      const folder = resolve(OUT, 'screens', info.project.name);
      mkdirSync(folder, { recursive: true });
      for (const item of cases) {
        const document = sizedDocument(await (await page.request.get(`/fixtures/${item.name}.json`)).json(), item);
        const count = await page.evaluate(({ document }) => (window as unknown as { gate: Promise<any> }).gate.then(({ engine, fonts }) => {
          (window as unknown as { model: unknown }).model = engine.layout(document, fonts, { photo: true, engineVersion: 'gate' });
          return (window as unknown as { model: { pages: unknown[] } }).model.pages.length;
        }), { document });
        // One page at a time at the origin: a stacked page starts at a fractional device pixel, and the clip would round it.
        for (let number = 1; number <= count; number++) {
          await page.evaluate(async number => {
            const { engine } = await (window as unknown as { gate: Promise<any> }).gate;
            const { pages } = (window as unknown as { model: { pages: unknown[] } }).model;
            const host = window.document.createElement('div');
            window.document.body.replaceChildren(host);
            engine.paintPage(pages[number - 1], '/fixtures/photo.jpg', host);
            await Promise.all(Array.from(window.document.images).map(image => image.decode().catch(() => undefined)));
            await window.document.fonts.ready;
          }, number);
          writeFileSync(resolve(folder, `${item.label}-${number}.png`), await page.locator('body > div > *').first().screenshot());
        }
        expect(count, item.label).toBeGreaterThan(0);
      }
    });
  });
}
