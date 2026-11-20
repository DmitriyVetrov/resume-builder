import { describe, expect, it } from 'vitest';
import { blankResumeDocument, copyTitle, TITLE_LIMIT, titleLength, type ResumeDocument } from '.';

describe('B01 blank resume (ADR-018)', () => {
  it('has the FR-SEC-01 set in order with the T1 defaults', () => {
    const document: ResumeDocument = blankResumeDocument();
    expect({ ...document, sections: [] }).toEqual({
      title: 'Untitled resume',
      templateId: 'T1',
      accentPreset: 0,
      language: 'en',
      dateFormat: 'MonthYearLong',
      layout: { fontPreset: 'M', sectionSpacing: 10, entrySpacing: 10, lineSpacing: 1, pageSize: 'A4', margins: { top: 23, right: 23, bottom: 23, left: 23 }, bodyFont: null },
      header: { fullName: '', headline: '', showPhoto: true, contacts: [] },
      sections: [],
    });
    expect(document.sections.map(section => [section.title, section.type])).toEqual([
      ['Professional Summary', 'text'],
      ['Professional Experience', 'entries'],
      ['Education', 'entries'],
      ['Skills', 'list'],
      ['Languages', 'inline'],
    ]);
    for (const section of document.sections) {
      expect(section.hidden).toBe(false);
      expect(section.listColumns).toBeNull();
      expect(section.placement).toBeNull();
    }
  });
  it('holds empty content, the Education labels and fresh unique IDs', () => {
    const [summary, experience, education, skills, languages] = blankResumeDocument().sections;
    expect(summary).toMatchObject({ content: { body: [] } });
    expect(experience).toMatchObject({ content: { labels: { title: 'Role', organization: 'Organization', location: 'Location' }, entries: [] } });
    expect(education).toMatchObject({ content: { labels: { title: 'Degree', organization: 'Institution', location: null }, entries: [] } });
    expect(skills).toMatchObject({ content: { items: [] } });
    expect(languages).toMatchObject({ content: { body: [{ kind: 'paragraph', inlines: [] }] } });
    const ids = [...blankResumeDocument().sections, ...blankResumeDocument().sections].map(section => section.id);
    expect(new Set(ids).size).toBe(10);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('B02 titles count code points', () => {
  it('counts an emoji as one character', () => {
    expect(titleLength('a\u{1F600}')).toBe(2);
    expect(titleLength('Олександр')).toBe(9);
  });
  it('names a copy and never exceeds the limit or splits a surrogate pair', () => {
    expect(copyTitle('Backend')).toBe('Backend (copy)');
    expect(copyTitle('')).toBe('Untitled resume (copy)');
    expect(titleLength(copyTitle('x'.repeat(TITLE_LIMIT)))).toBe(TITLE_LIMIT);
    expect(copyTitle('x'.repeat(TITLE_LIMIT))).toBe('x'.repeat(TITLE_LIMIT - 7) + ' (copy)');
    const emoji = copyTitle('\u{1F600}'.repeat(TITLE_LIMIT));
    expect(titleLength(emoji)).toBe(TITLE_LIMIT);
    expect(emoji.endsWith('\u{1F600} (copy)')).toBe(true);
  });
});
