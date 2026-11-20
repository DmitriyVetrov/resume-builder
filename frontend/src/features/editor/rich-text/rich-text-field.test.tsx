import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Block } from '../../../entities/resume/rich-text';
import { RichTextField } from './RichTextField';

const t = (value: string, bold = false) => ({ kind: 'text' as const, value, bold, italic: false, underline: false });
const para = (value: string): Block => ({ kind: 'paragraph', inlines: [t(value)] });

function Host({ initial, variant, spy }: { initial: Block[]; variant?: 'block' | 'inline' | 'line'; spy?: (value: Block[]) => void }) {
  const [value, setValue] = useState(initial);
  return <>
    <RichTextField label="Body" value={value} {...(variant ? { variant } : {})} onChange={next => { setValue(next); spy?.(next); }} />
    <button onClick={() => setValue([para('from outside')])}>Set outside</button>
  </>;
}

describe('RichTextField', () => {
  it('F01 is a named, spell-checked text field', () => {
    render(<Host initial={[para('hello')]} />);
    const field = screen.getByRole('textbox', { name: 'Body' });
    expect(field).toHaveAttribute('contenteditable', 'true');
    expect(field).toHaveAttribute('spellcheck', 'true');
    expect(field).toHaveAttribute('aria-multiline', 'true');
    expect(field).toHaveTextContent('hello');
  });

  it('F02 single-line variants are not multiline and block keeps Tab free', () => {
    render(<Host initial={[para('x')]} variant="line" />);
    expect(screen.getByRole('textbox', { name: 'Body' })).toHaveAttribute('aria-multiline', 'false');
  });

  it('F03 emits nothing on mount or on an outside value change, and shows the outside value', () => {
    const spy = vi.fn();
    render(<Host initial={[para('hello')]} spy={spy} />);
    expect(spy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Set outside' }));
    expect(screen.getByRole('textbox', { name: 'Body' })).toHaveTextContent('from outside');
    expect(spy).not.toHaveBeenCalled();
  });

  it('F04 a stored non-canonical value is shown and not rewritten', () => {
    const spy = vi.fn();
    render(<Host initial={[{ kind: 'paragraph', inlines: [t('a'), t('b')] }]} spy={spy} />);
    expect(screen.getByRole('textbox', { name: 'Body' })).toHaveTextContent('ab');
    expect(spy).not.toHaveBeenCalled();
  });

  it('F05 the toolbar has the five actions and reports pressed state from the selection', () => {
    render(<Host initial={[{ kind: 'paragraph', inlines: [t('bold', true)] }]} />);
    const toolbar = within(screen.getByRole('toolbar', { name: 'Body formatting' }));
    for (const name of ['Bold', 'Italic', 'Underline', 'Bullet list', 'Link']) expect(toolbar.getByRole('button', { name })).toBeInTheDocument();
    expect(toolbar.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    expect(toolbar.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('F06 toolbar buttons rove with arrow keys, Home and End, with one tab stop', () => {
    render(<Host initial={[para('x')]} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Body formatting' });
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons.filter(button => button.tabIndex === 0)).toHaveLength(1);
    buttons[0]!.focus();
    fireEvent.keyDown(buttons[0]!, { key: 'ArrowRight' });
    expect(buttons[1]).toHaveFocus();
    fireEvent.keyDown(buttons[1]!, { key: 'End' });
    expect(buttons.at(-1)).toHaveFocus();
    fireEvent.keyDown(buttons.at(-1)!, { key: 'Home' });
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(buttons[0]!, { key: 'ArrowLeft' });
    expect(buttons.at(-1)).toHaveFocus();
    expect(buttons.filter(button => button.tabIndex === 0)).toHaveLength(1);
  });

  it('F07 the link dialog refuses an unsafe URL with a field error, and asks for text with no selection', async () => {
    render(<Host initial={[]} />);
    fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Link' }));
    const dialog = within(screen.getByRole('dialog', { name: /link/i }));
    const url = dialog.getByRole('textbox', { name: /URL/ });
    expect(url).toHaveFocus();
    expect(dialog.getByRole('textbox', { name: 'Link text' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Apply' })).toBeDisabled();
    fireEvent.change(url, { target: { value: 'javascript:alert(1)' } });
    await act(async () => { fireEvent.click(dialog.getByRole('button', { name: 'Apply' })); });
    expect(dialog.getByText(/web address, an e-mail address or a phone number/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /link/i })).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('F08 a compact variant puts the toolbar after the editable in DOM order', () => {
    render(<Host initial={[para('x')]} variant="line" />);
    const field = screen.getByRole('textbox', { name: 'Body' });
    const toolbar = screen.getByRole('toolbar', { name: 'Body formatting' });
    expect(field.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(toolbar).queryByRole('button', { name: 'Bullet list' })).not.toBeInTheDocument();
  });
});
