import { AllSelection, EditorState, TextSelection, type Command } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import type { Block, Inline } from '../../../entities/resume/rich-text';
import { backspaceAtBulletStart, enterInBlock, hardBreak, insertBlocks, isInBullets, isMarkActive, linkAtSelection, removeLink, setLink, toggleBold, toggleBullets, toggleItalic, toggleUnderline } from './commands';
import { astToDoc, docToAst } from './convert';

const t = (value: string, marks: Partial<Record<'bold' | 'italic' | 'underline', boolean>> = {}) => ({ kind: 'text' as const, value, bold: false, italic: false, underline: false, ...marks });
const p = (...inlines: Inline[]): Block => ({ kind: 'paragraph', inlines });
const ul = (...items: Inline[][]): Block => ({ kind: 'bulletList', items });

function state(blocks: Block[], from?: number, to?: number) {
  const doc = astToDoc(blocks, 'block');
  return EditorState.create(from === undefined ? { doc } : { doc, selection: TextSelection.create(doc, from, to ?? from) });
}
function run(start: EditorState, command: Command) {
  let current = start;
  const handled = command(current, tr => { current = current.apply(tr); });
  return { handled, state: current, blocks: docToAst(current.doc, 'block') };
}

describe('rich text commands', () => {
  it('K01 toggles bold, italic and underline on a selection and reports the state', () => {
    let result = run(state([p(t('hello world'))], 1, 6), toggleBold);
    expect(result.blocks).toEqual([p(t('hello', { bold: true }), t(' world'))]);
    expect(isMarkActive(result.state, 'bold')).toBe(true);
    result = run(result.state, toggleItalic);
    result = run(result.state, toggleUnderline);
    expect(result.blocks).toEqual([p(t('hello', { bold: true, italic: true, underline: true }), t(' world'))]);
    result = run(result.state, toggleBold);
    expect(result.blocks).toEqual([p(t('hello', { italic: true, underline: true }), t(' world'))]);
    expect(isMarkActive(result.state, 'bold')).toBe(false);
  });

  it('K02 turns selected paragraphs into bullets and back, keeping text and the caret line', () => {
    const start = state([p(t('one')), p(t('two')), p(t('three'))], 2, 7);
    const on = run(start, toggleBullets);
    expect(on.blocks).toEqual([ul([t('one')], [t('two')]), p(t('three'))]);
    expect(isInBullets(on.state)).toBe(true);
    expect(on.state.selection.$from.parent.textContent).toBe('one');
    expect(on.state.selection.$to.parent.textContent).toBe('two');
    const off = run(on.state, toggleBullets);
    expect(off.blocks).toEqual([p(t('one')), p(t('two')), p(t('three'))]);
  });

  it('K02b select all, whose ends lie outside any line, covers every line', () => {
    const doc = astToDoc([p(t('a')), ul([t('b')]), p(t('c'))], 'block');
    const on = run(EditorState.create({ doc, selection: new AllSelection(doc) }), toggleBullets);
    expect(on.blocks).toEqual([ul([t('a')], [t('b')], [t('c')])]);
  });

  it('K03 merges with neighbouring lists and splits a list when one item leaves', () => {
    const merge = run(state([ul([t('a')]), p(t('b')), ul([t('c')])], 6), toggleBullets);
    expect(merge.blocks).toEqual([ul([t('a')], [t('b')], [t('c')])]);
    const split = run(state([ul([t('a')], [t('b')], [t('c')])], 5), toggleBullets);
    expect(split.blocks).toEqual([ul([t('a')]), p(t('b')), ul([t('c')])]);
  });

  it('K04 Enter splits a bullet, and on an empty bullet leaves the list', () => {
    const split = run(state([ul([t('ab')])], 3), enterInBlock);
    expect(split.blocks).toEqual([ul([t('a')], [t('b')])]);
    const leave = run(state([ul([t('a')], [])], 5), enterInBlock);
    expect(leave.blocks).toEqual([ul([t('a')]), p()]);
    const paragraph = run(state([p(t('ab'))], 2), enterInBlock);
    expect(paragraph.blocks).toEqual([p(t('a')), p(t('b'))]);
  });

  it('K05 Backspace at a bullet start makes it a paragraph; elsewhere it does not handle', () => {
    const start = run(state([ul([t('a')], [t('b')])], 5), backspaceAtBulletStart);
    expect(start.handled).toBe(true);
    expect(start.blocks).toEqual([ul([t('a')]), p(t('b'))]);
    expect(run(state([ul([t('ab')])], 3), backspaceAtBulletStart).handled).toBe(false);
    expect(run(state([p(t('ab'))], 1), backspaceAtBulletStart).handled).toBe(false);
  });

  it('K06 Shift+Enter stores a line break', () => {
    expect(run(state([p(t('ab'))], 2), hardBreak).blocks).toEqual([p(t('a'), { kind: 'lineBreak' }, t('b'))]);
  });

  it('K07 links a selection, keeps its formatting, and reads the URL back', () => {
    const start = state([p(t('see '), t('bold', { bold: true }), t(' now'))], 5, 9);
    const linked = run(start, setLink('https://example.invalid'));
    expect(linked.blocks).toEqual([p(t('see '), { kind: 'link', url: 'https://example.invalid', children: [t('bold', { bold: true })] }, t(' now'))]);
    expect(linkAtSelection(linked.state)).toBe('https://example.invalid');
  });

  it('K08 with the caret inside, edit and remove act on the whole link', () => {
    const blocks = [p(t('a '), { kind: 'link', url: 'https://old.invalid', children: [t('link'), t('ed', { bold: true })] }, t(' b'))] as Block[];
    const caret = state(blocks, 6);
    expect(linkAtSelection(caret)).toBe('https://old.invalid');
    expect(run(caret, setLink('https://new.invalid')).blocks).toEqual([p(t('a '), { kind: 'link', url: 'https://new.invalid', children: [t('link'), t('ed', { bold: true })] }, t(' b'))]);
    expect(run(caret, removeLink).blocks).toEqual([p(t('a link'), t('ed', { bold: true }), t(' b'))]);
  });

  it('K09 an empty selection outside a link inserts link text', () => {
    expect(run(state([p(t('ab'))], 2), setLink('https://a.invalid', 'text')).blocks).toEqual([p(t('a'), { kind: 'link', url: 'https://a.invalid', children: [t('text')] }, t('b'))]);
  });

  it('K10 inserting blocks merges one paragraph inline and places a list in an empty field', () => {
    expect(run(state([p(t('ab'))], 2), insertBlocks([p(t('X', { bold: true }))])).blocks).toEqual([p(t('a'), t('X', { bold: true }), t('b'))]);
    expect(run(state([], 1), insertBlocks([ul([t('x')], [t('y')])])).blocks).toEqual([ul([t('x')], [t('y')])]);
    expect(run(state([p(t('ab'))], 3), insertBlocks([p(t('n')), ul([t('x')])])).blocks).toEqual([p(t('abn')), ul([t('x')])]);
  });
});
