import type { Line, PlacedIcon, Shape } from './page-model';
import { q } from './quantize';

/**
 * A flow block: unbreakable, positioned relative to its own top. Keep-with-next (PG-01, PG-02) is
 * expressed by merging blocks, so pagination only ever has to ask whether one block fits.
 */
export type Flow = {
  before: number; height: number; lines: Line[]; shapes: Shape[]; icons: PlacedIcon[]; lineCount: number; breakBefore: boolean;
  /** T1's line: where it starts inside this flow, so a merged section title does not carry it upward. */
  timeline: { id: string; x: number; offset: number } | null;
  /** Null is the header. */
  sectionId: string | null;
  /** The column this flow occupies, for the selection region. */
  box: { x: number; width: number };
  oversized: boolean;
};

export const emptyFlow = (before = 0): Flow => ({ before, height: 0, lines: [], shapes: [], icons: [], lineCount: 0, breakBefore: false, timeline: null, sectionId: null, box: { x: 0, width: 0 }, oversized: false });

export const moved = <T extends { y: number }>(item: T, dy: number): T => ({ ...item, y: q(item.y + dy) });
export const movedLine = (line: Line, dy: number): Line => ({ ...line, y: q(line.y + dy), baseline: q(line.baseline + dy) });

/** `next` under `flow`, keeping its own gap. */
export function append(flow: Flow, next: Flow): Flow {
  const top = flow.height + next.before;
  return {
    ...flow,
    height: top + next.height,
    lineCount: flow.lineCount + next.lineCount,
    lines: [...flow.lines, ...next.lines.map(line => movedLine(line, top))],
    shapes: [...flow.shapes, ...next.shapes.map(shape => moved(shape, top))],
    icons: [...flow.icons, ...next.icons.map(icon => moved(icon, top))],
    timeline: flow.timeline ?? (next.timeline && { ...next.timeline, offset: next.timeline.offset + top }),
  };
}

/**
 * Merges following flows into `head` until at least `lines` lines of content came with it (PG-01, PG-02).
 * A manual break outranks keeping (ADR-010 §10): the head travels with a break on its first content, and is never pulled across a later one.
 */
export function keepWith(head: Flow, following: Flow[], lines = 2): Flow[] {
  const rest = [...following];
  let merged = head;
  let taken = 0;
  while (taken < lines && rest.length) {
    if ((rest[0] as Flow).breakBefore && taken > 0) break;
    const next = rest.shift() as Flow;
    merged = { ...append(merged, next), breakBefore: merged.breakBefore || next.breakBefore };
    taken += next.lineCount;
  }
  return [merged, ...rest];
}

const clipped = <T extends { y: number; height: number }>(item: T, from: number, to: number, base: number): T[] => {
  const top = Math.max(item.y, from);
  const bottom = Math.min(item.y + item.height, to);
  return bottom > top ? [{ ...item, y: q(top - base), height: q(bottom - top) }] : [];
};

/** Splits a flow taller than a whole page by rows (PG-09). A shape over several rows is cut into them, so a band or chip stays behind its text. */
export function splitOversized(flow: Flow): Flow[] {
  const rows = new Map<number, Line[]>();
  for (const line of flow.lines) rows.set(line.y, [...(rows.get(line.y) ?? []), line]);
  const ordered = [...rows.entries()].sort((a, b) => a[0] - b[0]);
  const bottomOf = (lines: Line[], y: number) => y + Math.max(...lines.map(line => line.height));
  return ordered.map(([y, lines], index) => {
    // The first row keeps its offset inside the flow, so padding above the first line stays.
    const base = index === 0 ? 0 : y;
    const from = index === 0 ? -Infinity : y;
    const to = ordered[index + 1]?.[0] ?? Infinity;
    const previous = ordered[index - 1];
    return {
      ...emptyFlow(index === 0 ? flow.before : y - bottomOf(previous![1], previous![0])),
      height: bottomOf(lines, y) - base, lineCount: 1, sectionId: flow.sectionId, box: flow.box, oversized: true,
      timeline: flow.timeline && { ...flow.timeline, offset: index === 0 ? flow.timeline.offset : 0 },
      breakBefore: index === 0 && flow.breakBefore,
      lines: lines.map(line => movedLine(line, -base)),
      shapes: flow.shapes.flatMap(shape => clipped(shape, from, to, base)),
      icons: flow.icons.filter(icon => icon.y >= from && icon.y < to).map(icon => moved(icon, -base)),
    };
  });
}
