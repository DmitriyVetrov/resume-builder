import { blankResumeDocument, TITLE_LIMIT, type ResumeDocument } from '../../entities/resume';
import { resetDesign, setLanguage, setPlacement, switchTemplate } from '../../entities/resume/design-operations';
import { addSection, clampCodePoints, LIMITS, newContact, newEntry, newListItem, newSection, type Entry, type Section } from '../../entities/resume/operations';
import { normalizeBlocks, type Block, type Inline } from '../../entities/resume/rich-text';
import { markupToInlines } from './markup';
import type { ImportDraft, ImportDraftBlock, ImportDraftDate, ImportDraftSection, ImportReport, ImportWarning } from './types';

export type BuildContext = { columns: 1 | 2; sidebarSide: 'left' | 'right' | null; warnings: ImportWarning[]; droppedImages: number; photo: boolean; basic: boolean; sourceCapped: boolean };

/** D-10, ADR-023: neutral form labels for the sidebar's name–detail pairs (O-4); never printed. */
const SIDEBAR_LABELS = { title: 'Name', organization: 'Detail', location: null };

/** The text of draft markup, for the fields that hold plain strings. */
const plainOf = (value: string | null) => markupToInlines(value ?? '').map(inline => inline.kind === 'text' ? inline.value : inline.kind === 'link' ? inline.children.map(child => child.value).join('') : ' ').join('').trim();

function blocksOf(blocks: readonly ImportDraftBlock[]): Block[] {
  const result: Block[] = [];
  for (const block of blocks) {
    const inlines = markupToInlines(block.text.trim());
    if (!inlines.length) continue;
    result.push(block.kind === 'bullet' ? { kind: 'bulletList', items: [inlines] } : { kind: 'paragraph', inlines });
  }
  return normalizeBlocks(result);
}

const dateOf = (value: ImportDraftDate | null) => value ? { kind: 'date' as const, year: value.year, month: value.month } : null;

const sectionLabel = (index: number, sections: readonly ImportDraftSection[]) => {
  const title = sections[index]?.title ? plainOf(sections[index].title) : '';
  return title ? `Section ${index + 1} “${title}”` : `Section ${index + 1}`;
};

/** A readable name for a JSON pointer into the draft (D-11); never the value. */
function fieldName(pointer: string, draft: ImportDraft): string {
  const parts = pointer.split('/').slice(1);
  const [root, first, second, third, fourth, fifth] = parts;
  const number = (value: string | undefined) => Number(value) + 1;
  if (root === 'fullName') return 'Name';
  if (root === 'headline') return 'Headline';
  if (root === 'language') return 'Language';
  if (root === 'contacts') return first === undefined ? 'Contacts' : `Contact ${number(first)}`;
  if (root !== 'sections') return pointer;
  if (first === undefined) return 'Sections';
  const section = sectionLabel(Number(first), draft.sections);
  if (second === 'title') return `${section}: title`;
  if (second === 'items') return third === undefined ? `${section}: items` : `${section}, item ${number(third)}`;
  if (second === 'blocks') return third === undefined ? `${section}: text` : `${section}, paragraph ${number(third)}`;
  if (second === 'entries') {
    if (third === undefined) return `${section}: entries`;
    const entry = `${section}, entry ${number(third)}`;
    if (fourth === 'blocks') return fifth === undefined ? `${entry}: description` : `${entry}, description ${number(fifth)}`;
    return fourth ? `${entry}: ${fourth === 'dateText' ? 'dates' : fourth}` : entry;
  }
  return section;
}

/**
 * ADR-055 §4: the draft becomes a document through the existing operations only. Strings are clamped to the
 * contract's limits and arrays cut, each change listed in the report; the design is the template's defaults (DD-IMP-18).
 */
export function buildDocument(draft: ImportDraft, context: BuildContext): { document: ResumeDocument; report: ImportReport } {
  const clamped: string[] = [];
  const overLimit: string[] = [];
  const clamp = (value: string, limit: number, label: string) => {
    const result = clampCodePoints(value, limit);
    if (result.clamped) clamped.push(label);
    return result.value;
  };
  const cut = <T,>(list: readonly T[], limit: number, label: string, noun: string): T[] => {
    if (list.length > limit) overLimit.push(`${label}: ${list.length - limit} ${noun}`);
    return list.slice(0, limit);
  };

  const fullName = clamp(plainOf(draft.fullName), LIMITS.fullName, 'Name');
  const blank = blankResumeDocument();
  let document: ResumeDocument = {
    ...blank,
    title: fullName ? clampCodePoints(fullName, TITLE_LIMIT).value : blank.title,
    header: {
      fullName,
      headline: clamp(plainOf(draft.headline), LIMITS.headline, 'Headline'),
      showPhoto: true,
      contacts: cut(draft.contacts, LIMITS.contacts, 'Contacts', 'contacts')
        .map((contact, index) => ({ ...newContact(), text: clamp(plainOf(contact.text), LIMITS.contact, `Contact ${index + 1}`), kind: contact.kind }))
        .filter(contact => contact.text),
    },
    sections: [],
  };
  const templateId = context.sidebarSide === 'left' ? 'T4' : context.sidebarSide === 'right' ? 'T3' : 'T1';
  document = setLanguage(switchTemplate(document, templateId), draft.language ?? 'en');

  let entryCount = 0;
  cut(draft.sections, LIMITS.sections, 'Sections', 'sections').forEach((part, index) => {
    const label = sectionLabel(index, draft.sections);
    const title = clamp(plainOf(part.title), LIMITS.sectionTitle, `${label}: title`);
    let section: Section;
    if (part.type === 'list') {
      const list = newSection('list', title) as Extract<Section, { type: 'list' }>;
      const items = cut(part.items, LIMITS.items, label, 'items').map(item => markupToInlines(item.trim())).filter((inlines: Inline[]) => inlines.length);
      section = { ...list, content: { items: items.map(inlines => newListItem(inlines)) } };
    } else if (part.type === 'entries') {
      const entries = newSection('entries', title) as Extract<Section, { type: 'entries' }>;
      const built = cut(part.entries, LIMITS.entries, label, 'entries').map((item, at): Entry => {
        const where = `${label}, entry ${at + 1}`;
        const start = dateOf(item.start);
        return {
          ...newEntry(),
          title: clamp(plainOf(item.title), LIMITS.entryField, `${where}: title`),
          organization: clamp(plainOf(item.organization), LIMITS.entryField, `${where}: organization`),
          location: clamp(plainOf(item.location), LIMITS.entryField, `${where}: location`),
          start,
          end: item.present ? { kind: 'present' } : dateOf(item.end),
          dateText: clamp(plainOf(item.dateText), LIMITS.dateText, `${where}: dates`),
          description: blocksOf(item.blocks),
        };
      });
      entryCount += built.length;
      section = { ...entries, content: { labels: part.placement === 'sidebar' ? SIDEBAR_LABELS : null, entries: built } };
    } else {
      const text = newSection('text', title) as Extract<Section, { type: 'text' }>;
      section = { ...text, content: { body: blocksOf(part.blocks) } };
    }
    document = setPlacement(addSection(document, section), section.id, part.placement);
  });
  document = resetDesign(document);

  const named = (code: ImportWarning['code']) => context.warnings.filter(warning => warning.code === code).map(warning => fieldName(warning.pointer, draft));
  const report: ImportReport = {
    basic: context.basic,
    recognised: { contacts: document.header.contacts.length, sections: document.sections.length, entries: entryCount },
    clamped: [...named('clamped'), ...clamped],
    overLimit: [...named('over_limit'), ...overLimit],
    notInSource: named('not_in_source'),
    droppedImages: context.droppedImages,
    photo: context.photo,
    sourceCapped: context.sourceCapped,
  };
  return { document, report };
}
