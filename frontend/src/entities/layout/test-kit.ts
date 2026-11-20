// Shared by the engine tests. Not imported by application code.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ResumeDocument, Section } from '../resume/operations';
import { createFontBook, layout, type FontBook, type Line, type PageModel } from './index';

const root = resolve(import.meta.dirname, '../../../..');
export const fixture = (name: string): ResumeDocument => JSON.parse(readFileSync(resolve(root, `tests/fixtures/resumes/${name}.json`), 'utf8'));
export function testFonts(): FontBook {
  return createFontBook(Object.fromEntries(['roboto', 'ibm-plex-sans', 'pt-serif'].map(id => [id, Object.fromEntries(['regular', 'italic', 'bold', 'bold-italic'].map(face => [face, new Uint8Array(readFileSync(resolve(root, `frontend/src/assets/fonts/${id}/${face}.ttf`)))]))])));
}
export const text = (line: Line) => line.runs.map(item => item.text).join('');
export const lines = (model: PageModel) => model.pages.flatMap(page => page.lines);
export const pageOfLine = (model: PageModel, line: Line) => model.pages.findIndex(page => page.lines.includes(line));
export const run = (value: string, marks: Partial<Record<'bold' | 'italic' | 'underline', boolean>> = {}) => ({ kind: 'text' as const, value, bold: false, italic: false, underline: false, ...marks });
const shell = { hidden: false, listColumns: null, placement: null };

/** A paragraph of exactly `count` lines. */
export const paragraph = (count: number, label = 'line') => ({ kind: 'paragraph' as const, inlines: Array.from({ length: count }, (_, index) => [run(`${label} ${index + 1}`), { kind: 'lineBreak' as const }]).flat() });
export const textSection = (id: string, title: string, body: unknown[]): Section => ({ ...shell, id, type: 'text', title, content: { body } }) as unknown as Section;
export const listSection = (id: string, title: string, items: { id: string; lines: number }[], listColumns: 1 | 2 | null): Section => ({ ...shell, listColumns, id, type: 'list', title, content: { items: items.map(item => ({ id: item.id, text: paragraph(item.lines, item.id).inlines })) } }) as unknown as Section;
export const entry = (id: string, title: string, description: unknown[] = [], pageBreakBefore = false) => ({ id, title, organization: 'Org', location: 'Place', start: { kind: 'date', year: 2020, month: 1 }, end: { kind: 'present' }, dateText: '', description, pageBreakBefore });
export const entriesSection = (id: string, title: string, entries: unknown[], listColumns: 1 | 2 | null = null): Section => ({ ...shell, listColumns, id, type: 'entries', title, content: { labels: null, entries } }) as unknown as Section;
/** A base document with no header contacts, so a sweep moves only what it means to move. */
export function documentOf(sections: Section[], templateId: ResumeDocument['templateId'] = 'T1'): ResumeDocument {
  const base = fixture('minimal');
  return { ...base, templateId, sections, header: { ...base.header, contacts: [] } } as ResumeDocument;
}
/** Filler that pushes what follows down by `count` body lines. */
export const filler = (count: number) => textSection('filler', 'Filler', [paragraph(Math.max(count, 1), 'filler')]);
export const run_ = (document: ResumeDocument, fonts: FontBook, photo = false) => layout(document, fonts, { photo, engineVersion: 'test' });
export const SWEEP = Array.from({ length: 70 }, (_, index) => index + 1);
