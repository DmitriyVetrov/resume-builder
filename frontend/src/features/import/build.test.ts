import { describe, expect, it } from 'vitest';
import { codePointLength } from '../../entities/resume/rich-text';
import { resetDesign } from '../../entities/resume/design-operations';
import { LIMITS, type ResumeDocument, type Section } from '../../entities/resume/operations';
import { isSafeUrl } from '../../entities/resume/safe-url';
import { buildDocument, type BuildContext } from './build';
import type { ImportDraft, ImportDraftEntry, ImportDraftSection } from './types';

/** IMP-01 D-01…D-12 (AC-IMP-05): the draft becomes a document through the existing operations. */
const context = (partial: Partial<BuildContext> = {}): BuildContext => ({ columns: 2, sidebarSide: 'left', warnings: [], droppedImages: 0, photo: false, basic: false, sourceCapped: false, ...partial });
const entry = (partial: Partial<ImportDraftEntry> = {}): ImportDraftEntry => ({ title: 'Platform Engineer', organization: 'Example Systems', location: 'Springfield', start: { year: 2024, month: null }, end: null, present: true, dateText: null, blocks: [], ...partial });
const section = (partial: Partial<ImportDraftSection>): ImportDraftSection => ({ title: 'Section', type: 'text', placement: 'main', blocks: [], items: [], entries: [], ...partial });
const draft = (partial: Partial<ImportDraft> = {}): ImportDraft => ({
  fullName: 'Alex Sample',
  headline: 'Platform Engineer',
  contacts: [{ text: 'alex.sample@example.com', kind: 'email' }, { text: 'example.com/alex', kind: 'link' }, { text: 'Work permit S', kind: 'other' }],
  language: 'en',
  sections: [
    section({ title: '', type: 'text', blocks: [{ kind: 'paragraph', text: 'Builds platforms <b>teams</b> enjoy.' }] }),
    section({ title: 'Work Experience', type: 'entries', entries: [entry({ blocks: [{ kind: 'bullet', text: 'Ran <a href="https://example.com/">example.com</a>.' }, { kind: 'bullet', text: 'Second.' }, { kind: 'paragraph', text: 'After.' }] })] }),
    section({ title: 'Languages', type: 'entries', placement: 'sidebar', entries: [entry({ title: 'English', organization: 'Native', location: null, start: null, present: false })] }),
    section({ title: 'Skills', type: 'list', placement: 'sidebar', items: ['Kubernetes', 'Terraform'] }),
  ],
  ...partial,
});
const build = (value: ImportDraft = draft(), extra: Partial<BuildContext> = {}) => buildDocument(value, context(extra));
const sectionOf = (document: ResumeDocument, title: string) => document.sections.find(item => item.title === title) as Section;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('draft → document', () => {
  it('D-01 header: name, headline, contacts with kinds and derived links', () => {
    const { header } = build().document;
    expect(header).toMatchObject({ fullName: 'Alex Sample', headline: 'Platform Engineer', showPhoto: true });
    expect(header.contacts.map(item => [item.text, item.kind, item.url])).toEqual([['alex.sample@example.com', 'email', null], ['example.com/alex', 'link', null], ['Work permit S', 'other', null]]);
    expect(header.contacts.every(item => UUID.test(item.id))).toBe(true);
  });

  it('D-02 sections in draft order; placement from the draft', () => {
    const { document } = build();
    expect(document.sections.map(item => [item.title, item.type, item.placement])).toEqual([['', 'text', 'main'], ['Work Experience', 'entries', 'main'], ['Languages', 'entries', 'sidebar'], ['Skills', 'list', 'sidebar']]);
  });

  it('D-03 text blocks become paragraphs; adjacent bullets join one list', () => {
    const summary = build().document.sections[0] as Extract<Section, { type: 'text' }>;
    expect(summary.content.body).toEqual([{ kind: 'paragraph', inlines: [{ kind: 'text', value: 'Builds platforms ', bold: false, italic: false, underline: false }, { kind: 'text', value: 'teams', bold: true, italic: false, underline: false }, { kind: 'text', value: ' enjoy.', bold: false, italic: false, underline: false }] }]);
    const work = sectionOf(build().document, 'Work Experience') as Extract<Section, { type: 'entries' }>;
    const description = work.content.entries[0]!.description;
    expect(description.map(block => block.kind)).toEqual(['bulletList', 'paragraph']);
    expect(description[0]).toMatchObject({ kind: 'bulletList', items: [[{ kind: 'text', value: 'Ran ' }, { kind: 'link', url: 'https://example.com/' }, { kind: 'text', value: '.' }], [{ kind: 'text', value: 'Second.' }]] });
  });

  it('D-04 list items', () => {
    const skills = sectionOf(build().document, 'Skills') as Extract<Section, { type: 'list' }>;
    expect(skills.content.items.map(item => item.text)).toEqual([[{ kind: 'text', value: 'Kubernetes', bold: false, italic: false, underline: false }], [{ kind: 'text', value: 'Terraform', bold: false, italic: false, underline: false }]]);
  });

  it('D-05 entries: title, organisation, location', () => {
    const work = sectionOf(build().document, 'Work Experience') as Extract<Section, { type: 'entries' }>;
    expect(work.content.entries[0]).toMatchObject({ title: 'Platform Engineer', organization: 'Example Systems', location: 'Springfield', dateText: '' });
    const languages = sectionOf(build().document, 'Languages') as Extract<Section, { type: 'entries' }>;
    expect(languages.content.entries[0]).toMatchObject({ title: 'English', organization: 'Native', location: '', start: null, end: null });
  });

  it('D-06 dates: year only, "Jan – May 2026", present', () => {
    const value = draft({ sections: [section({ title: 'Work', type: 'entries', entries: [entry(), entry({ start: { year: 2026, month: 1 }, end: { year: 2026, month: 5 }, present: false })] })] });
    const [first, second] = (build(value).document.sections[0] as Extract<Section, { type: 'entries' }>).content.entries;
    expect([first!.start, first!.end]).toEqual([{ kind: 'date', year: 2024, month: null }, { kind: 'present' }]);
    expect([second!.start, second!.end]).toEqual([{ kind: 'date', year: 2026, month: 1 }, { kind: 'date', year: 2026, month: 5 }]);
  });

  it('D-07 unparseable dates keep dateText and no structured dates', () => {
    const value = draft({ sections: [section({ title: 'Work', type: 'entries', entries: [entry({ start: null, end: null, present: false, dateText: 'Summers 2019 and 2020' })] })] });
    expect((build(value).document.sections[0] as Extract<Section, { type: 'entries' }>).content.entries[0]).toMatchObject({ start: null, end: null, dateText: 'Summers 2019 and 2020' });
  });

  it('D-08 limits: long strings are clamped and too many items cut, both listed', () => {
    const value = draft({ fullName: 'N'.repeat(130), sections: [section({ title: 'List', type: 'list', items: Array.from({ length: 105 }, (_, index) => `Item ${index}`) })] });
    const { document, report } = build(value);
    expect(codePointLength(document.header.fullName)).toBe(LIMITS.fullName);
    expect((document.sections[0] as Extract<Section, { type: 'list' }>).content.items).toHaveLength(LIMITS.items);
    expect(report.clamped).toContain('Name');
    expect(report.overLimit).toEqual(['Section 1 “List”: 5 items']);
  });

  it('D-09 template by layout; accent 0; language from the draft; title from the name', () => {
    expect(build(draft(), { sidebarSide: 'left' }).document).toMatchObject({ templateId: 'T4', accentPreset: 0, language: 'en', title: 'Alex Sample' });
    expect(build(draft(), { sidebarSide: 'right' }).document.templateId).toBe('T3');
    expect(build(draft(), { columns: 1, sidebarSide: null }).document.templateId).toBe('T1');
    expect(build(draft({ language: 'es' })).document.language).toBe('es');
    expect(build(draft({ language: null })).document.language).toBe('en');
  });

  it('D-10 sidebar entries get neutral form labels; main entries keep none', () => {
    const { document } = build();
    expect((sectionOf(document, 'Languages') as Extract<Section, { type: 'entries' }>).content.labels).toEqual({ title: 'Name', organization: 'Detail', location: null });
    expect((sectionOf(document, 'Work Experience') as Extract<Section, { type: 'entries' }>).content.labels).toBeNull();
  });

  it('D-11 the report: recognised counts, dropped images, not-in-source fields by readable name', () => {
    const { report } = build(draft(), { droppedImages: 2, photo: true, warnings: [{ code: 'not_in_source', pointer: '/sections/1/entries/0/organization' }, { code: 'not_in_source', pointer: '/headline' }] });
    expect(report).toMatchObject({ basic: false, recognised: { contacts: 3, sections: 4, entries: 2 }, droppedImages: 2, photo: true });
    expect(report.notInSource).toEqual(['Section 2 “Work Experience”, entry 1: organization', 'Headline']);
  });

  it('D-12 the result meets the contract: limits, UUIDs, non-empty runs and lists, safe links', () => {
    const { document } = build();
    const ids: string[] = [];
    const runs: { value: string }[] = [];
    const links: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!node || typeof node !== 'object') return;
      const record = node as Record<string, unknown>;
      if (typeof record.id === 'string') ids.push(record.id);
      if (record.kind === 'text') runs.push(record as { value: string });
      // An inline link; a contact of kind `link` has no children and its URL is derived at render time (D-01).
      if (record.kind === 'link' && 'children' in record) links.push(record.url as string);
      if (record.kind === 'bulletList') expect((record.items as unknown[]).length).toBeGreaterThan(0);
      Object.values(record).forEach(walk);
    };
    walk(document);
    expect(ids.every(id => UUID.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(runs.every(run => run.value.length > 0)).toBe(true);
    expect(links.every(isSafeUrl)).toBe(true);
    for (const item of document.sections) expect(codePointLength(item.title)).toBeLessThanOrEqual(LIMITS.sectionTitle);
    // DD-IMP-18: the design is the chosen template's defaults (resetDesign).
    expect(document).toEqual(resetDesign(document));
  });
});
