import { baseKeymap, chainCommands, deleteSelection, joinBackward, selectNodeBackward } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { Slice } from 'prosemirror-model';
import { AllSelection, EditorState, Selection, TextSelection, type Command, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { plainText, type Block, type Inline } from '../../../entities/resume/rich-text';
import { normalizeUrl } from '../../../entities/resume/safe-url';
import { Button, Dialog, TextField } from '../../../shared/ui';
import { htmlToBlocks, plainTextToBlocks } from './clipboard';
import { backspaceAtBulletStart, enterInBlock, hardBreak, insertBlocks, isInBullets, isMarkActive, linkAtSelection, removeLink, setLink, toggleBold, toggleBullets, toggleItalic, toggleUnderline } from './commands';
import { astToDoc, docToAst, flattenToLine } from './convert';
import type { RichTextVariant } from './schema';

export type { RichTextVariant };
export type RichTextChange = { coalesce: boolean; label: string };
type Props = {
  label: string; value: Block[]; onChange: (value: Block[], change: RichTextChange) => void; variant?: RichTextVariant;
  /** `line` fields: Enter adds the next item; pasted lines become items (§5.6). */
  onEnter?: () => void; onPasteLines?: (lines: Inline[][]) => void; autoFocus?: boolean;
};
type Formats = { bold: boolean; italic: boolean; underline: boolean; bullets: boolean; link: boolean; selection: boolean };
const ACTION_META = 'richTextAction';

function readFormats(state: EditorState): Formats {
  return { bold: isMarkActive(state, 'bold'), italic: isMarkActive(state, 'italic'), underline: isMarkActive(state, 'underline'), bullets: isInBullets(state), link: linkAtSelection(state) !== null, selection: !state.selection.empty };
}

type LinkDialogProps = { current: string | null; needsText: boolean; onApply: (url: string, text?: string) => void; onRemove: () => void; onClose: () => void };

function LinkDialog({ current, needsText, onApply, onRemove, onClose }: LinkDialogProps) {
  const id = useId();
  const [url, setUrl] = useState(current ?? '');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const safe = normalizeUrl(url);
    if (!safe) { setError('Use a web address, an e-mail address or a phone number.'); return; }
    onApply(safe, needsText ? text || safe : undefined);
  };
  return <Dialog title={current ? 'Edit link' : 'Add link'} onClose={onClose}>
    <form onSubmit={submit} noValidate>
      {needsText && <TextField id={`${id}-text`} label="Link text" value={text} spellCheck onChange={event => setText(event.target.value)} />}
      <TextField id={`${id}-url`} label="Link (URL)" type="url" value={url} data-initial-focus error={error} onChange={event => { setUrl(event.target.value); setError(''); }} />
      <div className="dialog-actions">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        {current && <Button type="button" variant="danger" onClick={onRemove}>Remove link</Button>}
        <Button type="submit" disabled={!url.trim()}>Apply</Button>
      </div>
    </form>
  </Dialog>;
}

function Toolbar({ label, variant, formats, run, onLink }: { label: string; variant: RichTextVariant; formats: Formats; run: (command: Command, action: string) => void; onLink: () => void }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const buttons: { name: string; text: string; pressed: boolean; press: () => void; className?: string }[] = [
    { name: 'Bold', text: 'B', pressed: formats.bold, press: () => run(toggleBold, 'formatting'), className: 'rt-bold' },
    { name: 'Italic', text: 'I', pressed: formats.italic, press: () => run(toggleItalic, 'formatting'), className: 'rt-italic' },
    { name: 'Underline', text: 'U', pressed: formats.underline, press: () => run(toggleUnderline, 'formatting'), className: 'rt-underline' },
    ...(variant === 'block' ? [{ name: 'Bullet list', text: '• List', pressed: formats.bullets, press: () => run(toggleBullets, 'list change') }] : []),
    { name: 'Link', text: 'Link', pressed: formats.link, press: onLink },
  ];
  const keys = (event: KeyboardEvent, index: number) => {
    const count = buttons.length;
    const target = event.key === 'ArrowRight' ? (index + 1) % count : event.key === 'ArrowLeft' ? (index - 1 + count) % count : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
    if (target === null) return;
    event.preventDefault();
    setActive(target);
    refs.current[target]?.focus();
  };
  return <div role="toolbar" aria-label={`${label} formatting`} className="rte-toolbar">
    {buttons.map((button, index) => <button key={button.name} ref={node => { refs.current[index] = node; }} type="button" className="rte-button" aria-label={button.name} aria-pressed={button.pressed} tabIndex={index === active ? 0 : -1}
      onMouseDown={event => event.preventDefault()} onFocus={() => setActive(index)} onKeyDown={event => keys(event, index)} onClick={button.press}><span className={button.className}>{button.text}</span></button>)}
  </div>;
}

function createKeymap(variant: RichTextVariant, enter: RefObject<(() => void) | undefined>, openLink: RefObject<() => void>) {
  const bindings: Record<string, Command> = {
    'Mod-b': toggleBold, 'Mod-i': toggleItalic, 'Mod-u': toggleUnderline,
    'Mod-k': () => { openLink.current(); return true; },
    Backspace: chainCommands(backspaceAtBulletStart, deleteSelection, joinBackward, selectNodeBackward),
  };
  if (variant === 'block') {
    bindings.Enter = enterInBlock;
    bindings['Shift-Enter'] = hardBreak;
  } else {
    bindings.Enter = () => { enter.current?.(); return true; };
    bindings['Shift-Enter'] = variant === 'inline' ? hardBreak : () => true;
  }
  return keymap(bindings);
}

/**
 * The engine learns of a keyboard selection from `selectionchange`, which can arrive after the next keydown. A key
 * pressed right after would act on the old selection: Enter after select-all then ArrowRight would replace the text.
 */
function syncSelectionFromDom(view: EditorView) {
  const selection = view.dom.ownerDocument.getSelection();
  if (!selection?.anchorNode || !selection.focusNode || !view.dom.contains(selection.anchorNode) || !view.dom.contains(selection.focusNode)) return;
  const anchor = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
  const head = view.posAtDOM(selection.focusNode, selection.focusOffset);
  const current = view.state.selection;
  const from = Math.min(anchor, head);
  const to = Math.max(anchor, head);
  if (current instanceof AllSelection) {
    if (from === Selection.atStart(view.state.doc).from && to === Selection.atEnd(view.state.doc).to) return;
  } else if (current.from === from && current.to === to) return;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, anchor, head)));
}

/** The controlled editor (ADR-052). `value` and `onChange` carry only the contract AST; the engine stays in here. */
export function RichTextField({ label, value, onChange, variant = 'block', onEnter, onPasteLines, autoFocus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const emitted = useRef<Block[]>(value);
  const change = useRef(onChange);
  const enter = useRef(onEnter);
  const pasteLines = useRef(onPasteLines);
  const openLink = useRef<() => void>(() => {});
  const [formats, setFormats] = useState<Formats>(() => readFormats(EditorState.create({ doc: astToDoc(value, variant) })));
  const [linking, setLinking] = useState<{ current: string | null; needsText: boolean } | null>(null);

  useLayoutEffect(() => {
    change.current = onChange;
    enter.current = onEnter;
    pasteLines.current = onPasteLines;
  });
  openLink.current = () => {
    const state = view.current?.state;
    if (state) setLinking({ current: linkAtSelection(state), needsText: state.selection.empty && linkAtSelection(state) === null });
  };

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    const editor: EditorView = new EditorView(mount, {
      state: EditorState.create({ doc: astToDoc(emitted.current, variant), plugins: [createKeymap(variant, enter, openLink), keymap(baseKeymap)] }),
      attributes: { role: 'textbox', 'aria-label': label, 'aria-multiline': String(variant === 'block'), spellcheck: 'true', class: 'rte-content' },
      dispatchTransaction(transaction: Transaction) {
        const next = editor.state.apply(transaction);
        editor.updateState(next);
        setFormats(readFormats(next));
        if (!transaction.docChanged || transaction.getMeta('external')) return;
        const blocks = docToAst(next.doc, variant);
        emitted.current = blocks;
        const action = transaction.getMeta(ACTION_META) as string | undefined;
        const pasted = transaction.getMeta('paste') === true || transaction.getMeta('uiEvent') === 'paste';
        change.current(blocks, action ? { coalesce: false, label: action } : pasted ? { coalesce: false, label: 'paste' } : { coalesce: true, label: 'typing' });
      },
      handleKeyDown(target, event) {
        if (!event.isComposing) syncSelectionFromDom(target);
        return false;
      },
      handlePaste(target, event) {
        const html = event.clipboardData?.getData('text/html');
        const text = event.clipboardData?.getData('text/plain') ?? '';
        const read = html ? htmlToBlocks(html) : [];
        const blocks = read.length ? read : plainTextToBlocks(text);
        const lines = blocks.flatMap(block => block.kind === 'paragraph' ? [block.inlines] : block.items);
        if (variant === 'line' && lines.length > 1 && pasteLines.current) { pasteLines.current(lines); return true; }
        if (variant === 'block') {
          insertBlocks(blocks)(target.state, tr => target.dispatch(tr.setMeta(ACTION_META, 'paste')));
          return true;
        }
        const line = astToDoc([{ kind: 'paragraph', inlines: flattenToLine(blocks) }], variant).child(0);
        target.dispatch(target.state.tr.replaceSelection(new Slice(line.content, 0, 0)).setMeta(ACTION_META, 'paste').scrollIntoView());
        return true;
      },
    });
    view.current = editor;
    if (autoFocus) editor.focus();
    return () => { editor.destroy(); view.current = null; };
    // The engine is created once per field; later props reach it through refs and the value effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // An outside change (undo, redo, reload) becomes a minimal replace, which keeps the caret where the change is.
  useEffect(() => {
    const editor = view.current;
    // A `line` field gets a freshly wrapped value on each render, so identity alone cannot say "this is ours".
    if (!editor || value === emitted.current || JSON.stringify(value) === JSON.stringify(emitted.current)) return;
    emitted.current = value;
    const next = astToDoc(value, variant);
    const current = editor.state.doc;
    const start = current.content.findDiffStart(next.content);
    if (start === null) return;
    const ends = current.content.findDiffEnd(next.content);
    if (!ends) return;
    let { a: endOld, b: endNew } = ends;
    const overlap = start - Math.min(endOld, endNew);
    if (overlap > 0) { endOld += overlap; endNew += overlap; }
    const tr = editor.state.tr.setMeta('external', true);
    tr.replace(start, endOld, next.slice(start, endNew));
    if (editor.hasFocus()) tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(endNew, tr.doc.content.size))));
    editor.dispatch(tr);
  }, [value, variant]);

  const run = (command: Command, action: string) => {
    const editor = view.current;
    if (!editor) return;
    command(editor.state, tr => editor.dispatch(tr.setMeta(ACTION_META, action)));
    editor.focus();
  };
  const closeLink = () => { setLinking(null); view.current?.focus(); };
  const toolbar = <Toolbar label={label} variant={variant} formats={formats} run={run} onLink={() => openLink.current()} />;
  const compact = variant !== 'block';
  return <div className={`rte ${compact ? 'rte-compact' : ''}`} data-empty={plainText(value) === '' || undefined}>
    {!compact && <span className="rte-label">{label}</span>}
    {!compact && toolbar}
    <div ref={host} className="rte-host" />
    {compact && toolbar}
    {linking && <LinkDialog current={linking.current} needsText={linking.needsText} onClose={closeLink}
      onApply={(url, text) => { setLinking(null); run(setLink(url, text), 'link edit'); }}
      onRemove={() => { setLinking(null); run(removeLink, 'link removal'); }} />}
  </div>;
}
