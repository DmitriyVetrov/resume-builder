import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { installApi, RESUME_ID } from '../features/editor/test-fixture';

// DD-P08-12: the panels now need a resume, so the route opens a fixture resume. Every P05 assertion stays.
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });
it('switches all four editor panels with accessible tab state', async () => {
  installApi();
  window.history.replaceState(null, '', `/resumes/${RESUME_ID}/edit`);
  render(<App />);
  const tabs = await screen.findByRole('tablist', { name: /editor panels/i });
  for (const name of ['Sections', 'Edit', 'Preview', 'Design']) {
    const tab = within(tabs).getByRole('tab', { name });
    fireEvent.click(tab);
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name })).toBeVisible();
  }
  expect(within(tabs).getAllByRole('tab', { selected: true })).toHaveLength(1);
});
