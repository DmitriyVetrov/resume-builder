import type { components } from '../../shared/api/generated/schema';

type Schemas = components['schemas'];
export type ResumeDocument = Schemas['ResumeDocument'];
export type Section = Schemas['TextSection'] | Schemas['InlineSection'] | Schemas['ListSection'] | Schemas['EntriesSection'];
export type SectionType = Section['type'];
export type Entry = Schemas['Entry'];
export type ListItem = Schemas['ListItem'];
export type ContactItem = Schemas['ContactItem'];
export type Conversion = { type: SectionType; allowed: boolean; reason?: string };
type Block = Schemas['Block'];
type Inline = Schemas['Inline'];

export const LIMITS = { sections: 100, entries: 100, items: 100, contacts: 20, title: 150, fullName: 120, headline: 200, contact: 200, sectionTitle: 80, entryField: 150, dateText: 60, label: 40 } as const;

const shell = { hidden: false, listColumns: null, placement: null };
const id = () => crypto.randomUUID();

export function newSection(type: SectionType, title: string): Section {
  switch (type) {
    case 'text': return { ...shell, id: id(), type, title, content: { body: [] } };
    case 'inline': return { ...shell, id: id(), type, title, content: { body: [{ kind: 'paragraph', inlines: [] }] } };
    case 'list': return { ...shell, id: id(), type, title, content: { items: [] } };
    case 'entries': return { ...shell, id: id(), type, title, content: { labels: null, entries: [] } };
  }
}

export const addSection = (document: ResumeDocument, section: Section): ResumeDocument => ({ ...document, sections: [...document.sections, section] });

export function updateSection(document: ResumeDocument, sectionId: string, change: (section: Section) => Section): ResumeDocument {
  return { ...document, sections: document.sections.map(section => section.id === sectionId ? change(section as Section) : section) };
}

export function moveWithin<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved as T);
  return next;
}

export function moveSection(document: ResumeDocument, sectionId: string, toIndex: number): ResumeDocument {
  const from = document.sections.findIndex(section => section.id === sectionId);
  return from < 0 ? document : { ...document, sections: moveWithin(document.sections, from, toIndex) };
}

export const removeSection = (document: ResumeDocument, sectionId: string): ResumeDocument => ({ ...document, sections: document.sections.filter(section => section.id !== sectionId) });

export function duplicateEntry(entry: Entry): Entry { return { ...entry, id: id() }; }

function freshIds(section: Section): Section {
  const copy = { ...section, id: id() };
  if (copy.type === 'list') return { ...copy, content: { items: copy.content.items.map(item => ({ ...item, id: id() })) } };
  if (copy.type === 'entries') return { ...copy, content: { ...copy.content, entries: copy.content.entries.map(duplicateEntry) } };
  return copy;
}

export function duplicateSection(document: ResumeDocument, sectionId: string): { document: ResumeDocument; id: string } {
  const index = document.sections.findIndex(section => section.id === sectionId);
  const copy = freshIds(document.sections[index] as Section);
  const sections = [...document.sections];
  sections.splice(index + 1, 0, copy);
  return { document: { ...document, sections }, id: copy.id };
}

const hasContent = (inlines: readonly Inline[]) => inlines.some(inline => inline.kind !== 'lineBreak');
const blockHasContent = (block: Block) => block.kind === 'paragraph' ? hasContent(block.inlines) : block.items.some(hasContent);

function entryHasContent(entry: Entry) {
  return !!(entry.title || entry.organization || entry.location || entry.dateText || entry.start || entry.end) || entry.description.some(blockHasContent);
}

export function isSectionEmpty(section: Section): boolean {
  switch (section.type) {
    case 'text': case 'inline': return !section.content.body.some(blockHasContent);
    case 'list': return !section.content.items.some(item => hasContent(item.text));
    case 'entries': return !section.content.entries.some(entryHasContent);
  }
}

/** The lines of a section when each is one inline array, or null if a conversion would lose structure. */
function linesOf(section: Section): Inline[][] | null {
  if (section.type === 'entries') return null;
  if (section.type === 'list') return section.content.items.map(item => item.text);
  const lines: Inline[][] = [];
  for (const block of section.content.body) {
    if (block.kind === 'paragraph') lines.push(block.inlines);
    else lines.push(...block.items);
  }
  return lines;
}

const hasBreak = (lines: Inline[][]) => lines.some(line => line.some(inline => inline.kind === 'lineBreak'));

/** DD-P08-15: only conversions that lose nothing. */
export function conversionOptions(section: Section): Conversion[] {
  const types = (['text', 'list', 'entries', 'inline'] as const).filter(type => type !== section.type);
  if (section.type === 'entries') return types.map(type => ({ type, allowed: false, reason: 'Entries have fields that this type cannot hold.' }));
  const lines = linesOf(section) ?? [];
  const bullets = section.type === 'text' && section.content.body.some(block => block.kind === 'bulletList');
  return types.map((type): Conversion => {
    if (type === 'entries') return { type, allowed: false, reason: 'Entries have fields that this type cannot hold.' };
    if (type === 'list' && hasBreak(lines)) return { type, allowed: false, reason: 'A list item cannot hold a line break.' };
    if (type === 'inline' && (lines.length > 1 || bullets)) return { type, allowed: false, reason: 'An inline section holds one paragraph.' };
    return { type, allowed: true };
  });
}

export function convertSection(section: Section, type: SectionType): Section {
  const option = conversionOptions(section).find(candidate => candidate.type === type);
  if (!option?.allowed) throw new Error('This conversion would lose content.');
  const lines = linesOf(section) ?? [];
  const common = { id: section.id, title: section.title, hidden: section.hidden, listColumns: section.listColumns, placement: section.placement };
  if (type === 'list') return { ...common, type, content: { items: lines.map(newListItem) } };
  if (type === 'inline') return { ...common, type, content: { body: [{ kind: 'paragraph', inlines: lines[0] ?? [] }] } };
  if (section.type === 'inline') return { ...common, type: 'text', content: { body: section.content.body } };
  return { ...common, type: 'text', content: { body: lines.map(inlines => ({ kind: 'paragraph' as const, inlines })) } };
}

export function newEntry(): Entry {
  return { id: id(), title: '', organization: '', location: '', start: null, end: null, dateText: '', description: [], pageBreakBefore: false };
}

export function newListItem(text: ListItem['text'] = []): ListItem { return { id: id(), text }; }
export function newContact(): ContactItem { return { id: id(), text: '', url: null, kind: 'other' }; }

export function clampCodePoints(value: string, limit: number): { value: string; clamped: boolean } {
  // A fast path: UTF-16 length is never below the code point count.
  if (value.length <= limit) return { value, clamped: false };
  const points = Array.from(value);
  return points.length <= limit ? { value, clamped: false } : { value: points.slice(0, limit).join(''), clamped: true };
}

export function isDateRangeInverted(entry: Entry): boolean {
  const { start, end } = entry;
  if (!start || !end || end.kind !== 'date') return false;
  if (start.year !== end.year) return start.year > end.year;
  return start.month !== null && end.month !== null && start.month > end.month;
}
