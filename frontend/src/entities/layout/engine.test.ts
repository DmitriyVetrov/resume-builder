// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ResumeDocument } from '../resume/operations';
import { switchTemplate } from '../resume/design-operations';
import { definitionOf, resolveDesign } from '../template';
import { canonicalHash, createFontBook, layout, type FontBook, type Line, type Page, type PageModel } from './index';

const root = resolve(import.meta.dirname, '../../../..');
const fixture = (name: string): ResumeDocument => JSON.parse(readFileSync(resolve(root, `tests/fixtures/resumes/${name}.json`), 'utf8'));
let fonts: FontBook;
const run = (document: ResumeDocument, photo = false): PageModel => layout(document, fonts, { photo, engineVersion: 'test' });
const lines = (model: PageModel) => model.pages.flatMap(page => page.lines);
const text = (line: Line) => line.runs.map(item => item.text).join('');
const lineWith = (model: PageModel, needle: string) => lines(model).find(line => text(line).includes(needle));
const pageOf = (model: PageModel, needle: string): Page | undefined => model.pages.find(page => page.lines.some(line => text(line).includes(needle)));

beforeAll(() => {
  const bytes = Object.fromEntries(['roboto', 'ibm-plex-sans', 'pt-serif'].map(id => [id, Object.fromEntries(['regular', 'italic', 'bold', 'bold-italic'].map(face => [face, new Uint8Array(readFileSync(resolve(root, `frontend/src/assets/fonts/${id}/${face}.ttf`)))]))]));
  fonts = createFontBook(bytes);
});

describe('page geometry', () => {
  it('E01 A4 and Letter (FR-LAY-05)', () => {
    const a4 = run(fixture('one-page'));
    expect(a4.pages[0]).toMatchObject({ number: 1, width: 595, height: 842 });
    const document = fixture('one-page');
    const letter = run({ ...document, layout: { ...document.layout, pageSize: 'Letter' } });
    expect(letter.pages[0]).toMatchObject({ width: 612, height: 792 });
  });
  it('E02 first page starts at the margin, a continuation page at margin + 8 (§6.1, SC-04)', () => {
    const model = run(fixture('four-pages'));
    expect(model.pages.length).toBeGreaterThanOrEqual(3);
    const top = (page: Page) => Math.min(...page.lines.map(line => line.y));
    expect(top(model.pages[0]!)).toBeCloseTo(23, 3);
    expect(top(model.pages[1]!)).toBeGreaterThanOrEqual(31 - 0.001);
    expect(top(model.pages[1]!)).toBeLessThan(31 + 13);
  });
  it('E03 nothing passes the bottom margin or the side margins', () => {
    const model = run(fixture('four-pages'));
    for (const page of model.pages) for (const line of page.lines) {
      expect(line.y + line.height, text(line)).toBeLessThanOrEqual(page.height - 23 + 0.01);
      expect(line.x, text(line)).toBeGreaterThanOrEqual(23 - 0.01);
      expect(line.x + line.width, text(line)).toBeLessThanOrEqual(page.width - 23 + 0.01);
    }
  });
});

describe('spacing rules, measured in the model', () => {
  const titleGap = (model: PageModel, a: string, b: string) => { const first = lineWith(model, a)!; const second = lineWith(model, b)!; return second.y - (first.y + first.height); };
  it('E04 line height by the formula (FR-LAY-04)', () => {
    const document = fixture('one-page');
    const paragraphLines = (v: number) => { const model = run({ ...document, layout: { ...document.layout, lineSpacing: v } }); const summary = lines(model).filter(line => line.anchor?.sectionId === document.sections[0]!.id && line.role === 'body'); return summary[1]!.y - summary[0]!.y; };
    expect(paragraphLines(1)).toBeCloseTo(12.5, 3);
    expect(paragraphLines(0)).toBeCloseTo(12, 3);
    expect(paragraphLines(20)).toBeCloseTo(22, 3);
  });
  it('E05 space above a section title is 10 + v (FR-LAY-02)', () => {
    const document = fixture('one-page');
    const space = (v: number) => {
      const model = run({ ...document, layout: { ...document.layout, sectionSpacing: v } });
      const titles = lines(model).filter(line => line.role === 'sectionTitle');
      const second = titles[1]!;
      const previous = lines(model).filter(line => line.y < second.y).reduce((a, b) => a.y + a.height > b.y + b.height ? a : b);
      return second.y - (previous.y + previous.height);
    };
    expect(space(10)).toBeCloseTo(20, 3);
    expect(space(0)).toBeCloseTo(10, 3);
    expect(space(20)).toBeCloseTo(30, 3);
  });
  it('E06 entry spacing is v between entries (FR-LAY-03)', () => {
    const document = fixture('two-pages');
    const titlesAt = (v: number) => {
      const model = run({ ...document, layout: { ...document.layout, entrySpacing: v } });
      return lines(model).filter(line => line.role === 'entryTitle').slice(0, 2).map(line => line.y);
    };
    const [a0, b0] = titlesAt(0);
    const [a20, b20] = titlesAt(20);
    expect((b20! - a20!) - (b0! - a0!)).toBeCloseTo(20, 3);
  });
  it('E07 section title to content is 10 (§6.4)', () => {
    const model = run(fixture('one-page'));
    expect(titleGap(model, 'RESUMEN PROFESIONAL', 'Ingeniera de software')).toBeCloseTo(10, 3);
  });
  it('E08 preset changes sizes and leaves markers fixed (FR-LAY-01, §6.9)', () => {
    const document = fixture('one-page');
    const large = run({ ...document, layout: { ...document.layout, fontPreset: 'L' } });
    expect(lines(large).find(line => line.role === 'name')!.runs[0]!.size).toBe(29);
    expect(lines(large).find(line => line.role === 'body')!.runs[0]!.size).toBe(12);
    const marker = large.pages[0]!.shapes.find(shape => shape.role === 'marker')!;
    expect([marker.width, marker.height, marker.radius]).toEqual([4, 4, 1]);
  });
});

describe('T1 rules', () => {
  it('E09 accent roles only (FR-CLR-03, §6.2, ADR-030)', () => {
    const document = { ...fixture('one-page'), accentPreset: 1 as const };
    const model = run(document);
    const accent = '#335776';
    const colors = (role: Line['role']) => new Set(lines(model).filter(line => line.role === role).flatMap(line => line.runs.filter(item => !item.link).map(item => item.color)));
    for (const role of ['name', 'sectionTitle', 'entryOrganization'] as const) expect([...colors(role)], role).toEqual([accent]);
    for (const role of ['headline', 'body', 'entryTitle', 'entryLocation', 'entryDates', 'listItem'] as const) expect([...colors(role)], role).toEqual(['#050505']);
    for (const shape of model.pages[0]!.shapes.filter(item => ['marker', 'separator', 'dot'].includes(item.role))) expect(shape.fill, shape.role).toBe(accent);
    for (const shape of model.pages[0]!.shapes.filter(item => ['rule', 'timeline'].includes(item.role))) expect(shape.fill, shape.role).toBe('#CDCDCD');
    const linkRuns = lines(model).flatMap(line => line.runs).filter(item => item.link);
    expect(linkRuns.length).toBeGreaterThan(0);
    for (const item of linkRuns) { expect(item.color).toBe(accent); expect(item.underline).toBe(false); }
  });
  it('E10 links carry a rectangle and a safe URL; contact items are auto-linked (FR-HDR-04, ADR-010)', () => {
    const document = fixture('one-page');
    const model = run(document);
    const urls = model.pages.flatMap(page => page.links.map(item => item.url));
    expect(urls).toContain('mailto:lucia@example.invalid');
    expect(urls).toContain('https://example.invalid/in/lucia');
    const hostile = { ...document, header: { ...document.header, contacts: [{ ...document.header.contacts[0]!, text: 'click', url: 'javascript:alert(1)' }] } };
    expect(run(hostile).pages[0]!.links.map(item => item.url)).not.toContain('javascript:alert(1)');
  });
  it('E11 no separator at the start of a contact line (§6.3)', () => {
    const document = fixture('one-page');
    const contacts = Array.from({ length: 10 }, (_, index) => ({ id: `c${index}`, text: `contact-item-number-${index}@example.invalid`, url: null, kind: 'email' as const }));
    const model = run({ ...document, header: { ...document.header, contacts } });
    const contactLines = model.pages[0]!.lines.filter(line => line.role === 'contact');
    expect(contactLines.length).toBeGreaterThan(1);
    for (const contactLine of contactLines) expect(model.pages[0]!.shapes.filter(shape => shape.role === 'separator' && shape.y >= contactLine.y && shape.y < contactLine.y + contactLine.height && shape.x < contactLine.x)).toEqual([]);
    expect(model.pages[0]!.shapes.filter(shape => shape.role === 'separator').length).toBeGreaterThan(0);
  });
  it('E12 photo: 70 pt at the corner, text column moved by 90, or full width without (§6.3, FR-HDR-06)', () => {
    const document = fixture('one-page');
    const withPhoto = run(document, true);
    expect(withPhoto.pages[0]!.images[0]).toMatchObject({ x: 23, y: 23, width: 70, height: 70, radius: 9 });
    expect(withPhoto.pages[0]!.lines.find(line => line.role === 'name')!.x).toBeCloseTo(113, 3);
    const without = run(document, false);
    expect(without.pages[0]!.images).toEqual([]);
    expect(without.pages[0]!.lines.find(line => line.role === 'name')!.x).toBeCloseTo(23, 3);
    const hidden = run({ ...document, header: { ...document.header, showPhoto: false } }, true);
    expect(hidden.pages[0]!.images).toEqual([]);
  });
  it('E13 timeline: dot per entry, continuous line, none for a single entry (§6.7, PG-07, ADR-031)', () => {
    const document = fixture('two-pages');
    const model = run(document);
    const dots = model.pages.flatMap(page => page.shapes.filter(shape => shape.role === 'dot'));
    const entryCount = (document.sections.filter(section => section.type === 'entries') as Extract<ResumeDocument['sections'][number], { type: 'entries' }>[]).reduce((sum, section) => sum + section.content.entries.length, 0);
    expect(dots).toHaveLength(entryCount);
    const timeline = model.pages.flatMap(page => page.shapes.filter(shape => shape.role === 'timeline'));
    expect(timeline.length).toBeGreaterThan(0);
    for (const shape of timeline) expect(shape.x).toBeCloseTo(26, 3);
    const education = document.sections[3]!;
    const single = lines(model).find(line => line.anchor?.sectionId === education.id && line.role === 'entryTitle')!;
    const pageIndex = model.pages.findIndex(page => page.lines.includes(single));
    expect(model.pages[pageIndex]!.shapes.filter(shape => shape.role === 'timeline' && shape.y >= single.y)).toEqual([]);
    const pagesWithLine = model.pages.filter(page => page.shapes.some(shape => shape.role === 'timeline'));
    expect(pagesWithLine.length).toBeGreaterThanOrEqual(2);
  });
  it('E14 two-column rows are atomic and filled row by row (§6.6, PG-05, FR-SEC-11)', () => {
    const document = fixture('one-page');
    const model = run(document);
    const items = lines(model).filter(line => line.anchor?.sectionId === document.sections[1]!.id && line.role === 'listItem');
    const xs = [...new Set(items.map(line => line.x))].sort((a, b) => a - b);
    expect(xs).toHaveLength(2);
    expect(xs[1]! - xs[0]!).toBeCloseTo((549 - 20) / 2 + 20, 3);
    const oneColumn = run({ ...document, sections: document.sections.map((section, index) => index === 1 ? { ...section, listColumns: 1 } : section) as ResumeDocument['sections'] });
    const single = lines(oneColumn).filter(line => line.anchor?.sectionId === document.sections[1]!.id && line.role !== 'sectionTitle');
    expect(new Set(single.map(line => line.x)).size).toBe(1);
    expect(single[0]!.role).toBe('body');
    for (const page of run(fixture('four-pages')).pages) {
      for (const shape of page.shapes.filter(item => item.role === 'marker')) expect(page.lines.some(line => Math.abs(line.y - (shape.y - 4)) < 0.01)).toBe(true);
    }
  });
});

describe('fonts', () => {
  it('E22 all twelve faces cover the Spanish, Slovak and Ukrainian strings (NFR-07, AC-P10-11)', () => {
    const strings = ['Ñandú València migración año ¿Cómo? ¡Sí!', 'Šťastná Žilina Ľubomír ďakujem ôsmy kôň', 'Інженерка їжак ґанок Єва програмного забезпечення'];
    const keys = ['roboto', 'ibm-plex-sans', 'pt-serif'].flatMap(id => ['regular', 'italic', 'bold', 'bold-italic'].map(face => `${id}/${face}`));
    expect(keys).toHaveLength(12);
    for (const key of keys) {
      const font = fonts.font(key);
      for (const char of strings.join(' ')) expect(font.hasGlyphForCodePoint(char.codePointAt(0)!), `${key} ${char}`).toBe(true);
      // The subset is limited on purpose, so this check can fail: a kana is not in it.
      expect(font.hasGlyphForCodePoint('あ'.codePointAt(0)!), key).toBe(false);
    }
  });
});

describe('bundle boundary', () => {
  it('E21 only the preview runtime reaches the engine, and only through import() (ADR-010 Risk, NFR-02)', () => {
    const src = resolve(import.meta.dirname, '../..');
    const walk = (folder: string): string[] => readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(resolve(folder, entry.name)) : [resolve(folder, entry.name)]);
    const sources = walk(src).filter(file => /\.tsx?$/.test(file) && !file.includes('/entities/layout/') && !/\.test\.tsx?$/.test(file) && !file.includes('/test/'));
    // Three leaves are pure data or plain geometry, with no shaping behind them, so a cached thumbnail needs no engine.
    const valueImports = sources.filter(file => /^import (?!type )[^;]*from '[^']*entities\/layout(\/(?!icons'|regions'|version')[^']*)?'/m.test(readFileSync(file, 'utf8')) || /^import (?!type )[^;]*from '(fontkit|linebreak|pdfkit)'/m.test(readFileSync(file, 'utf8')));
    expect(valueImports.map(file => file.slice(src.length + 1))).toEqual([]);
    const lazy = sources.filter(file => /import\('[^']*entities\/layout[^']*'\)/.test(readFileSync(file, 'utf8')));
    expect(lazy.map(file => file.slice(src.length + 1))).toEqual(['features/preview-paint/runtime.ts']);
    const paint = readFileSync(resolve(src, 'features/preview-paint/paint.ts'), 'utf8');
    expect(paint).toContain("from '../../entities/layout/icons'");
    expect(paint).not.toMatch(/fontkit|linebreak/);
  });
});

describe('content and determinism', () => {
  const words = (model: PageModel) => lines(model).map(text).join(' ').replace(/\s+/g, ' ');
  it('E15 no text lost: every typed word of a fixture appears (no content loss)', () => {
    const document = fixture('two-pages');
    const output = words(run(document)).toLowerCase();
    const walk = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(walk) : value && typeof value === 'object' ? Object.entries(value).filter(([key]) => key !== 'labels' && (['value', 'title', 'organization', 'location', 'fullName', 'headline', 'text'].includes(key) || typeof (value as Record<string, unknown>)[key] === 'object')).flatMap(([, item]) => walk(item)) : [];
    const typed = walk(document.sections).concat(walk(document.header)).filter(item => !/^[0-9a-f-]{36}$/.test(item)).flatMap(item => item.split(/\s+/)).filter(Boolean);
    for (const word of typed) expect(output, word).toContain(word.toLowerCase());
  });
  it('E16 pure: two runs give the same hash, and a switch back restores it (FR-TPL-03, NFR-14)', () => {
    const document = fixture('two-pages');
    const first = canonicalHash(run(document));
    expect(canonicalHash(run(structuredClone(document)))).toBe(first);
    const back = switchTemplate(switchTemplate(switchTemplate(document, 'T2'), 'T3'), 'T1');
    expect(canonicalHash(run(back))).toBe(first);
    expect(canonicalHash(run(switchTemplate(document, 'T2')))).not.toBe(first);
  });
  it('E17 T2 and T3 tokens reach the model: the definitions fit the engine (ADR-010, FR-TPL-05)', () => {
    const document = { ...fixture('one-page'), templateId: 'T3' as const };
    const design = resolveDesign(document);
    const model = run(document);
    expect(design.definition.id).toBe('T3');
    expect(lines(model).find(line => line.role === 'sectionTitle')!.runs[0]).toMatchObject({ size: design.styles.sectionTitle.size, color: design.accent });
    expect(definitionOf('T3').styles.sectionTitle.size).toBe(12);
  });
  it('E18 hidden and empty sections are not laid out (FR-SEC-05, FR-SEC-07)', () => {
    const document = fixture('one-page');
    const model = run({ ...document, sections: [{ ...document.sections[0]!, hidden: true }, { ...document.sections[1]!, content: { items: [] } }, ...document.sections.slice(2)] as ResumeDocument['sections'] });
    expect(lineWith(model, 'RESUMEN PROFESIONAL')).toBeUndefined();
    expect(lineWith(model, 'ЩО Я ВМІЮ')).toBeUndefined();
    expect(lineWith(model, 'EXPERIENCIA PROFESIONAL')).toBeDefined();
  });
  it('E19 keep rules: a section title is never last on a page, an entry head stays with its body (PG-01, PG-02)', () => {
    const model = run(fixture('four-pages'));
    for (const page of model.pages) {
      const last = page.lines.reduce((a, b) => a.y >= b.y ? a : b);
      expect(['sectionTitle', 'entryTitle', 'entryOrganization', 'entryLocation', 'entryDates'], text(last)).not.toContain(last.role);
    }
    expect(pageOf(model, 'RESUMEN PROFESIONAL')).toBe(model.pages[0]);
  });
  it('E20 engine sources stay pure and use no runtime locale data (F-FE-3, ADR-010 §7)', () => {
    const folder = resolve(import.meta.dirname);
    for (const name of readdirSync(folder).filter(file => /\.ts$/.test(file) && !file.endsWith('.test.ts') && file !== 'fontkit.d.ts' && file !== 'pdfkit.d.ts')) {
      const source = readFileSync(resolve(folder, name), 'utf8');
      expect(source, name).not.toMatch(/from 'react|document\.(create|query|get|body)|window\.|Intl\.|toLocale|localeCompare|\.normalize\(|Math\.(sin|cos|tan|exp|log|pow)\b/);
    }
  });
});
