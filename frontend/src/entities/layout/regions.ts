import type { Anchor, Line, Page } from './page-model';

const distance = (from: number, start: number, length: number) => from < start ? start - from : from > start + length ? from - start - length : 0;

/** FR-PRV-08: the section, entry or item under a point in page points. Null outside every region. */
export function anchorAt(page: Page, x: number, y: number): Anchor | null {
  const region = page.regions.find(item => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
  if (!region) return null;
  let best: Line | null = null;
  let bestRow = Infinity;
  let bestColumn = Infinity;
  for (const line of page.lines) {
    if ((line.anchor?.sectionId ?? null) !== region.sectionId) continue;
    const row = distance(y, line.y, line.height);
    const column = distance(x, line.x, line.width);
    if (row < bestRow || (row === bestRow && column < bestColumn)) { best = line; bestRow = row; bestColumn = column; }
  }
  return best?.anchor ?? { sectionId: region.sectionId, entryId: null, itemId: null };
}
