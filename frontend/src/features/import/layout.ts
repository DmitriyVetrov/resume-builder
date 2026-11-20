import type { Analysis, Column, Extraction, PdfImage, PdfRun, TextBlock } from './types';

/**
 * ADR-055 §3: layout analysis over the extracted runs. Size, weight, style, case and position only (DD-IMP-11).
 * Columns come from a vertical gutter on page 1 that no text crosses below a full-width header; the sidebar is the
 * narrower column. Reading order: the full-width header, then main top to bottom over the pages, then the sidebar.
 */
type Region = 'header' | 'left' | 'right' | 'all';
/** `marked`: the line starts an item by a glyph or a drawn marker; `item`: its tagged list item, if any. */
type Line = { page: number; baseline: number; x: number; right: number; size: number; bold: boolean; italic: boolean; listItem: boolean; glyph: boolean; marked: boolean; item: number | null; markup: string; plain: string };

const GLYPH = /^[●•▪■◦‣∙○◆▸►✓*–-]\s+/u;
const LONE_GLYPH = /^[●•▪■◦‣∙○◆▸►✓*–-]$/u;
const MIN_GUTTER = 8;

const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeHref = (value: string) => escapeText(value).replace(/"/g, '&quot;');
const round = (value: number) => Math.round(value * 100) / 100;
const hasLetters = (run: PdfRun) => /\p{L}/u.test(run.text);

/** The most common size by character count; a tie goes to the smaller size. */
function bodySizeOf(runs: PdfRun[]): number {
  const counts = new Map<number, number>();
  for (const run of runs) counts.set(run.size, (counts.get(run.size) ?? 0) + run.text.trim().length);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

type Gutter = { from: number; to: number };

/**
 * A page's gutter: the widest vertical band that text does not cross, except text above the top of both columns
 * (a full-width header). Both sides need two runs with letters and must overlap vertically, so right-aligned dates
 * or a stray short line are not a column.
 */
function gutterOf(runs: PdfRun[], width: number): Gutter | null {
  let best: Gutter | null = null;
  let open: number | null = null;
  const valid = (g: number) => {
    const left = runs.filter(run => run.x + run.width <= g);
    const right = runs.filter(run => run.x >= g);
    if (left.filter(hasLetters).length < 2 || right.filter(hasLetters).length < 2) return false;
    const top = Math.max(Math.min(...left.map(run => run.baseline)), Math.min(...right.map(run => run.baseline)));
    const overlap = Math.min(Math.max(...left.map(run => run.baseline)), Math.max(...right.map(run => run.baseline))) - top;
    if (overlap <= 0) return false;
    return runs.every(run => run.x + run.width <= g || run.x >= g || run.baseline < top - run.size);
  };
  const last = Math.round(width * 0.85);
  for (let g = Math.round(width * 0.15); g <= last + 1; g++) {
    const ok = g <= last && valid(g);
    if (ok && open === null) open = g;
    if (!ok && open !== null) {
      if (g - open >= MIN_GUTTER && (!best || g - open > best.to - best.from)) best = { from: open, to: g - 1 };
      open = null;
    }
  }
  return best;
}

function regionOf(run: PdfRun, gutter: Gutter | null): Region {
  if (!gutter) return 'all';
  const middle = (gutter.from + gutter.to) / 2;
  if (run.x + run.width <= middle) return 'left';
  if (run.x >= middle) return 'right';
  return 'header';
}

/**
 * Runs of one region on one baseline, left to right. A wide gap splits a baseline into separate lines: list
 * columns, separate contacts, or dates set to the right edge.
 */
function linesOf(runs: PdfRun[], page: number, markers: Extraction['markers']): Line[] {
  // A drawn bullet sits inside the text column; a dot left of all the text is decoration (a timeline).
  const left = Math.min(...runs.map(run => run.x));
  // A dot right after text on its row separates items on one line (contacts); it is not a bullet.
  const separator = (item: Extraction['markers'][number]) => runs.some(run => Math.abs(run.baseline - item.y) <= run.size && run.x + run.width <= item.x && item.x - (run.x + run.width) <= run.size * 0.8);
  const bullets = markers.filter(item => item.page === page && item.x >= left - 0.5 && !separator(item));
  const sorted = [...runs].sort((a, b) => a.baseline - b.baseline || a.x - b.x);
  const rows: PdfRun[][] = [];
  for (const run of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(run.baseline - row[0]!.baseline) <= Math.max(run.size, row[0]!.size) * 0.3) row.push(run);
    else rows.push([run]);
  }
  const lines: Line[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let group: PdfRun[] = [];
    for (const run of row) {
      const previous = group.at(-1);
      if (previous && run.x - (previous.x + previous.width) > Math.max(run.size, previous.size) * 1.5) {
        lines.push(lineOf(group, page, bullets));
        group = [];
      }
      group.push(run);
    }
    if (group.length) lines.push(lineOf(group, page, bullets));
  }
  return lines;
}

function lineOf(runs: PdfRun[], page: number, markers: Extraction['markers']): Line {
  const visible = runs.filter(run => run.text.trim());
  // DD-IMP-27: a glyph set as a run of its own ("●", then the text) marks the line but does not decide its weight.
  const lone = visible.length > 1 && LONE_GLYPH.test(visible[0]!.text.trim()) ? visible[0] : undefined;
  const styled = visible.filter(run => run !== lone);
  const bold = styled.every(run => run.bold);
  const italic = styled.every(run => run.italic);
  const size = Math.max(...runs.map(run => run.size));
  // Text pieces with their own marks; a space is added where the PDF leaves a gap instead of a space glyph.
  const pieces: { text: string; bold: boolean; italic: boolean; href: string | null }[] = [];
  runs.forEach((run, index) => {
    if (run === lone) return;
    const previous = runs[index - 1];
    let text = run.text;
    if (previous && run.x - (previous.x + previous.width) > run.size * 0.2 && !/\s$/.test(previous.text) && !/^\s/.test(text)) text = ` ${text}`;
    pieces.push({ text, bold: run.bold && !bold, italic: run.italic && !italic, href: run.href });
  });
  const found = lone ? null : GLYPH.exec(pieces[0]?.text.trimStart() ?? '');
  if (found && pieces[0]) pieces[0] = { ...pieces[0], text: pieces[0].text.trimStart().slice(found[0].length) };
  const glyph = Boolean(lone || found);
  const x = runs[0]!.x;
  const baseline = runs[0]!.baseline;
  // A drawn list marker is small next to the text; a larger dot is decoration, not a bullet.
  const marker = markers.some(item => item.page === page && item.size <= size * 0.55 && item.x < x && x - item.x <= size * 3 && item.y >= baseline - size && item.y <= baseline);
  let markup = '';
  let plain = '';
  for (const piece of pieces) {
    if (!piece.text) continue;
    plain += piece.text;
    // Spaces stay outside the tags, so a styled word keeps its neighbours' spacing.
    const [, before = '', core = '', after = ''] = /^(\s*)(.*?)(\s*)$/s.exec(piece.text) ?? [];
    let value = escapeText(core);
    if (value) {
      if (piece.italic) value = `<i>${value}</i>`;
      if (piece.bold) value = `<b>${value}</b>`;
      if (piece.href) value = `<a href="${escapeHref(piece.href)}">${value}</a>`;
    }
    markup += before + value + after;
  }
  return {
    page, baseline, x, right: Math.max(...runs.map(run => run.x + run.width)), size, bold, italic,
    listItem: glyph || marker || runs.some(run => run.listItem), glyph, marked: glyph || marker,
    item: runs.find(run => run.item !== undefined && run.item !== null)?.item ?? null,
    markup: joinLinks(markup.replace(/\s+/g, ' ').trim()), plain: plain.replace(/\s+/g, ' ').trim(),
  };
}

/** One link drawn as several runs (`<a>learn</a> <a>more</a>`) is one link again. */
const SPLIT_LINK = /<a href="([^"]*)">((?:(?!<\/a>).)*)<\/a>(\s*)<a href="\1">/;
function joinLinks(markup: string): string {
  let value = markup;
  while (SPLIT_LINK.test(value)) value = value.replace(SPLIT_LINK, '<a href="$1">$2$3');
  return value;
}

const startsLower = (value: string) => /^[\p{Ll}\p{N}(,;:.)]/u.test(value);

/** Whether `next` continues the block whose first line is `first` and last line `last`. */
function continues(first: Line, last: Line, next: Line, right: number): boolean {
  if (next.page !== last.page || next.marked || next.baseline <= last.baseline) return false;
  // A tagged item's lines belong to it by the structure tree.
  if (next.item !== null) return next.item === first.item && next.baseline - last.baseline <= last.size * 2;
  // A bold line continues only a bold line: a title wrapped over two lines, never a title into its body.
  if (next.listItem || next.bold !== last.bold) return false;
  if (next.size !== last.size || next.italic !== last.italic) return false;
  if (next.baseline - last.baseline > last.size * 1.6 || next.baseline <= last.baseline) return false;
  if (first.listItem) {
    // A hanging indent: the text of a glyph item starts right of its glyph; a marked or tagged item's text at its x.
    if (first.glyph ? next.x <= first.x + 0.5 || next.x > first.x + next.size * 3 : Math.abs(next.x - first.x) > 1) return false;
  } else if (Math.abs(next.x - last.x) > 1) return false;
  // A wrapped line fills most of its column; a short line before a lower-case start is a list of short items.
  const fill = (last.right - last.x) / Math.max(1, right - last.x);
  if (startsLower(next.plain)) return fill >= 0.6;
  return fill >= 0.85 && last.plain.split(' ').length >= 4 && !/[.:!?]$/.test(last.plain);
}

/** Lines to blocks. Several blocks stay open at once, so side-by-side list columns each keep their own items. */
function blocksOf(lines: Line[], column: Column): TextBlock[] {
  type Open = { first: Line; last: Line; markup: string; plain: string };
  const blocks: Open[] = [];
  let open: Open[] = [];
  // The right edge of the text that starts where a line starts: its column, or its list column.
  const rightOf = (line: Line) => Math.max(...lines.filter(other => other.page === line.page && Math.abs(other.x - line.x) <= 1.5).map(other => other.right));
  for (const line of lines) {
    if (!line.plain) continue;
    open = open.filter(item => item.last.page === line.page && line.baseline - item.last.baseline <= item.last.size * 1.6);
    const target = [...open].reverse().find(item => continues(item.first, item.last, line, rightOf(item.last)));
    if (target) {
      // A line broken after a hyphen or a slash joins without a space ("on-" + "premises", "CI/" + "CD").
      const space = /[\p{L}\p{N}][-/]$/u.test(target.plain) ? '' : ' ';
      target.markup = joinLinks(target.markup + space + line.markup);
      target.plain += space + line.plain;
      target.last = line;
      continue;
    }
    const block = { first: line, last: line, markup: line.markup, plain: line.plain };
    blocks.push(block);
    open.push(block);
  }
  return blocks.map(({ first, markup, plain }) => ({ column, page: first.page, top: round(first.baseline - first.size), x: round(first.x), size: first.size, bold: first.bold, italic: first.italic, listItem: first.listItem, text: markup, plain }));
}

/** DD-IMP-15: the largest near-square image on page 1, in the header band or the sidebar. Icons are not counted. */
function photoOf(images: PdfImage[], sidebar: (image: PdfImage) => boolean, pageHeight: number) {
  const counted = images.filter(image => Math.min(image.width, image.height) >= 24);
  const candidates = counted.filter(image => {
    const aspect = image.width / image.height;
    return image.page === 0 && aspect >= 0.8 && aspect <= 1.25 && Math.min(image.width, image.height) >= 64 && (image.top < pageHeight * 0.3 || sidebar(image));
  }).sort((a, b) => b.width * b.height - a.width * a.height || a.top - b.top || a.x - b.x);
  const photo = candidates[0] ?? null;
  return { photo, droppedImages: counted.length - (photo ? 1 : 0) };
}

/**
 * A template may print a line in capitals that the document metadata (author, title) holds as typed: the metadata's
 * spelling is the source's own, so an all-caps block that equals one of its parts ignoring case takes that spelling.
 */
function restoreCase(block: TextBlock, labels: readonly string[]): TextBlock {
  if (block.plain !== block.plain.toLocaleUpperCase() || block.plain === block.plain.toLocaleLowerCase() || block.text !== escapeText(block.plain)) return block;
  const typed = labels.find(label => label !== block.plain && label.toLocaleUpperCase() === block.plain);
  return typed ? { ...block, plain: typed, text: escapeText(typed) } : block;
}

export function analyze(extraction: Extraction): Analysis {
  const bodySize = bodySizeOf(extraction.runs);
  // Page 1 decides the columns; a later page splits only at a gutter that overlaps page 1's.
  const first = extraction.pages[0] ? gutterOf(extraction.runs.filter(run => run.page === 0), extraction.pages[0].width) : null;
  const gutters = extraction.pages.map((page, index) => {
    if (!first) return null;
    if (index === 0) return first;
    const gutter = gutterOf(extraction.runs.filter(run => run.page === index), page.width);
    return gutter && gutter.from <= first.to && gutter.to >= first.from ? gutter : null;
  });
  // The sidebar is the side whose text spans less width.
  let sidebarSide: 'left' | 'right' | null = null;
  if (first) {
    const runs = extraction.runs.filter(run => run.page === 0);
    const left = runs.filter(run => regionOf(run, first) === 'left');
    const right = runs.filter(run => regionOf(run, first) === 'right');
    const leftWidth = first.from - Math.min(...left.map(run => run.x));
    const rightWidth = Math.max(...right.map(run => run.x + run.width)) - first.to;
    sidebarSide = leftWidth <= rightWidth ? 'left' : 'right';
  }
  const header: Line[] = [];
  const main: Line[] = [];
  const side: Line[] = [];
  extraction.pages.forEach((_, page) => {
    const runs = extraction.runs.filter(run => run.page === page);
    const gutter = gutters[page] ?? null;
    // A row with any run across the gutter is header as a whole, so a full-width line is not cut in two.
    const regions = new Map(runs.map(run => [run, regionOf(run, gutter)]));
    for (const run of runs) {
      if (regions.get(run) === 'header') for (const other of runs) if (Math.abs(other.baseline - run.baseline) <= Math.max(other.size, run.size) * 0.3) regions.set(other, 'header');
    }
    for (const region of ['header', 'left', 'right', 'all'] as const) {
      const lines = linesOf(runs.filter(run => regions.get(run) === region), page, extraction.markers);
      if (region === 'header') header.push(...lines);
      else if (region === 'all' || region !== sidebarSide) main.push(...lines);
      else side.push(...lines);
    }
  });
  const labels = (extraction.labels ?? []).flatMap(label => [label, ...label.split(/\s+[—–|-]\s+/)]).map(label => label.trim()).filter(Boolean);
  const blocks = [...blocksOf(header, 'M'), ...blocksOf(main, 'M'), ...blocksOf(side, 'S')].map(block => restoreCase(block, labels));
  const isSidebar = (image: PdfImage) => {
    if (!first || !sidebarSide) return false;
    const middle = (first.from + first.to) / 2;
    return sidebarSide === 'left' ? image.x + image.width <= middle : image.x >= middle;
  };
  const { photo, droppedImages } = photoOf(extraction.images, isSidebar, extraction.pages[0]?.height ?? 0);
  return { columns: first ? 2 : 1, sidebarSide, bodySize, pages: extraction.pages.length, blocks, photo, droppedImages };
}
