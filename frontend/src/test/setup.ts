import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, vi } from 'vitest';
afterEach(cleanup);
// The first test of a file loads the real engine and fonts.
vi.setConfig({ testTimeout: 30_000 });

// The real engine runs under jsdom, on the real font files, read from disk instead of over HTTP.
vi.mock('../features/preview-paint/font-source', () => ({
  loadFontFile: vi.fn(async (fontId: string, face: string) => new Uint8Array(await readFile(resolve(import.meta.dirname, `../assets/fonts/${fontId}/${face}.ttf`)))),
}));

// The theme Select (Radix, DD-UI-16) scrolls its list and captures the pointer; jsdom has neither.
// Files that run in the node environment have no Element.
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  Element.prototype.hasPointerCapture ??= function hasPointerCapture() { return false; };
  Element.prototype.releasePointerCapture ??= function releasePointerCapture() {};
}
