import { splitBlock, toggleMark } from 'prosemirror-commands';
import { Slice, type Fragment, type MarkType, type Node as PmNode, type Schema } from 'prosemirror-model';
import { TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import type { Block } from '../../../entities/resume/rich-text';
import { astToDoc } from './convert';

const markOf = (state: EditorState, name: string) => state.schema.marks[name] as MarkType;

export const toggleBold: Command = (state, dispatch) => toggleMark(markOf(state, 'bold'))(state, dispatch);
export const toggleItalic: Command = (state, dispatch) => toggleMark(markOf(state, 'italic'))(state, dispatch);
export const toggleUnderline: Command = (state, dispatch) => toggleMark(markOf(state, 'underline'))(state, dispatch);

type Line = { kind: 'paragraph' | 'item'; content: Fragment };
const isTextblockLine = (node: PmNode) => node.type.name === 'paragraph' || node.type.name === 'list_item';

function linesOf(doc: PmNode): Line[] {
  const lines: Line[] = [];
  doc.descendants(node => {
    if (isTextblockLine(node)) { lines.push({ kind: node.type.name === 'list_item' ? 'item' : 'paragraph', content: node.content }); return false; }
    return true;
  });
  return lines;
}

function nodesOf(schema: Schema, lines: readonly Line[]): PmNode[] {
  const result: PmNode[] = [];
  let items: PmNode[] = [];
  const close = () => { if (items.length) { result.push(schema.nodes.bullet_list!.create(null, items)); items = []; } };
  for (const line of lines) {
    if (line.kind === 'item') { items.push(schema.nodes.list_item!.create(null, line.content)); continue; }
    close();
    result.push(schema.nodes.paragraph!.create(null, line.content));
  }
  close();
  return result;
}

/** The line a position is in, and its offset there. Positions outside any line (select all) clamp to the nearest. */
function locate(doc: PmNode, position: number): { line: number; offset: number } {
  let line = -1;
  let found = { line: 0, offset: 0 };
  doc.descendants((node, start) => {
    if (!isTextblockLine(node)) return true;
    line++;
    if (position >= start + 1) found = { line, offset: Math.min(position - start - 1, node.content.size) };
    return false;
  });
  return found;
}

function positionOf(doc: PmNode, target: { line: number; offset: number }): number {
  let line = -1;
  let position = 1;
  doc.descendants((node, start) => {
    if (!isTextblockLine(node)) return true;
    line++;
    if (line === target.line) position = start + 1 + Math.min(target.offset, node.content.size);
    return false;
  });
  return position;
}

/** Rebuilds the document from its lines: bullets are lines of one kind, so merging and splitting lists is grouping. */
function changeLines(state: EditorState, firstLine: number, lastLine: number, kind: Line['kind']): Transaction {
  const { doc, selection, schema, tr } = state;
  const anchor = locate(doc, selection.from);
  const head = locate(doc, selection.to);
  const lines = linesOf(doc).map((line, index) => index >= firstLine && index <= lastLine ? { ...line, kind } : line);
  tr.replaceWith(0, doc.content.size, nodesOf(schema, lines));
  return tr.setSelection(TextSelection.create(tr.doc, positionOf(tr.doc, anchor), positionOf(tr.doc, head))).scrollIntoView();
}

export const toggleBullets: Command = (state, dispatch) => {
  if (!state.schema.nodes.doc!.contentMatch.matchType(state.schema.nodes.bullet_list!)) return false;
  const first = locate(state.doc, state.selection.from).line;
  const last = locate(state.doc, state.selection.to).line;
  const lines = linesOf(state.doc).slice(first, last + 1);
  dispatch?.(changeLines(state, first, last, lines.every(line => line.kind === 'item') ? 'paragraph' : 'item'));
  return true;
};

export const enterInBlock: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (empty && $from.parent.type.name === 'list_item' && $from.parent.content.size === 0) {
    const line = locate(state.doc, $from.pos).line;
    dispatch?.(changeLines(state, line, line, 'paragraph'));
    return true;
  }
  return splitBlock(state, dispatch);
};

export const backspaceAtBulletStart: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== 'list_item' || $from.parentOffset !== 0) return false;
  const line = locate(state.doc, $from.pos).line;
  dispatch?.(changeLines(state, line, line, 'paragraph'));
  return true;
};

export const hardBreak: Command = (state, dispatch) => {
  dispatch?.(state.tr.replaceSelectionWith(state.schema.nodes.hard_break!.create()).scrollIntoView());
  return true;
};

/** The extent of the link around the caret, across runs with different marks. */
function linkRange(state: EditorState): { from: number; to: number; href: string } | null {
  const { $from, empty } = state.selection;
  const type = markOf(state, 'link');
  if (!empty) {
    let href: string | null = null;
    state.doc.nodesBetween(state.selection.from, state.selection.to, node => {
      href ??= node.marks.find(mark => mark.type === type)?.attrs.href as string | undefined ?? null;
    });
    return href ? { from: state.selection.from, to: state.selection.to, href } : null;
  }
  const parent = $from.parent;
  const start = $from.start();
  let offset = 0;
  const children: { from: number; to: number; href: string | null }[] = [];
  parent.forEach(child => {
    children.push({ from: start + offset, to: start + offset + child.nodeSize, href: child.marks.find(mark => mark.type === type)?.attrs.href as string | undefined ?? null });
    offset += child.nodeSize;
  });
  const index = children.findIndex(child => child.href !== null && $from.pos >= child.from && $from.pos <= child.to);
  if (index < 0) return null;
  const href = children[index]!.href as string;
  let first = index;
  let last = index;
  while (children[first - 1]?.href === href) first--;
  while (children[last + 1]?.href === href) last++;
  return { from: children[first]!.from, to: children[last]!.to, href };
}

export const linkAtSelection = (state: EditorState) => linkRange(state)?.href ?? null;

export function setLink(url: string, text?: string): Command {
  return (state, dispatch) => {
    const type = markOf(state, 'link');
    const mark = type.create({ href: url });
    const existing = linkRange(state);
    if (state.selection.empty && !existing) {
      if (!text) return false;
      const tr = state.tr.replaceSelectionWith(state.schema.text(text, [mark]), false);
      dispatch?.(tr.scrollIntoView());
      return true;
    }
    const range = state.selection.empty && existing ? existing : state.selection;
    dispatch?.(state.tr.removeMark(range.from, range.to, type).addMark(range.from, range.to, mark));
    return true;
  };
}

export const removeLink: Command = (state, dispatch) => {
  const range = linkRange(state);
  if (!range) return false;
  dispatch?.(state.tr.removeMark(range.from, range.to, markOf(state, 'link')));
  return true;
};

export function isMarkActive(state: EditorState, name: 'bold' | 'italic' | 'underline' | 'link'): boolean {
  const type = markOf(state, name);
  const { from, to, empty, $from } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks ?? $from.marks());
  return state.doc.rangeHasMark(from, to, type);
}

export const isInBullets = (state: EditorState) => state.selection.$from.parent.type.name === 'list_item';

/** Paste into a block field. One paragraph merges at the caret; an empty line is replaced by what was pasted. */
export function insertBlocks(blocks: readonly Block[]): Command {
  return (state, dispatch) => {
    if (!blocks.length) return true;
    const doc = astToDoc(blocks, 'block');
    const content = doc.content;
    const { $from, empty } = state.selection;
    const emptyTarget = empty && $from.parent.content.size === 0;
    const onlyParagraph = doc.childCount === 1 && doc.firstChild?.type.name === 'paragraph';
    const slice = onlyParagraph ? new Slice(content, 1, 1) : emptyTarget ? new Slice(content, 0, 0) : Slice.maxOpen(content);
    dispatch?.(state.tr.replaceSelection(slice).scrollIntoView());
    return true;
  };
}
