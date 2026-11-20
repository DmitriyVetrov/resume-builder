import { ENGINE_VERSION } from '../../entities/layout/version';
import { exportFileName } from '../../entities/resume/export-name';
import { resolveDesign } from '../../entities/template';
import { apiRequest, type AccountDataExport } from '../../shared/api/client';
import { reportClientEvent } from '../../shared/api/client-events';
import { createZip, type ZipEntry } from '../../shared/lib/zip';
import { masterUrl, renditionUrl, type PhotoInfo } from '../editor/api';
import { hasFullName } from '../export/gate';
import { loadFailureCode, loadRuntime, loadTextSerializer } from '../preview-paint/runtime';

export type ArchiveProgress = { done: number; total: number };
export type ArchiveMissing = { file: string; reason: string };
export type ArchiveManifestResume = { id: string; title: string; state: 'active' | 'trashed'; files: string[]; missing: ArchiveMissing[] };
export type ArchiveManifest = { exportedAt: string; engineVersion: string; resumes: ArchiveManifestResume[] };
export type ArchiveResult = { blob: Blob; fileName: string; manifest: ArchiveManifest };
export type ArchiveOptions = { signal?: AbortSignal; onProgress?: (progress: ArchiveProgress) => void; now?: () => Date };
type Resume = AccountDataExport['resumes'][number];

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const encoder = new TextEncoder();

class PartFailure extends Error {
  constructor(readonly code: string) { super(code); }
}

/** The bytes at a same-origin URL, or null. An abort is never swallowed: it ends the whole archive. */
async function fetchBytes(url: string, signal: AbortSignal | undefined): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...(signal ? { signal } : {}) });
    if (response.ok) return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  return null;
}

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** The PDF of the current version, exactly as one-click export writes it for the same version (ADR-010 §7, DD-P13-16): no snapshot, no download. */
async function pdfOf(resume: Resume, signal: AbortSignal | undefined): Promise<Uint8Array> {
  const document = resume.document;
  const runtime = await loadRuntime(resolveDesign(document).font.id);
  let model;
  try { model = runtime.layout(document, resume.photo !== null); } catch { throw new PartFailure('layout_error'); }
  let photo: Uint8Array | null = null;
  if (resume.photo && model.pages.some(page => page.images.length)) {
    photo = await fetchBytes(renditionUrl(resume.id, resume.photo), signal);
    if (!photo) throw new PartFailure('photo_load');
  }
  return runtime.writePdf({ model, document, photo, updatedAt: resume.updatedAt });
}

async function filesOf(resume: Resume, signal: AbortSignal | undefined): Promise<{ files: ZipEntry[]; entry: ArchiveManifestResume }> {
  const document = resume.document;
  const folder = `resumes/${resume.id}/`;
  const files: ZipEntry[] = [];
  const missing: ArchiveMissing[] = [];
  const add = (name: string, data: Uint8Array) => files.push({ name: folder + name, data });
  const pdfName = exportFileName(document.title, 'pdf');
  const txtName = exportFileName(document.title, 'txt');

  if (resume.photo) {
    const photo: PhotoInfo = resume.photo;
    const name = `photo-master.${EXTENSIONS[photo.mime] ?? 'bin'}`;
    const master = await fetchBytes(masterUrl(resume.id, photo), signal);
    if (master) add(name, master);
    else missing.push({ file: name, reason: 'photo_load' });
  }

  if (!hasFullName(document)) {
    // FR-TYP-03, DD-P13-14: one export rule. The data itself is in account-data.json.
    missing.push({ file: pdfName, reason: 'no_full_name' }, { file: txtName, reason: 'no_full_name' });
  } else {
    try { add(pdfName, await pdfOf(resume, signal)); } catch (error) {
      if (signal?.aborted) throw error;
      const code = error instanceof PartFailure ? error.code : loadFailureCode(error) ?? 'pdf_write';
      reportClientEvent('export_failed', code, resume.id, ENGINE_VERSION);
      missing.push({ file: pdfName, reason: code });
    }
    try {
      const { serializeTxt } = await loadTextSerializer();
      add(txtName, encoder.encode(serializeTxt(document)));
    } catch (error) {
      const code = loadFailureCode(error) ?? 'txt_write';
      reportClientEvent('export_failed', code, resume.id, ENGINE_VERSION);
      missing.push({ file: txtName, reason: code });
    }
  }
  const entry: ArchiveManifestResume = {
    id: resume.id, title: document.title, state: resume.deletedAt ? 'trashed' : 'active',
    files: files.map(file => file.name.slice(folder.length)), missing,
  };
  return { files, entry };
}

/**
 * FR-ACC-04, ADR-039 §6: the account's data as one ZIP, built in the browser. One resume at a time (DD-P13-13), so progress
 * moves and a cancel stops between any two requests. Only the JSON read can fail the whole archive.
 */
export async function buildArchive({ signal, onProgress, now = () => new Date() }: ArchiveOptions = {}): Promise<ArchiveResult> {
  const data = await apiRequest('/account/data-export', signal ? { signal } : {}) as AccountDataExport;
  signal?.throwIfAborted();
  const total = data.resumes.length;
  const files: ZipEntry[] = [{ name: 'account-data.json', data: encoder.encode(JSON.stringify(data, null, 2)) }];
  const resumes: ArchiveManifestResume[] = [];
  onProgress?.({ done: 0, total });
  for (const [index, resume] of data.resumes.entries()) {
    const part = await filesOf(resume, signal);
    signal?.throwIfAborted();
    files.push(...part.files);
    resumes.push(part.entry);
    onProgress?.({ done: index + 1, total });
  }
  const manifest: ArchiveManifest = { exportedAt: data.exportedAt, engineVersion: ENGINE_VERSION, resumes };
  files.splice(1, 0, { name: 'manifest.json', data: encoder.encode(JSON.stringify(manifest, null, 2)) });
  const date = now();
  return { blob: createZip(files, date), fileName: `resumiser-data-${localDate(date)}.zip`, manifest };
}

/** How many PDFs the manifest lists as missing for a reason other than a missing full name. */
export const failedPdfs = (manifest: ArchiveManifest) => manifest.resumes.filter(resume => resume.missing.some(item => item.file.endsWith('.pdf') && item.reason !== 'no_full_name')).length;
