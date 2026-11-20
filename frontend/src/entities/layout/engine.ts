import { deriveContactUrl } from '../resume/contact-link';
import { formatEntryDates } from '../resume/dates';
import { isSectionEmpty, type Entry, type ResumeDocument, type Section } from '../resume/operations';
import { isSafeUrl } from '../resume/safe-url';
import type { components } from '../../shared/api/generated/schema';
import { listColumnsFor, placementFor, resolveDesign, type ResolvedDesign, type StyleId, type TemplateDefinition } from '../template';
import { composeLines, type ComposedLine, type Span } from './compose';
import { append, emptyFlow, keepWith, movedLine, type Flow } from './flow';
import { faceKey, type FontBook } from './fonts';
import { paginate } from './paginate';
import type { Anchor, ContactKind, Line, PageModel, PlacedImage, Shape } from './page-model';
import { q } from './quantize';

type Inline = components['schemas']['Inline'];
type Block_ = components['schemas']['Block'];

type Ctx = { fonts: FontBook; design: ResolvedDesign; document: ResumeDocument };

/** ADR-010: the scheme rule again at paint and PDF time; an unsafe URL renders as plain text. */
const safeLinkUrl = (url: string | null) => url && isSafeUrl(url) ? url : null;

/** ADR-024: links outside T3's band have the link colour; inside it they stay white. */
const onBand = (ctx: Ctx, styleId: StyleId) => styleId === 'contact' && ctx.design.definition.header.kind === 'band';

function spanOf(ctx: Ctx, styleId: StyleId, text: string, marks: { bold?: boolean; italic?: boolean; underline?: boolean; link?: string | null } = {}): Span {
  const style = ctx.design.styles[styleId];
  const link = marks.link ?? null;
  return {
    text: style.upper ? text.toUpperCase() : text,
    face: faceKey(ctx.design.font.id, style.bold || !!marks.bold, style.italic || !!marks.italic),
    size: style.size,
    color: link && !onBand(ctx, styleId) ? ctx.design.link.color : style.color,
    underline: !!marks.underline,
    link,
  };
}

function inlineSpans(ctx: Ctx, styleId: StyleId, inlines: Inline[]): Span[] {
  return inlines.flatMap<Span>(inline => {
    if (inline.kind === 'lineBreak') return [spanOf(ctx, styleId, '\n')];
    if (inline.kind === 'link') {
      const url = safeLinkUrl(inline.url);
      return inline.children.map(run => spanOf(ctx, styleId, run.value, { ...run, link: url }));
    }
    return [spanOf(ctx, styleId, inline.value, inline)];
  });
}

function placeLine(ctx: Ctx, composed: ComposedLine, styleId: StyleId, x: number, y: number, anchor: Anchor | null, block: string | null = null): Line {
  const style = ctx.design.styles[styleId];
  // The document's font sets the baseline, also when a line starts with a fallback letter (DD-P12-22).
  const first = composed.runs.find(run => run.face.startsWith(`${ctx.design.font.id}/`));
  const { ascent, descent } = ctx.fonts.vertical(first?.face ?? faceKey(ctx.design.font.id, style.bold, style.italic), style.size);
  return { x: q(x), y: q(y), width: composed.width, height: style.lineHeight, baseline: q(y + (style.lineHeight - (ascent + descent)) / 2 + ascent), role: styleId, runs: composed.runs, anchor, block };
}

const anchorOf = (sectionId: string | null, entryId: string | null = null, itemId: string | null = null): Anchor => ({ sectionId, entryId, itemId });
const ICON_SIZE = 9;
const ICON_GAP = 3;
const round = (x: number, y: number, width: number, height: number, radius: number, fill: string, role: Shape['role']): Shape => ({ role, x: q(x), y: q(y), width: q(width), height: q(height), radius, fill });

/** Lines of one paragraph as flows: PG-04 keeps at least two lines on each side of a break. */
function paragraphFlows(ctx: Ctx, spans: Span[], styleId: StyleId, x: number, width: number, anchor: Anchor | null, before: number, block: string): Flow[] {
  const composed = composeLines(ctx.fonts, spans, width);
  const { lineHeight } = ctx.design.styles[styleId];
  const toFlow = (slice: ComposedLine[], gap: number): Flow => ({
    ...emptyFlow(gap),
    height: slice.length * lineHeight,
    lineCount: slice.length,
    lines: slice.map((line, index) => placeLine(ctx, line, styleId, x, index * lineHeight, anchor, block)),
  });
  if (composed.length <= 3) return composed.length ? [toFlow(composed, before)] : [];
  const flows = [toFlow(composed.slice(0, 2), before)];
  for (let index = 2; index < composed.length - 2; index++) flows.push(toFlow(composed.slice(index, index + 1), 0));
  flows.push(toFlow(composed.slice(-2), 0));
  return flows;
}

/** One bullet cell: marker plus text, relative to the row. */
function bulletCell(ctx: Ctx, inlines: Inline[], styleId: StyleId, textX: number, width: number, anchor: Anchor, block: string) {
  const { lineHeight } = ctx.design.styles[styleId];
  const composed = composeLines(ctx.fonts, inlineSpans(ctx, styleId, inlines), width);
  const { marker } = ctx.design;
  return {
    height: Math.max(composed.length, 1) * lineHeight,
    lines: composed.map((line, index) => placeLine(ctx, line, styleId, textX, index * lineHeight, anchor, block)),
    marker: round(textX - marker.slot, marker.top, marker.width, marker.height, marker.radius, marker.fill, 'marker'),
    count: composed.length,
  };
}

type Bullet = { inlines: Inline[]; anchor: Anchor; block: string };

/** §6.6, §6.7. Two columns fill row by row and a row is atomic (PG-05). A one-column item of up to four lines is atomic (PG-03). */
function bulletFlows(ctx: Ctx, items: Bullet[], styleId: StyleId, x: number, width: number, columns: number, indent: number, secondColumnX: number, textWidth: number, rowGap: number, firstBefore: number): Flow[] {
  const flows: Flow[] = [];
  const step = columns === 2 ? 2 : 1;
  for (let index = 0; index < items.length; index += step) {
    const before = index === 0 ? firstBefore : rowGap;
    const left = items[index] as Bullet;
    const right = step === 2 ? items[index + 1] : undefined;
    const a = bulletCell(ctx, left.inlines, styleId, x + indent, columns === 2 ? textWidth : width - indent, left.anchor, left.block);
    const b = right ? bulletCell(ctx, right.inlines, styleId, secondColumnX, textWidth, right.anchor, right.block) : null;
    if (step === 1 && a.count > 4) {
      const parts = paragraphFlows(ctx, inlineSpans(ctx, styleId, left.inlines), styleId, x + indent, width - indent, left.anchor, before, left.block);
      (parts[0] as Flow).shapes.push(a.marker);
      flows.push(...parts);
      continue;
    }
    flows.push({ ...emptyFlow(before), height: Math.max(a.height, b?.height ?? 0), lineCount: Math.max(a.count, b?.count ?? 0), lines: [...a.lines, ...(b?.lines ?? [])], shapes: [a.marker, ...(b ? [b.marker] : [])] });
  }
  return flows;
}

/** A description or a text section: paragraphs and bullet lists mixed (§5.7). */
function richFlows(ctx: Ctx, blocks: Block_[], section: Section, x: number, width: number, anchor: Anchor, firstBefore: number, inEntry: boolean): Flow[] {
  const { gaps } = ctx.design.definition;
  const flows: Flow[] = [];
  blocks.forEach((block, index) => {
    const before = index === 0 ? firstBefore : gaps.paragraph;
    if (block.kind === 'paragraph') {
      flows.push(...paragraphFlows(ctx, inlineSpans(ctx, 'body', block.inlines), 'body', x, width, anchor, before, `p${index}`));
      return;
    }
    const columns = listColumnsFor(section, ctx.design.definition) === 2 ? 2 : 1;
    const { marker } = ctx.design;
    const textWidth = (width - marker.slot - gaps.columnGutter) / 2;
    const rowGap = inEntry && columns === 2 ? gaps.descriptionRow : gaps.listRow;
    flows.push(...bulletFlows(ctx, block.items.map((inlines, item) => ({ inlines, anchor, block: `l${index}/${item}` })), 'body', x, width, columns, marker.slot, x + marker.slot + textWidth + gaps.columnGutter, textWidth, rowGap, before));
  });
  return flows;
}

/**
 * ADR-054 entry heads. `title-dates`: the title, then `| dates` on its last row when it fits, else on the next row; then
 * "Organization · Location". `compact`: the title, then one line "Organization, Location, dates". Separators are layout
 * text (DD-TPL-07). Returns the head's height.
 */
function alternateHead(ctx: Ctx, entry: Entry, head: Flow, left: number, inner: number, anchor: Anchor, kind: 'title-dates' | 'compact'): number {
  const { design, fonts, document } = ctx;
  let y = 0;
  const titleHeight = design.styles.entryTitle.lineHeight;
  for (const line of composeLines(fonts, entry.title ? [spanOf(ctx, 'entryTitle', entry.title)] : [], inner)) {
    head.lines.push(placeLine(ctx, line, 'entryTitle', left, y, anchor));
    y += titleHeight;
  }
  const dates = formatEntryDates(entry, document.language, document.dateFormat);
  const meta = (spans: Span[], styleId: StyleId) => {
    const { lineHeight } = design.styles[styleId];
    for (const line of composeLines(fonts, spans, inner)) { head.lines.push(placeLine(ctx, line, styleId, left, y, anchor)); y += lineHeight; }
  };
  if (kind === 'compact') {
    const parts: [StyleId, string][] = [['entryOrganization', entry.organization], ['entryLocation', entry.location], ['entryDates', dates]];
    const present = parts.filter(([, value]) => value);
    meta(present.flatMap(([styleId, value], index) => [...(index ? [spanOf(ctx, styleId, ', ')] : []), spanOf(ctx, styleId, value)]), 'entryOrganization');
    return y;
  }
  if (dates) {
    const lastTitle = head.lines[head.lines.length - 1];
    const spans = lastTitle ? [spanOf(ctx, 'entryTitle', '| '), spanOf(ctx, 'entryDates', dates)] : [spanOf(ctx, 'entryDates', dates)];
    const single = composeLines(fonts, spans, Number.MAX_SAFE_INTEGER)[0] as ComposedLine;
    const offset = lastTitle ? lastTitle.width + design.definition.gaps.titleOrganization : 0;
    if (lastTitle && offset + single.width <= inner) {
      const placed = placeLine(ctx, single, 'entryDates', left + offset, lastTitle.y, anchor);
      head.lines.push({ ...placed, baseline: lastTitle.baseline });
    } else meta(spans, 'entryDates');
  }
  const where = [['entryOrganization', entry.organization], ['entryLocation', entry.location]].filter(([, value]) => value) as [StyleId, string][];
  meta(where.flatMap(([styleId, value], index) => [...(index ? [spanOf(ctx, 'entryOrganization', ' · ')] : []), spanOf(ctx, styleId, value)]), 'entryOrganization');
  return y;
}

function entryFlows(ctx: Ctx, section: Extract<Section, { type: 'entries' }>, entry: Entry, x: number, width: number, before: number, marked: boolean): Flow[] {
  const { design, fonts, document } = ctx;
  const { entries, gaps } = design.definition;
  const left = x + entries.indent;
  const inner = width - entries.indent;
  const anchor = anchorOf(section.id, entry.id);
  const head = emptyFlow(before);
  head.breakBefore = entry.pageBreakBefore;
  const timeline = entries.timeline;
  const mark = marked && timeline ? { id: section.id, x: x + timeline.x, offset: 0 } : null;
  head.timeline = mark;
  let y = 0;
  const title = design.styles.entryTitle;
  const headKind = entries.head ?? 'classic';
  if (headKind !== 'classic') y = alternateHead(ctx, entry, head, left, inner, anchor, headKind);
  else {
  const titleLines = composeLines(fonts, entry.title ? [spanOf(ctx, 'entryTitle', entry.title)] : [], inner);
  titleLines.forEach(line => { head.lines.push(placeLine(ctx, line, 'entryTitle', left, y, anchor)); y += title.lineHeight; });
  if (entry.organization) {
    const lastWidth = titleLines[titleLines.length - 1]?.width ?? 0;
    const spans = [spanOf(ctx, 'entryOrganization', entry.organization)];
    const offset = lastWidth ? lastWidth + gaps.titleOrganization : 0;
    const single = composeLines(fonts, spans, Number.MAX_SAFE_INTEGER)[0] as ComposedLine;
    if (titleLines.length && offset + single.width <= inner) {
      const lastTitle = head.lines[head.lines.length - 1] as Line;
      const placed = placeLine(ctx, single, 'entryOrganization', left + offset, lastTitle.y, anchor);
      head.lines.push({ ...placed, baseline: lastTitle.baseline });
    } else {
      for (const line of composeLines(fonts, spans, inner)) { head.lines.push(placeLine(ctx, line, 'entryOrganization', left, y, anchor)); y += design.styles.entryOrganization.lineHeight; }
    }
  }
  const dates = formatEntryDates(entry, document.language, document.dateFormat);
  const metaHeight = design.styles.entryLocation.lineHeight;
  const location = entry.location ? composeLines(fonts, [spanOf(ctx, 'entryLocation', entry.location)], inner) : [];
  const dateLines = dates ? composeLines(fonts, [spanOf(ctx, 'entryDates', dates)], inner) : [];
  const firstDate = dateLines[0];
  location.forEach((line, index) => { head.lines.push(placeLine(ctx, line, 'entryLocation', left, y + index * metaHeight, anchor)); });
  const lastLocation = location[location.length - 1];
  if (firstDate) {
    const fits = !lastLocation || lastLocation.width + 8 + firstDate.width <= inner;
    const row = fits ? Math.max(location.length - 1, 0) : location.length;
    dateLines.forEach((line, index) => { head.lines.push(placeLine(ctx, line, 'entryDates', left + inner - line.width, y + (row + index) * metaHeight, anchor)); });
    y += (row + dateLines.length) * metaHeight;
  } else {
    y += location.length * metaHeight;
  }
  }
  head.height = y;
  head.lineCount = head.lines.length;
  if (entries.marker === 'dot' && entries.dot) {
    const { size } = entries.dot;
    head.shapes.push(round(x, (title.lineHeight - size) / 2, size, size, size / 2, design.accent, 'dot'));
  }
  if (timeline) {
    const { dot } = timeline;
    head.shapes.push(round(x + timeline.x + timeline.width / 2 - dot.width / 2, timeline.dotTop, dot.width, dot.height, dot.radius, design.accent, 'dot'));
  }
  const description = richFlows(ctx, entry.description, section, left, inner, anchor, gaps.descriptionTop, true);
  for (const flow of description) flow.timeline = mark;
  return keepWith(head, description);
}

function sectionFlows(ctx: Ctx, section: Section, x: number, width: number): Flow[] {
  const { design, fonts } = ctx;
  const { gaps, list } = design.definition;
  const anchor = anchorOf(section.id);
  const titleStyle = design.styles.sectionTitle;
  const titleLines = composeLines(fonts, [spanOf(ctx, 'sectionTitle', section.title)], width);
  const head: Flow = {
    ...emptyFlow(design.sectionSpaceAbove),
    height: titleLines.length * titleStyle.lineHeight,
    lineCount: 0,
    lines: titleLines.map((line, index) => placeLine(ctx, line, 'sectionTitle', x, index * titleStyle.lineHeight, anchor)),
  };
  const rule = design.sectionRule;
  if (rule && titleLines.length) {
    head.shapes.push(round(x, head.height + rule.gap, width, rule.height, 0, rule.fill, 'rule'));
    head.height += rule.gap + rule.height;
  }
  let content: Flow[] = [];
  switch (section.type) {
    case 'text':
    case 'inline':
      content = richFlows(ctx, section.content.body, section, x, width, anchor, gaps.sectionTitle, false);
      break;
    case 'list': {
      const kind = listColumnsFor(section, design.definition);
      if (kind === 'chips' && list.chip) {
        content = chipFlows(ctx, section.content.items.map((item, index) => ({ spans: inlineSpans(ctx, 'listItem', item.text), anchor: anchorOf(section.id, null, item.id), icon: null, block: `l/${index}` })), 'listItem', list.chip, x, width, gaps.sectionTitle);
        break;
      }
      const columns = kind === 2 ? 2 : 1;
      const styleId: StyleId = columns === 2 ? 'listItem' : list.oneColumnStyle;
      const items = section.content.items.map((item, index) => ({ inlines: item.text, anchor: anchorOf(section.id, null, item.id), block: `l/${index}` }));
      const columnWidth = (width - gaps.columnGutter) / 2;
      content = bulletFlows(ctx, items, styleId, x, width, columns, columns === 2 ? list.twoColumnIndent : list.indent, x + columnWidth + gaps.columnGutter + list.twoColumnIndent, columnWidth - list.twoColumnIndent, gaps.listRow, gaps.sectionTitle);
      break;
    }
    case 'entries': {
      const marked = design.definition.entries.marker === 'timeline' && section.content.entries.length > 1;
      section.content.entries.forEach((entry, index) => { content.push(...entryFlows(ctx, section, entry, x, width, index === 0 ? gaps.sectionTitle : design.entryGap, marked)); });
      break;
    }
  }
  return keepWith(head, content).map(flow => ({ ...flow, sectionId: section.id, box: { x, width } }));
}

/**
 * ADR-024 chips: a filled box around each item, in rows that wrap. A row is one flow, and text that does not fit one chip wraps inside it.
 * Each chip's text starts after the icon, when there is one.
 */
function chipFlows(ctx: Ctx, items: { spans: Span[]; anchor: Anchor; icon: ContactKind | null; block: string | null }[], styleId: StyleId, chip: NonNullable<TemplateDefinition['list']['chip']>, x: number, width: number, firstBefore: number): Flow[] {
  const { fonts, design } = ctx;
  const { lineHeight } = design.styles[styleId];
  const flows: Flow[] = [];
  let row = emptyFlow(firstBefore);
  let cursor = 0;
  const flush = () => {
    if (!row.lines.length && !row.shapes.length) return;
    row.lineCount = 1;
    flows.push(row);
    row = emptyFlow(chip.gap);
    cursor = 0;
  };
  for (const item of items) {
    const iconWidth = item.icon ? ICON_SIZE + ICON_GAP : 0;
    const composed = composeLines(fonts, item.spans, width - 2 * chip.paddingX - iconWidth);
    if (!composed.length) continue;
    const chipWidth = 2 * chip.paddingX + iconWidth + Math.max(...composed.map(line => line.width));
    const chipHeight = 2 * chip.paddingY + composed.length * lineHeight;
    if (cursor > 0 && cursor + chipWidth > width) flush();
    const left = x + cursor;
    row.shapes.push(round(left, 0, chipWidth, chipHeight, chip.radius, chip.fill, 'chip'));
    if (item.icon) row.icons.push({ kind: item.icon, x: q(left + chip.paddingX), y: q(chip.paddingY + (lineHeight - ICON_SIZE) / 2), size: ICON_SIZE, color: design.accent });
    composed.forEach((line, index) => { row.lines.push(placeLine(ctx, line, styleId, left + chip.paddingX + iconWidth, chip.paddingY + index * lineHeight, item.anchor, item.block)); });
    row.height = Math.max(row.height, chipHeight);
    cursor += chipWidth + chip.gap;
  }
  flush();
  return flows;
}

/** T1 contact line (§6.3): items flow, a square in a 19 pt slot between two items, none at a line start. */
function contactLines(ctx: Ctx, x: number, width: number, top: number): { lines: Line[]; shapes: Shape[]; height: number } {
  const { design, document, fonts } = ctx;
  const style = design.styles.contact;
  const { marker } = design;
  const lines: Line[] = [];
  const shapes: Shape[] = [];
  let row: { x: number; line: ComposedLine }[] = [];
  let cursor = 0;
  let y = top;
  const flush = () => {
    if (!row.length) return;
    const runs = row.flatMap(part => part.line.runs.map(run => ({ ...run, x: q(run.x + part.x) })));
    const last = row[row.length - 1] as { x: number; line: ComposedLine };
    lines.push(placeLine(ctx, { width: q(last.x + last.line.width), runs }, 'contact', x, y, anchorOf(null)));
    row = [];
    cursor = 0;
    y += style.lineHeight;
  };
  for (const contact of document.header.contacts) {
    if (!contact.text) continue;
    const url = safeLinkUrl(contact.url ?? deriveContactUrl(contact.text));
    const pieces = composeLines(fonts, [spanOf(ctx, 'contact', contact.text, { link: url })], width);
    for (const piece of pieces) {
      const slot = row.length ? marker.slot : 0;
      if (row.length && cursor + slot + piece.width > width) flush();
      if (row.length) {
        shapes.push(round(x + cursor + (marker.slot - marker.width) / 2, y + (style.lineHeight - marker.height) / 2, marker.width, marker.height, marker.radius, onBand(ctx, 'contact') ? design.definition.colors.onAccent : marker.fill, 'separator'));
        cursor += marker.slot;
      }
      row.push({ x: cursor, line: piece });
      cursor += piece.width;
    }
  }
  flush();
  return { lines, shapes, height: y - top };
}

/** §6.3 and ADR-024. The text column stacks the name, headline, contacts and rule in the template's order; T3 puts all of it in the band. */
function headerFlow(ctx: Ctx, hasPhoto: boolean): { flow: Flow; images: PlacedImage[] } {
  const { design, fonts, document } = ctx;
  const { header: rules } = design.definition;
  const { page } = design;
  const { margins } = page;
  const photo = hasPhoto && document.header.showPhoto ? rules.photo : null;
  const x = margins.left + (photo ? photo.size + photo.gap : 0);
  const width = page.contentWidth - (photo ? photo.size + photo.gap : 0);
  let text = emptyFlow();
  for (const [styleId, value] of [['name', document.header.fullName], ['headline', document.header.headline ?? '']] as const) {
    const { lineHeight } = design.styles[styleId];
    for (const line of composeLines(fonts, value ? [spanOf(ctx, styleId, value)] : [], width)) {
      text.lines.push(placeLine(ctx, line, styleId, x, text.height, anchorOf(null)));
      text.height += lineHeight;
    }
  }
  const drawRule = () => {
    const { rule } = rules;
    if (!rule) return;
    const top = Math.max(rule.offset, text.height + 4);
    text.shapes.push(round(x, top, width, rule.height, 0, rule.color === 'accent' ? design.accent : design.definition.colors.line, 'rule'));
    text.height = top + rule.height + rule.contactGap;
  };
  if (rules.contacts === 'separated') drawRule();
  if (rules.contacts === 'chips' && rules.chip) {
    const items = document.header.contacts.filter(contact => contact.text).map(contact => ({
      spans: [spanOf(ctx, 'contact', contact.text, { link: safeLinkUrl(contact.url ?? deriveContactUrl(contact.text)) })],
      anchor: anchorOf(null),
      icon: rules.icons ? contact.kind : null,
      block: null,
    }));
    for (const row of chipFlows(ctx, items, 'contact', rules.chip, x, width, 4)) text = append(text, row);
  } else {
    const contacts = contactLines(ctx, x, width, text.height);
    text.lines.push(...contacts.lines);
    text.shapes.push(...contacts.shapes);
    text.height += contacts.height;
  }
  if (rules.contacts !== 'separated') drawRule();
  const inner = Math.max(text.height, photo?.size ?? 0);
  if (rules.kind !== 'band') {
    const flow: Flow = { ...text, height: inner, lineCount: text.lines.length, box: { x: margins.left, width: page.contentWidth } };
    return { flow, images: photo ? [{ x: margins.left, y: margins.top, width: photo.size, height: photo.size, radius: photo.radius }] : [] };
  }
  const padding = rules.bandPadding;
  const offset = padding + (inner - text.height) / 2;
  const height = inner + 2 * padding;
  const flow: Flow = {
    ...text, height, lineCount: text.lines.length, box: { x: 0, width: page.width },
    lines: text.lines.map(line => movedLine(line, offset)),
    shapes: [round(0, 0, page.width, height, 0, design.accent, 'band'), ...text.shapes.map(shape => ({ ...shape, y: q(shape.y + offset) }))],
  };
  return { flow, images: photo ? [{ x: margins.left, y: q(padding + (inner - photo.size) / 2), width: photo.size, height: photo.size, radius: photo.radius }] : [] };
}

type Box = { x: number; width: number };

/**
 * ADR-054 split header, DD-TPL-06: name and headline lead the main column; the photo with its decoration, the contacts
 * title and the bulleted contacts lead the sidebar. Each half is one flow, so neither splits across pages (PG-06),
 * unless it is longer than page 1's room: then it breaks between lines with the oversized hint (PG-09, ADR-010 §10).
 */
function splitHeader(ctx: Ctx, side: Ctx, hasPhoto: boolean, main: Box, zone: Box, text: Box): { main: Flow | null; side: Flow | null; images: PlacedImage[] } {
  const { design, fonts, document } = ctx;
  const { header: rules, zones } = design.definition;
  const top = zones?.panel?.padding ?? 0;
  const lead = emptyFlow();
  for (const [styleId, value] of [['name', document.header.fullName], ['headline', document.header.headline ?? '']] as const) {
    const { lineHeight } = design.styles[styleId];
    for (const line of composeLines(fonts, value ? [spanOf(ctx, styleId, value)] : [], main.width)) {
      lead.lines.push(placeLine(ctx, line, styleId, main.x, lead.height, anchorOf(null)));
      lead.height += lineHeight;
    }
  }
  const aside = emptyFlow();
  const images: PlacedImage[] = [];
  let y = top;
  const photo = hasPhoto && document.header.showPhoto ? rules.photo : null;
  if (photo) {
    const x = zone.x + (zone.width - photo.size) / 2;
    let bottom = y + photo.size;
    for (const circle of rules.decor ?? []) {
      aside.shapes.push(round(x + circle.x, y + circle.y, circle.size, circle.size, circle.size / 2, design.colors.tint, 'decor'));
      bottom = Math.max(bottom, y + circle.y + circle.size);
    }
    images.push({ x: q(x), y: q(design.page.margins.top + y), width: photo.size, height: photo.size, radius: photo.radius });
    y = bottom + photo.gap;
  }
  const contacts = document.header.contacts.filter(contact => contact.text);
  const sd = side.design;
  if (contacts.length) {
    if (design.contactsTitle) {
      const { lineHeight } = sd.styles.sectionTitle;
      for (const line of composeLines(fonts, [spanOf(side, 'sectionTitle', design.contactsTitle)], text.width)) {
        aside.lines.push(placeLine(side, line, 'sectionTitle', text.x, y, anchorOf(null)));
        y += lineHeight;
      }
      if (sd.sectionRule) {
        aside.shapes.push(round(text.x, y + sd.sectionRule.gap, text.width, sd.sectionRule.height, 0, sd.sectionRule.fill, 'rule'));
        y += sd.sectionRule.gap + sd.sectionRule.height;
      }
      y += sd.definition.gaps.sectionTitle;
    }
    const { marker } = sd;
    const { lineHeight } = sd.styles.contact;
    contacts.forEach((contact, index) => {
      if (index) y += sd.definition.gaps.listRow;
      const url = safeLinkUrl(contact.url ?? deriveContactUrl(contact.text));
      aside.shapes.push(round(text.x, y + marker.top, marker.width, marker.height, marker.radius, marker.fill, 'marker'));
      for (const line of composeLines(fonts, [spanOf(side, 'contact', contact.text, { link: url })], text.width - marker.slot)) {
        aside.lines.push(placeLine(side, line, 'contact', text.x + marker.slot, y, anchorOf(null)));
        y += lineHeight;
      }
    });
  }
  aside.height = y;
  const finish = (flow: Flow, box: Box): Flow | null => flow.lines.length || flow.shapes.length ? { ...flow, lineCount: flow.lines.length, box } : null;
  return { main: finish(lead, main), side: photo || contacts.length ? finish(aside, text) : null, images };
}

/** ADR-010 §1: the pure function behind preview and PDF. */
export function layout(document: ResumeDocument, fonts: FontBook, options: { photo: boolean; engineVersion: string }): PageModel {
  const design = resolveDesign(document);
  const ctx: Ctx = { fonts, design, document };
  const { page, definition } = design;
  const visible = (document.sections as Section[]).filter(section => !section.hidden && !isSectionEmpty(section));
  if (definition.zones) {
    // DD-P11-03: the main column has its share of the content width, and the sidebar what the gutter leaves.
    const mainWidth = definition.zones.main * page.contentWidth;
    const sidebarWidth = page.contentWidth - mainWidth - definition.zones.gutter;
    // ADR-054: a left sidebar puts main after it; the panel, when there is one, insets the sidebar's text.
    const left = definition.zones.side === 'left';
    const mainX = left ? page.margins.left + sidebarWidth + definition.zones.gutter : page.margins.left;
    const sidebarX = left ? page.margins.left : page.margins.left + mainWidth + definition.zones.gutter;
    const padding = definition.zones.panel?.padding ?? 0;
    const textX = padding ? sidebarX + padding : sidebarX;
    const textWidth = padding ? sidebarWidth - 2 * padding : sidebarWidth;
    const side: Ctx = design.sidebar ? { ...ctx, design: design.sidebar } : ctx;
    const inZone = (zone: 'main' | 'sidebar', c: Ctx, x: number, width: number) => visible.filter(section => placementFor(section, definition) === zone).flatMap(section => sectionFlows(c, section, x, width));
    const zones = [inZone('main', ctx, mainX, mainWidth), inZone('sidebar', side, textX, textWidth)];
    const panel = definition.zones.panel ? round(sidebarX, page.margins.top, sidebarWidth, page.height - page.margins.top - page.margins.bottom, 0, design.colors.panel, 'panel') : null;
    if (definition.header.kind === 'split') {
      const split = splitHeader(ctx, side, options.photo, { x: mainX, width: mainWidth }, { x: sidebarX, width: sidebarWidth }, { x: textX, width: textWidth });
      if (split.main) zones[0]!.unshift(split.main);
      if (split.side) zones[1]!.unshift(split.side);
      const { pages, hints } = paginate(design, null, split.images, zones, panel);
      return { engineVersion: options.engineVersion, pages, hints };
    }
    const { flow, images } = headerFlow(ctx, options.photo);
    const { pages, hints } = paginate(design, flow, images, zones, panel);
    return { engineVersion: options.engineVersion, pages, hints };
  }
  const { flow, images } = headerFlow(ctx, options.photo);
  const zones = [visible.flatMap(section => sectionFlows(ctx, section, page.margins.left, page.contentWidth))];
  const { pages, hints } = paginate(design, flow, images, zones);
  return { engineVersion: options.engineVersion, pages, hints };
}
