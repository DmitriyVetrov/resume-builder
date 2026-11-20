import type { components } from '../../shared/api/generated/schema';

type Schemas = components['schemas'];
export type Block = Schemas['Block'];
export type Inline = Schemas['Inline'];
export type TextRun = Schemas['TextRun'];

const sameMarks = (a: TextRun, b: TextRun) => a.bold === b.bold && a.italic === b.italic && a.underline === b.underline;

function normalizeRuns(runs: readonly TextRun[]): TextRun[] {
  const result: TextRun[] = [];
  for (const run of runs) {
    if (!run.value) continue;
    const last = result.at(-1);
    if (last && sameMarks(last, run)) result[result.length - 1] = { ...last, value: last.value + run.value };
    else result.push(run);
  }
  return result;
}

/** The canonical form (§10.2): no empty runs or links, equal neighbours merged. It never changes the plain text. */
export function normalizeInlines(inlines: readonly Inline[]): Inline[] {
  const result: Inline[] = [];
  for (const inline of inlines) {
    const last = result.at(-1);
    if (inline.kind === 'lineBreak') { result.push(inline); continue; }
    if (inline.kind === 'text') {
      if (!inline.value) continue;
      if (last?.kind === 'text' && sameMarks(last, inline)) result[result.length - 1] = { ...last, value: last.value + inline.value };
      else result.push(inline);
      continue;
    }
    const children = normalizeRuns(inline.children);
    if (!children.length) continue;
    if (last?.kind === 'link' && last.url === inline.url) result[result.length - 1] = { ...last, children: normalizeRuns([...last.children, ...children]) };
    else result.push({ ...inline, children });
  }
  return result;
}

export function normalizeBlocks(blocks: readonly Block[]): Block[] {
  const result: Block[] = [];
  for (const block of blocks) {
    if (block.kind === 'paragraph') { result.push({ kind: 'paragraph', inlines: normalizeInlines(block.inlines) }); continue; }
    const items = block.items.map(normalizeInlines);
    const last = result.at(-1);
    if (last?.kind === 'bulletList') result[result.length - 1] = { kind: 'bulletList', items: [...last.items, ...items] };
    else result.push({ kind: 'bulletList', items });
  }
  return result;
}

function inlineText(inlines: readonly Inline[]): string {
  return inlines.map(inline => {
    if (inline.kind === 'text') return inline.value;
    if (inline.kind === 'link') return inline.children.map(child => child.value).join('');
    return '\n';
  }).join('');
}

export function plainText(blocks: readonly Block[]): string {
  return blocks.flatMap(block => block.kind === 'paragraph' ? [inlineText(block.inlines)] : block.items.map(inlineText)).join('\n');
}

export const codePointLength = (value: string) => Array.from(value).length;
