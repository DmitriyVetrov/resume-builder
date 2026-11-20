// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ResumeDocument, Section } from '../resume/operations';
import { formatEntryDates } from '../resume/dates';
import { layout } from './engine';
import { lines as modelLines, testFonts, text as lineText } from './test-kit';
import { serializeTxt } from './txt';

const fixture = (name = 'one-page'): ResumeDocument => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../../../tests/fixtures/resumes/${name}.json`), 'utf8'));

describe('TXT serializer, §9', () => {
  it('T01 grammar: name, headline, contacts, blank line, sections as typed', () => {
    const lines = serializeTxt(fixture()).split('\n');
    expect(lines[0]).toBe('Lucía Ñáñez-Šťastná | Інженерка');
    expect(lines[1]).toBe('Go • PostgreSQL • Kubernetes • Azure');
    expect(lines[2]).toContain(' | ');
    expect(lines[2]).toContain('example.invalid/in/lucia (https://example.invalid/in/lucia)');
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('Resumen profesional');
    expect(lines[5]).toBe('');
  });
  it('T02 UTF-8 rules: no BOM, no tab, no CR, no trailing space, ends with one newline', () => {
    const text = serializeTxt(fixture());
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(text).not.toMatch(/[\t\r]/);
    expect(text).not.toMatch(/ +\n/);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });
  it('T03 hidden and empty sections are left out (FR-SEC-05, FR-SEC-07)', () => {
    const document = fixture();
    const text = serializeTxt({ ...document, sections: [{ ...document.sections[0]!, hidden: true }, { ...document.sections[1]!, content: { items: [] } }, ...document.sections.slice(2)] as ResumeDocument['sections'] });
    expect(text).not.toContain('Resumen profesional');
    expect(text).not.toContain('Що я вмію');
  });
  it('T04 ignores list columns and template (FR-SEC-11)', () => {
    const document = fixture();
    const other = { ...document, templateId: 'T3' as const, sections: document.sections.map(section => ({ ...section, listColumns: 1 })) as ResumeDocument['sections'] };
    expect(serializeTxt(other)).toBe(serializeTxt({ ...document, sections: document.sections.map(section => ({ ...section, listColumns: 1 })) as ResumeDocument['sections'] }));
    expect(serializeTxt(document)).toBe(serializeTxt({ ...document, sections: document.sections.map(section => ({ ...section, listColumns: 2 })) as ResumeDocument['sections'] }));
  });
  it('T05 entries use the same dates as the layout, and bullets use "- " (FR-TXT-02, §9)', () => {
    const document = fixture();
    const entries = document.sections[2]! as Extract<ResumeDocument['sections'][number], { type: 'entries' }>;
    const first = entries.content.entries[0]!;
    const text = serializeTxt(document);
    expect(text).toContain(`${first.title} — ${first.organization}\n${first.location} | ${formatEntryDates(first, 'es', 'MonthYearLong')}\n`);
    expect(text).toContain('- Rendimiento: redujo');
    expect(serializeTxt(fixture('two-pages'))).toContain('Published the on-call runbook (https://example.invalid/runbook) and trained');
  });

  const golden = (name: string) => readFileSync(resolve(import.meta.dirname, `../../../../tests/fixtures/txt/${name}.txt`), 'utf8');
  const FIXTURES = ['one-page', 'two-pages', 'four-pages', 'minimal', 'title-at-bottom', 'long-paragraph', 'long-bullet', 'many-rows', 'manual-break', 'oversized', 'rich-marks', 'contacts-heavy'];
  const plain = (value: string) => ({ kind: 'text' as const, value, bold: false, italic: false, underline: false });
  const para = (value: string) => ({ kind: 'paragraph' as const, inlines: [plain(value)] });
  const shell = { hidden: false, listColumns: null, placement: null };
  const withContacts = (...contacts: { text: string; url: string | null }[]): ResumeDocument => {
    const document = fixture('minimal');
    return { ...document, sections: [], header: { ...document.header, headline: 'Headline', contacts: contacts.map((contact, index) => ({ id: `id-${index}`, kind: 'other' as const, ...contact })) } } as ResumeDocument;
  };
  const contactLine = (document: ResumeDocument) => serializeTxt(document).split('\n')[2];
  const named = (sections: unknown[]): ResumeDocument => ({ ...fixture('minimal'), sections, header: { ...fixture('minimal').header, headline: '', contacts: [] } }) as ResumeDocument;

  it('T06 reproduces the example of §9.4 byte for byte', () => {
    expect(serializeTxt(fixture('reference-cv'))).toBe(golden('reference-cv'));
  });
  it('T07 all twelve fixtures equal their goldens', () => {
    for (const name of FIXTURES) expect(serializeTxt(fixture(name)), name).toBe(golden(name));
  });
  it('T08 contacts: a derived address is hidden, a chosen URL, a link and a handle follow §9.3 and FR-HDR-04', () => {
    expect(contactLine(withContacts({ text: 'a@example.invalid', url: null }))).toBe('a@example.invalid');
    expect(contactLine(withContacts({ text: '+34 600 000 000', url: null }))).toBe('+34 600 000 000');
    expect(contactLine(withContacts({ text: 'Email me', url: 'mailto:a@example.invalid' }))).toBe('Email me (mailto:a@example.invalid)');
    expect(contactLine(withContacts({ text: 'Portfolio', url: 'https://example.invalid/p' }))).toBe('Portfolio (https://example.invalid/p)');
    expect(contactLine(withContacts({ text: 'example.invalid/me', url: null }))).toBe('example.invalid/me (https://example.invalid/me)');
    expect(contactLine(withContacts({ text: 'https://example.invalid/me', url: null }))).toBe('https://example.invalid/me');
    expect(contactLine(withContacts({ text: '@handle', url: null }))).toBe('@handle');
    expect(contactLine(withContacts({ text: 'Bad', url: 'javascript:alert(1)' }))).toBe('Bad');
    expect(contactLine(withContacts({ text: 'one', url: null }, { text: 'two', url: null }))).toBe('one | two');
  });
  it('T09 empty items, entries and whitespace-only blocks print nothing', () => {
    const emptyEntry = { id: 'e0', title: '', organization: '', location: '', start: null, end: null, dateText: '', description: [], pageBreakBefore: false };
    const realEntry = { ...emptyEntry, id: 'e1', title: 'Job' };
    const output = serializeTxt(named([
      { ...shell, id: 's1', type: 'list', title: 'List', content: { items: [{ id: 'i1', text: [plain('kept')] }, { id: 'i2', text: [] }, { id: 'i3', text: [plain('   ')] }] } },
      { ...shell, id: 's2', type: 'entries', title: 'Entries', content: { labels: null, entries: [emptyEntry, realEntry, emptyEntry] } },
      { ...shell, id: 's3', type: 'text', title: 'Text', content: { body: [para('one'), para('   '), para('two')] } },
    ]));
    expect(output).toBe(`${fixture('minimal').header.fullName}\n\nList\n\n- kept\n\nEntries\n\nJob\n\nText\n\none\n\ntwo\n`);
  });
  it('T10 a blank section title prints no title line', () => {
    const output = serializeTxt(named([{ ...shell, id: 's1', type: 'text', title: '', content: { body: [para('body')] } }]));
    expect(output).toBe(`${fixture('minimal').header.fullName}\n\nbody\n`);
  });
  it('T11 normalizes blank runs, carriage returns and tabs (§9.1)', () => {
    const breaks = { kind: 'lineBreak' as const };
    const output = serializeTxt(named([{ ...shell, id: 's1', type: 'text', title: 'T', content: { body: [{ kind: 'paragraph', inlines: [plain('a'), breaks, breaks, breaks, plain('b\tc\r\nd\re  ')] }] } }]));
    expect(output).toBe(`${fixture('minimal').header.fullName}\n\nT\n\na\n\nb c\nd\ne\n`);
  });
  it('T12 the crlf option changes every line ending and nothing else (FR-TXT-05)', () => {
    const document = fixture('reference-cv');
    const lf = serializeTxt(document);
    const crlf = serializeTxt(document, { lineEnding: 'crlf' });
    expect(crlf).toBe(lf.replaceAll('\n', '\r\n'));
    expect(crlf).not.toMatch(/(^|[^\r])\n/);
    expect(serializeTxt(document, { lineEnding: 'lf' })).toBe(lf);
  });
  it('T13 keeps the typed case on every template, where the layout may not (FR-TXT-07)', () => {
    const fonts = testFonts();
    for (const templateId of ['T1', 'T2', 'T3'] as const) {
      const document = { ...named([{ ...shell, id: 's1', type: 'text', title: 'Tech Stack', content: { body: [para('body')] } }]), templateId };
      expect(serializeTxt(document).split('\n')[2]).toBe('Tech Stack');
      expect(modelLines(layout(document, fonts, { photo: false, engineVersion: 'test' })).map(lineText)).toContain('TECH STACK');
    }
  });
  it('T14 no section is lost: every visible non-empty section appears, in document order (FR-TXT-02, FR-TXT-03)', () => {
    for (const name of [...FIXTURES, 'reference-cv']) {
      const document = fixture(name);
      const output = serializeTxt(document);
      let from = 0;
      for (const section of document.sections as Section[]) {
        const at = output.indexOf(`\n${section.title}\n`, from);
        expect(at, `${name}: ${section.title}`).toBeGreaterThanOrEqual(from);
        from = at + 1;
      }
    }
  });
  it('T15 inline rules of §9.3: marks drop, a link equal to its text prints once', () => {
    const link = (url: string, value: string) => ({ kind: 'link' as const, url, children: [{ ...plain(value), bold: true }] });
    const output = serializeTxt(named([{ ...shell, id: 's1', type: 'inline', title: 'T', content: { body: [{ kind: 'paragraph', inlines: [{ ...plain('bold'), bold: true, italic: true, underline: true }, plain(' '), link('https://example.invalid/a', 'text'), plain(' '), link('https://example.invalid/b', 'https://example.invalid/b'), plain(' '), link('javascript:alert(1)', 'unsafe')] }] } }]));
    expect(output.split('\n')[4]).toBe('bold text (https://example.invalid/a) https://example.invalid/b unsafe');
  });
});
