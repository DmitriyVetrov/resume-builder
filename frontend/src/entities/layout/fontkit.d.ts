declare module 'fontkit' {
  export type GlyphRun = { advanceWidth: number };
  export type Font = { unitsPerEm: number; ascent: number; descent: number; lineGap: number; layout(text: string): GlyphRun; hasGlyphForCodePoint(codePoint: number): boolean };
  export function create(buffer: Uint8Array, postscriptName?: string): Font;
}
declare module 'linebreak' {
  export default class LineBreaker {
    constructor(text: string);
    nextBreak(): { position: number; required: boolean } | null;
  }
}
