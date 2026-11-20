import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import type { components } from '../../shared/api/generated/schema';
import { ImportError } from './pdf';
import type { Analysis, ImportStructureResult } from './types';

/** IMP-01 U-01…U-07 and T-02 (AC-IMP-06, AC-IMP-07, AC-IMP-10). File reading and the painted preview are replaced; the API is a stubbed fetch. */
const read = vi.hoisted(() => ({ readCv: vi.fn() }));
vi.mock('./read', () => read);
vi.mock('./ReviewPreview', () => ({ ReviewPreview: ({ document }: { document: { header: { fullName: string } } }) => <div data-testid="import-preview">{document.header.fullName}</div> }));

type Resume = components['schemas']['Resume'];
const uuid = (n: number) => `01934f6e-7a2b-7c3d-8e4f-${String(n).padStart(12, '0')}`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const problem = (status: number, code: string) => new Response(JSON.stringify({ type: 'about:blank', title: 'Error', status, code, traceId: 'synthetic-trace' }), { status, headers: { 'Content-Type': 'application/problem+json' } });
const NOTICE = 'The CV text is processed by Claude (Anthropic). The file and photo are not sent.';

const analysis = (partial: Partial<Analysis> = {}): Analysis => ({
  columns: 2, sidebarSide: 'left', bodySize: 9, pages: 1, photo: null, droppedImages: 1,
  blocks: [
    { column: 'M', page: 0, top: 40, x: 210, size: 22, bold: true, italic: false, listItem: false, text: 'Alex Sample', plain: 'Alex Sample' },
    { column: 'M', page: 0, top: 70, x: 210, size: 13, bold: true, italic: false, listItem: false, text: 'Platform Engineer', plain: 'Platform Engineer' },
    { column: 'M', page: 0, top: 110, x: 210, size: 11, bold: true, italic: false, listItem: false, text: 'SKILLS', plain: 'SKILLS' },
    { column: 'M', page: 0, top: 130, x: 210, size: 9, bold: false, italic: false, listItem: true, text: 'Kubernetes', plain: 'Kubernetes' },
  ],
  ...partial,
});
const result: ImportStructureResult = {
  draft: { fullName: 'Alex Sample', headline: 'Platform Engineer', contacts: [{ text: 'alex.sample@example.com', kind: 'email' }], language: 'en', sections: [{ title: 'Skills', type: 'list', placement: 'sidebar', blocks: [], items: ['Kubernetes'], entries: [] }] },
  escalated: false,
  warnings: [{ code: 'not_in_source', pointer: '/headline' }],
};
const created: Resume = {
  id: uuid(7), version: 1, createdAt: '2026-11-15T10:00:00Z', updatedAt: '2026-11-15T10:00:00Z', deletedAt: null, purgeAt: null, photo: null,
  document: { title: 'Alex Sample', templateId: 'T4', accentPreset: 0, language: 'en', dateFormat: 'MonthYearLong', layout: { fontPreset: 'M', sectionSpacing: 4, entrySpacing: 6, lineSpacing: 1, pageSize: 'A4', margins: { top: 23, right: 23, bottom: 23, left: 23 }, bodyFont: null }, header: { fullName: 'Alex Sample', headline: '', showPhoto: true, contacts: [] }, sections: [] },
};

const sent: { method: string; path: string; init: RequestInit }[] = [];
let structure: () => Response;
beforeEach(() => {
  sent.length = 0;
  document.cookie = 'XSRF-TOKEN=synthetic-csrf';
  structure = () => json(result);
  read.readCv.mockReset();
  read.readCv.mockResolvedValue({ analysis: analysis(), format: 'pdf', photo: null });
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    sent.push({ method, path: url.pathname, init });
    if (url.pathname === '/api/v1/session') return json({ authenticated: true, user: { id: uuid(0), email: 'person-a@example.invalid', emailVerified: true, createdAt: '2026-10-01T08:00:00Z' } });
    if (url.pathname === '/api/v1/resume-imports/structure') return structure();
    if (url.pathname === '/api/v1/resumes' && method === 'POST') return json(created, 201);
    if (url.pathname === `/api/v1/resumes/${uuid(7)}/photo`) return json({ version: 2, photo: null });
    if (url.pathname.startsWith('/api/v1/resumes')) return json(method === 'GET' && url.pathname.endsWith(uuid(7)) ? created : { items: [], nextCursor: null });
    return problem(404, 'not_found');
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

const open = () => { window.history.replaceState(null, '', '/resumes/import'); render(<App />); };
const pick = async (name = 'cv.pdf', type = 'application/pdf') => {
  const input = await screen.findByLabelText('CV file (PDF or TXT)');
  fireEvent.change(input, { target: { files: [new File(['%PDF-1.7 synthetic'], name, { type })] } });
};
const structureCalls = () => sent.filter(call => call.path === '/api/v1/resume-imports/structure');

describe('import page', () => {
  it('U-01 shows the picker for PDF and TXT and the processing notice', async () => {
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Import a CV' })).toBeInTheDocument();
    expect(screen.getByLabelText('CV file (PDF or TXT)')).toHaveAttribute('accept', '.pdf,.txt,application/pdf,text/plain');
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
  });

  it('U-02 a picked PDF is structured and the review shows the preview and the report', async () => {
    open();
    await pick();
    expect(await screen.findByRole('heading', { level: 2, name: 'Review the import' })).toBeInTheDocument();
    expect(screen.getByTestId('import-preview')).toHaveTextContent('Alex Sample');
    const [call] = structureCalls();
    const body = JSON.parse(String(call!.init.body)) as { sourceText: string; sourceFormat: string; layoutHint: unknown };
    expect(body).toEqual({ sourceText: '[M b 22] Alex Sample\n[M b 13] Platform Engineer\n[M b 11] SKILLS\n[M li] Kubernetes', sourceFormat: 'pdf', layoutHint: { columns: 2, sidebarSide: 'left' } });
    expect(new Headers(call!.init.headers).get('X-XSRF-TOKEN')).toBe('synthetic-csrf');
    const report = screen.getByRole('region', { name: 'Import report' });
    expect(within(report).getByText('1 image was not imported.')).toBeInTheDocument();
    expect(within(report).getByText('Headline')).toBeInTheDocument();
  });

  it('U-03 503 import_unavailable gives the basic result with a notice', async () => {
    structure = () => problem(503, 'import_unavailable');
    open();
    await pick();
    expect(await screen.findByRole('heading', { level: 2, name: 'Review the import' })).toBeInTheDocument();
    expect(screen.getByText(/Basic import:/)).toBeInTheDocument();
    expect(screen.getByTestId('import-preview')).toHaveTextContent('Alex Sample');
  });

  it('U-04 a PDF without a text layer is refused and nothing is sent', async () => {
    read.readCv.mockRejectedValue(new ImportError('no_text_layer'));
    open();
    await pick();
    expect(await screen.findByText('This PDF has no text layer. Export it again with selectable text, or import a TXT file.')).toBeInTheDocument();
    expect(structureCalls()).toEqual([]);
  });

  it('U-05 429 shows the limit message and creates nothing', async () => {
    structure = () => problem(429, 'rate_limited');
    open();
    await pick();
    expect(await screen.findByText('You have imported many CVs recently. Try again later.')).toBeInTheDocument();
    expect(sent.filter(call => call.path === '/api/v1/resumes' && call.method === 'POST')).toEqual([]);
  });

  it('U-06 Create stores the document, uploads the photo, then opens the editor', async () => {
    read.readCv.mockResolvedValue({ analysis: analysis(), format: 'pdf', photo: new Blob(['png'], { type: 'image/png' }) });
    open();
    await pick();
    fireEvent.click(await screen.findByRole('button', { name: 'Create resume' }));
    await waitFor(() => expect(window.location.pathname).toBe(`/resumes/${uuid(7)}/edit`));
    const create = sent.find(call => call.path === '/api/v1/resumes' && call.method === 'POST')!;
    const body = JSON.parse(String(create.init.body)) as { source: string; document: { templateId: string; header: { fullName: string } }; copyPhotoFromResumeId: null };
    expect(body).toMatchObject({ source: 'document', copyPhotoFromResumeId: null, document: { templateId: 'T4', header: { fullName: 'Alex Sample' } } });
    expect(new Headers(create.init.headers).get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    const photo = sent.find(call => call.path === `/api/v1/resumes/${uuid(7)}/photo`)!;
    expect(photo.init.body).toBeInstanceOf(FormData);
    expect(new Headers(photo.init.headers).get('If-Match')).toBe('"1"');
  });

  it('U-07 Cancel returns to the library without sending anything more', async () => {
    open();
    await pick();
    fireEvent.click(await screen.findByRole('link', { name: 'Cancel' }));
    await waitFor(() => expect(window.location.pathname).toBe('/resumes'));
    expect(sent.filter(call => call.method === 'POST' && call.path !== '/api/v1/resume-imports/structure')).toEqual([]);
  });

  it('U-08 the review takes the focus and is announced (external review R1)', async () => {
    open();
    await pick();
    const heading = await screen.findByRole('heading', { level: 2, name: 'Review the import' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole('status')).toHaveTextContent('The CV is ready to review.');
  });

  it('T-02 a TXT file is sent as txt with a one-column hint', async () => {
    read.readCv.mockResolvedValue({ analysis: analysis({ columns: 1, sidebarSide: null, droppedImages: 0 }), format: 'txt', photo: null });
    open();
    await pick('cv.txt', 'text/plain');
    await screen.findByRole('heading', { level: 2, name: 'Review the import' });
    const body = JSON.parse(String(structureCalls()[0]!.init.body)) as { sourceFormat: string; layoutHint: unknown };
    expect(body).toMatchObject({ sourceFormat: 'txt', layoutHint: { columns: 1, sidebarSide: null } });
  });
});
