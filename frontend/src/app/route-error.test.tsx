import { createElement, type ComponentType, type PropsWithChildren } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { App } from './App';
import { suppressCaughtErrorLogging } from './error-handlers';

// RTL 16.3.0 forwards this React 19 root option, but its conditional type resolves to never.
const silentRootOptions = { onCaughtError: suppressCaughtErrorLogging } as unknown as NonNullable<Parameters<typeof render>[1]>;

it('contains a routed render failure and recovers without exposing details', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const sentinel = 'fictional-sensitive-sentinel';
  function BrokenRoute(): never { throw new Error(sentinel); }
  try {
    render(createElement(App as ComponentType<PropsWithChildren>, {}, <BrokenRoute />), silentRootOptions);
    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(document.body).not.toHaveTextContent(sentinel);
    const loggedText = consoleSpy.mock.calls.flat().map(value => value instanceof Error ? value.message : String(value)).join(' ');
    expect(loggedText).not.toContain(sentinel);
    fireEvent.click(screen.getByRole('button', { name: /try again|go home/i }));
    expect(screen.getByRole('main')).toBeInTheDocument();
  } finally { consoleSpy.mockRestore(); }
});

it('restores routing after Go home recovery', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  let shouldThrow = true;
  function BrokenOnce() {
    if (shouldThrow) {
      throw new Error('fictional-recovery-sentinel');
    }
    return null;
  }
  try {
    window.history.replaceState(null, '', '/');
    render(createElement(App as ComponentType<PropsWithChildren>, {}, <BrokenOnce />), silentRootOptions);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /go home/i }));
    fireEvent.click(screen.getByRole('link', { name: 'Resumes' }));
    expect(window.location.pathname).toBe('/resumes');
    expect(screen.getByRole('heading', { level: 1, name: 'Resumes' })).toBeInTheDocument();
  } finally {
    consoleSpy.mockRestore();
    window.history.replaceState(null, '', '/');
  }
});
