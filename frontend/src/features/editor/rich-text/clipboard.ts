import { normalizeBlocks, type Block, type Inline } from '../../../entities/resume/rich-text';
import { normalizeUrl } from '../../../entities/resume/safe-url';

type Marks = { bold: boolean; italic: boolean; underline: boolean; url: string | null };
type Line = { bullet: boolean; inlines: Inline[] };

const DROPPED = new Set(['script', 'style', 'head', 'meta', 'title', 'link', 'img', 'picture', 'svg', 'math', 'object', 'embed', 'iframe', 'noscript', 'template', 'canvas', 'video', 'audio', 'input', 'select', 'textarea', 'button']);
const BLOCKS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'pre', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'address', 'hr', 'form', 'fieldset', 'center']);
const SPACES = /\s+/g; // \s includes the no-break spaces Word uses.

/** DD-P09-04: only what can be stored survives, read from tags and from the inline CSS Word and Docs use. */
function styleMarks(element: Element, marks: Marks): Marks {
  const next = { ...marks };
  const tag = element.tagName.toLowerCase();
  if (tag === 'b' || tag === 'strong') next.bold = true;
  if (tag === 'i' || tag === 'em') next.italic = true;
  if (tag === 'u') next.underline = true;
  if (tag === 'a') {
    const url = normalizeUrl(element.getAttribute('href') ?? '');
    if (url) next.url = url;
  }
  const style = (element as HTMLElement).style;
  if (style) {
    const weight = style.fontWeight;
    if (weight) next.bold = weight === 'bold' || weight === 'bolder' || Number(weight) >= 600;
    const italic = style.fontStyle;
    if (italic) next.italic = italic.startsWith('italic') || italic.startsWith('oblique');
    const decoration = style.textDecorationLine || style.textDecoration;
    if (decoration) next.underline = decoration.includes('underline');
  }
  return next;
}

const isWordMarker = (element: Element) => /mso-list:\s*ignore/i.test(element.getAttribute('style') ?? '');
const isWordListParagraph = (element: Element) => /mso-list:\s*l\d/i.test(element.getAttribute('style') ?? '') || /^MsoListParagraph/.test(element.getAttribute('class') ?? '');

function appendText(line: Line, value: string, marks: Marks) {
  // Docs and browsers underline link text by style; a link's look comes from the template (D-18).
  const run = { kind: 'text' as const, value, bold: marks.bold, italic: marks.italic, underline: marks.url ? false : marks.underline };
  if (!marks.url) { line.inlines.push(run); return; }
  const last = line.inlines.at(-1);
  if (last?.kind === 'link' && last.url === marks.url) last.children.push(run);
  else line.inlines.push({ kind: 'link', url: marks.url, children: [run] });
}

function readInto(root: Element): Line[] {
  const lines: Line[] = [];
  let current: Line = { bullet: false, inlines: [] };
  let inList = 0;
  const flush = () => {
    if (current.inlines.length) lines.push(current);
    current = { bullet: inList > 0, inlines: [] };
  };
  const trailing = () => current.inlines.at(-1);
  const walk = (node: Node, marks: Marks) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(SPACES, ' ');
      const last = trailing();
      const atStart = !last || last.kind === 'lineBreak';
      const value = atStart ? text.replace(/^ /, '') : text;
      if (value) appendText(current, value, marks);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (DROPPED.has(tag) || isWordMarker(element)) return;
    if (tag === 'br') { if (current.inlines.length) current.inlines.push({ kind: 'lineBreak' }); return; }
    const next = styleMarks(element, marks);
    if (tag === 'ul' || tag === 'ol') {
      flush();
      inList++;
      current.bullet = true;
      element.childNodes.forEach(child => walk(child, next));
      flush();
      inList--;
      current.bullet = inList > 0;
      return;
    }
    if (tag === 'li' || BLOCKS.has(tag)) {
      flush();
      if (isWordListParagraph(element)) current.bullet = true;
      element.childNodes.forEach(child => walk(child, next));
      flush();
      return;
    }
    element.childNodes.forEach(child => walk(child, next));
  };
  root.childNodes.forEach(child => walk(child, { bold: false, italic: false, underline: false, url: null }));
  flush();
  return lines;
}

/** Spaces at the end of a line and line breaks at its end carry nothing. */
function tidy(inlines: Inline[]): Inline[] {
  const result = [...inlines];
  for (;;) {
    const last = result.at(-1);
    if (last?.kind === 'lineBreak') { result.pop(); continue; }
    if (last?.kind === 'text') {
      const value = last.value.replace(/ +$/, '');
      if (!value) { result.pop(); continue; }
      result[result.length - 1] = { ...last, value };
    }
    if (last?.kind === 'link') {
      const child = last.children.at(-1);
      if (child) result[result.length - 1] = { ...last, children: [...last.children.slice(0, -1), { ...child, value: child.value.replace(/ +$/, '') || child.value }] };
    }
    return result;
  }
}

function toBlocks(lines: readonly Line[]): Block[] {
  const blocks: Block[] = [];
  for (const line of lines) {
    const inlines = tidy(line.inlines);
    if (!inlines.length) continue;
    if (line.bullet) blocks.push({ kind: 'bulletList', items: [inlines] });
    else blocks.push({ kind: 'paragraph', inlines });
  }
  return normalizeBlocks(blocks);
}

/** A first barrier: these tags can name a URL, and pasted content must never reach a third party (T-ID-07). */
const RESOURCE_TAGS = /<\/?(?:img|image|iframe|frame|frameset|link|video|audio|source|track|object|embed|input|base|body|applet)\b[^>]*>/gi;

/**
 * Reads clipboard HTML in an inert document (no scripts, no loading) through an allow-list walker. The engine only
 * ever receives the resulting AST (DD-P09-03).
 */
export function htmlToBlocks(html: string): Block[] {
  const cleaned = html.replace(/<!--\[if !supportLists\]-->[\s\S]*?<!--\[endif\]-->/gi, '').replace(/<!\[if !supportLists\]>[\s\S]*?<!\[endif\]>/gi, '').replace(RESOURCE_TAGS, '');
  const parsed = new DOMParser().parseFromString(cleaned, 'text/html');
  return toBlocks(readInto(parsed.body));
}

const BULLET_PREFIX = /^\s*[-*•·]\s+/;

export function plainTextToBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const run = (value: string): Inline => ({ kind: 'text', value, bold: false, italic: false, underline: false });
    if (BULLET_PREFIX.test(raw)) blocks.push({ kind: 'bulletList', items: [[run(raw.replace(BULLET_PREFIX, ''))]] });
    else blocks.push({ kind: 'paragraph', inlines: [run(raw)] });
  }
  return normalizeBlocks(blocks);
}
