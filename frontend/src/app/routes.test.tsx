import { render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { App } from './App';

afterEach(() => { window.history.replaceState(null, '', '/'); });
function at(path: string) { window.history.replaceState(null, '', path); render(<App />); }

// DD-P08-12: no fixture editor route exists any more, so the landing links to the library.
it('/ shows the landing with a library link', () => {
  at('/');
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: /resumiser/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /open your resumes/i })).toHaveAttribute('href', '/resumes');
});
// DD-P07-16: /resumes is the real library now; its heading, deep-link and axe checks live in library.test.tsx and library.spec.ts.
it('matches an editor deep link', () => {
  at('/resumes/fixture-id/edit');
  expect(screen.getByRole('heading', { level: 1, name: /editor/i })).toBeInTheDocument();
});
it('shows an unknown-path recovery link instead of an editor', () => {
  at('/missing');
  expect(screen.getByRole('heading', { level: 1, name: /not found/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
  expect(screen.queryByRole('heading', { name: /editor/i })).not.toBeInTheDocument();
});
