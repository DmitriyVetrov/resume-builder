// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import type { ResumeDocument } from '../resume/operations';
import { fitToPages, layout, type FontBook } from './index';
import { documentOf, fixture, paragraph, testFonts, textSection } from './test-kit';

let fonts: FontBook;
beforeAll(() => { fonts = testFonts(); });
const options = { photo: false, engineVersion: 'test' };
const pages = (document: ResumeDocument) => layout(document, fonts, options).pages.length;
const withLayout = (document: ResumeDocument, change: Partial<ResumeDocument['layout']>): ResumeDocument => ({ ...document, layout: { ...document.layout, ...change } });
/** A document whose page count is just above `target` at the given settings, by lines of body. */
function overflowing(settings: Partial<ResumeDocument['layout']>, target = 1): { document: ResumeDocument; lines: number } {
  for (let count = 5; count < 400; count++) {
    const document = withLayout(documentOf([textSection('s', 'Text', [paragraph(count)])]), settings);
    if (pages(document) > target) return { document, lines: count };
  }
  throw new Error('No overflow found');
}

describe('Fit to N pages (FR-PRV-05)', () => {
  it('Z01 a document that fits is returned unchanged', () => {
    const document = fixture('one-page');
    const result = fitToPages(document, 1, fonts, options);
    expect(result.outcome).toBe('already');
    expect(result.document).toBe(document);
    expect(result.pages).toBe(1);
  });
  it('Z02 line spacing goes first, by the least that fits', () => {
    const { document } = overflowing({ lineSpacing: 4 });
    const result = fitToPages(document, 1, fonts, options);
    expect(result.outcome).toBe('fitted');
    expect(result.pages).toBe(1);
    expect(pages(result.document)).toBe(1);
    expect(result.document.layout.lineSpacing).toBeLessThan(4);
    expect(pages(withLayout(result.document, { lineSpacing: result.document.layout.lineSpacing + 1 }))).toBeGreaterThan(1);
    expect(result.document.layout.entrySpacing).toBe(document.layout.entrySpacing);
    expect(result.document.layout.sectionSpacing).toBe(document.layout.sectionSpacing);
    expect(result.document.layout.fontPreset).toBe(document.layout.fontPreset);
  });
  it('Z03 then entry spacing, then section spacing, each only after the one before is at zero', () => {
    const sections = Array.from({ length: 6 }, (_, index) => textSection(`s${index}`, `T${index}`, [paragraph(7)]));
    const base = withLayout(documentOf(sections), { lineSpacing: 0, entrySpacing: 0, sectionSpacing: 20 });
    expect(pages(base)).toBeGreaterThan(1);
    const result = fitToPages(base, 1, fonts, options);
    expect(result.outcome).toBe('fitted');
    expect(result.document.layout.lineSpacing).toBe(0);
    expect(result.document.layout.entrySpacing).toBe(0);
    expect(result.document.layout.sectionSpacing).toBeLessThan(20);
    expect(result.document.layout.fontPreset).toBe(base.layout.fontPreset);
    expect(pages(result.document)).toBe(1);
  });
  it('Z04 the font preset comes last', () => {
    const { document } = overflowing({ lineSpacing: 0, entrySpacing: 0, sectionSpacing: 0, fontPreset: 'L' });
    const result = fitToPages(document, 1, fonts, options);
    expect(result.outcome).toBe('fitted');
    expect(['M', 'S']).toContain(result.document.layout.fontPreset);
    expect(pages(result.document)).toBe(1);
    const smallest = { lineSpacing: 0, entrySpacing: 0, sectionSpacing: 0 };
    expect(result.document.layout).toMatchObject(smallest);
  });
  it('Z05 when nothing fits it reports so and changes nothing', () => {
    const document = documentOf([textSection('s', 'Text', [paragraph(900)])]);
    const result = fitToPages(document, 1, fonts, options);
    expect(result.outcome).toBe('impossible');
    expect(result.document).toBe(document);
    expect(result.pages).toBeGreaterThan(1);
  });
  it('Z06 only spacing and the preset ever change: content stays deep-equal', () => {
    const document = fixture('four-pages');
    const result = fitToPages(document, 3, fonts, options);
    const { layout: before, ...restBefore } = document;
    const { layout: after, ...restAfter } = result.document;
    expect(restAfter).toEqual(restBefore);
    expect({ ...after, lineSpacing: 0, entrySpacing: 0, sectionSpacing: 0, fontPreset: 'M' }).toEqual({ ...before, lineSpacing: 0, entrySpacing: 0, sectionSpacing: 0, fontPreset: 'M' });
  });
});
