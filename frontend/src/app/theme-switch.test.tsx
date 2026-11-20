import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY } from '../shared/lib/theme';
import { App } from './App';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.stubGlobal('matchMedia', (query: string) => ({ media: query, matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('T-02 theme switch in the header (ADR-053 §6)', () => {
  it('offers Light, Dark and System, with the current choice checked', async () => {
    render(<App />);
    const trigger = within(screen.getByRole('banner')).getByRole('button', { name: /theme/i });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitemradio');
    expect(items.map(item => item.textContent?.trim())).toEqual(['Light', 'Dark', 'System']);
    expect(within(menu).getByRole('menuitemradio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
  });

  it('choosing Dark applies and remembers it', async () => {
    render(<App />);
    fireEvent.keyDown(within(screen.getByRole('banner')).getByRole('button', { name: /theme/i }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });
});
