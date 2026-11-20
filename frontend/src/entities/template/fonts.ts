/** The bundled document fonts (DD-P10-09). Only data here: the module stays usable in Node and in the browser. */
export type FontFace = 'regular' | 'italic' | 'bold' | 'bold-italic';
export const FONT_FACES: readonly FontFace[] = ['regular', 'italic', 'bold', 'bold-italic'];
export type DocumentFont = { id: string; name: string; family: string; fallback: 'sans-serif' | 'serif' };
/** NFR-07, DD-P12-22: PT Serif lacks letters of Latin Extended-A and Cyrillic, so those letters print in this bundled family, in the same style. */
export const COVERAGE_FALLBACK: Readonly<Record<string, string>> = { 'pt-serif': 'roboto' };
export const DOCUMENT_FONTS: Record<string, DocumentFont> = {
  roboto: { id: 'roboto', name: 'Roboto', family: 'Resume Roboto', fallback: 'sans-serif' },
  'ibm-plex-sans': { id: 'ibm-plex-sans', name: 'IBM Plex Sans', family: 'Resume IBM Plex Sans', fallback: 'sans-serif' },
  'pt-serif': { id: 'pt-serif', name: 'PT Serif', family: 'Resume PT Serif', fallback: 'serif' },
};
