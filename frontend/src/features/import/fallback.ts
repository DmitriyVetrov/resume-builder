import type { Analysis, ImportDraft, ImportDraftDate, ImportDraftEntry, ImportDraftSection, TextBlock } from './types';

/**
 * ADR-055 §5: the deterministic parser used when the server cannot structure the text (503) and for own TXT. It only
 * picks and groups the source's own blocks, so it never invents text (F-04). A section that starts with a
 * "Title | Dates" row is an entries section (Amendment 1, DD-IMP-27); everything else is text or a list.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s().-]{5,}$/;
const LINK = /^(?:https?:\/\/\S+|(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#]\S*)?)$/i;
const TITLE_LIMIT = 80;

const kindOf = (value: string): ImportDraft['contacts'][number]['kind'] => {
  if (EMAIL.test(value)) return 'email';
  if (PHONE.test(value) && (value.match(/\d/g)?.length ?? 0) >= 5) return 'phone';
  if (LINK.test(value)) return 'link';
  return 'other';
};
const length = (value: string) => Array.from(value).length;
const isUpper = (value: string) => /\p{L}.*\p{L}/su.test(value) && value === value.toLocaleUpperCase() && value !== value.toLocaleLowerCase();

/** A section title: short, not a list item or a sentence, and either upper case or clearly larger than the body. */
function isHeading(block: TextBlock, bodySize: number): boolean {
  if (block.listItem || length(block.plain) > TITLE_LIMIT || /[.,;]$/.test(block.plain) || block.plain.includes(' | ')) return false;
  return isUpper(block.plain) || block.size >= bodySize + 1.5;
}
/** A header line that reads as a contact rather than prose. */
const isContactLike = (block: TextBlock) => !block.listItem && length(block.plain) <= TITLE_LIMIT && !/[.!?]$/.test(block.plain);

/** DD-IMP-27: month words of the three document languages; Ukrainian by stem, so the genitive ("січня") reads too. */
const MONTHS = [['jan', 'january', 'ene', 'enero'], ['feb', 'february', 'febrero'], ['mar', 'march', 'marzo'], ['apr', 'april', 'abr', 'abril'], ['may', 'mayo'], ['jun', 'june', 'junio'],
  ['jul', 'july', 'julio'], ['aug', 'august', 'ago', 'agosto'], ['sep', 'sept', 'september', 'septiembre', 'setiembre'], ['oct', 'october', 'octubre'], ['nov', 'november', 'noviembre'], ['dec', 'december', 'dic', 'diciembre']];
const MONTH_STEMS = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
const PRESENT = /^(?:present|current|now|today|actualidad|presente|actual|hoy|дотепер|нині|зараз|(?:по )?теперішній час)$/iu;
const SENTENCE_END = /[.!?:;]$/;
const HEAD_LIMIT = 120;

function monthOf(word: string): number | null {
  const value = word.toLocaleLowerCase().replace(/\.$/, '');
  const index = MONTHS.findIndex(names => names.includes(value));
  if (index >= 0) return index + 1;
  const stem = MONTH_STEMS.findIndex(prefix => value.startsWith(prefix));
  return stem >= 0 ? stem + 1 : null;
}

/** "2024", "Nov 2020", "11/2020", or a month alone ("Jan" in "Jan – May 2026"); null if unreadable. */
function pointOf(text: string): { year: number | null; month: number | null } | null {
  const numeric = /^(\d{1,2})[./](\d{4})$/.exec(text);
  if (numeric) return { year: Number(numeric[2]), month: Number(numeric[1]) };
  const words = /^(?:(\p{L}+\.?)\s+)?(\d{4})$/u.exec(text);
  if (words) {
    const month = words[1] ? monthOf(words[1]) : null;
    return words[1] && !month ? null : { year: Number(words[2]), month };
  }
  const month = /^\p{L}+\.?$/u.test(text) ? monthOf(text) : null;
  return month ? { year: null, month } : null;
}

const valid = (point: { year: number | null; month: number | null }): point is ImportDraftDate => point.year !== null && point.year >= 1900 && point.year <= 2100 && (point.month === null || (point.month >= 1 && point.month <= 12));

/** A date or a range as the draft's start, end and present; null when the text is not one. */
function datesOf(text: string): Pick<ImportDraftEntry, 'start' | 'end' | 'present'> | null {
  const parts = text.trim().split(/\s*[–—-]\s*/u);
  if (parts.length === 1) {
    const point = pointOf(parts[0]!);
    return point && valid(point) ? { start: point, end: null, present: false } : null;
  }
  if (parts.length !== 2) return null;
  const start = pointOf(parts[0]!);
  if (!start) return null;
  if (PRESENT.test(parts[1]!)) return valid(start) ? { start, end: null, present: true } : null;
  const end = pointOf(parts[1]!);
  if (!end || !valid(end)) return null;
  const from = { year: start.year ?? end.year, month: start.month };
  return valid(from) ? { start: from, end, present: false } : null;
}

/** Dates as read, or kept as written when the text holds a year but no readable range. */
const datesText = (text: string) => datesOf(text) !== null || (Array.from(text).length <= 40 && /\d{4}/.test(text));

/** An entry's first row: "Title | Dates", or a title with its dates set on the same row (a block of their own). */
function headOf(block: TextBlock, next: TextBlock | undefined): { title: string; dates: string; sameRow: boolean } | null {
  if (length(block.plain) > HEAD_LIMIT || SENTENCE_END.test(block.plain)) return null;
  const pipe = block.plain.lastIndexOf(' | ');
  if (pipe > 0) {
    const dates = block.plain.slice(pipe + 3).trim();
    return datesText(dates) ? { title: block.plain.slice(0, pipe).trim(), dates, sameRow: false } : null;
  }
  const sameRow = next && next.page === block.page && Math.abs(next.top - block.top) <= 2 && next.x > block.x && datesText(next.plain);
  return sameRow ? { title: block.plain, dates: next.plain, sameRow: true } : null;
}

/** The row under a title: "Organization · Location" splits in two; any other short row is the organization. */
function organizationOf(block: TextBlock | undefined): Pick<ImportDraftEntry, 'organization' | 'location'> | null {
  if (!block || block.listItem || length(block.plain) > HEAD_LIMIT || SENTENCE_END.test(block.plain) || !/\p{L}/u.test(block.plain)) return null;
  const parts = block.plain.split(/\s+[·|]\s+/u);
  return parts.length === 2 ? { organization: parts[0]!, location: parts[1]! } : { organization: block.plain, location: null };
}

/** The section's blocks as entries, or null when its first block does not start one (its text is then kept as is). */
function entriesOf(sources: readonly TextBlock[]): ImportDraftEntry[] | null {
  if (!sources.length || !headOf(sources[0]!, sources[1])) return null;
  const entries: ImportDraftEntry[] = [];
  for (let index = 0; index < sources.length; index++) {
    const block = sources[index]!;
    const head = headOf(block, sources[index + 1]);
    if (!head) {
      entries.at(-1)!.blocks.push({ kind: block.listItem ? 'bullet' : 'paragraph', text: block.text });
      continue;
    }
    if (head.sameRow) index++;
    const next = sources[index + 1];
    const place = next && !headOf(next, sources[index + 2]) ? organizationOf(next) : null;
    if (place) index++;
    const dates = datesOf(head.dates);
    entries.push({
      title: head.title, organization: place?.organization ?? null, location: place?.location ?? null,
      start: dates?.start ?? null, end: dates?.end ?? null, present: dates?.present ?? false, dateText: dates ? null : head.dates,
      blocks: [],
    });
  }
  return entries;
}

function sectionOf(title: string, column: TextBlock['column']): ImportDraftSection {
  return { title, type: 'text', placement: column === 'S' ? 'sidebar' : 'main', blocks: [], items: [], entries: [] };
}

export function fallbackDraft(analysis: Analysis): ImportDraft {
  const { blocks, bodySize } = analysis;
  const firstPage = blocks.filter(block => block.page === 0);
  const largest = Math.max(...firstPage.map(block => block.size));
  const nameIndex = blocks.findIndex(block => block.page === 0 && block.size === largest);
  const name = blocks[nameIndex];
  // The headline is the next block, unless it is a contact or a title that recurs in the document's heading style.
  const next = nameIndex >= 0 ? blocks[nameIndex + 1] : undefined;
  const headingStyle = (block: TextBlock) => blocks.some(other => other !== block && isHeading(other, bodySize) && other.size === block.size && other.bold === block.bold && isUpper(other.plain) === isUpper(block.plain));
  // An upper-case title right after the name reads as the first section, not as a headline.
  const titleLike = (block: TextBlock) => isHeading(block, bodySize) && (headingStyle(block) || isUpper(block.plain));
  const headline = next && next.column === name?.column && kindOf(next.plain) === 'other' && !next.listItem && !titleLike(next) ? next : undefined;

  const draft: ImportDraft = { fullName: name?.plain ?? '', headline: headline?.plain ?? null, contacts: [], language: null, sections: [] };
  const current = new Map<TextBlock['column'], ImportDraftSection>();
  const sources = new Map<ImportDraftSection, TextBlock[]>();
  for (const block of blocks) {
    if (block === name || block === headline || !block.plain) continue;
    if (isHeading(block, bodySize)) {
      const section = sectionOf(block.plain, block.column);
      draft.sections.push(section);
      current.set(block.column, section);
      continue;
    }
    let section = current.get(block.column);
    if (!section) {
      if (isContactLike(block)) { draft.contacts.push({ text: block.plain, kind: kindOf(block.plain) }); continue; }
      section = sectionOf('', block.column);
      draft.sections.push(section);
      current.set(block.column, section);
    }
    section.blocks.push({ kind: block.listItem ? 'bullet' : 'paragraph', text: block.text });
    sources.set(section, [...sources.get(section) ?? [], block]);
  }
  for (const section of draft.sections) {
    const entries = entriesOf(sources.get(section) ?? []);
    if (entries) {
      Object.assign(section, { type: 'entries', blocks: [], entries });
      continue;
    }
    if (section.blocks.length && section.blocks.every(block => block.kind === 'bullet')) {
      section.type = 'list';
      section.items = section.blocks.map(block => block.text);
      section.blocks = [];
    }
  }
  return draft;
}
