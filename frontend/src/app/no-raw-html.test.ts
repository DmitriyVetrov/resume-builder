/// <reference types="vite/client" />
import { expect, it } from 'vitest';

const sources = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

it('S01 nothing injects raw HTML (T-ID-11)', () => {
  const names = Object.keys(sources).filter(name => !name.endsWith('no-raw-html.test.ts') && !name.includes('/generated/'));
  expect(names.length).toBeGreaterThan(30);
  const offenders = names.filter(name => /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write/.test(sources[name]!));
  expect(offenders).toEqual([]);
});
