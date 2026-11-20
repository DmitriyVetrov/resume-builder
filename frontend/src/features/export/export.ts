import type { PageModel } from '../../entities/layout';
import { ENGINE_VERSION } from '../../entities/layout/version';
import { exportFileName } from '../../entities/resume/export-name';
import type { LineEnding } from '../../entities/resume/local-data';
import type { ResumeDocument } from '../../entities/resume/operations';
import { resolveDesign } from '../../entities/template';
import { reportClientEvent } from '../../shared/api/client-events';
import { createSnapshot, renditionUrl, type PhotoInfo } from '../editor/api';
import { loadFailureCode, loadRuntime, loadTextSerializer } from '../preview-paint/runtime';
import { saveFile } from './download';

export type ExportSource = {
  resumeId: string; document: ResumeDocument; updatedAt: string; photo: PhotoInfo | null;
  /** The preview's one layout result, when one is on screen (ADR-010 §3). */
  preview?: { document: ResumeDocument | null; model: PageModel | null } | null;
};
export type PdfOutcome = { fileName: string; mismatch: boolean; missing: { characters: string[]; more: number } };

export class ExportFailure extends Error {
  constructor(readonly code: string) { super(code); }
}

/** NFR-13: a content-free report, then a failure the caller can name. */
function failed(code: string, resumeId: string) {
  reportClientEvent('export_failed', code, resumeId, ENGINE_VERSION);
  return new ExportFailure(code);
}

/** DD-P12-11: FR-PER-05 is a Should, so it never holds the export back. */
const snapshotBeforeExport = (resumeId: string) => { void createSnapshot(resumeId, crypto.randomUUID()).catch(() => {}); };

const lineTexts = (model: PageModel) => model.pages.map(page => page.lines.map(line => line.runs.map(run => run.text).join('')).join('\n'));

/** ADR-010 §8. The engine is pure, so a difference means the preview is stale or was laid out from other inputs. */
function differenceFrom(preview: PageModel, current: PageModel): string | null {
  if (preview.pages.length !== current.pages.length) return 'page_count.differs';
  const seen = lineTexts(preview);
  return lineTexts(current).some((text, index) => text !== seen[index]) ? 'line_breaks.differs' : null;
}

async function fetchPhoto(resumeId: string, photo: PhotoInfo): Promise<Uint8Array> {
  try {
    const response = await fetch(renditionUrl(resumeId, photo), { credentials: 'same-origin' });
    if (response.ok) return new Uint8Array(await response.arrayBuffer());
  } catch { /* Reported below, as any other failure to get the photo. */ }
  throw failed('photo_load', resumeId);
}

/** FR-PDF-01. The same path from the editor and the library, so a version gives the same bytes from both (FR-LIB-06). */
export async function exportPdf({ resumeId, document, updatedAt, photo, preview }: ExportSource): Promise<PdfOutcome> {
  snapshotBeforeExport(resumeId);
  const hasPhoto = photo !== null;
  const runtime = await loadRuntime(resolveDesign(document).font.id).catch(error => { throw failed(loadFailureCode(error) ?? 'engine_load', resumeId); });
  let current: PageModel;
  try { current = runtime.layout(document, hasPhoto); } catch { throw failed('layout_error', resumeId); }
  // DD-P12-01, DD-P12-03: the preview's own object, unless it says something else than this document does.
  const shown = preview?.document === document ? preview.model : null;
  const difference = shown && differenceFrom(shown, current);
  if (difference) reportClientEvent('export_mismatch', difference, resumeId, ENGINE_VERSION);
  const model = shown && !difference ? shown : current;
  const bytes = photo && model.pages.some(page => page.images.length) ? await fetchPhoto(resumeId, photo) : null;
  let file: Uint8Array;
  try { file = await runtime.writePdf({ model, document, photo: bytes, updatedAt }); } catch (error) { throw failed(loadFailureCode(error) ?? 'pdf_write', resumeId); }
  const fileName = exportFileName(document.title, 'pdf');
  saveFile(file, fileName, 'application/pdf');
  return { fileName, mismatch: difference !== null, missing: runtime.missing(model) };
}

async function serialized(resumeId: string, document: ResumeDocument, lineEnding: LineEnding) {
  try {
    const { serializeTxt } = await loadTextSerializer();
    return serializeTxt(document, { lineEnding });
  } catch (error) { throw failed(loadFailureCode(error) ?? 'txt_write', resumeId); }
}

/** FR-TXT-01. */
export async function exportTxt({ resumeId, document }: ExportSource, lineEnding: LineEnding = 'lf'): Promise<{ fileName: string }> {
  snapshotBeforeExport(resumeId);
  const text = await serialized(resumeId, document, lineEnding);
  const fileName = exportFileName(document.title, 'txt');
  saveFile(text, fileName, 'text/plain;charset=utf-8');
  return { fileName };
}

/** FR-TXT-06. A browser may refuse the clipboard, which says nothing about the product, so it raises no event. */
export async function copyText(document: ResumeDocument, lineEnding: LineEnding = 'lf'): Promise<void> {
  const { serializeTxt } = await loadTextSerializer().catch(() => { throw new ExportFailure('copy'); });
  try { await navigator.clipboard.writeText(serializeTxt(document, { lineEnding })); } catch { throw new ExportFailure('copy'); }
}

export function pdfMessage({ fileName, mismatch, missing }: PdfOutcome): string {
  const parts = [`Exported ${fileName}.`];
  if (missing.characters.length) parts.push(`Not in this template's font, so they print as empty boxes: ${missing.characters.join(' ')}${missing.more ? ` and ${missing.more} more` : ''}.`);
  if (mismatch) parts.push('Its pages differ from the preview. Reload the page to see them.');
  return parts.join(' ');
}

export function failureMessage(error: unknown, kind: 'PDF' | 'text file' | 'copy'): string {
  const code = error instanceof ExportFailure ? error.code : null;
  if (kind === 'copy') return 'The text could not be copied. Your browser may not allow it here.';
  if (code === 'photo_load') return 'The photo could not be loaded, so the PDF was not created. Check your connection and try again.';
  if (code === 'font_load' || code === 'engine_load') return `The ${kind} could not be created because its tools did not load. Check your connection and try again.`;
  return `The ${kind} could not be created. Try again.`;
}
