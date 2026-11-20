import type { Analysis, TextBlock } from './types';

/** The contract's `sourceText` limit (DD-IMP-04). */
export const SOURCE_LIMIT = 60000;

/** S-01: `[M b 22] Name` — column, then bold, italic, list item, and the size when it differs from the body by ≥ 0.5 pt. */
export function blockLine(block: TextBlock, bodySize: number): string {
  const tags: string[] = [block.column];
  if (block.bold) tags.push('b');
  if (block.italic) tags.push('i');
  if (block.listItem) tags.push('li');
  if (Math.abs(block.size - bodySize) >= 0.5) tags.push(String(Math.round(block.size * 10) / 10));
  return `[${tags.join(' ')}] ${block.text}`;
}

/** Lines joined and cut at a line boundary so the text stays within the limit (S-02). */
export function capLines(lines: readonly string[]): { text: string; capped: boolean } {
  let length = -1;
  for (let index = 0; index < lines.length; index++) {
    length += lines[index]!.length + 1;
    if (length > SOURCE_LIMIT) return { text: lines.slice(0, index).join('\n'), capped: true };
  }
  return { text: lines.join('\n'), capped: false };
}

/** ADR-055 §3: the intermediate text sent to the server, one block per line. */
export const serialize = (analysis: Analysis) => capLines(analysis.blocks.map(block => blockLine(block, analysis.bodySize)));
