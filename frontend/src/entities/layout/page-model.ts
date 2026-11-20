import type { components } from '../../shared/api/generated/schema';
import type { StyleId } from '../template';

export type ContactKind = components['schemas']['ContactItem']['kind'];

/** A piece of a long run, at its model offset inside the run. The painter anchors each one (DD-P11-17); the PDF writes the whole run. */
export type RunPart = { text: string; x: number };
export type Run = { text: string; x: number; width: number; face: string; size: number; color: string; underline: boolean; link: string | null; parts: RunPart[] };
export type Anchor = { sectionId: string | null; entryId: string | null; itemId: string | null };
/** FR-PDF-08, tags only: `pN` a paragraph, `lN/M` item M of list N. Null for a heading or a meta line, which `role` already says. */
export type Line = { x: number; y: number; width: number; height: number; baseline: number; role: StyleId; runs: Run[]; anchor: Anchor | null; block: string | null };
export type ShapeRole = 'marker' | 'separator' | 'dot' | 'timeline' | 'rule' | 'band' | 'chip' | 'panel' | 'decor';
export type Shape = { role: ShapeRole; x: number; y: number; width: number; height: number; radius: number; fill: string };
export type PlacedImage = { x: number; y: number; width: number; height: number; radius: number };
export type LinkRect = { x: number; y: number; width: number; height: number; url: string };
/** A vector icon in a square box (FR-HDR-05): the path comes from `icons.ts`, so preview and PDF draw the same one. */
export type PlacedIcon = { kind: ContactKind; x: number; y: number; size: number; color: string };
/** The box of one section, or of the header when `sectionId` is null, on one page. Selection hits this (FR-PRV-08). */
export type Region = { sectionId: string | null; x: number; y: number; width: number; height: number };
export type Page = { number: number; width: number; height: number; lines: Line[]; shapes: Shape[]; images: PlacedImage[]; icons: PlacedIcon[]; regions: Region[]; links: LinkRect[] };
/** FR-PRV-07, PG-09. Part of the layout result, so it is deterministic; the PDF does not draw it. */
export type Hint = { kind: 'lone-title' | 'oversized'; page: number; sectionId: string | null; x: number; y: number; width: number; height: number };
export type PageModel = { engineVersion: string; pages: Page[]; hints: Hint[] };
