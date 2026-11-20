import { deriveContactUrl } from '../resume/contact-link';
import { formatEntryDates } from '../resume/dates';
import { isSectionEmpty, type Entry, type ResumeDocument, type Section } from '../resume/operations';
import { isSafeUrl } from '../resume/safe-url';
import type { components } from '../../shared/api/generated/schema';

type Inline = components['schemas']['Inline'];
type Block = components['schemas']['Block'];

const safeLinkUrl = (url: string | null) => url && isSafeUrl(url) ? url : null;

/** §9.3: marks drop; a link keeps its URL unless the text already is the URL. */
function inlineText(inlines: Inline[]): string {
  return inlines.map(inline => {
    if (inline.kind === 'lineBreak') return '\n';
    if (inline.kind === 'text') return inline.value;
    const text = inline.children.map(run => run.value).join('');
    const url = safeLinkUrl(inline.url);
    return !url || text === url ? (url ?? text) : `${text} (${url})`;
  }).join('');
}

const present = (text: string) => text.trim() !== '';
const bullets = (items: Inline[][]) => items.map(inlineText).filter(present).map(item => `- ${item}`).join('\n');
const blocksOf = (blocks: Block[], between: string) => blocks.map(block => block.kind === 'paragraph' ? inlineText(block.inlines) : bullets(block.items)).filter(present).join(between);

function entryText(entry: Entry, document: ResumeDocument) {
  const dates = formatEntryDates(entry, document.language, document.dateFormat);
  const head = [entry.title ?? '', entry.organization ? `${entry.title ? ' — ' : ''}${entry.organization}` : ''].join('');
  const meta = [entry.location ?? '', dates].filter(Boolean).join(' | ');
  return [head, meta, blocksOf(entry.description, '\n')].filter(present).join('\n');
}

function sectionBody(section: Section, document: ResumeDocument) {
  switch (section.type) {
    case 'text': case 'inline': return blocksOf(section.content.body, '\n\n');
    case 'list': return bullets(section.content.items.map(item => item.text));
    case 'entries': return section.content.entries.map(entry => entryText(entry, document)).filter(present).join('\n\n');
  }
}

/** §9.3 and §9.4: an address derived from its own text is not repeated. A chosen one, or any web link, is. */
function contactText(contact: ResumeDocument['header']['contacts'][number]) {
  const derived = deriveContactUrl(contact.text);
  const url = safeLinkUrl(contact.url ?? derived);
  if (!url || url === contact.text) return contact.text;
  return /^(mailto|tel):/.test(url) && url === derived ? contact.text : `${contact.text} (${url})`;
}

/** §9: UTF-8 without BOM, LF, no tabs or trailing spaces, as typed. Templates and list columns do not reach this output (FR-SEC-11). */
export function serializeTxt(document: ResumeDocument, options: { lineEnding?: 'lf' | 'crlf' } = {}): string {
  const { header } = document;
  const contacts = header.contacts.filter(contact => contact.text).map(contactText).join(' | ');
  const top = [header.fullName, header.headline ?? '', contacts].filter(Boolean).join('\n');
  const sections = (document.sections as Section[]).filter(section => !section.hidden && !isSectionEmpty(section)).map(section => [section.title, sectionBody(section, document)].filter(present).join('\n\n'));
  const text = [top, ...sections].join('\n\n').replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(/ +(?=\n)/g, '').replace(/\n{3,}/g, '\n\n').trimEnd();
  return `${text}\n`.replaceAll('\n', options.lineEnding === 'crlf' ? '\r\n' : '\n');
}
