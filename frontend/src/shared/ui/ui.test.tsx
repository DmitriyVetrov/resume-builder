import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button, Dialog, TextField } from '.';

describe('T-03 shared primitives are the shadcn components (ADR-053 §3, §4)', () => {
  it('Button is the shadcn button with the mapped variants', () => {
    render(<><Button>Save</Button><Button variant="secondary">Cancel</Button><Button variant="danger">Delete</Button></>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('data-slot', 'button');
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('data-variant', 'default');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('data-variant', 'outline');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('data-variant', 'outline'); // DD-UI-18
  });

  it('TextField is the shadcn input with its label, help and error wiring', () => {
    render(<TextField id="mail" label="Email" help="Work address" error="Required" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('data-slot', 'input');
    expect(screen.getByText('Email')).toHaveAttribute('data-slot', 'label');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Work address Required');
  });

  function Harness({ busy = false, onClose = () => {} }: { busy?: boolean; onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return <>
      <button onClick={() => setOpen(true)}>Open</button>
      <p>Outside</p>
      {open && <Dialog title="Rename resume" busy={busy} onClose={() => { onClose(); setOpen(false); }}>
        <button>First</button><button data-initial-focus>Cancel</button>
      </Dialog>}
    </>;
  }

  it('Dialog is the shadcn dialog: labelled, initial focus, focus returns to the opener', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Rename resume' });
    expect(dialog).toHaveAttribute('data-slot', 'dialog-content');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(opener).toHaveFocus();
  });

  it('Dialog ignores Escape while busy and never closes on an outside pointer', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness busy onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    rerender(<Harness onClose={onClose} />);
    fireEvent.pointerDown(document.body);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
