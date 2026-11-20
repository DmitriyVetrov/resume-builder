import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readThemePreference, setThemePreference, startTheme, THEME_KEY } from './theme';

type Listener = (event: { matches: boolean }) => void;
let osDark = false;
let listeners: Listener[] = [];
const root = () => document.documentElement;

function emulateOs(dark: boolean) {
  osDark = dark;
  for (const listener of listeners) listener({ matches: dark });
}

beforeEach(() => {
  osDark = false;
  listeners = [];
  localStorage.clear();
  root().classList.remove('dark');
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() { return query === '(prefers-color-scheme: dark)' && osDark; },
    addEventListener: (_type: string, listener: Listener) => { listeners.push(listener); },
    removeEventListener: (_type: string, listener: Listener) => { listeners = listeners.filter(item => item !== listener); },
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('T-01 color scheme preference (ADR-053 §6)', () => {
  it('defaults to system, also for an unknown stored value or a storage that throws', () => {
    expect(readThemePreference()).toBe('system');
    localStorage.setItem(THEME_KEY, 'sepia');
    expect(readThemePreference()).toBe('system');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readThemePreference()).toBe('system');
  });

  it('dark and light set or clear the class and persist', () => {
    const stop = startTheme();
    setThemePreference('dark');
    expect(root()).toHaveClass('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    setThemePreference('light');
    expect(root()).not.toHaveClass('dark');
    expect(readThemePreference()).toBe('light');
    stop();
  });

  it('system follows the OS, on start and on change', () => {
    osDark = true;
    const stop = startTheme();
    expect(root()).toHaveClass('dark');
    emulateOs(false);
    expect(root()).not.toHaveClass('dark');
    emulateOs(true);
    expect(root()).toHaveClass('dark');
    stop();
    expect(listeners).toHaveLength(0);
  });

  it('an explicit choice ignores the OS, and system clears the stored choice', () => {
    const stop = startTheme();
    setThemePreference('light');
    emulateOs(true);
    expect(root()).not.toHaveClass('dark');
    setThemePreference('system');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(root()).toHaveClass('dark');
    stop();
  });

  it('a storage that refuses writes still applies the choice', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const stop = startTheme();
    setThemePreference('dark');
    expect(root()).toHaveClass('dark');
    stop();
  });
});
