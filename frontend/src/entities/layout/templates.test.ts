// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import type { ResumeDocument, Section } from '../resume/operations';
import { definitionOf, resolveDesign } from '../template';
import { ICON_PATHS } from './icons';
import { canonicalHash, type FontBook, type Line, type PageModel } from './index';
import { switchTemplate } from '../resume/design-operations';
import { documentOf, entriesSection, entry, fixture, lines, listSection, paragraph, run, run_, testFonts, text, textSection } from './test-kit';

let fonts: FontBook;
beforeAll(() => { fonts = testFonts(); });
const go = (document: ResumeDocument, photo = false) => run_(document, fonts, photo);
const contacts: ResumeDocument['header']['contacts'] = [
  { id: 'a', text: 'person@example.invalid', url: null, kind: 'email' },
  { id: 'b', text: '+34 600 000 000', url: null, kind: 'phone' },
  { id: 'c', text: 'Valencia', url: null, kind: 'location' },
  { id: 'd', text: 'example.invalid/in/person', url: 'https://example.invalid/in/person', kind: 'link' },
  { id: 'e', text: 'Open to work', url: null, kind: 'other' },
];
const withContacts = (document: ResumeDocument, list = contacts) => ({ ...document, header: { ...document.header, contacts: list } });
const role = (model: PageModel, name: Line['role']) => lines(model).filter(line => line.role === name);
const chipsOf = (model: PageModel) => model.pages.flatMap(page => page.shapes.filter(shape => shape.role === 'chip'));

describe('T2 Compact (ADR-024, §7)', () => {
  it('X01 contacts are chips with one icon per kind, the text inside the padding', () => {
    const model = go(withContacts(documentOf([], 'T2')));
    const page = model.pages[0]!;
    const chips = chipsOf(model);
    expect(chips).toHaveLength(5);
    expect(page.icons.map(icon => icon.kind)).toEqual(['email', 'phone', 'location', 'link', 'other']);
    const accent = resolveDesign(documentOf([], 'T2')).accent;
    for (const icon of page.icons) { expect(icon.size).toBe(9); expect(icon.color).toBe(accent); }
    const texts = role(model, 'contact');
    expect(texts.map(text)).toEqual(contacts.map(item => item.text));
    texts.forEach((line, index) => {
      const chip = chips[index]!;
      expect(chip).toMatchObject({ fill: '#E9EDF1', radius: 4 });
      expect(line.x).toBeCloseTo(chip.x + 6 + 9 + 3, 3);
      expect(line.x + line.width).toBeLessThanOrEqual(chip.x + chip.width - 6 + 0.01);
      expect(line.y).toBeCloseTo(chip.y + 3, 3);
    });
    expect(go(withContacts(documentOf([], 'T1'))).pages[0]!.icons).toEqual([]);
    expect(go(withContacts(documentOf([], 'T3'))).pages[0]!.icons).toEqual([]);
  });
  it('X02 a contact with no text is left out, and an unsafe URL is no link, on every template', () => {
    for (const templateId of ['T1', 'T2', 'T3'] as const) {
      const model = go(withContacts(documentOf([], templateId), [{ id: 'x', text: '', url: 'https://example.invalid', kind: 'link' }, { id: 'y', text: 'click', url: 'javascript:alert(1)', kind: 'link' }]));
      expect(role(model, 'contact').map(text), templateId).toEqual(['click']);
      expect(model.pages[0]!.links, templateId).toEqual([]);
    }
  });
  it('X03 list items are chips by default and keep rich text, with no marker', () => {
    const skills = { ...listSection('l', 'Skills', [], null), content: { items: [{ id: 'i1', text: [run('Go', { bold: true }), run(' lang')] }, { id: 'i2', text: [run('SQL')] }] } } as unknown as Section;
    const model = go(documentOf([skills], 'T2'));
    expect(chipsOf(model)).toHaveLength(2);
    expect(model.pages[0]!.shapes.filter(shape => shape.role === 'marker')).toEqual([]);
    const first = role(model, 'listItem')[0]!;
    expect(text(first)).toBe('Go lang');
    expect(first.runs[0]!.face).toBe('ibm-plex-sans/bold');
    expect(first.anchor).toMatchObject({ sectionId: 'l', itemId: 'i1' });
  });
  it('X04 chips wrap to a new row with the gap, and an explicit column count gives bullets', () => {
    const many = Array.from({ length: 40 }, (_, index) => ({ id: `i${index}`, lines: 1 }));
    const model = go(documentOf([listSection('l', 'Skills', many, null)], 'T2'));
    const chips = chipsOf(model);
    const rows = [...new Set(chips.map(chip => chip.y))];
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[1]! - rows[0]!).toBeCloseTo(chips[0]!.height + 4, 3);
    const inRow = chips.filter(chip => chip.y === rows[0]);
    expect(inRow[1]!.x - (inRow[0]!.x + inRow[0]!.width)).toBeCloseTo(4, 3);
    for (const chip of chips) expect(chip.x + chip.width).toBeLessThanOrEqual(595 - 23 + 0.01);
    for (const columns of [1, 2] as const) {
      const bullets = go(documentOf([listSection('l', 'Skills', many.slice(0, 4), columns)], 'T2'));
      expect(chipsOf(bullets), String(columns)).toEqual([]);
      expect(bullets.pages[0]!.shapes.filter(shape => shape.role === 'marker')).toHaveLength(4);
    }
  });
  it('X05 an accent rule under the header, no timeline, and no photo while showPhoto stays', () => {
    const document = withContacts(documentOf([entriesSection('s', 'Work', [entry('e1', 'One'), entry('e2', 'Two')])], 'T2'));
    const model = go(document, true);
    const page = model.pages[0]!;
    const rule = page.shapes.find(shape => shape.role === 'rule')!;
    expect(rule).toMatchObject({ fill: resolveDesign(document).accent, height: 1 });
    expect(rule.y).toBeGreaterThanOrEqual(Math.max(...role(model, 'contact').map(line => line.y + line.height)));
    expect(rule.y).toBeLessThan(role(model, 'sectionTitle')[0]!.y);
    expect(page.shapes.filter(shape => shape.role === 'timeline' || shape.role === 'dot')).toEqual([]);
    expect(page.images).toEqual([]);
    expect(document.header.showPhoto).toBe(false);
    expect(go({ ...document, header: { ...document.header, showPhoto: true } }, true).pages[0]!.images).toEqual([]);
  });
});

describe('T3 Sidebar (ADR-024, ADR-025, §7)', () => {
  const t3 = (sections: Section[] = []) => withContacts(documentOf(sections, 'T3'));
  it('X06 a full-bleed band on page 1 only, white text, white links, no underline', () => {
    const long = textSection('s', 'Long', [paragraph(120)]);
    const document = t3([long]);
    const model = go(document);
    expect(model.pages.length).toBeGreaterThan(1);
    const band = model.pages[0]!.shapes.find(shape => shape.role === 'band')!;
    expect(band).toMatchObject({ x: 0, y: 0, width: 595, fill: resolveDesign(document).accent });
    for (const page of model.pages.slice(1)) expect(page.shapes.filter(shape => shape.role === 'band')).toEqual([]);
    const name = role(model, 'name')[0]!;
    expect(name.y).toBeCloseTo(18, 3);
    expect(band.height).toBeCloseTo(18 * 2 + (role(model, 'contact').at(-1)!.y + role(model, 'contact').at(-1)!.height - 18), 3);
    for (const line of [...role(model, 'name'), ...role(model, 'headline'), ...role(model, 'contact')]) for (const item of line.runs) { expect(item.color).toBe('#FFFFFF'); expect(item.underline).toBe(false); }
    expect(model.pages[0]!.links.map(link => link.url)).toContain('https://example.invalid/in/person');
    expect(model.pages[0]!.shapes.filter(shape => shape.role === 'separator').every(shape => shape.fill === '#FFFFFF')).toBe(true);
    const continuation = model.pages[1]!.lines[0]!;
    expect(continuation.y).toBeCloseTo(23 + 8, 3);
    expect(model.pages[0]!.regions.find(region => region.sectionId === null)).toMatchObject({ x: 0, y: 0, width: 595 });
  });
  it('X07 a round 64 pt photo at the left inside the band; without it, the text starts at the margin', () => {
    const document = t3();
    const withPhoto = go({ ...document, header: { ...document.header, showPhoto: true } }, true);
    const image = withPhoto.pages[0]!.images[0]!;
    const band = withPhoto.pages[0]!.shapes.find(shape => shape.role === 'band')!;
    expect(image).toMatchObject({ x: 23, width: 64, height: 64, radius: 32 });
    expect(image.y).toBeGreaterThanOrEqual(18 - 0.01);
    expect(image.y + 64).toBeLessThanOrEqual(band.height - 18 + 0.01);
    expect(role(withPhoto, 'name')[0]!.x).toBeCloseTo(23 + 64 + 16, 3);
    const none = go(document, false);
    expect(none.pages[0]!.images).toEqual([]);
    expect(role(none, 'name')[0]!.x).toBeCloseTo(23, 3);
  });
  it('X08 zones: widths per DD-P11-03, defaults by type, an override wins, document order per column', () => {
    const sections = [
      textSection('t1', 'Summary', [paragraph(2)]),
      listSection('l1', 'Skills', [{ id: 'a', lines: 1 }], null),
      entriesSection('e1', 'Work', [entry('w1', 'One')]),
      { ...listSection('l2', 'Tools', [{ id: 'b', lines: 1 }], null), placement: 'main' } as Section,
      { ...textSection('t2', 'Notes', [paragraph(2)]), placement: 'sidebar' } as Section,
    ];
    const model = go(t3(sections));
    const xOf = (id: string) => role(model, 'sectionTitle').find(line => line.anchor?.sectionId === id)!.x;
    const mainWidth = 0.64 * 549;
    const sidebarX = 23 + mainWidth + 16;
    for (const id of ['t1', 'e1', 'l2']) expect(xOf(id), id).toBeCloseTo(23, 3);
    for (const id of ['l1', 't2']) expect(xOf(id), id).toBeCloseTo(sidebarX, 3);
    const order = (x: number) => role(model, 'sectionTitle').filter(line => Math.abs(line.x - x) < 0.01).sort((a, b) => a.y - b.y).map(line => line.anchor?.sectionId);
    expect(order(23)).toEqual(['t1', 'e1', 'l2']);
    expect(order(sidebarX)).toEqual(['l1', 't2']);
    const band = model.pages[0]!.shapes.find(shape => shape.role === 'band')!;
    const firstMain = role(model, 'sectionTitle').find(line => line.anchor?.sectionId === 't1')!;
    const firstSide = role(model, 'sectionTitle').find(line => line.anchor?.sectionId === 'l1')!;
    expect(firstMain.y).toBeCloseTo(band.height + 20, 3);
    expect(firstSide.y).toBeCloseTo(firstMain.y, 3);
    for (const line of lines(model)) if (line.anchor?.sectionId && Math.abs(line.x - 23) < mainWidth && xOf('t1') === 23 && line.x < sidebarX - 16) expect(line.x + line.width).toBeLessThanOrEqual(23 + mainWidth + 0.01);
    for (const line of lines(model).filter(item => item.x >= sidebarX)) expect(line.x + line.width).toBeLessThanOrEqual(595 - 23 + 0.01);
  });
  it('X09 T1 and T2 keep one flow, ignore placement, and the field stays stored', () => {
    const sections = [{ ...listSection('l', 'Skills', [{ id: 'a', lines: 1 }], 1), placement: 'sidebar' } as Section, textSection('t', 'Text', [paragraph(1)])];
    for (const templateId of ['T1', 'T2'] as const) {
      const document = documentOf(sections, templateId);
      const model = go(document);
      const titles = role(model, 'sectionTitle');
      expect(titles.map(line => line.anchor?.sectionId), templateId).toEqual(['l', 't']);
      expect(new Set(titles.map(line => line.x)).size, templateId).toBe(1);
      expect((document.sections[0] as Section).placement).toBe('sidebar');
    }
    const document = documentOf(sections);
    expect(canonicalHash(go(switchTemplate(switchTemplate(document, 'T3'), 'T1')))).toBe(canonicalHash(go(document)));
  });
  it('X10 columns paginate on their own and share pages', () => {
    const model = go(t3([textSection('main', 'Main', [paragraph(150, 'm')]), listSection('side', 'Side', Array.from({ length: 5 }, (_, index) => ({ id: `s${index}`, lines: 1 })), null)]));
    expect(model.pages.length).toBeGreaterThan(2);
    const sideLines = lines(model).filter(line => line.anchor?.sectionId === 'side');
    expect(sideLines.every(line => model.pages[0]!.lines.includes(line))).toBe(true);
    const reverse = go(t3([{ ...textSection('side', 'Side', [paragraph(150, 's')]), placement: 'sidebar' } as Section, textSection('main', 'Main', [paragraph(2, 'm')])]));
    expect(reverse.pages.length).toBeGreaterThan(1);
    expect(reverse.pages.at(-1)!.lines.every(line => line.anchor?.sectionId === 'side')).toBe(true);
  });
});

describe('roles and rules on every template', () => {
  it('X11 colour roles: only the roles change', () => {
    for (const templateId of ['T1', 'T2', 'T3'] as const) {
      const base = withContacts(documentOf([textSection('t', 'Text', [paragraph(2)])], templateId));
      const definition = definitionOf(templateId);
      const painted = (accentPreset: 0 | 1) => { const model = go({ ...base, accentPreset }); return lines(model).filter(line => line.role === 'body').flatMap(line => line.runs.map(item => item.color)); };
      expect(new Set([...painted(0), ...painted(1)]), templateId).toEqual(new Set(['#050505']));
      const titleColor = (accentPreset: 0 | 1) => role(go({ ...base, accentPreset }), 'sectionTitle')[0]!.runs[0]!.color;
      if (definition.styles.sectionTitle.color === 'accent') expect(titleColor(0)).not.toBe(titleColor(1));
      else expect(titleColor(0)).toBe(titleColor(1));
    }
  });
  it('X12 dates follow the language and the format, and a text override wins', () => {
    const entries = [entry('e', 'Job')];
    const at = (language: ResumeDocument['language'], dateFormat: ResumeDocument['dateFormat'], override = '') => {
      const document = { ...documentOf([entriesSection('s', 'Work', override ? [{ ...entries[0]!, dateText: override }] : entries)]), language, dateFormat };
      return text(role(go(document), 'entryDates')[0]!);
    };
    expect(at('uk', 'MonthYearLong')).toBe('січень 2020 - дотепер');
    expect(at('es', 'YearOnly')).toBe('2020 - Actualidad');
    expect(at('en', 'Numeric')).toBe('01/2020 - Present');
    expect(at('en', 'Numeric', 'Summer 2020')).toBe('Summer 2020');
  });
  it('X13 list columns: explicit wins, null follows the type and the template', () => {
    const items = Array.from({ length: 4 }, (_, index) => ({ id: `i${index}`, lines: 1 }));
    const columnsOf = (templateId: ResumeDocument['templateId'], listColumns: 1 | 2 | null) => new Set(role(go(documentOf([{ ...listSection('l', 'List', items, listColumns) }], templateId)), templateId === 'T1' && listColumns !== 1 ? 'listItem' : listColumns === 2 ? 'listItem' : definitionOf(templateId).list.oneColumnStyle).map(line => line.x)).size;
    expect(columnsOf('T1', null)).toBe(2);
    expect(columnsOf('T1', 1)).toBe(1);
    expect(columnsOf('T3', null)).toBe(1);
    expect(columnsOf('T3', 2)).toBe(2);
    expect(columnsOf('T2', 2)).toBe(2);
  });
  it('X14 entry bullets follow the section value; a text section stays in one column by default', () => {
    const bullets = { kind: 'bulletList', items: [[run('a1')], [run('a2')], [run('a3')], [run('a4')]] };
    const cells = (document: ResumeDocument) => new Set(role(go(document), 'body').map(line => line.x)).size;
    expect(cells(documentOf([entriesSection('s', 'Work', [entry('e', 'Job', [bullets])])]))).toBe(2);
    expect(cells(documentOf([entriesSection('s', 'Work', [entry('e', 'Job', [bullets])], 1)]))).toBe(1);
    expect(cells(documentOf([entriesSection('s', 'Work', [entry('e', 'Job', [bullets])])], 'T2'))).toBe(1);
    expect(cells(documentOf([entriesSection('s', 'Work', [entry('e', 'Job', [bullets])], 2)], 'T2'))).toBe(2);
    expect(cells(documentOf([textSection('t', 'Text', [bullets])]))).toBe(1);
  });
  it('X15 a link has the link colour and no default underline; a user underline stays (ADR-030)', () => {
    const body = [{ kind: 'paragraph', inlines: [{ kind: 'link', url: 'https://example.invalid/a', children: [run('plain'), run('under', { underline: true })] }] }];
    for (const templateId of ['T1', 'T2', 'T3'] as const) {
      const document = documentOf([textSection('t', 'Text', body)], templateId);
      const model = go(document);
      const runs = lines(model).flatMap(line => line.runs).filter(item => item.link);
      expect(runs.map(item => [item.text, item.underline]), templateId).toEqual([['plain', false], ['under', true]]);
      for (const item of runs) expect(item.color).toBe(resolveDesign(document).link.color);
      expect(model.pages[0]!.links.map(link => link.url)).toEqual(['https://example.invalid/a', 'https://example.invalid/a']);
    }
  });
  it('X16 icon paths use only M, L, C and Z, so the PDF writer needs no trigonometry (DD-P11-16)', () => {
    for (const [kind, path] of Object.entries(ICON_PATHS)) {
      expect(path, kind).not.toBe('');
      expect(path, kind).toMatch(/^[MLCZ0-9 .,-]+$/);
    }
  });
  it('X17 hidden and empty sections never reach any template', () => {
    for (const templateId of ['T1', 'T2', 'T3'] as const) {
      const model = go(documentOf([{ ...textSection('h', 'Hidden', [paragraph(1)]), hidden: true } as Section, textSection('e', 'Empty', []), textSection('v', 'Visible', [paragraph(1)])], templateId));
      expect(role(model, 'sectionTitle').map(line => line.anchor?.sectionId), templateId).toEqual(['v']);
    }
  });
  it('X18 fixtures keep every line inside the page on every template', () => {
    for (const name of ['four-pages', 'long-bullet', 'many-rows', 'oversized', 'contacts-heavy', 'rich-marks', 'manual-break']) for (const templateId of ['T1', 'T2', 'T3'] as const) {
      const model = go({ ...fixture(name), templateId });
      for (const page of model.pages) for (const line of page.lines) {
        expect(line.y + line.height, `${name} ${templateId} ${text(line)}`).toBeLessThanOrEqual(page.height - 23 + 0.01);
        expect(line.x + line.width, `${name} ${templateId} ${text(line)}`).toBeLessThanOrEqual(page.width - 23 + 0.01);
      }
    }
  });
});

describe('a header longer than a page (PG-09 over PG-06, ADR-010 §10)', () => {
  it('X20 T3: every contact stays on a piece of the band, nothing passes the page, and a hint is raised', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ id: `c${index}`, text: `${'contact text '.repeat(14)}${index}`, url: null, kind: 'other' as const }));
    const base = documentOf([textSection('t', 'Text', [paragraph(2)])], 'T3');
    const document = { ...base, layout: { ...base.layout, fontPreset: 'L' as const, lineSpacing: 20 }, header: { ...base.header, contacts: many } };
    const model = go(document);
    expect(model.pages.length).toBeGreaterThan(1);
    expect(role(model, 'contact').length).toBeGreaterThan(20);
    for (const page of model.pages) {
      for (const line of page.lines.filter(item => item.role === 'contact')) {
        expect(line.y + line.height, text(line)).toBeLessThanOrEqual(page.height + 0.01);
        const bands = page.shapes.filter(shape => shape.role === 'band');
        expect(bands.some(band => band.y <= line.y + 0.01 && band.y + band.height >= line.y + line.height - 0.01), `page ${page.number} ${text(line)}`).toBe(true);
      }
    }
    expect(model.hints.filter(hint => hint.kind === 'oversized' && hint.sectionId === null).length).toBeGreaterThanOrEqual(1);
  });
});

describe('margins', () => {
  it('X19 four different margins are all honoured (FR-LAY-06, DD-P10-07)', () => {
    const margins = { top: 11, right: 42, bottom: 33, left: 24 };
    const document = { ...fixture('many-rows'), layout: { ...fixture('many-rows').layout, margins } };
    const model = run_(document, fonts, false);
    expect(model.pages.length).toBeGreaterThan(1);
    expect(Math.min(...model.pages[0]!.lines.map(line => line.y))).toBeCloseTo(11, 3);
    for (const page of model.pages) for (const line of page.lines) {
      expect(line.x).toBeGreaterThanOrEqual(24 - 0.01);
      expect(line.x + line.width).toBeLessThanOrEqual(595 - 42 + 0.01);
      expect(line.y + line.height).toBeLessThanOrEqual(842 - 33 + 0.01);
    }
  });
});
