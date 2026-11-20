// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from './layout';
import { extractPdf, ImportError, MAX_FILE_BYTES, PDF_OPTIONS } from './pdf';
import { drawnMarkers, manyPages, noText, oneColumn, taggedList, twoColumn, withLink } from './test/pdfs';
import type { Analysis } from './types';

/** IMP-01 X-01…X-09 (AC-IMP-01, AC-IMP-07): pdf.js over synthetic PDFs, then layout analysis. */
const read = async (bytes: Promise<Uint8Array>): Promise<Analysis> => analyze(await extractPdf(await bytes));
const plain = (analysis: Analysis) => analysis.blocks.map(block => block.plain);
const block = (analysis: Analysis, value: string) => analysis.blocks.find(item => item.plain === value);

describe('PDF extraction (ADR-055 §3)', () => {
  it('X-01 one column: every line once, in reading order, with size and weight from the font', async () => {
    const extraction = await extractPdf(await oneColumn());
    expect(extraction.pages).toEqual([{ width: expect.closeTo(595.28, 1), height: expect.closeTo(841.89, 1) }]);
    const name = extraction.runs.find(run => run.text === 'Alex Sample');
    expect(name).toMatchObject({ page: 0, size: 22, bold: true, italic: false });
    expect(name!.x).toBeCloseTo(50, 0);
    expect(extraction.runs.find(run => run.text === 'Example Systems')).toMatchObject({ italic: true, bold: false });
    const analysis = analyze(extraction);
    expect(plain(analysis)).toEqual(['Alex Sample', 'Platform Engineer', 'EXPERIENCE', 'Built and ran the build system for four product teams.', 'Example Systems']);
  });

  it('X-02 a tagged PDF marks list items from L/LI even without a glyph or marker', async () => {
    const analysis = await read(taggedList());
    expect(block(analysis, 'Kept the lights on.')?.listItem).toBe(true);
    expect(block(analysis, 'Paged less often.')?.listItem).toBe(true);
    expect(block(analysis, 'A plain paragraph.')?.listItem).toBe(false);
  });

  it('X-03 link annotations become hrefs on the text they cover', async () => {
    const analysis = await read(withLink());
    const line = analysis.blocks.find(item => item.plain === 'Founded example.com');
    expect(line?.text).toMatch(/^Founded <a href="https:\/\/example\.com\/?">example\.com<\/a>$/);
  });

  it('X-04 glyph bullets are list items with the glyph removed', async () => {
    const analysis = await read(twoColumn('left'));
    expect(block(analysis, 'alex.sample@example.com')).toMatchObject({ listItem: true, column: 'S' });
    expect(analysis.blocks.some(item => item.plain.includes('●'))).toBe(false);
  });

  it('X-05 drawn markers with a hanging indent are list items', async () => {
    const extraction = await extractPdf(await drawnMarkers());
    expect(extraction.markers).toHaveLength(2);
    const analysis = analyze(extraction);
    expect(block(analysis, 'Built the release pipeline.')?.listItem).toBe(true);
    expect(block(analysis, 'Cut build times in half.')?.listItem).toBe(true);
    expect(block(analysis, 'Closing paragraph without a marker.')?.listItem).toBe(false);
  });

  it('X-06 the photo candidate is the near-square image in the sidebar, not the wide banner', async () => {
    const extraction = await extractPdf(await twoColumn('left', { images: true }));
    expect(extraction.images).toHaveLength(2);
    const analysis = analyze(extraction);
    expect(analysis.photo).toMatchObject({ page: 0, width: expect.closeTo(80, 0), height: expect.closeTo(80, 0) });
    expect(analysis.photo!.x).toBeCloseTo(60, 0);
    expect(analysis.photo!.top).toBeCloseTo(40, 0);
  });

  it('X-07 other images are dropped and counted (O-5)', async () => {
    expect((await read(twoColumn('left', { images: true }))).droppedImages).toBe(1);
    expect((await read(twoColumn('left'))).droppedImages).toBe(0);
  });

  it('X-08 no text layer, too many pages and too large a file are refused', async () => {
    await expect(extractPdf(await noText())).rejects.toEqual(new ImportError('no_text_layer'));
    await expect(extractPdf(await manyPages())).rejects.toEqual(new ImportError('too_many_pages'));
    await expect(extractPdf(new Uint8Array(MAX_FILE_BYTES + 1))).rejects.toEqual(new ImportError('too_large'));
    await expect(extractPdf(new TextEncoder().encode('not a pdf'))).rejects.toEqual(new ImportError('unreadable'));
  });

  it('X-09 the pinned pdf.js has no eval path, and wasm, XFA and font faces are off (DD-IMP-17)', () => {
    const dist = resolve(import.meta.dirname, '../../../node_modules/pdfjs-dist');
    for (const file of ['build/pdf.mjs', 'build/pdf.worker.mjs', 'legacy/build/pdf.mjs', 'legacy/build/pdf.worker.mjs']) {
      const source = readFileSync(resolve(dist, file), 'utf8');
      expect(source, file).not.toMatch(/\beval\(|new Function\(/);
    }
    expect(PDF_OPTIONS).toMatchObject({ useWasm: false, enableXfa: false, disableFontFace: true, useSystemFonts: false });
  });
});
