import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layout, serializeTxt, type PageModel } from '../../entities/layout';
import { writePdf } from '../../entities/layout/pdf';
import { fixture, testFonts } from '../../entities/layout/test-kit';
import type { ResumeDocument } from '../../entities/resume/operations';
import { resetClientEvents } from '../../shared/api/client-events';
import { fixturePhoto } from '../editor/test-fixture';
import { resetPreviewRuntime } from '../preview-paint/runtime';
import { loadFontFile } from '../preview-paint/font-source';
import { saveFile } from './download';
import { copyText, ExportFailure, exportPdf, exportTxt, type ExportSource } from './export';

const RESUME_ID = '01934f6e-7a2b-7c3d-8e4f-000000000001';
const UPDATED_AT = '2026-11-05T10:00:00.000Z';
const PHOTO = new Uint8Array(readFileSync(resolve(import.meta.dirname, '../../../../tests/fixtures/resumes/photo.jpg')));
const fonts = testFonts();

type Call = { method: string; path: string; body: unknown };
const calls: Call[] = [];
const saved: { name: string; blob: Blob; href: string }[] = [];
let rendition: () => Response = () => new Response(PHOTO, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
let snapshot: () => Response = () => new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } });

const bytesOf = (blob: Blob) => new Promise<Uint8Array>((done, fail) => {
  const reader = new FileReader();
  reader.onload = () => done(new Uint8Array(reader.result as ArrayBuffer));
  reader.onerror = () => fail(reader.error);
  reader.readAsArrayBuffer(blob);
});
const events = () => calls.filter(call => call.path === '/api/v1/client-events').flatMap(call => (call.body as { events: { type: string; code: string; resumeId: string }[] }).events);
const snapshots = () => calls.filter(call => call.method === 'POST' && call.path.endsWith('/snapshots'));
const fresh = (document: ResumeDocument, photo = false): PageModel => layout(document, fonts, { photo, engineVersion: 'x' });
const expectedPdf = (model: PageModel, document: ResumeDocument, photo: Uint8Array | null = null) => writePdf({ model, document, fonts, photo, updatedAt: UPDATED_AT });
const source = (document: ResumeDocument, extra: Partial<ExportSource> = {}): ExportSource => ({ resumeId: RESUME_ID, document, updatedAt: UPDATED_AT, photo: null, ...extra });
const hexOf = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

beforeEach(() => {
  calls.length = 0;
  saved.length = 0;
  document.cookie = 'XSRF-TOKEN=synthetic-csrf';
  rendition = () => new Response(PHOTO, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
  snapshot = () => new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } });
  resetClientEvents();
  resetPreviewRuntime();
  const blobs = new Map<string, Blob>();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn((blob: Blob) => { const href = `blob:test/${blobs.size}`; blobs.set(href, blob); return href; }), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) { saved.push({ name: this.download, blob: blobs.get(this.href)!, href: this.href }); });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    calls.push({ method, path: url.pathname, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
    if (url.pathname.endsWith('/photo/rendition')) return rendition();
    if (url.pathname.endsWith('/snapshots')) return snapshot();
    return new Response(null, { status: 202 });
  }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('exporting a PDF', () => {
  it('X01 writes from the preview\'s own model when the preview is of this document (ADR-010 §3)', async () => {
    const document = fixture('one-page');
    const model = fresh(document);
    const own = { ...model, pages: model.pages.map(page => ({ ...page, shapes: [] })) };
    const outcome = await exportPdf(source(document, { preview: { document, model: own } }));
    expect(outcome.mismatch).toBe(false);
    expect(events()).toEqual([]);
    expect(hexOf(await bytesOf(saved[0]!.blob))).toBe(hexOf(await expectedPdf(own, document)));
    expect(hexOf(await bytesOf(saved[0]!.blob))).not.toBe(hexOf(await expectedPdf(model, document)));
    expect(saved[0]!.name).toBe(`${document.title.replaceAll(' ', '-')}.pdf`);
  });
  it('X02 writes from a fresh layout when the preview is behind, with no event', async () => {
    const document = fixture('one-page');
    const older = { ...document, header: { ...document.header, fullName: 'Older' } };
    const outcome = await exportPdf(source(document, { preview: { document: older, model: fresh(older) } }));
    expect(outcome.mismatch).toBe(false);
    expect(events()).toEqual([]);
    expect(hexOf(await bytesOf(saved[0]!.blob))).toBe(hexOf(await expectedPdf(fresh(document), document)));
  });
  it('X03 another page count in the preview: the event, the fresh layout, and the outcome says so', async () => {
    const document = fixture('two-pages');
    const model = fresh(document);
    const outcome = await exportPdf(source(document, { preview: { document, model: { ...model, pages: model.pages.slice(0, 1) } } }));
    expect(outcome.mismatch).toBe(true);
    expect(events()).toMatchObject([{ type: 'export_mismatch', code: 'page_count.differs', resumeId: RESUME_ID }]);
    expect(hexOf(await bytesOf(saved[0]!.blob))).toBe(hexOf(await expectedPdf(model, document)));
  });
  it('X04 same pages but other line text: line_breaks.differs', async () => {
    const document = fixture('one-page');
    const model = fresh(document);
    const [first, ...rest] = model.pages;
    const changed = { ...first!, lines: first!.lines.slice(1) };
    const outcome = await exportPdf(source(document, { preview: { document, model: { ...model, pages: [changed, ...rest] } } }));
    expect(outcome.mismatch).toBe(true);
    expect(events()).toMatchObject([{ type: 'export_mismatch', code: 'line_breaks.differs' }]);
  });
  it('X05 fetches the photo only when the model places one, and embeds it', async () => {
    const document = fixture('one-page');
    const rendered = () => calls.filter(call => call.path.endsWith('/photo/rendition'));
    await exportPdf(source({ ...document, templateId: 'T2' }, { photo: fixturePhoto }));
    expect(rendered()).toHaveLength(0);
    await exportPdf(source({ ...document, header: { ...document.header, showPhoto: false } }, { photo: fixturePhoto }));
    expect(rendered()).toHaveLength(0);
    await exportPdf(source(document));
    expect(rendered()).toHaveLength(0);
    await exportPdf(source(document, { photo: fixturePhoto }));
    expect(rendered()).toHaveLength(1);
    expect(hexOf(await bytesOf(saved.at(-1)!.blob))).toBe(hexOf(await expectedPdf(fresh(document, true), document, PHOTO)));
  });
  it('X06 a failed photo fails the export: no file, an event, a failure the caller can name', async () => {
    rendition = () => new Response(null, { status: 500 });
    const error = await exportPdf(source(fixture('one-page'), { photo: fixturePhoto })).catch(failure => failure);
    expect(error).toBeInstanceOf(ExportFailure);
    expect(error.code).toBe('photo_load');
    expect(saved).toEqual([]);
    expect(events()).toMatchObject([{ type: 'export_failed', code: 'photo_load', resumeId: RESUME_ID }]);
  });
  it('X07 a font that does not load: no file, an event with its code', async () => {
    vi.mocked(loadFontFile).mockRejectedValueOnce(new Error('offline'));
    const error = await exportPdf(source(fixture('one-page'))).catch(failure => failure);
    expect(error.code).toBe('font_load');
    expect(saved).toEqual([]);
    expect(events()).toMatchObject([{ type: 'export_failed', code: 'font_load' }]);
  });
  it('X08 sends one before_export snapshot, and its failure does not stop the export (FR-PER-05)', async () => {
    await exportPdf(source(fixture('one-page')));
    expect(snapshots()).toMatchObject([{ path: `/api/v1/resumes/${RESUME_ID}/snapshots`, body: { reason: 'before_export' } }]);
    snapshot = () => new Response(null, { status: 500 });
    await exportPdf(source(fixture('one-page')));
    expect(saved).toHaveLength(2);
    vi.mocked(fetch).mockImplementationOnce(async () => { throw new TypeError('offline'); });
    await exportPdf(source(fixture('one-page')));
    expect(saved).toHaveLength(3);
  });
  it('X13 a PT Serif document with a gap letter loads the fallback and exports, with nothing to report (DD-P12-22)', async () => {
    const document = fixture('minimal');
    const gaps = { ...document, title: 'cv', layout: { ...document.layout, bodyFont: 'pt-serif' }, header: { ...document.header, headline: 'Ŵales Ѝ' } };
    const outcome = await exportPdf(source(gaps));
    expect(outcome.missing.characters).toEqual([]);
    expect(saved[0]!.name).toBe('cv.pdf');
    expect(events()).toEqual([]);
  });
  it('reports what the font cannot print (DD-P12-07)', async () => {
    const document = { ...fixture('minimal'), title: 'cv' };
    const outcome = await exportPdf(source({ ...document, header: { ...document.header, headline: 'Hola 😀' } }));
    expect(outcome.missing.characters).toEqual(['😀']);
    expect(saved[0]!.name).toBe('cv.pdf');
  });
});

describe('exporting text', () => {
  it('X09 TXT: the name, the type, the snapshot, and no BOM', async () => {
    const document = fixture('reference-cv');
    const { fileName } = await exportTxt(source(document));
    expect(fileName).toBe('SWE-Dmytro-Vietrov.txt');
    expect(saved[0]!.name).toBe('SWE-Dmytro-Vietrov.txt');
    expect(saved[0]!.blob.type).toBe('text/plain;charset=utf-8');
    const bytes = await bytesOf(saved[0]!.blob);
    expect(Array.from(bytes.slice(0, 3))).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe(serializeTxt(document));
    expect(snapshots()).toHaveLength(1);
  });
  it('X10 with the CRLF option', async () => {
    const document = fixture('minimal');
    await exportTxt(source(document), 'crlf');
    expect(new TextDecoder().decode(await bytesOf(saved[0]!.blob))).toBe(serializeTxt(document, { lineEnding: 'crlf' }));
  });
  it('X11 copy writes the same content, reports a refusal, and takes no snapshot (FR-TXT-06)', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const document = fixture('minimal');
    await copyText(document);
    expect(writeText).toHaveBeenCalledWith(serializeTxt(document));
    await copyText(document, 'crlf');
    expect(writeText).toHaveBeenLastCalledWith(serializeTxt(document, { lineEnding: 'crlf' }));
    writeText.mockRejectedValueOnce(new DOMException('no', 'NotAllowedError'));
    const refused = await copyText(document).catch(failure => failure);
    expect(refused).toBeInstanceOf(ExportFailure);
    expect(snapshots()).toEqual([]);
    expect(saved).toEqual([]);
  });
  it('X12 a download is a Blob URL with the file name, revoked afterwards', () => {
    vi.useFakeTimers();
    saveFile('text', 'a.txt', 'text/plain;charset=utf-8');
    expect(saved[0]).toMatchObject({ name: 'a.txt', href: 'blob:test/0' });
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/0');
    vi.useRealTimers();
  });
});
