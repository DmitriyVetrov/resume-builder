import { normalizeInlines, type Inline, type TextRun } from '../../entities/resume/rich-text';
import { isSafeUrl } from '../../entities/resume/safe-url';

/**
 * DD-IMP-06: the draft's three-tag markup (`<b>`, `<i>`, `<a href="…">`) to contract inlines. A string tokenizer,
 * never the DOM: anything else, and any unbalanced or mis-nested tag, stays literal text.
 */
const TOKEN = /<(\/?)([bi])>|<a href="([^"<>]*)">|<\/a>/g;
const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' };
const decode = (value: string) => value.replace(/&(?:amp|lt|gt|quot);/g, entity => ENTITIES[entity]!);
const run = (value: string, bold: boolean, italic: boolean): TextRun => ({ kind: 'text', value, bold, italic, underline: false });

type Token = { index: number; length: number; open: boolean; tag: 'b' | 'i' | 'a'; href?: string };

function tokens(text: string): Token[] | null {
  const found: Token[] = [];
  const stack: Token['tag'][] = [];
  for (const match of text.matchAll(TOKEN)) {
    const token: Token = match[0] === '</a>' ? { index: match.index, length: 4, open: false, tag: 'a' }
      : match[3] !== undefined ? { index: match.index, length: match[0].length, open: true, tag: 'a', href: decode(match[3]) }
      : { index: match.index, length: match[0].length, open: match[1] === '', tag: match[2] as 'b' | 'i' };
    if (token.open) {
      if (stack.includes(token.tag)) return null;
      stack.push(token.tag);
    } else if (stack.pop() !== token.tag) return null;
    found.push(token);
  }
  return stack.length ? null : found;
}

export function markupToInlines(text: string): Inline[] {
  const found = tokens(text);
  if (!found) return text ? [run(decode(text), false, false)] : [];
  const inlines: Inline[] = [];
  let bold = false;
  let italic = false;
  let link: { url: string; children: TextRun[] } | null = null;
  let at = 0;
  const emit = (value: string) => {
    if (!value) return;
    const piece = run(decode(value), bold, italic);
    if (link) link.children.push(piece);
    else inlines.push(piece);
  };
  for (const token of found) {
    emit(text.slice(at, token.index));
    at = token.index + token.length;
    if (token.tag === 'b') bold = token.open;
    else if (token.tag === 'i') italic = token.open;
    else if (token.open) link = { url: token.href!, children: [] };
    else if (link) {
      // M-03: an unsafe target keeps the text and loses the link.
      if (isSafeUrl(link.url)) inlines.push({ kind: 'link', url: link.url, children: link.children });
      else inlines.push(...link.children);
      link = null;
    }
  }
  emit(text.slice(at));
  return normalizeInlines(inlines);
}
