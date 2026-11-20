import { create, type Font } from 'fontkit';
import type { FontFace } from '../template';

const CACHE_LIMIT = 50_000;

/** Metrics come from the bundled font files only, never the browser (ADR-010 §6). */
export class FontBook {
  private readonly faces = new Map<string, Font>();
  private readonly widths = new Map<string, number>();
  constructor(readonly bytes: Record<string, Record<string, Uint8Array>>) {}

  font(key: string): Font {
    let font = this.faces.get(key);
    if (!font) {
      font = create(this.fileOf(key));
      this.faces.set(key, font);
    }
    return font;
  }

  fileOf(key: string): Uint8Array {
    const [id, face] = key.split('/') as [string, FontFace];
    const data = this.bytes[id]?.[face];
    if (!data) throw new Error(`Font is not loaded: ${key}`);
    return data;
  }

  /** Width in points. Cached in font units, so a font-size or spacing change costs no shaping. */
  measure(key: string, size: number, text: string): number {
    const cacheKey = `${key}\u0000${text}`;
    let units = this.widths.get(cacheKey);
    if (units === undefined) {
      units = this.font(key).layout(text).advanceWidth;
      if (this.widths.size >= CACHE_LIMIT) this.widths.clear();
      this.widths.set(cacheKey, units);
    }
    return (units * size) / this.font(key).unitsPerEm;
  }

  /** Ascent and descent in points, from the same tables the browser and the PDF viewer read. */
  vertical(key: string, size: number) {
    const font = this.font(key);
    return { ascent: (font.ascent * size) / font.unitsPerEm, descent: (-font.descent * size) / font.unitsPerEm };
  }
}

export const createFontBook = (bytes: Record<string, Record<string, Uint8Array>>) => new FontBook(bytes);
export const faceKey = (fontId: string, bold: boolean, italic: boolean) => `${fontId}/${bold ? (italic ? 'bold-italic' : 'bold') : italic ? 'italic' : 'regular'}`;
