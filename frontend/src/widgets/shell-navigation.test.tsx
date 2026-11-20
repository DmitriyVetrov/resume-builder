import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { installApi, RESUME_ID } from '../features/editor/test-fixture';

// DD-P08-12: the "no save or export button" assertion described the inert P05 shell; the top bar's status and exports are W01.
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });
it('offers labelled navigation and skip target around the editor', async () => {
  installApi();
  window.history.replaceState(null, '', `/resumes/${RESUME_ID}/edit`);
  render(<App />);
  expect(screen.getByRole('link', { name: /skip to main/i })).toHaveAttribute('href', '#main-content');
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { level: 1, name: /editor/i })).toBeInTheDocument();
});
