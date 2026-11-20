/**
 * The viewer's color scheme (ADR-053 §6): light, dark or the OS setting. The choice is a per-device
 * convenience in localStorage; a storage that is blocked or full only means it is not remembered.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_KEY = 'resumiser.theme';
const QUERY = '(prefers-color-scheme: dark)';

let current: ThemePreference = 'system';
let media: MediaQueryList | null = null;
const listeners = new Set<() => void>();

function apply() {
  const dark = current === 'dark' || (current === 'system' && !!media?.matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch { return 'system'; }
}

export function getThemePreference(): ThemePreference { return current; }

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setThemePreference(preference: ThemePreference): void {
  current = preference;
  try {
    if (preference === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, preference);
  } catch { /* not remembered, still applied */ }
  apply();
  for (const listener of listeners) listener();
}

/** Applies the stored choice and follows the OS while the choice is `system`. Call before the first render. */
export function startTheme(): () => void {
  current = readThemePreference();
  media = typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
  const follow = () => apply();
  media?.addEventListener('change', follow);
  apply();
  for (const listener of listeners) listener();
  return () => { media?.removeEventListener('change', follow); media = null; };
}
