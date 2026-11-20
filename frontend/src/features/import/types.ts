import type { components } from '../../shared/api/generated/schema';

type Schemas = components['schemas'];
export type ImportDraft = Schemas['ImportDraft'];
export type ImportDraftSection = Schemas['ImportDraftSection'];
export type ImportDraftEntry = Schemas['ImportDraftEntry'];
export type ImportDraftBlock = Schemas['ImportDraftBlock'];
export type ImportDraftDate = Schemas['ImportDraftDate'];
export type ImportWarning = Schemas['ImportWarning'];
export type ImportStructureRequest = Schemas['ImportStructureRequest'];
export type ImportStructureResult = Schemas['ImportStructureResult'];

/** One text item as pdf.js reports it, in points from the page's top-left corner (0-based page). */
/** `item`: the list item of a tagged PDF's structure tree the run belongs to, so an item's wrapped lines stay one item. */
export type PdfRun = { page: number; x: number; baseline: number; width: number; size: number; bold: boolean; italic: boolean; href: string | null; listItem: boolean; text: string; item?: number | null };
/** A small filled shape drawn left of a line: a list marker that is not a glyph (the CSS-marker case). */
export type PdfMarker = { page: number; x: number; y: number; size: number };
export type PdfImage = { page: number; x: number; top: number; width: number; height: number; id: string };
/** `labels`: the document's author and title metadata, the typed spelling of lines a template prints in capitals. */
export type Extraction = { pages: { width: number; height: number }[]; runs: PdfRun[]; markers: PdfMarker[]; images: PdfImage[]; labels?: string[] };

export type Column = 'M' | 'S';
/** A paragraph, a heading line or a list item after layout analysis. `text` carries `<b>`, `<i>` and `<a href>` markup; `plain` does not. */
export type TextBlock = { column: Column; page: number; top: number; x: number; size: number; bold: boolean; italic: boolean; listItem: boolean; text: string; plain: string };
export type Analysis = { columns: 1 | 2; sidebarSide: 'left' | 'right' | null; bodySize: number; pages: number; blocks: TextBlock[]; photo: PdfImage | null; droppedImages: number };

export type ImportReport = {
  basic: boolean;
  recognised: { contacts: number; sections: number; entries: number };
  clamped: string[];
  overLimit: string[];
  notInSource: string[];
  droppedImages: number;
  photo: boolean;
  sourceCapped: boolean;
};
