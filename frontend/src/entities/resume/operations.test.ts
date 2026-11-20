import { describe, expect, it } from 'vitest';
import { blankResumeDocument } from '.';
import { addSection, clampCodePoints, conversionOptions, convertSection, duplicateEntry, duplicateSection, isDateRangeInverted, isSectionEmpty, LIMITS, moveSection, moveWithin, newContact, newEntry, newListItem, newSection, removeSection, updateSection, type Section } from './operations';

const text = (value: string) => ({ kind: 'text' as const, value, bold: false, italic: false, underline: false });
const paragraph = (value: string) => ({ kind: 'paragraph' as const, inlines: value ? [text(value)] : [] });
const titles = (document: { sections: { title: string }[] }) => document.sections.map(section => section.title);

describe('document operations', () => {
  it('O01 builds a schema-shaped section for each type', () => {
    const shell = { hidden: false, listColumns: null, placement: null };
    expect(newSection('text', 'A')).toMatchObject({ ...shell, type: 'text', title: 'A', content: { body: [] } });
    expect(newSection('list', 'B')).toMatchObject({ ...shell, type: 'list', title: 'B', content: { items: [] } });
    expect(newSection('entries', 'C')).toMatchObject({ ...shell, type: 'entries', title: 'C', content: { labels: null, entries: [] } });
    expect(newSection('inline', 'D')).toMatchObject({ ...shell, type: 'inline', title: 'D', content: { body: [{ kind: 'paragraph', inlines: [] }] } });
    expect(newSection('text', '').id).toMatch(/^[0-9a-f-]{36}$/);
    expect(newSection('text', '').id).not.toBe(newSection('text', '').id);
    const entry = newEntry();
    expect(entry).toMatchObject({ title: '', organization: '', location: '', start: null, end: null, dateText: '', description: [], pageBreakBefore: false });
    expect(newContact()).toMatchObject({ text: '', url: null, kind: 'other' });
    expect(newListItem().text).toEqual([]);
  });

  it('O02 adds at the end and updates one section without touching the input', () => {
    const before = blankResumeDocument();
    const added = addSection(before, newSection('text', 'Interests'));
    expect(titles(added).at(-1)).toBe('Interests');
    expect(before.sections).toHaveLength(5);
    const id = before.sections[1]!.id;
    const renamed = updateSection(before, id, section => ({ ...section, title: 'New' }));
    expect(renamed.sections[1]!.title).toBe('New');
    expect(before.sections[1]!.title).toBe('Professional Experience');
    expect(renamed.sections[0]).toBe(before.sections[0]);
  });

  it('O03 moves a section to any position and clamps out-of-range targets', () => {
    const document = blankResumeDocument();
    const [a, b, c, d, e] = titles(document);
    const skills = document.sections[3]!.id;
    expect(titles(moveSection(document, skills, 0))).toEqual([d, a, b, c, e]);
    expect(titles(moveSection(document, skills, 4))).toEqual([a, b, c, e, d]);
    expect(titles(moveSection(document, skills, 99))).toEqual([a, b, c, e, d]);
    expect(titles(moveSection(document, skills, -1))).toEqual([d, a, b, c, e]);
    expect(moveWithin(['x', 'y', 'z'], 0, 2)).toEqual(['y', 'z', 'x']);
  });

  it('O04 removes one section and leaves the order', () => {
    const document = blankResumeDocument();
    const removed = removeSection(document, document.sections[2]!.id);
    expect(titles(removed)).toEqual(titles(document).filter((_, index) => index !== 2));
  });

  it('O05 duplicates right after the original with new IDs at every level', () => {
    const document = blankResumeDocument();
    const experience = document.sections[1]!;
    const filled = updateSection(document, experience.id, section => section.type === 'entries' ? { ...section, content: { ...section.content, entries: [{ ...newEntry(), title: 'Job' }] } } : section);
    const { document: copied, id } = duplicateSection(filled, experience.id);
    expect(copied.sections[2]!.id).toBe(id);
    expect(id).not.toBe(experience.id);
    const [original, copy] = [copied.sections[1]!, copied.sections[2]!];
    if (original.type !== 'entries' || copy.type !== 'entries') throw new Error('type');
    expect(copy.content.entries[0]!.title).toBe('Job');
    expect(copy.content.entries[0]!.id).not.toBe(original.content.entries[0]!.id);
    const list = { ...newSection('list', 'L'), content: { items: [newListItem()] } } as Section;
    const withList = addSection(document, list);
    const listCopy = duplicateSection(withList, list.id);
    const items = listCopy.document.sections.at(-1)!;
    if (items.type !== 'list' || list.type !== 'list') throw new Error('type');
    expect(items.content.items[0]!.id).not.toBe(list.content.items[0]!.id);
  });

  it('O06 duplicates an entry with a new ID and equal fields', () => {
    const entry = { ...newEntry(), title: 'Job', start: { kind: 'date' as const, year: 2020, month: 3 } };
    const copy = duplicateEntry(entry);
    expect(copy).toEqual({ ...entry, id: copy.id });
    expect(copy.id).not.toBe(entry.id);
  });

  it('O07 treats a section with no user content as empty', () => {
    const list = newSection('list', 'Skills');
    expect(isSectionEmpty(newSection('text', 'A'))).toBe(true);
    expect(isSectionEmpty(newSection('inline', 'A'))).toBe(true);
    expect(isSectionEmpty(newSection('entries', 'A'))).toBe(true);
    expect(isSectionEmpty(list)).toBe(true);
    expect(isSectionEmpty({ ...newSection('text', 'A'), content: { body: [paragraph(''), paragraph('')] } } as Section)).toBe(true);
    expect(isSectionEmpty({ ...newSection('text', 'A'), content: { body: [paragraph('x')] } } as Section)).toBe(false);
    expect(isSectionEmpty({ ...list, content: { items: [newListItem()] } } as Section)).toBe(true);
    expect(isSectionEmpty({ ...list, content: { items: [newListItem([text('Go')])] } } as Section)).toBe(false);
    expect(isSectionEmpty({ ...newSection('entries', 'A'), content: { labels: null, entries: [newEntry()] } } as Section)).toBe(true);
    expect(isSectionEmpty({ ...newSection('entries', 'A'), content: { labels: null, entries: [{ ...newEntry(), dateText: 'Summer' }] } } as Section)).toBe(false);
  });

  it.each([
    ['list', ['a', 'b'], 'text', true],
    ['list', ['a', 'b'], 'inline', false],
    ['list', ['a'], 'inline', true],
    ['text', ['a', 'b'], 'list', true],
    ['text', ['a', 'b'], 'inline', false],
    ['inline', ['a'], 'text', true],
    ['inline', ['a'], 'list', true],
  ] as const)('O08 %s with %j to %s allowed=%s', (from, lines, to, allowed) => {
    const section = from === 'list'
      ? { ...newSection('list', 'S'), content: { items: lines.map(line => newListItem([text(line)])) } } as Section
      : { ...newSection(from, 'S'), content: { body: lines.map(paragraph) } } as Section;
    const option = conversionOptions(section).find(candidate => candidate.type === to)!;
    expect(option.allowed).toBe(allowed);
    if (!allowed) { expect(option.reason).toBeTruthy(); expect(() => convertSection(section, to)).toThrow(); return; }
    const converted = convertSection(section, to);
    expect(converted).toMatchObject({ id: section.id, title: 'S', type: to });
    const plain = converted.type === 'list'
      ? converted.content.items.map(item => item.text.map(inline => inline.kind === 'text' ? inline.value : '').join(''))
      : converted.type === 'entries' ? [] : converted.content.body.flatMap(block => block.kind === 'paragraph' ? [block.inlines.map(inline => inline.kind === 'text' ? inline.value : '').join('')] : []);
    expect(plain).toEqual(lines);
  });

  it('O09 never converts entries and offers only other types; a line break blocks text to list', () => {
    const entries = conversionOptions(newSection('entries', 'E'));
    expect(entries.every(option => !option.allowed && option.reason)).toBe(true);
    const text2 = { ...newSection('text', 'S'), content: { body: [{ kind: 'paragraph', inlines: [text('a'), { kind: 'lineBreak' }, text('b')] }] } } as Section;
    expect(conversionOptions(text2).find(option => option.type === 'list')?.allowed).toBe(false);
    expect(conversionOptions(text2).map(option => option.type)).not.toContain('text');
    const bullets = { ...newSection('text', 'S'), content: { body: [paragraph('a'), { kind: 'bulletList', items: [[text('b')], [text('c')]] }] } } as Section;
    const list = convertSection(bullets, 'list');
    if (list.type !== 'list') throw new Error('type');
    expect(list.content.items).toHaveLength(3);
    expect(conversionOptions(newSection('text', 'S')).find(option => option.type === 'entries')?.allowed).toBe(false);
  });

  it('O10 clamps by code points, not UTF-16 units', () => {
    expect(clampCodePoints('😀😀😀', 2)).toEqual({ value: '😀😀', clamped: true });
    expect(clampCodePoints('😀😀', 2)).toEqual({ value: '😀😀', clamped: false });
    expect(clampCodePoints('abc', 3)).toEqual({ value: 'abc', clamped: false });
    expect(LIMITS.contacts).toBe(20);
  });

  it('O11 reports only a start after the end as inverted', () => {
    const date = (year: number, month: number | null) => ({ kind: 'date' as const, year, month });
    const at = (start: ReturnType<typeof date> | null, end: ReturnType<typeof date> | { kind: 'present' } | null) => isDateRangeInverted({ ...newEntry(), start, end });
    expect(at(date(2021, 1), date(2020, 1))).toBe(true);
    expect(at(date(2020, 5), date(2020, 4))).toBe(true);
    expect(at(date(2020, 4), date(2020, 4))).toBe(false);
    expect(at(date(2020, null), date(2020, 1))).toBe(false);
    expect(at(date(2020, 1), { kind: 'present' })).toBe(false);
    expect(at(null, date(2020, 1))).toBe(false);
  });
});
