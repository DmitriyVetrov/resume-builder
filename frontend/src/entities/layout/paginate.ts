import type { ResolvedDesign } from '../template';
import { moved, movedLine, splitOversized, type Flow } from './flow';
import type { Hint, Line, Page, PlacedImage, Shape } from './page-model';
import { q } from './quantize';

type Cursor = { page: number; y: number; empty: boolean };
type Span = { top: number; bottom: number; first: boolean; x: number };

/**
 * §8, ADR-010 §10: a flow goes on the next page if it does not fit, and space before it is dropped at a page top.
 * The header comes first; each zone then walks from where the header ended, so T3's columns paginate on their own and share pages.
 */
export function paginate(design: ResolvedDesign, header: Flow | null, images: PlacedImage[], zones: Flow[][], background: Shape | null = null): { pages: Page[]; hints: Hint[] } {
  const { page, definition } = design;
  const bottom = page.height - page.margins.bottom;
  const newPage = (number: number): Page => ({ number, width: page.width, height: page.height, lines: [], shapes: [], images: [], icons: [], regions: [], links: [] });
  const pages = [newPage(1)];
  pages[0]!.images = images;
  const pageAt = (index: number): Page => {
    while (pages.length <= index) pages.push(newPage(pages.length + 1));
    return pages[index] as Page;
  };
  const marks = new Map<string, Map<number, Span>>();
  const hints = new Map<string, Hint>();
  const lastByZonePage = new Map<string, { page: number; flow: Flow }>();

  const extendHint = (kind: Hint['kind'], pageIndex: number, sectionId: string | null, x: number, y: number, width: number, height: number) => {
    const key = `${kind}:${pageIndex}:${sectionId}`;
    const seen = hints.get(key);
    hints.set(key, seen ? { ...seen, height: q(y + height - seen.y) } : { kind, page: pageIndex + 1, sectionId, x: q(x), y: q(y), width: q(width), height: q(height) });
  };

  const place = (cursor: Cursor, flow: Flow, zone: number) => {
    let y = cursor.empty ? cursor.y : cursor.y + flow.before;
    if ((!cursor.empty && y + flow.height > bottom) || (flow.breakBefore && !cursor.empty)) {
      cursor.page += 1;
      cursor.y = page.continuationTop;
      y = cursor.y;
      cursor.empty = true;
    }
    const current = pageAt(cursor.page);
    current.lines.push(...flow.lines.map(line => movedLine(line, y)));
    current.shapes.push(...flow.shapes.map(shape => moved(shape, y)));
    current.icons.push(...flow.icons.map(icon => moved(icon, y)));
    // One region per section and column: T4's header is in both columns (DD-TPL-06).
    const region = current.regions.find(item => item.sectionId === flow.sectionId && item.x === q(flow.box.x));
    if (region) region.height = q(y + flow.height - region.y);
    else current.regions.push({ sectionId: flow.sectionId, x: q(flow.box.x), y: q(y), width: q(flow.box.width), height: q(flow.height) });
    if (flow.timeline) {
      const bySection = marks.get(flow.timeline.id) ?? new Map<number, Span>();
      const seen = bySection.get(cursor.page);
      bySection.set(cursor.page, { top: seen?.top ?? y + flow.timeline.offset, bottom: y + flow.height, first: seen?.first ?? bySection.size === 0, x: flow.timeline.x });
      marks.set(flow.timeline.id, bySection);
    }
    if (flow.oversized) extendHint('oversized', cursor.page, flow.sectionId, flow.box.x, y, flow.box.width, flow.height);
    lastByZonePage.set(`${zone}:${cursor.page}`, { page: cursor.page, flow: { ...flow, lines: flow.lines.map(line => movedLine(line, y)) } });
    cursor.y = y + flow.height;
    cursor.empty = false;
  };

  // The header has the whole first page; anything else has what a continuation page leaves.
  const headerTop = definition.header.kind === 'band' ? 0 : page.margins.top;
  const start: Cursor = { page: 0, y: headerTop, empty: true };
  // ADR-054: a split header has no flow of its own; its halves lead their zones.
  if (header) for (const flow of header.height > bottom - headerTop ? splitOversized(header) : [header]) place(start, flow, -1);
  const available = bottom - page.continuationTop;
  zones.forEach((flows, zone) => {
    const cursor = { ...start };
    for (const flow of flows) {
      // ADR-054, PG-06: a split header's half leads its zone on page 1 and has that page's room; only a longer half breaks (PG-09).
      const room = flow.sectionId === null && cursor.empty ? bottom - cursor.y : available;
      for (const part of flow.height > room ? splitOversized(flow) : [flow]) place(cursor, part, zone);
    }
  });

  const timeline = definition.entries.timeline;
  if (timeline) {
    for (const bySection of marks.values()) {
      for (const [index, span] of bySection) {
        const from = span.first ? span.top + timeline.dotTop : span.top;
        const line: Shape = { role: 'timeline', x: q(span.x), y: q(from), width: q(timeline.width), height: q(span.bottom - from), radius: 0, fill: definition.colors.line };
        (pages[index] as Page).shapes.unshift(line);
      }
    }
  }
  // ADR-054: the sidebar panel lies under everything, on every page.
  if (background) for (const current of pages) current.shapes.unshift({ ...background });
  // FR-PRV-07, the safety net: the last line of a column on a page is a section title.
  for (const { page: index, flow } of lastByZonePage.values()) {
    const last = flow.lines.reduce<Line | null>((best, line) => !best || line.y >= best.y ? line : best, null);
    if (last?.role === 'sectionTitle') extendHint('lone-title', index, flow.sectionId, last.x, last.y, last.width, last.height);
  }
  for (const current of pages) {
    current.links = current.lines.flatMap(line => line.runs.filter(run => run.link).map(run => ({ x: q(line.x + run.x), y: line.y, width: run.width, height: line.height, url: run.link as string })));
  }
  const order = (hint: Hint) => hint.page * 1000 + (hint.kind === 'oversized' ? 0 : 1);
  return { pages, hints: [...hints.values()].sort((a, b) => order(a) - order(b)) };
}
