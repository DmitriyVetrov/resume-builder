import { describe, expect, it } from 'vitest';
import { serializeTxt } from '../../entities/layout';
import { fixture } from '../../entities/layout/test-kit';
import { fallbackDraft } from './fallback';
import { analyze } from './layout';
import { extraction, textRun } from './test/pdfs';
import { analyzeTxt } from './txt';
import type { ImportDraft } from './types';

/** IMP-01 F-01…F-04, T-01: the deterministic fallback parser and own-TXT import (ADR-055 §5, DD-IMP-12). */
const cv = () => analyze(extraction([
  textRun('Alex Sample', 50, 60, { size: 22, bold: true }),
  textRun('Platform Engineer', 50, 85, { size: 13 }),
  textRun('alex.sample@example.com', 50, 105),
  textRun('+41 79 555 01 00', 50, 117),
  textRun('example.com/alex', 50, 129),
  textRun('Springfield', 50, 141),
  textRun('SUMMARY', 50, 170, { size: 11, bold: true }),
  textRun('Builds platforms that teams enjoy.', 50, 186),
  textRun('Skills', 50, 215, { size: 11, bold: true }),
  textRun('• Kubernetes', 50, 231),
  textRun('• Terraform', 50, 243),
]));
const strings = (draft: ImportDraft): string[] => [draft.fullName, draft.headline ?? '', ...draft.contacts.map(item => item.text), ...draft.sections.flatMap(section => [section.title, ...section.items, ...section.blocks.map(block => block.text)])];

describe('fallback parser', () => {
  it('F-01 the largest line is the name and the next distinct line the headline', () => {
    const draft = fallbackDraft(cv());
    expect(draft.fullName).toBe('Alex Sample');
    expect(draft.headline).toBe('Platform Engineer');
  });

  it('F-02 e-mail, phone and URL lines are contacts with kinds; other header lines too', () => {
    expect(fallbackDraft(cv()).contacts).toEqual([
      { text: 'alex.sample@example.com', kind: 'email' },
      { text: '+41 79 555 01 00', kind: 'phone' },
      { text: 'example.com/alex', kind: 'link' },
      { text: 'Springfield', kind: 'other' },
    ]);
  });

  it('F-03 headings by style become sections; bullets become a list; the rest text', () => {
    const { sections } = fallbackDraft(cv());
    expect(sections.map(section => [section.title, section.type, section.placement])).toEqual([['SUMMARY', 'text', 'main'], ['Skills', 'list', 'main']]);
    expect(sections[0]!.blocks).toEqual([{ kind: 'paragraph', text: 'Builds platforms that teams enjoy.' }]);
    expect(sections[1]!.items).toEqual(['Kubernetes', 'Terraform']);
    expect(sections.every(section => section.entries.length === 0)).toBe(true);
  });

  it('F-04 never invents: every output string occurs in the input', () => {
    const source = cv().blocks.map(block => block.plain).join('\n');
    for (const value of strings(fallbackDraft(cv())).filter(Boolean)) expect(source, value).toContain(value);
  });

  it('F-05 sidebar headings keep their column as placement', () => {
    const analysis = analyze(extraction([
      textRun('Alex Sample', 210, 60, { size: 22, bold: true }),
      textRun('WORK', 210, 130, { size: 11, bold: true }), ...Array.from({ length: 12 }, (_, index) => textRun(`Main line ${index}`, 210, 150 + index * 30)),
      textRun('SKILLS', 30, 150, { size: 8.5, bold: true }), ...Array.from({ length: 12 }, (_, index) => textRun(`Side ${index}`, 30, 170 + index * 30)),
    ]));
    expect(fallbackDraft(analysis).sections.map(section => [section.title, section.placement])).toEqual([['WORK', 'main'], ['SKILLS', 'sidebar']]);
  });
});

/** DD-IMP-27 (owner, ADR-055 Amendment 1): a section that starts with a "Title | Dates" row is an entries section. */
const experience = (rows: { text: string; x?: number; y: number; bold?: boolean; size?: number }[]) => analyze(extraction([
  textRun('Alex Sample', 50, 60, { size: 22, bold: true }),
  textRun('WORK EXPERIENCE', 50, 100, { size: 11, bold: true }),
  ...rows.map(row => textRun(row.text, row.x ?? 50, row.y, { bold: row.bold ?? false, size: row.size ?? 9 })),
]));
const jobs = () => experience([
  { text: '●', y: 120 },
  { text: 'Platform Engineer | 2024 – Present', x: 60, y: 120, bold: true },
  { text: 'Example Systems · Springfield', y: 134 },
  { text: 'Ran the platform for twelve teams.', y: 150 },
  { text: '• Cut build times in half.', y: 164 },
  { text: 'Site Reliability Engineer | Nov 2020 – Jun 2024', y: 190, bold: true },
  { text: 'Example Retail', y: 204 },
  { text: 'Kept the lights on.', y: 220 },
  { text: 'Intern | Jan – May 2019', y: 246, bold: true },
  { text: 'Wrote the first deploy script.', y: 260 },
]);
const entryStrings = (draft: ImportDraft): string[] => draft.sections.flatMap(section => section.entries.flatMap(entry => [entry.title, entry.organization, entry.location, entry.dateText, ...entry.blocks.map(block => block.text)])).filter((value): value is string => Boolean(value));

describe('fallback entries (DD-IMP-27)', () => {
  it('F-06 "Title | Dates" rows start entries; the next short row is the organization and the location; the rest the description', () => {
    const [section, ...rest] = fallbackDraft(jobs()).sections;
    expect(rest).toEqual([]);
    expect(section).toMatchObject({ title: 'WORK EXPERIENCE', type: 'entries', placement: 'main', blocks: [], items: [] });
    expect(section!.entries).toEqual([
      { title: 'Platform Engineer', organization: 'Example Systems', location: 'Springfield', start: { year: 2024, month: null }, end: null, present: true, dateText: null,
        blocks: [{ kind: 'paragraph', text: 'Ran the platform for twelve teams.' }, { kind: 'bullet', text: 'Cut build times in half.' }] },
      { title: 'Site Reliability Engineer', organization: 'Example Retail', location: null, start: { year: 2020, month: 11 }, end: { year: 2024, month: 6 }, present: false, dateText: null,
        blocks: [{ kind: 'paragraph', text: 'Kept the lights on.' }] },
      { title: 'Intern', organization: null, location: null, start: { year: 2019, month: 1 }, end: { year: 2019, month: 5 }, present: false, dateText: null,
        blocks: [{ kind: 'paragraph', text: 'Wrote the first deploy script.' }] },
    ]);
  });

  it('F-07 dates: years only, a single year, other languages, and unreadable dates kept as written', () => {
    const entries = (dates: string) => fallbackDraft(experience([{ text: `Engineer | ${dates}`, y: 120, bold: true }, { text: 'Did the work.', y: 134 }])).sections[0]!.entries;
    expect(entries('2017 – 2018')[0]).toMatchObject({ start: { year: 2017, month: null }, end: { year: 2018, month: null }, present: false, dateText: null });
    expect(entries('2019')[0]).toMatchObject({ start: { year: 2019, month: null }, end: null, present: false, dateText: null });
    expect(entries('ene. 2021 – Actualidad')[0]).toMatchObject({ start: { year: 2021, month: 1 }, end: null, present: true, dateText: null });
    expect(entries('Summer 2019 – Spring 2020')[0]).toMatchObject({ start: null, end: null, present: false, dateText: 'Summer 2019 – Spring 2020' });
  });

  it('F-08 an organization row with more than two parts stays whole; a row that ends a sentence is description', () => {
    const [first, second] = fallbackDraft(experience([
      { text: 'Engineer | 2020 – 2021', y: 120, bold: true },
      { text: 'Example Consulting · IT services · Client: Example Retail', y: 134 },
      { text: 'Analyst | 2018 – 2020', y: 160, bold: true },
      { text: 'Ran the reports.', y: 174 },
    ])).sections[0]!.entries;
    expect(first).toMatchObject({ organization: 'Example Consulting · IT services · Client: Example Retail', location: null, blocks: [] });
    expect(second).toMatchObject({ organization: null, blocks: [{ kind: 'paragraph', text: 'Ran the reports.' }] });
  });

  it('F-09 dates set right on the title row are the entry\'s dates', () => {
    const [entry] = fallbackDraft(experience([
      { text: 'Platform Engineer', y: 120, bold: true },
      { text: '2021 – Present', x: 450, y: 120 },
      { text: 'Example Systems · Springfield', y: 134 },
      { text: 'Ran the platform.', y: 150 },
    ])).sections[0]!.entries;
    expect(entry).toMatchObject({ title: 'Platform Engineer', organization: 'Example Systems', location: 'Springfield', start: { year: 2021, month: null }, present: true, blocks: [{ kind: 'paragraph', text: 'Ran the platform.' }] });
  });

  it('F-10 a section that does not start with an entry row stays text, and nothing is invented', () => {
    const text = fallbackDraft(experience([{ text: 'Worked as Engineer | 2020 – 2021 at a firm that did good work.', y: 120 }, { text: 'Engineer | 2020 – 2021', y: 140, bold: true }])).sections[0]!;
    expect(text).toMatchObject({ type: 'text', entries: [] });
    expect(text.blocks.map(block => block.text)).toEqual(['Worked as Engineer | 2020 – 2021 at a firm that did good work.', 'Engineer | 2020 – 2021']);
    const source = jobs().blocks.map(block => block.plain).join('\n');
    for (const value of entryStrings(fallbackDraft(jobs()))) expect(source, value).toContain(value);
  });
});

describe('own TXT (§9)', () => {
  it('T-01 the TXT export of a synthetic resume comes back with name, headline, contacts and section titles in order', () => {
    const document = fixture('one-page');
    const draft = fallbackDraft(analyzeTxt(serializeTxt(document)));
    expect(draft.fullName).toBe(document.header.fullName);
    expect(draft.headline).toBe(document.header.headline);
    expect(draft.contacts.map(item => item.text)).toEqual(document.header.contacts.map(item => item.text));
    const titles = document.sections.filter(section => !section.hidden && section.title).map(section => section.title.toLocaleUpperCase('en'));
    expect(draft.sections.map(section => section.title.toLocaleUpperCase('en'))).toEqual(titles);
  });
});
