import LineBreaker from 'linebreak';
import { COVERAGE_FALLBACK } from '../template';
import { q } from './quantize';
import type { FontBook } from './fonts';
import type { Run, RunPart } from './page-model';

export type Span = { text: string; face: string; size: number; color: string; underline: boolean; link: string | null };
export type ComposedLine = { width: number; runs: Run[] };

const sameStyle = (a: Span, b: Span) => a.face === b.face && a.size === b.size && a.color === b.color && a.underline === b.underline && a.link === b.link;

/** Adjacent pieces of one style are shaped together, so kerning across a word boundary is the same as in the painted run. */
function merge(pieces: Span[]): Span[] {
  const merged: Span[] = [];
  for (const piece of pieces) {
    const last = merged[merged.length - 1];
    if (last && sameStyle(last, piece)) merged[merged.length - 1] = { ...last, text: last.text + piece.text };
    else if (piece.text) merged.push(piece);
  }
  return merged;
}

function trimEnd(pieces: Span[]): Span[] {
  const trimmed = [...pieces];
  for (let index = trimmed.length - 1; index >= 0; index--) {
    const piece = trimmed[index] as Span;
    const text = piece.text.replace(/[ \u00A0\n]+$/, '');
    if (text) { trimmed[index] = { ...piece, text }; return trimmed; }
    trimmed.pop();
  }
  return trimmed;
}

const widthOf = (fonts: FontBook, pieces: Span[]) => merge(trimEnd(pieces)).reduce((sum, piece) => sum + fonts.measure(piece.face, piece.size, piece.text), 0);

const PART_LENGTH = 32;
const SHORTEST_TAIL = 8;

/** Offsets for a long run, cut at a space, from the same shaping as its width. Empty for a short run, which is painted whole. */
function partsOf(fonts: FontBook, piece: Span): RunPart[] {
  const { text } = piece;
  if (text.length <= PART_LENGTH + SHORTEST_TAIL) return [];
  const parts: RunPart[] = [];
  let start = 0;
  while (start < text.length) {
    const space = text.indexOf(' ', start + PART_LENGTH);
    const end = space < 0 || text.length - space - 1 < SHORTEST_TAIL ? text.length : space + 1;
    parts.push({ text: text.slice(start, end), x: start ? q(fonts.measure(piece.face, piece.size, text.slice(0, start))) : 0 });
    start = end;
  }
  return parts.length > 1 ? parts : [];
}

function finish(fonts: FontBook, pieces: Span[]): ComposedLine {
  let x = 0;
  const runs = merge(trimEnd(pieces)).map(piece => {
    const width = fonts.measure(piece.face, piece.size, piece.text);
    const run: Run = { text: piece.text, x: q(x), width: q(width), face: piece.face, size: piece.size, color: piece.color, underline: piece.underline, link: piece.link, parts: partsOf(fonts, piece) };
    x += width;
    return run;
  });
  return { width: q(x), runs };
}

/** DD-P12-22: a letter its family lacks takes the fallback family, if that has it. From font data only, so every runtime agrees (ADR-010 §7). */
function withCoverage(fonts: FontBook, span: Span): Span[] {
  const [family = '', face = ''] = span.face.split('/');
  const fallback = COVERAGE_FALLBACK[family];
  if (!fallback) return [span];
  const own = fonts.font(span.face);
  const other = fonts.font(`${fallback}/${face}`);
  const parts: Span[] = [];
  for (const character of span.text) {
    const code = character.codePointAt(0) as number;
    const chosen = !own.hasGlyphForCodePoint(code) && other.hasGlyphForCodePoint(code) ? `${fallback}/${face}` : span.face;
    const last = parts[parts.length - 1];
    if (last?.face === chosen) last.text += character;
    else parts.push({ ...span, text: character, face: chosen });
  }
  return parts;
}

/** UAX #14 opportunities plus a greedy fit (ADR-010 §6). A segment wider than the line breaks by code point (PG-09's spirit). */
export function composeLines(fonts: FontBook, source: Span[], width: number): ComposedLine[] {
  const spans = source.flatMap(span => withCoverage(fonts, span));
  const text = spans.map(span => span.text).join('');
  if (!text) return [];
  const segments: { start: number; end: number; required: boolean }[] = [];
  const breaker = new LineBreaker(text);
  let start = 0;
  for (let next = breaker.nextBreak(); next; next = breaker.nextBreak()) {
    segments.push({ start, end: next.position, required: next.required });
    start = next.position;
  }
  const cut = (from: number, to: number): Span[] => {
    const pieces: Span[] = [];
    let offset = 0;
    for (const span of spans) {
      const left = Math.max(from, offset);
      const right = Math.min(to, offset + span.text.length);
      if (left < right) pieces.push({ ...span, text: span.text.slice(left - offset, right - offset) });
      offset += span.text.length;
    }
    return pieces;
  };
  const lines: ComposedLine[] = [];
  let current: Span[] = [];
  const flush = () => { lines.push(finish(fonts, current)); current = []; };
  for (const segment of segments) {
    let pieces = cut(segment.start, segment.end);
    if (current.length && widthOf(fonts, [...current, ...pieces]) > width) flush();
    if (widthOf(fonts, pieces) > width) {
      // Emergency break: one word is wider than the column.
      for (const piece of pieces) {
        for (const char of Array.from(piece.text)) {
          const one = { ...piece, text: char };
          if (current.length && widthOf(fonts, [...current, one]) > width) flush();
          current.push(one);
        }
      }
      pieces = [];
    }
    current.push(...pieces);
    if (segment.required) flush();
  }
  if (current.length && merge(trimEnd(current)).length) flush();
  return lines;
}
