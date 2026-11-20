import type { Analysis, TextBlock } from './types';

/**
 * DD-IMP-12: our own TXT export (TECHNICAL-SPEC §9) as blocks for the fallback parser. The first group is the name, the
 * headline and the ` | `-joined contacts; then each section is its title, a blank line, and its content groups.
 */
const BODY = 10;
const LINKED = /^(.*\S) \((?:https?:\/\/|mailto:|tel:)\S+\)$/;
const CONTACTISH = /@|\d{3}|^(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}/i;
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function block(plain: string, size: number, options: Partial<TextBlock> = {}): TextBlock {
  return { column: 'M', page: 0, top: 0, x: 0, size, bold: size > BODY, italic: false, listItem: false, text: escapeText(plain), plain, ...options };
}
const isTitle = (group: string[]) => group.length === 1 && !group[0]!.startsWith('- ') && !group[0]!.includes(' | ') && Array.from(group[0]!).length <= 80 && !/[.,;]$/.test(group[0]!);

export function analyzeTxt(text: string): Analysis {
  const groups = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/).map(group => group.split('\n').map(line => line.trim()).filter(Boolean)).filter(group => group.length);
  const blocks: TextBlock[] = [];
  const [header = [], ...rest] = groups;
  const [name, ...others] = header;
  if (name) blocks.push(block(name, 22));
  // Two lines after the name are the headline and the contacts; one line is whichever it looks like.
  const contactLine = others.length >= 2 ? others[1] : others[0] && (others[0].includes(' | ') || CONTACTISH.test(others[0])) ? others[0] : undefined;
  const headline = others.length >= 2 || (others[0] && others[0] !== contactLine) ? others[0] : undefined;
  if (headline) blocks.push(block(headline, 13));
  for (const contact of contactLine?.split(' | ') ?? []) blocks.push(block(LINKED.exec(contact)?.[1] ?? contact, BODY));
  for (const group of rest) {
    if (isTitle(group)) { blocks.push(block(group[0]!, 12)); continue; }
    for (const line of group) blocks.push(line.startsWith('- ') ? block(line.slice(2), BODY, { listItem: true }) : block(line, BODY));
  }
  return { columns: 1, sidebarSide: null, bodySize: BODY, pages: 1, blocks: blocks.map((item, index) => ({ ...item, top: index * 12 })), photo: null, droppedImages: 0 };
}
