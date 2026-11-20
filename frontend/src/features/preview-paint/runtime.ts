import type { FitResult, FontBook, PageModel } from '../../entities/layout';
import type { Page } from '../../entities/layout/page-model';
import { ENGINE_VERSION } from '../../entities/layout/version';
import type { ResumeDocument } from '../../entities/resume/operations';
import { COVERAGE_FALLBACK, FONT_FACES } from '../../entities/template';
import { loadFontFile } from './font-source';
import { faceFamily } from './paint';

export type PreviewRuntime = {
  layout: (document: ResumeDocument, photo: boolean) => PageModel;
  fit: (document: ResumeDocument, target: number, photo: boolean) => FitResult;
  /** PDFKit has a chunk of its own, loaded on the first export (AC-P12-19). */
  writePdf: (input: { model: PageModel; document: ResumeDocument; photo: Uint8Array | null; updatedAt: string }) => Promise<Uint8Array>;
  missing: (model: PageModel) => { characters: string[]; more: number };
};
export type PreviewFailure = 'engine_load' | 'font_load' | 'layout_error';

class LoadFailure extends Error {
  constructor(readonly code: PreviewFailure) { super(code); }
}
export const loadFailureCode = (error: unknown): PreviewFailure | null => error instanceof LoadFailure ? error.code : null;
export const failureCode = (error: unknown): PreviewFailure => loadFailureCode(error) ?? 'layout_error';

const bytes: Record<string, Record<string, Uint8Array>> = {};
let families = new Map<string, Promise<void>>();
let engine: Promise<PreviewRuntime> | null = null;

/** Keeps one attempt per key while it may succeed: a failed load is forgotten, so Retry starts over. */
function once<T>(start: () => Promise<T>, forget: () => void): Promise<T> {
  const attempt = start();
  attempt.catch(forget);
  return attempt;
}

/** All four faces of one family, for the engine and for the painter, from the same bytes (DD-P10-10). */
export function ensureFamily(fontId: string): Promise<void> {
  let family = families.get(fontId);
  if (!family) {
    family = once(async () => {
      const faces = await Promise.all(FONT_FACES.map(async face => [face, await loadFontFile(fontId, face)] as const)).catch(() => { throw new LoadFailure('font_load'); });
      bytes[fontId] = Object.fromEntries(faces);
      // Absent under jsdom, where nothing paints glyphs.
      if (typeof FontFace === 'undefined') return;
      await Promise.all(faces.map(async ([face, data]) => {
        const loaded = await new FontFace(faceFamily(`${fontId}/${face}`), data.slice().buffer).load();
        document.fonts.add(loaded);
      })).catch(() => { throw new LoadFailure('font_load'); });
    }, () => families.delete(fontId));
    families.set(fontId, family);
  }
  return family;
}

/** Faces a stored page paints with, so a cached thumbnail needs no engine (DD-P11-09). */
export const ensurePageFonts = (page: Page) => Promise.all([...new Set(page.lines.flatMap(line => line.runs.map(run => run.face.split('/')[0] as string)))].map(ensureFamily));

function loadEngine(): Promise<PreviewRuntime> {
  engine ??= once(async () => {
    // The only value import of the engine: the route bundle stays free of it (ADR-010 "Risk", NFR-02).
    const { createFontBook, fitToPages, layout, missingCharacters } = await import('../../entities/layout').catch(() => { throw new LoadFailure('engine_load'); });
    const book: FontBook = createFontBook(bytes);
    const options = (photo: boolean) => ({ photo, engineVersion: ENGINE_VERSION });
    return {
      layout: (document, photo) => layout(document, book, options(photo)),
      fit: (document, target, photo) => fitToPages(document, target, book, options(photo)),
      writePdf: async input => {
        const { writePdf } = await import('../../entities/layout/pdf').catch(() => { throw new LoadFailure('engine_load'); });
        return writePdf({ ...input, fonts: book });
      },
      missing: model => missingCharacters(model, book),
    };
  }, () => { engine = null; });
  return engine;
}

/** TXT needs no fonts. */
export const loadTextSerializer = () => import('../../entities/layout/txt').catch(() => { throw new LoadFailure('engine_load'); });

/** The engine, with one family ready for it. */
export async function loadRuntime(fontId: string): Promise<PreviewRuntime> {
  const fallback = COVERAGE_FALLBACK[fontId];
  const [runtime] = await Promise.all([loadEngine(), ensureFamily(fontId), ...(fallback ? [ensureFamily(fallback)] : [])]);
  return runtime;
}

/** For tests only: the next load starts from nothing. */
export function resetPreviewRuntime() {
  engine = null;
  families = new Map();
  for (const key of Object.keys(bytes)) delete bytes[key];
}
