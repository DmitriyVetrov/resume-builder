// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import type { ResumeDocument } from '../resume/operations';
import type { FontBook, Line, PageModel } from './index';
import { documentOf, entriesSection, entry, filler, fixture, lines, listSection, pageOfLine, paragraph, run, run_, SWEEP, text, textSection } from './test-kit';

let fonts: FontBook;
beforeAll(async () => { fonts = (await import('./test-kit')).testFonts(); });
const go = (document: ResumeDocument, photo = false) => run_(document, fonts, photo);
const ofSection = (model: PageModel, id: string) => lines(model).filter(line => line.anchor?.sectionId === id);
const onPages = (model: PageModel, list: Line[]) => list.map(line => pageOfLine(model, line));

describe('§8 pagination, swept across the page boundary', () => {
  it('N01 PG-01: a section title stays with at least two lines of its content', () => {
    let moved = false;
    for (const count of SWEEP) {
      const model = go(documentOf([filler(count), textSection('s', 'Target', [paragraph(6, 'body')])]));
      const list = ofSection(model, 's');
      const title = list.find(line => line.role === 'sectionTitle')!;
      const body = list.filter(line => line.role === 'body');
      expect(pageOfLine(model, title), `filler ${count}`).toBe(pageOfLine(model, body[0]!));
      expect(pageOfLine(model, title), `filler ${count}`).toBe(pageOfLine(model, body[1]!));
      if (pageOfLine(model, title) > 0) moved = true;
    }
    expect(moved).toBe(true);
  });
  it('N02 PG-02: title and meta rows stay together and with two description lines', () => {
    let moved = false;
    for (const count of SWEEP) {
      const model = go(documentOf([filler(count), entriesSection('s', 'Work', [entry('e1', 'One', [paragraph(6, 'one')]), entry('e2', 'Two', [paragraph(6, 'two')])])]));
      for (const id of ['e1', 'e2']) {
        const list = lines(model).filter(line => line.anchor?.entryId === id);
        const head = list.filter(line => line.role !== 'body');
        const body = list.filter(line => line.role === 'body');
        const page = pageOfLine(model, head[0]!);
        for (const line of [...head, body[0]!, body[1]!]) expect(pageOfLine(model, line), `filler ${count} ${id}`).toBe(page);
      }
      if (pageOfLine(model, lines(model).find(line => line.anchor?.entryId === 'e2')!) > 0) moved = true;
    }
    expect(moved).toBe(true);
  });
  it('N03 PG-03: a bullet of up to four lines is never split', () => {
    for (const count of SWEEP) {
      const items = Array.from({ length: 8 }, (_, index) => ({ id: `i${index}`, lines: 4 }));
      const model = go(documentOf([filler(count), listSection('s', 'List', items, 1)]));
      for (const { id } of items) expect(new Set(onPages(model, lines(model).filter(line => line.anchor?.itemId === id))).size, `filler ${count} ${id}`).toBe(1);
    }
  });
  it('N04 PG-03: a longer bullet splits with at least two lines on each side, and has one marker', () => {
    let split = false;
    for (const count of SWEEP) {
      const model = go(documentOf([filler(count), listSection('s', 'List', [{ id: 'long', lines: 9 }], 1)]));
      const list = lines(model).filter(line => line.anchor?.itemId === 'long');
      const perPage = new Map<number, number>();
      for (const page of onPages(model, list)) perPage.set(page, (perPage.get(page) ?? 0) + 1);
      if (perPage.size > 1) split = true;
      for (const [page, amount] of perPage) expect(amount, `filler ${count} page ${page}`).toBeGreaterThanOrEqual(2);
      expect(model.pages.flatMap(page => page.shapes.filter(shape => shape.role === 'marker')), `filler ${count}`).toHaveLength(1);
    }
    expect(split).toBe(true);
  });
  it('N05 PG-04: a paragraph keeps at least two lines each side of a break', () => {
    let split = false;
    for (const count of SWEEP) {
      const model = go(documentOf([filler(count), textSection('s', 'Text', [paragraph(7, 'body')])]));
      const perPage = new Map<number, number>();
      for (const page of onPages(model, ofSection(model, 's').filter(line => line.role === 'body'))) perPage.set(page, (perPage.get(page) ?? 0) + 1);
      if (perPage.size > 1) split = true;
      for (const [page, amount] of perPage) expect(amount, `filler ${count} page ${page}`).toBeGreaterThanOrEqual(2);
    }
    expect(split).toBe(true);
  });
  it('N06 PG-05: a two-column row is never divided', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({ id: `i${index}`, lines: 3 }));
    let moved = false;
    for (const count of SWEEP) {
      const model = go(documentOf([filler(count), listSection('s', 'List', items, 2)]));
      for (let row = 0; row < items.length; row += 2) {
        const cells = lines(model).filter(line => line.anchor?.itemId === `i${row}` || line.anchor?.itemId === `i${row + 1}`);
        expect(new Set(onPages(model, cells)).size, `filler ${count} row ${row}`).toBe(1);
        expect(new Set(cells.map(line => line.x)).size).toBe(2);
      }
      if (model.pages.length > 1) moved = true;
    }
    expect(moved).toBe(true);
  });
  it('N07 PG-06: the header is never split', () => {
    const base = fixture('contacts-heavy');
    const model = go({ ...base, sections: [] }, true);
    expect(model.pages).toHaveLength(1);
    const headerRoles = new Set(['name', 'headline', 'contact']);
    expect(lines(model).filter(line => headerRoles.has(line.role))).not.toEqual([]);
    expect(onPages(model, lines(model).filter(line => headerRoles.has(line.role))).every(page => page === 0)).toBe(true);
  });
  it('N08 PG-07: the timeline starts at the first dot, not at the section title, and continues with no second dot', () => {
    const entries = Array.from({ length: 6 }, (_, index) => entry(`e${index}`, `Job ${index}`, [paragraph(14, `job${index}`)]));
    const model = go(documentOf([entriesSection('s', 'Work', entries)]));
    expect(model.pages.length).toBeGreaterThan(1);
    const first = model.pages[0]!;
    const dot = first.shapes.find(shape => shape.role === 'dot')!;
    const line = first.shapes.find(shape => shape.role === 'timeline')!;
    expect(line.y).toBeCloseTo(dot.y, 3);
    const title = first.lines.find(item => item.role === 'sectionTitle')!;
    expect(line.y).toBeGreaterThanOrEqual(title.y + title.height);
    const continued = model.pages.find((page, index) => index > 0 && page.lines.some(item => item.role === 'body' && text(item).startsWith('job0')))
      ?? model.pages.find((page, index) => index > 0 && page.shapes.some(shape => shape.role === 'timeline'))!;
    expect(continued.shapes.some(shape => shape.role === 'timeline')).toBe(true);
    expect(model.pages.flatMap(page => page.shapes.filter(shape => shape.role === 'dot'))).toHaveLength(entries.length);
  });
  it('N09 PG-08: a manual break starts a new page, and on a first entry the section title moves with it', () => {
    const later = go(documentOf([textSection('a', 'Before', [paragraph(2)]), entriesSection('s', 'Work', [entry('e1', 'One'), entry('e2', 'Two', [], true)])]));
    const two = lines(later).find(line => line.anchor?.entryId === 'e2')!;
    expect(pageOfLine(later, two)).toBe(1);
    expect(two.y).toBeCloseTo(31, 3);
    const first = go(documentOf([textSection('a', 'Before', [paragraph(2)]), entriesSection('s', 'Work', [entry('e1', 'One', [], true), entry('e2', 'Two')])]));
    const title = lines(first).find(line => line.anchor?.sectionId === 's' && line.role === 'sectionTitle')!;
    const one = lines(first).find(line => line.anchor?.entryId === 'e1')!;
    expect(pageOfLine(first, title)).toBe(1);
    expect(pageOfLine(first, one)).toBe(1);
    expect(title.y).toBeLessThan(one.y);
  });
  it('N10 PG-08 in T3: a manual break moves only that column', () => {
    const model = go(documentOf([entriesSection('m', 'Work', [entry('e1', 'One'), entry('e2', 'Two', [], true)]), listSection('l', 'Skills', [{ id: 'i1', lines: 1 }], null)], 'T3'));
    expect(model.pages).toHaveLength(2);
    expect(pageOfLine(model, lines(model).find(line => line.anchor?.entryId === 'e2')!)).toBe(1);
    expect(pageOfLine(model, lines(model).find(line => line.anchor?.itemId === 'i1')!)).toBe(0);
  });
  it('N11 ADR-010 §10: a manual break outranks keep-with-next, so a one-line entry is not pulled across it', () => {
    const model = go(documentOf([entriesSection('s', 'Work', [{ ...entry('e1', 'One'), organization: '', location: '', start: null, end: null }, entry('e2', 'Two', [], true)])]));
    const one = lines(model).find(line => line.anchor?.entryId === 'e1')!;
    const two = lines(model).find(line => line.anchor?.entryId === 'e2')!;
    expect(pageOfLine(model, one)).toBe(0);
    expect(pageOfLine(model, two)).toBe(1);
  });
  it('N12 PG-09: an item longer than a page breaks by lines, loses nothing, and raises a hint per page', () => {
    const items = [{ id: 'huge', lines: 90 }, { id: 'small', lines: 1 }];
    const model = go(documentOf([listSection('s', 'List', items, 2)]));
    expect(model.pages.length).toBeGreaterThan(1);
    const huge = lines(model).filter(line => line.anchor?.itemId === 'huge');
    expect(huge.map(text)).toEqual(Array.from({ length: 90 }, (_, index) => `huge ${index + 1}`));
    for (const page of model.pages) for (const line of page.lines) expect(line.y + line.height, text(line)).toBeLessThanOrEqual(page.height - 23 + 0.01);
    const hints = model.hints.filter(hint => hint.kind === 'oversized');
    expect(hints.length).toBeGreaterThanOrEqual(2);
    expect(new Set(hints.map(hint => hint.page)).size).toBe(hints.length);
    for (const hint of hints) { expect(hint.sectionId).toBe('s'); expect(hint.height).toBeGreaterThan(0); }
  });
  it('N13 FR-PRV-07: a lone title raises the safety-net hint; ordinary documents raise none', () => {
    for (const name of ['one-page', 'two-pages', 'four-pages', 'long-paragraph', 'long-bullet', 'many-rows', 'title-at-bottom']) expect(go(fixture(name)).hints, name).toEqual([]);
    // An entry section whose only entry has text that lays out to nothing is not empty to the model.
    const blank = entriesSection('s', 'Lonely', [{ ...entry('e1', ' '), organization: '', location: '', start: null, end: null }]);
    let raised = false;
    for (const count of SWEEP) {
      const model = go(documentOf([filler(count), blank]));
      const title = lines(model).find(line => line.anchor?.sectionId === 's' && line.role === 'sectionTitle')!;
      const page = model.pages[pageOfLine(model, title)]!;
      const last = page.lines.reduce((a, b) => a.y + a.height >= b.y + b.height ? a : b);
      const hint = model.hints.find(item => item.kind === 'lone-title');
      if (last === title) { raised = true; expect(hint?.sectionId, `filler ${count}`).toBe('s'); expect(hint?.page, `filler ${count}`).toBe(pageOfLine(model, title) + 1); }
    }
    expect(raised).toBe(true);
  });
  it('N14 entry dates wider than the column keep every line (no content loss)', () => {
    const dateText = Array.from({ length: 40 }, (_, index) => `date${index}`).join(' ');
    const model = go(documentOf([entriesSection('s', 'Work', [{ ...entry('e1', 'One'), dateText }])], 'T3'));
    const joined = lines(model).filter(line => line.role === 'entryDates').map(text).join(' ');
    for (let index = 0; index < 40; index++) expect(joined).toContain(`date${index}`);
    expect(lines(model).filter(line => line.role === 'entryDates').length).toBeGreaterThan(1);
  });
  it('N17 a long run has parts that rebuild its text at growing offsets inside its width; a short one has none (DD-P11-17)', () => {
    const model = go(fixture('long-paragraph'));
    const runs = lines(model).flatMap(line => line.runs);
    const long = runs.filter(item => item.text.length > 40);
    expect(long.length).toBeGreaterThan(10);
    for (const item of long) {
      expect(item.parts.length, item.text).toBeGreaterThan(1);
      expect(item.parts.map(part => part.text).join('')).toBe(item.text);
      expect(item.parts[0]!.x).toBe(0);
      for (let index = 1; index < item.parts.length; index++) {
        expect(item.parts[index]!.x).toBeGreaterThan(item.parts[index - 1]!.x);
        expect(item.parts[index]!.x).toBeLessThan(item.width);
      }
    }
    for (const item of runs.filter(entry => entry.text.length <= 32)) expect(item.parts).toEqual([]);
  });
  it('N15 regions: one box per section per page, in the column, and one for the header', () => {
    const model = go(fixture('four-pages'), true);
    const header = model.pages[0]!.regions.filter(region => region.sectionId === null);
    expect(header).toHaveLength(1);
    expect(header[0]!.y).toBeCloseTo(23, 3);
    for (const page of model.pages) {
      expect(new Set(page.regions.map(region => region.sectionId)).size).toBe(page.regions.length);
      for (const line of page.lines) {
        const region = page.regions.find(item => item.sectionId === (line.anchor?.sectionId ?? null))!;
        expect(region, text(line)).toBeDefined();
        expect(line.y).toBeGreaterThanOrEqual(region.y - 0.01);
        expect(line.y + line.height).toBeLessThanOrEqual(region.y + region.height + 0.01);
      }
    }
  });
  it('N16 anchorAt resolves a point to the entry or item under it (FR-PRV-08)', async () => {
    const { anchorAt } = await import('./regions');
    const model = go(documentOf([entriesSection('s', 'Work', [entry('e1', 'One', [paragraph(2, 'one')]), entry('e2', 'Two', [paragraph(2, 'two')])]), listSection('l', 'List', [{ id: 'i1', lines: 1 }, { id: 'i2', lines: 1 }], 1)]));
    const page = model.pages[0]!;
    const at = (needle: string) => { const line = page.lines.find(item => text(item).includes(needle))!; return anchorAt(page, line.x + 1, line.y + line.height / 2); };
    expect(at('one 1')).toMatchObject({ sectionId: 's', entryId: 'e1' });
    expect(at('two 2')).toMatchObject({ sectionId: 's', entryId: 'e2' });
    expect(at('i2 1')).toMatchObject({ sectionId: 'l', itemId: 'i2' });
    const between = page.lines.find(item => text(item).includes('two 1'))!;
    expect(anchorAt(page, between.x, between.y - 2)).toMatchObject({ sectionId: 's', entryId: 'e2' });
    expect(anchorAt(page, page.width - 1, page.height - 1)).toBeNull();
    expect(run('x').kind).toBe('text');
  });
});
