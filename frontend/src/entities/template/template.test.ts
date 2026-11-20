// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blankResumeDocument, type ResumeDocument } from '../resume';
import { newSection, type Section } from '../resume/operations';
import { DOCUMENT_FONTS } from './fonts';
import { contrastOnWhite, definitionOf, listColumnsFor, placementFor, resolveDesign, TEMPLATES } from './index';
import type { TemplateDefinition } from './types';

const doc = (change: Partial<ResumeDocument> = {}, layout: Partial<ResumeDocument['layout']> = {}): ResumeDocument => {
  const base = blankResumeDocument();
  return { ...base, ...change, layout: { ...base.layout, ...layout } };
};
const section = (type: Section['type'], change: Partial<Section> = {}) => ({ ...newSection(type, 'x'), ...change }) as Section;

describe('registry', () => {
  it('D01 has T1, T2, T3 and T4, in that order, with T1 the first (ADR-054)', () => {
    expect(TEMPLATES.map(item => item.id)).toEqual(['T1', 'T2', 'T3', 'T4']);
    expect(TEMPLATES.map(item => item.name)).toEqual(['Classic Timeline', 'Compact', 'Sidebar', 'Panel']);
    expect(definitionOf('T1').id).toBe('T1');
  });
  it('D02 definitions are plain data, unchanged by a JSON round trip (FR-TPL-05)', () => {
    for (const template of TEMPLATES) expect(JSON.parse(JSON.stringify(template))).toEqual(template);
  });
  it('D03 a fourth definition resolves against an unchanged document (FR-TPL-05)', () => {
    const fourth: TemplateDefinition = { ...definitionOf('T1'), id: 'T4', name: 'Fourth', accents: [{ name: 'A', hex: '#111111' }, { name: 'B', hex: '#222222' }, { name: 'C', hex: '#333333' }] };
    const document = doc({ accentPreset: 1 });
    expect(resolveDesign(document, fourth).accent).toBe('#222222');
  });
  it('D04 each template has exactly three accents and three fonts, all known (FR-CLR-01, FR-LAY-08)', () => {
    for (const template of TEMPLATES) {
      expect(template.accents).toHaveLength(3);
      expect(template.fonts).toHaveLength(3);
      expect(new Set(template.fonts).size).toBe(3);
      for (const font of template.fonts) expect(DOCUMENT_FONTS[font]).toBeDefined();
    }
  });
  it('D05 an unknown template ID falls back to T1 rather than breaking', () => {
    expect(definitionOf('nonsense').id).toBe('T1');
  });
  it('D06 definitions import no document model and no React', () => {
    const folder = resolve(import.meta.dirname);
    for (const name of readdirSync(folder).filter(file => /^t\d\.ts$/.test(file))) {
      const source = readFileSync(resolve(folder, name), 'utf8');
      expect(source, name).not.toMatch(/from '(react|\.\.\/resume)/);
    }
  });
  it('D07 every accent is at least 4.5:1 on white, so white on the T3 band is too (FR-CLR-02)', () => {
    expect(contrastOnWhite('#000000')).toBeCloseTo(21, 5);
    expect(contrastOnWhite('#FFFFFF')).toBeCloseTo(1, 5);
    for (const template of TEMPLATES) for (const accent of template.accents) expect(contrastOnWhite(accent.hex), `${template.id} ${accent.name}`).toBeGreaterThanOrEqual(4.5);
  });
});

describe('T1 tokens', () => {
  const t1 = definitionOf('T1');
  it('D08 presets by hex, Blue first (FR-CLR-02, ADR-026)', () => {
    expect(t1.accents).toEqual([{ name: 'Blue', hex: '#2A68A0' }, { name: 'Navy', hex: '#335776' }, { name: 'Graphite', hex: '#333333' }]);
    expect(resolveDesign(doc()).accent).toBe('#2A68A0');
    expect(resolveDesign(doc({ accentPreset: 2 })).accent).toBe('#333333');
  });
  it('D09 §6.2 type styles at Medium', () => {
    const { styles } = t1;
    expect(styles.name).toEqual({ size: 24, bold: true, italic: false, upper: true, color: 'accent' });
    expect(styles.headline).toEqual({ size: 14, bold: true, italic: false, upper: true, color: 'ink' });
    expect(styles.contact).toEqual({ size: 10, bold: false, italic: false, upper: false, color: 'ink' });
    expect(styles.sectionTitle).toEqual({ size: 14, bold: true, italic: false, upper: true, color: 'accent' });
    expect(styles.body).toEqual({ size: 10, bold: false, italic: false, upper: false, color: 'ink' });
    expect(styles.listItem).toEqual({ size: 11, bold: false, italic: false, upper: false, color: 'ink' });
    expect(styles.entryTitle).toEqual({ size: 11, bold: true, italic: false, upper: true, color: 'ink' });
    expect(styles.entryOrganization).toEqual({ size: 10, bold: false, italic: false, upper: false, color: 'accent' });
    expect(styles.entryLocation).toEqual({ size: 10, bold: false, italic: false, upper: false, color: 'ink' });
    expect(styles.entryDates).toEqual({ size: 10, bold: false, italic: true, upper: false, color: 'ink' });
  });
  it('D10 §6 rules: colours, rule, markers, timeline, photo, no icons', () => {
    expect(t1.colors).toMatchObject({ ink: '#050505', line: '#CDCDCD' });
    expect(t1.header).toMatchObject({ photo: { size: 70, radius: 9, gap: 20 }, rule: { height: 1, color: 'line', offset: 54, contactGap: 6 }, contacts: 'separated', icons: false });
    expect(t1.marker).toMatchObject({ width: 4, height: 4, radius: 1, slot: 19, top: 4, color: 'accent' });
    expect(t1.entries).toMatchObject({ marker: 'timeline', indent: 18, defaultColumns: 2, timeline: { x: 3, width: 1, dot: { width: 7, height: 8, radius: 2 }, dotTop: 2 } });
    expect(t1.gaps).toMatchObject({ sectionTitle: 10, paragraph: 6, listRow: 5, descriptionTop: 12, descriptionRow: 10, titleOrganization: 5, columnGutter: 20 });
    expect(t1.list).toMatchObject({ defaultColumns: 2, oneColumnStyle: 'body', indent: 19, twoColumnIndent: 37 });
    expect(t1.zones).toBeNull();
  });
  it('D11 links use the accent with no underline (ADR-030); defaults are FR-LAY defaults', () => {
    expect(t1.link).toEqual({ color: 'accent', underline: false });
    expect(t1.fonts[0]).toBe('roboto');
    expect(t1.defaults).toEqual({ fontPreset: 'M', sectionSpacing: 10, entrySpacing: 10, lineSpacing: 1, margin: 23, pageSize: 'A4', accentPreset: 0 });
    expect(resolveDesign(doc()).link).toEqual({ color: '#2A68A0', underline: false });
  });
});

describe('numeric rules', () => {
  it('D12 the whole §6.9 table (ADR-027)', () => {
    const sizes = (fontPreset: 'S' | 'M' | 'L') => { const { styles } = resolveDesign(doc({}, { fontPreset })); return [styles.name.size, styles.sectionTitle.size, styles.headline.size, styles.entryTitle.size, styles.listItem.size, styles.body.size]; };
    expect(sizes('S')).toEqual([21.5, 12.5, 12.5, 10, 10, 9]);
    expect(sizes('M')).toEqual([24, 14, 14, 11, 11, 10]);
    expect(sizes('L')).toEqual([29, 17, 17, 13, 13, 12]);
  });
  it('D13 a preset changes every text style and nothing else (FR-LAY-01)', () => {
    const medium = resolveDesign(doc({}, { fontPreset: 'M' }));
    const large = resolveDesign(doc({}, { fontPreset: 'L' }));
    for (const style of Object.keys(medium.styles) as (keyof typeof medium.styles)[]) expect(large.styles[style].size).toBeGreaterThan(medium.styles[style].size);
    expect(large.sectionSpaceAbove).toBe(medium.sectionSpaceAbove);
    expect(large.entryGap).toBe(medium.entryGap);
    expect(large.marker).toEqual(medium.marker);
    expect(large.photo).toEqual(medium.photo);
    expect(large.page).toEqual(medium.page);
  });
  it('D14 line height = round(size × 1.2) + v × 0.5 (FR-LAY-04, ADR-028)', () => {
    const line = (fontPreset: 'S' | 'M' | 'L', lineSpacing: number) => resolveDesign(doc({}, { fontPreset, lineSpacing })).styles;
    expect(line('M', 1).body.lineHeight).toBe(12.5);
    expect(line('M', 1).listItem.lineHeight).toBe(13.5);
    expect(line('M', 1).sectionTitle.lineHeight).toBe(17.5);
    expect(line('M', 1).name.lineHeight).toBe(29.5);
    expect(line('M', 0).body.lineHeight).toBe(12);
    expect(line('M', 20).body.lineHeight).toBe(22);
    expect(line('S', 1).body.lineHeight).toBe(11.5);
    expect(line('L', 1).body.lineHeight).toBe(14.5);
    expect(line('S', 1).name.lineHeight).toBe(26.5);
  });
  it('D15 section space above = 10 + v, entry gap = v (FR-LAY-02, FR-LAY-03)', () => {
    expect(resolveDesign(doc({}, { sectionSpacing: 0, entrySpacing: 0 }))).toMatchObject({ sectionSpaceAbove: 10, entryGap: 0 });
    expect(resolveDesign(doc({}, { sectionSpacing: 20, entrySpacing: 20 }))).toMatchObject({ sectionSpaceAbove: 30, entryGap: 20 });
    expect(resolveDesign(doc())).toMatchObject({ sectionSpaceAbove: 20, entryGap: 10 });
  });
  it('D16 page geometry: A4 595×842, Letter 612×792, content width (FR-LAY-05, §6.1)', () => {
    expect(resolveDesign(doc()).page).toMatchObject({ width: 595, height: 842, contentWidth: 549 });
    expect(resolveDesign(doc({}, { pageSize: 'Letter' })).page).toMatchObject({ width: 612, height: 792, contentWidth: 566 });
  });
  it('D17 margins flow into the page on all four sides (FR-LAY-06)', () => {
    const margins = { top: 36, right: 36, bottom: 36, left: 36 };
    expect(resolveDesign(doc({}, { margins })).page).toMatchObject({ margins, contentWidth: 523 });
    expect(resolveDesign(doc({}, { margins: { top: 10, right: 20, bottom: 30, left: 40 } })).page).toMatchObject({ contentWidth: 535 });
  });
  it('D18 the continuation top is margin + 8 pt for every value (SC-04, DD-P10-04)', () => {
    for (const margin of [10, 16, 23, 36, 50, 12.5]) expect(resolveDesign(doc({}, { margins: { top: margin, right: 23, bottom: 23, left: 23 } })).page.continuationTop).toBe(margin + 8);
  });
});

describe('per-section defaults', () => {
  it('D19 list columns by type and template; explicit wins (FR-SEC-11, DD-P10-05, DD-P10-08)', () => {
    const t1 = definitionOf('T1');
    expect(listColumnsFor(section('list'), t1)).toBe(2);
    expect(listColumnsFor(section('entries'), t1)).toBe(2);
    expect(listColumnsFor(section('text'), t1)).toBe(1);
    expect(listColumnsFor(section('list', { listColumns: 1 }), t1)).toBe(1);
    expect(listColumnsFor(section('entries', { listColumns: 1 }), t1)).toBe(1);
    expect(listColumnsFor(section('text', { listColumns: 2 }), t1)).toBe(2);
  });
  it('D20 T3 placement by type; explicit wins (ADR-025)', () => {
    const t3 = definitionOf('T3');
    expect(placementFor(section('list'), t3)).toBe('sidebar');
    expect(placementFor(section('inline'), t3)).toBe('sidebar');
    expect(placementFor(section('text'), t3)).toBe('main');
    expect(placementFor(section('entries'), t3)).toBe('main');
    expect(placementFor(section('list', { placement: 'main' }), t3)).toBe('main');
    expect(placementFor(section('text', { placement: 'sidebar' }), t3)).toBe('sidebar');
  });
  it('D21 single-zone templates ignore placement (ADR-025)', () => {
    expect(placementFor(section('list', { placement: 'sidebar' }), definitionOf('T1'))).toBeNull();
    expect(placementFor(section('list', { placement: 'sidebar' }), definitionOf('T2'))).toBeNull();
  });
  it('D22 a foreign or unknown body font resolves to the template default (AC-P10-11)', () => {
    expect(resolveDesign(doc({}, { bodyFont: 'pt-serif' })).font.id).toBe('pt-serif');
    expect(resolveDesign(doc({}, { bodyFont: 'comic-sans' })).font.id).toBe('roboto');
    expect(resolveDesign(doc({}, { bodyFont: null })).font.id).toBe('roboto');
  });
  it('D23 the document is not changed by resolving', () => {
    const document = doc({}, { bodyFont: 'comic-sans' });
    const before = structuredClone(document);
    resolveDesign(document);
    expect(document).toEqual(before);
  });
});
