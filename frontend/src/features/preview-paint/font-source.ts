/// <reference types="vite/client" />
const FILES = import.meta.glob('../../assets/fonts/*/*.ttf', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** One asset for the browser and the engine, so they cannot disagree about metrics (DD-P10-10). Our own origin only (NFR-09). */
export async function loadFontFile(fontId: string, face: string): Promise<Uint8Array> {
  const url = FILES[`../../assets/fonts/${fontId}/${face}.ttf`];
  if (!url) throw new Error('Unknown font file');
  const response = await fetch(url);
  if (!response.ok) throw new Error('Font file failed to load');
  return new Uint8Array(await response.arrayBuffer());
}
