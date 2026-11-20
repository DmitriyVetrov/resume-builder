import { analyze } from './layout';
import { extractPdf, extractPhoto, ImportError, MAX_FILE_BYTES } from './pdf';
import { analyzeTxt } from './txt';
import type { Analysis } from './types';

/** `text`: what is sent for a TXT file, as it is (DD-IMP-12); a PDF sends its serialised analysis. */
export type ReadResult = { analysis: Analysis; format: 'pdf' | 'txt'; photo: Blob | null; text?: string };

const isTxt = (file: File) => file.type === 'text/plain' || /\.txt$/i.test(file.name);

/** ADR-055 §3: the file is read in the browser only; nothing of it leaves the device here. */
export async function readCv(file: File): Promise<ReadResult> {
  if (file.size > MAX_FILE_BYTES) throw new ImportError('too_large');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isTxt(file)) {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new ImportError('unreadable'); }
    if (!text.trim()) throw new ImportError('unreadable');
    return { analysis: analyzeTxt(text), format: 'txt', photo: null, text: text.replace(/^\uFEFF/, '') };
  }
  const analysis = analyze(await extractPdf(bytes));
  const photo = analysis.photo ? await extractPhoto(bytes, analysis.photo) : null;
  return { analysis, format: 'pdf', photo };
}
