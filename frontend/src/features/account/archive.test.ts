import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResumeDocument } from '../../entities/resume/operations';
import { fixture } from '../../entities/layout/test-kit';
import { resetClientEvents } from '../../shared/api/client-events';
import { blobBytes, text, unzip } from '../../test/unzip';
import { buildArchive, type ArchiveManifest } from './archive';

const writes: { title: string; photo: string | null; updatedAt: string }[] = [];
let failPdfFor: string | null = null;

vi.mock('../preview-paint/runtime', () => ({
  loadFailureCode: () => null,
  loadRuntime: async () => ({
    layout: (document: ResumeDocument, photo: boolean) => ({ pages: [{ lines: [], images: photo ? [{}] : [] }], title: document.title }),
    fit: () => { throw new Error('unused'); },
    missing: () => ({ characters: [], more: 0 }),
    writePdf: async ({ document, photo, updatedAt }: { document: ResumeDocument; photo: Uint8Array | null; updatedAt: string }) => {
      if (document.title === failPdfFor) throw new Error('synthetic writer failure');
      writes.push({ title: document.title, photo: photo ? new TextDecoder().decode(photo) : null, updatedAt });
      return new TextEncoder().encode(`%PDF ${document.title} ${updatedAt}`);
    },
  }),
  loadTextSerializer: async () => ({ serializeTxt: (document: ResumeDocument) => `TXT ${document.title}\n` }),
}));

const ACTIVE = '01934f6e-7a2b-7c3d-8e4f-000000000101';
const TRASHED = '01934f6e-7a2b-7c3d-8e4f-000000000102';
const NAMELESS = '01934f6e-7a2b-7c3d-8e4f-000000000103';
const photo = (id: string, mime: string) => ({ id, mime, width: 600, height: 600, bytes: 10, crop: { x: 0, y: 0, width: 600, height: 600 }, updatedAt: '2026-11-01T09:00:00.000Z' });
const doc = (title: string, fullName = 'Olena Kovalenko'): ResumeDocument => {
  const base = fixture('two-pages');
  return { ...base, title, header: { ...base.header, fullName } };
};
const resume = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, version: 3, createdAt: '2026-10-01T08:00:00.000Z', updatedAt: `2026-11-0${id.slice(-1)}T10:00:00.000Z`, deletedAt: null, purgeAt: null,
  photo: null, document: doc(title), ...extra,
});

type Call = { method: string; path: string; signal: AbortSignal | null; body: unknown };
let calls: Call[] = [];
let exportBody: unknown;
let failMasterFor: string | null = null;
let failExport = false;
let onFetch: ((path: string) => void) | null = null;

const exportPayload = () => ({
  exportedAt: '2026-11-12T10:00:00.000Z',
  account: { id: '00000000-0000-4000-8000-000000000001', email: 'person-a@example.invalid', createdAt: '2026-10-01T08:00:00.000Z', emailVerifiedAt: '2026-10-01T08:05:00.000Z' },
  resumes: [
    resume(ACTIVE, 'Active CV', { photo: photo('p-active', 'image/jpeg') }),
    resume(TRASHED, 'Trashed CV', { photo: photo('p-trashed', 'image/png'), deletedAt: '2026-11-10T10:00:00.000Z', purgeAt: '2026-12-10T10:00:00.000Z' }),
  ],
});

beforeEach(() => {
  calls = []; writes.length = 0; failPdfFor = null; failMasterFor = null; failExport = false; onFetch = null;
  exportBody = exportPayload();
  document.cookie = 'XSRF-TOKEN=synthetic-csrf';
  resetClientEvents();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    calls.push({ method: (init.method ?? 'GET').toUpperCase(), path: url.pathname, signal: init.signal ?? null, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
    onFetch?.(url.pathname);
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (url.pathname === '/api/v1/account/data-export') {
      if (failExport) return new Response(JSON.stringify({ type: 'about:blank', title: 'Unauthorized', status: 401, code: 'reauthentication_required', traceId: 't' }), { status: 401, headers: { 'Content-Type': 'application/problem+json' } });
      return new Response(JSON.stringify(exportBody), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    const photoPath = /^\/api\/v1\/resumes\/([^/]+)\/photo\/(master|rendition)$/.exec(url.pathname);
    if (photoPath) {
      if (photoPath[2] === 'master' && photoPath[1] === failMasterFor) return new Response(null, { status: 503 });
      return new Response(`${photoPath[2]}-of-${photoPath[1]}`, { status: 200 });
    }
    return new Response(null, { status: 202 });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function entriesOf(blob: Blob) {
  return new Map(unzip(await blobBytes(blob)).map(entry => [entry.name, entry.data]));
}
const events = () => calls.filter(call => call.path === '/api/v1/client-events').flatMap(call => (call.body as { events: { type: string; code: string }[] }).events);

describe('the data archive (FR-ACC-04, ADR-039 §6)', () => {
  it('A01 holds the JSON as received, the manifest, and per resume the photo master, the PDF and the TXT', async () => {
    const result = await buildArchive({ now: () => new Date(2026, 10, 12, 15, 0, 0) });
    expect(result.fileName).toBe('resumiser-data-2026-11-12.zip');
    const files = await entriesOf(result.blob);
    expect([...files.keys()].sort()).toEqual([
      'account-data.json', 'manifest.json',
      `resumes/${ACTIVE}/Active-CV.pdf`, `resumes/${ACTIVE}/Active-CV.txt`, `resumes/${ACTIVE}/photo-master.jpg`,
      `resumes/${TRASHED}/Trashed-CV.pdf`, `resumes/${TRASHED}/Trashed-CV.txt`, `resumes/${TRASHED}/photo-master.png`,
    ]);
    expect(JSON.parse(text(files.get('account-data.json')!))).toEqual(exportPayload());
    expect(text(files.get(`resumes/${ACTIVE}/photo-master.jpg`)!)).toBe(`master-of-${ACTIVE}`);
    expect(text(files.get(`resumes/${TRASHED}/Trashed-CV.txt`)!)).toBe('TXT Trashed CV\n');
    // The PDF gets the rendition, as one-click export does, and the stored date (ADR-010 §7).
    expect(writes).toEqual([
      { title: 'Active CV', photo: `rendition-of-${ACTIVE}`, updatedAt: '2026-11-01T10:00:00.000Z' },
      { title: 'Trashed CV', photo: `rendition-of-${TRASHED}`, updatedAt: '2026-11-02T10:00:00.000Z' },
    ]);
    const manifest = JSON.parse(text(files.get('manifest.json')!)) as ArchiveManifest;
    expect(manifest).toEqual(result.manifest);
    expect(manifest.resumes.map(item => [item.id, item.state, item.missing])).toEqual([[ACTIVE, 'active', []], [TRASHED, 'trashed', []]]);
    // No snapshot, no write of any kind (DD-P13-16).
    expect(calls.filter(call => call.method !== 'GET')).toEqual([]);
  });

  it('A02 a resume without a full name has no PDF or TXT, and the manifest says why', async () => {
    exportBody = { ...exportPayload(), resumes: [resume(NAMELESS, 'Nameless', { document: doc('Nameless', '  ') })] };
    const result = await buildArchive();
    const files = await entriesOf(result.blob);
    expect([...files.keys()].filter(name => name.startsWith('resumes/'))).toEqual([]);
    expect(result.manifest.resumes[0]!.missing).toEqual([{ file: 'Nameless.pdf', reason: 'no_full_name' }, { file: 'Nameless.txt', reason: 'no_full_name' }]);
  });

  it('A03 a PDF that cannot be written is listed with its code, reported without content, and the rest is delivered', async () => {
    failPdfFor = 'Active CV';
    const result = await buildArchive();
    const files = await entriesOf(result.blob);
    expect(files.has(`resumes/${ACTIVE}/Active-CV.pdf`)).toBe(false);
    expect(files.has(`resumes/${ACTIVE}/Active-CV.txt`)).toBe(true);
    expect(files.has(`resumes/${TRASHED}/Trashed-CV.pdf`)).toBe(true);
    expect(result.manifest.resumes[0]!.missing).toEqual([{ file: 'Active-CV.pdf', reason: 'pdf_write' }]);
    await vi.waitFor(() => expect(events()).toEqual([expect.objectContaining({ type: 'export_failed', code: 'pdf_write', resumeId: ACTIVE })]));
    expect(JSON.stringify(events())).not.toContain('Active CV');
  });

  it('A04 an abort after the first resume rejects, starts nothing more and returns no archive', async () => {
    const controller = new AbortController();
    onFetch = path => { if (path === `/api/v1/resumes/${ACTIVE}/photo/rendition`) controller.abort(); };
    await expect(buildArchive({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls.some(call => call.path.includes(TRASHED))).toBe(false);
    expect(calls.filter(call => call.path !== '/api/v1/client-events').every(call => call.signal === controller.signal)).toBe(true);
  });

  it('A05 progress starts at zero and steps once per resume', async () => {
    const progress: [number, number][] = [];
    await buildArchive({ onProgress: ({ done, total }) => progress.push([done, total]) });
    expect(progress).toEqual([[0, 2], [1, 2], [2, 2]]);
  });

  it('A06 a failed data read fails the archive before any photo is fetched', async () => {
    failExport = true;
    await expect(buildArchive()).rejects.toMatchObject({ status: 401 });
    expect(calls.map(call => call.path)).toEqual(['/api/v1/account/data-export']);
  });

  it('A07 a photo master that does not load is listed; the PDF still uses the rendition', async () => {
    failMasterFor = ACTIVE;
    const result = await buildArchive();
    const files = await entriesOf(result.blob);
    expect(files.has(`resumes/${ACTIVE}/photo-master.jpg`)).toBe(false);
    expect(files.has(`resumes/${ACTIVE}/Active-CV.pdf`)).toBe(true);
    expect(result.manifest.resumes[0]!.missing).toEqual([{ file: 'photo-master.jpg', reason: 'photo_load' }]);
  });
});
