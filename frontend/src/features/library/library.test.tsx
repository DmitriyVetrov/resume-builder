import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import type { components } from '../../shared/api/generated/schema';

type Summary = components['schemas']['ResumeSummary'];
type Page = components['schemas']['ResumePage'];
type Resume = components['schemas']['Resume'];
type Problem = components['schemas']['Problem'];
type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

const uuid = (n: number) => `01934f6e-7a2b-7c3d-8e4f-${String(n).padStart(12, '0')}`;
const summary = (n: number, title: string, extra: Partial<Summary> = {}): Summary => ({
  id: uuid(n), version: n + 1, title, templateId: 'T1', createdAt: '2026-10-20T09:00:00Z', updatedAt: '2026-11-01T17:42:10Z', deletedAt: null, purgeAt: null, ...extra,
});
const page = (items: Summary[], nextCursor: string | null = null): Page => ({ items, nextCursor });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const problem = (status: number, code: string) => new Response(
  JSON.stringify({ type: 'about:blank', title: 'Error', status, code, traceId: 'synthetic-trace' } satisfies Problem),
  { status, headers: { 'Content-Type': 'application/problem+json' } });
const resume = (n: number, title: string): Resume => ({
  id: uuid(n), version: n + 1, createdAt: '2026-10-20T09:00:00Z', updatedAt: '2026-11-01T17:42:10Z', deletedAt: null, purgeAt: null, photo: null,
  document: {
    title, templateId: 'T1', accentPreset: 0, language: 'en', dateFormat: 'MonthYearLong',
    layout: { fontPreset: 'M', sectionSpacing: 10, entrySpacing: 10, lineSpacing: 1, pageSize: 'A4', margins: { top: 23, right: 23, bottom: 23, left: 23 }, bodyFont: null },
    header: { fullName: 'Synthetic Person', headline: '', showPhoto: true, contacts: [] }, sections: [],
  },
});

const sent: { method: string; path: string; init: RequestInit }[] = [];
let emailVerified = true;
const unsafe = () => sent.filter(call => call.method !== 'GET');
function stub(handler: Handler) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    sent.push({ method, path: url.pathname + url.search, init });
    if (url.pathname === '/api/v1/session') return json({ authenticated: true, user: { id: uuid(0), email: 'person-a@example.invalid', emailVerified, createdAt: '2026-10-01T08:00:00Z' } });
    return handler(url, init);
  }));
}
const at = (path: string) => { window.history.replaceState(null, '', path); render(<App />); };
const cleanupAndOpenTrash = () => { cleanup(); window.history.replaceState(null, '', '/'); };
const headerOf = (call: { init: RequestInit }, name: string) => new Headers(call.init.headers).get(name);

// These tests count list requests. Cards stay out of view here, so no thumbnail fetches a document; thumbnail.test.tsx covers those.
beforeEach(() => { sent.length = 0; emailVerified = true; document.cookie = 'XSRF-TOKEN=synthetic-csrf'; window.history.replaceState(null, '', '/'); vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('library page', () => {
  it('L-01 IMP-01: "Import CV" sits next to the create button and opens the import page', async () => {
    stub(() => json(page([summary(1, 'Backend engineer')])));
    at('/resumes');
    const link = await screen.findByRole('link', { name: 'Import CV' });
    expect(link).toHaveAttribute('href', '/resumes/import');
    expect(screen.getByRole('button', { name: 'Create new resume' })).toBeInTheDocument();
  });

  it('F01 shows each card with title, date, template placeholder and an Open link', async () => {
    stub(() => json(page([summary(1, 'Backend engineer'), summary(2, '')])));
    at('/resumes');
    expect(screen.getByRole('heading', { level: 1, name: 'Resumes' })).toBeInTheDocument();
    const open = await screen.findByRole('link', { name: 'Open Backend engineer' });
    expect(open).toHaveAttribute('href', `/resumes/${uuid(1)}/edit`);
    const card = open.closest('article');
    expect(card).not.toBeNull();
    const scope = within(card as HTMLElement);
    expect(scope.getByRole('heading', { level: 2, name: 'Backend engineer' })).toBeInTheDocument();
    expect(scope.getByText(/last modified/i)).toHaveTextContent(/1 Nov(ember)? 2026/);
    expect(scope.getByText('Template T1')).toBeInTheDocument();
    expect(card?.querySelector('[aria-hidden="true"]')).not.toBeNull();
    for (const name of ['Rename Backend engineer', 'Copy Backend engineer', 'Delete Backend engineer']) expect(scope.getByRole('button', { name })).toBeInTheDocument();
    // An empty title falls back to a display name, not to an empty heading.
    expect(screen.getByRole('heading', { level: 2, name: 'Untitled resume' })).toBeInTheDocument();
    expect(sent.find(call => call.path.startsWith('/api/v1/resumes'))?.path).toBe('/api/v1/resumes?state=active');
  });

  it('F02 goes through loading, empty, error and retry', async () => {
    let answer: () => Response = () => problem(500, 'internal_error');
    stub(() => answer());
    at('/resumes');
    expect(screen.getByRole('status')).toHaveTextContent(/loading resumes/i);
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable|try again/i);
    answer = () => json(page([]));
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('No resumes yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create your first resume' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('F02 keeps the cards when loading the next page fails, and appends on retry', async () => {
    let failing = true;
    stub(url => {
      if (!url.searchParams.get('cursor')) return json(page([summary(1, 'First')], 'next-cursor'));
      return failing ? problem(503, 'service_unavailable') : json(page([summary(2, 'Second')]));
    });
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: /load more/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'First' })).toBeInTheDocument();
    failing = false;
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Second' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'First' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    expect(sent.at(-1)?.path).toContain('cursor=next-cursor');
    expect(document.activeElement?.closest('article')).toHaveTextContent('Second');
  });

  it('F03 sends an expired session to the login page with a return path', async () => {
    stub(() => problem(401, 'unauthenticated'));
    at('/resumes');
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(window.location.search).toBe('?returnTo=%2Fresumes');
  });

  it('F04 renders a template it does not know as text', async () => {
    stub(() => json(page([summary(1, 'Future', { templateId: 'T9' as Summary['templateId'] })])));
    at('/resumes');
    expect(await screen.findByText('Template T9')).toBeInTheDocument();
  });

  it('F12 shows a Unicode title exactly', async () => {
    const title = 'Олександр Núñez Ľubomír \u{1F600}';
    stub(() => json(page([summary(1, title)])));
    at('/resumes');
    expect(await screen.findByRole('heading', { level: 2, name: title })).toBeInTheDocument();
  });
});

describe('create dialog', () => {
  it('F05 creates a blank resume with a key and goes to the editor', async () => {
    stub((url, init) => {
      if (init.method === 'POST') return json(resume(9, 'Untitled resume'), 201);
      return url.searchParams.get('state') ? json(page([summary(1, 'Existing')])) : json(resume(1, 'Existing'));
    });
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Create new resume' }));
    const dialog = await screen.findByRole('dialog', { name: /create/i });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start from scratch' }));
    await waitFor(() => expect(window.location.pathname).toBe(`/resumes/${uuid(9)}/edit`));
    const [post] = unsafe();
    expect(post?.path).toBe('/api/v1/resumes');
    expect(headerOf(post!, 'Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(headerOf(post!, 'X-XSRF-TOKEN')).toBe('synthetic-csrf');
    const body = JSON.parse(String(post?.init.body));
    expect(body.source).toBe('document');
    expect(body.copyPhotoFromResumeId).toBeNull();
    expect(body.document.sections).toHaveLength(5);
  });

  it('F05 copies a selected resume only after a choice', async () => {
    stub((url, init) => init.method === 'POST' ? json(resume(9, 'Backend (copy)'), 201) : json(page([summary(1, 'Backend')])));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Create new resume' }));
    const dialog = await screen.findByRole('dialog', { name: /create/i });
    const copy = within(dialog).getByRole('button', { name: 'Copy selected' });
    expect(copy).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Backend/ }));
    expect(copy).toBeEnabled();
    fireEvent.click(copy);
    await waitFor(() => expect(window.location.pathname).toBe(`/resumes/${uuid(9)}/edit`));
    expect(JSON.parse(String(unsafe()[0]?.init.body))).toEqual({ source: 'copy', sourceResumeId: uuid(1), title: 'Backend (copy)' });
  });

  it('F05 hides the copy list when there is nothing to copy', async () => {
    stub(() => json(page([])));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Create your first resume' }));
    const dialog = await screen.findByRole('dialog', { name: /create/i });
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Copy selected' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start from scratch' })).toBeEnabled();
  });

  it('F05 retries a failed create with the same key and body', async () => {
    let attempts = 0;
    stub((url, init) => {
      if (init.method !== 'POST') return json(page([]));
      attempts++;
      return attempts === 1 ? Promise.reject(new TypeError('network down')) : json(resume(9, 'Untitled resume'), 201);
    });
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Create your first resume' }));
    const dialog = await screen.findByRole('dialog', { name: /create/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start from scratch' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start from scratch' }));
    await waitFor(() => expect(window.location.pathname).toBe(`/resumes/${uuid(9)}/edit`));
    const [first, second] = unsafe();
    expect(headerOf(second!, 'Idempotency-Key')).toBe(headerOf(first!, 'Idempotency-Key'));
    expect(second?.init.body).toBe(first?.init.body);
  });

  // External review, major: a 5xx or an in-flight 409 does not prove the first attempt wrote nothing,
  // so a new key could create a second resume.
  it.each([
    ['a 5xx', () => problem(500, 'internal_error')],
    ['an in-flight duplicate', () => problem(409, 'idempotency_request_in_progress')],
  ])('F05 keeps the key and body after %s, whose outcome is unknown', async (_name, failure) => {
    let attempts = 0;
    stub((url, init) => {
      if (init.method !== 'POST') return json(page([]));
      attempts++;
      return attempts === 1 ? failure() : json(resume(9, 'Untitled resume'), 201);
    });
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Create your first resume' }));
    const dialog = await screen.findByRole('dialog', { name: /create/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start from scratch' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start from scratch' }));
    await waitFor(() => expect(window.location.pathname).toBe(`/resumes/${uuid(9)}/edit`));
    const [first, second] = unsafe();
    expect(headerOf(second!, 'Idempotency-Key')).toBe(headerOf(first!, 'Idempotency-Key'));
    expect(second?.init.body).toBe(first?.init.body);
  });

  // External delta review, major: closing the dialog must not forget an attempt whose outcome is unknown.
  it('F05 keeps the key and body when the dialog is closed and reopened after an unknown outcome, and shows the current list', async () => {
    let attempts = 0;
    stub((url, init) => {
      if (init.method !== 'POST') return json(page([]));
      attempts++;
      return attempts === 1 ? problem(500, 'internal_error') : json(resume(9, 'Untitled resume'), 201);
    });
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Create your first resume' }));
    let dialog = await screen.findByRole('dialog', { name: /create/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start from scratch' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    // The first request may have created a resume, so the list behind the dialog is read again.
    await waitFor(() => expect(sent.filter(call => call.path === '/api/v1/resumes?state=active')).toHaveLength(2));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(await screen.findByRole('button', { name: 'Create your first resume' }));
    dialog = await screen.findByRole('dialog', { name: /create/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start from scratch' }));
    await waitFor(() => expect(window.location.pathname).toBe(`/resumes/${uuid(9)}/edit`));
    const [first, second] = unsafe();
    expect(headerOf(second!, 'Idempotency-Key')).toBe(headerOf(first!, 'Idempotency-Key'));
    expect(second?.init.body).toBe(first?.init.body);
  });

  it('F05 uses a new key after a rejection that proves nothing was written', async () => {
    let attempts = 0;
    stub((url, init) => {
      if (init.method !== 'POST') return json(page([]));
      attempts++;
      return attempts === 1 ? problem(409, 'limit_reached') : json(resume(9, 'Untitled resume'), 201);
    });
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Create your first resume' }));
    const dialog = await screen.findByRole('dialog', { name: /create/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start from scratch' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start from scratch' }));
    await waitFor(() => expect(window.location.pathname).toBe(`/resumes/${uuid(9)}/edit`));
    const [first, second] = unsafe();
    expect(headerOf(second!, 'Idempotency-Key')).not.toBe(headerOf(first!, 'Idempotency-Key'));
  });

  it('F06 explains the limit with a link to the trash and stays open', async () => {
    stub((url, init) => init.method === 'POST' ? problem(409, 'limit_reached') : json(page([summary(1, 'Backend')])));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Create new resume' }));
    const dialog = await screen.findByRole('dialog', { name: /create/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start from scratch' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/200 resumes/);
    expect(within(dialog).getByRole('link', { name: /trash/i })).toHaveAttribute('href', '/resumes/trash');
    expect(window.location.pathname).toBe('/resumes');
  });
});

describe('card actions', () => {
  const library = (extra: Handler) => (url: URL, init: RequestInit) => {
    if (init.method && init.method !== 'GET') return extra(url, init);
    return url.pathname === '/api/v1/resumes' ? json(page([summary(1, 'Backend')])) : json(resume(1, 'Backend'));
  };

  it('F05 copies from a card and refreshes the list', async () => {
    stub(library(() => json(resume(9, 'Backend (copy)'), 201)));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Copy Backend' }));
    expect(await screen.findByText('Copied.')).toBeInTheDocument();
    expect(JSON.parse(String(unsafe()[0]?.init.body))).toEqual({ source: 'copy', sourceResumeId: uuid(1), title: 'Backend (copy)' });
    expect(sent.filter(call => call.path === '/api/v1/resumes?state=active')).toHaveLength(2);
  });

  it('F05 a card copy keeps its key after a 5xx', async () => {
    let attempts = 0;
    stub(library(() => { attempts++; return attempts === 1 ? problem(500, 'internal_error') : json(resume(9, 'Backend (copy)'), 201); }));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Copy Backend' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Backend' }));
    expect(await screen.findByText('Copied.')).toBeInTheDocument();
    const [first, second] = unsafe();
    expect(headerOf(second!, 'Idempotency-Key')).toBe(headerOf(first!, 'Idempotency-Key'));
  });

  it('F09 a retried delete and rename keep their keys after a 5xx', async () => {
    let failures = 1;
    stub(library(() => {
      if (failures-- > 0) return problem(500, 'internal_error');
      return json({ id: uuid(1), version: 3, updatedAt: '2026-11-02T10:00:00Z', deletedAt: null, purgeAt: null, warnings: [] });
    }));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Backend' }));
    const dialog = await screen.findByRole('dialog', { name: /delete/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move to trash' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move to trash' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [firstDelete, secondDelete] = unsafe();
    expect(headerOf(secondDelete!, 'Idempotency-Key')).toBe(headerOf(firstDelete!, 'Idempotency-Key'));

    failures = 1;
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Backend' }));
    const field = await screen.findByRole('textbox', { name: 'Name' });
    expect(field).toHaveValue('Backend');
    await waitFor(() => expect(sent.some(call => call.method === 'GET' && call.path === `/api/v1/resumes/${uuid(1)}`)).toBe(true));
    fireEvent.change(field, { target: { value: 'Renamed' } });
    fireEvent.submit(field.closest('form')!);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.submit(field.closest('form')!);
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument());
    const puts = unsafe().filter(call => call.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(headerOf(puts[1]!, 'Idempotency-Key')).toBe(headerOf(puts[0]!, 'Idempotency-Key'));
    expect(puts[1]?.init.body).toBe(puts[0]?.init.body);
  });

  it('F07 renames with the whole current document, only the title changed, and If-Match', async () => {
    stub(library(() => json({ id: uuid(1), version: 3, updatedAt: '2026-11-02T10:00:00Z', warnings: [] })));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Backend' }));
    const field = await screen.findByRole('textbox', { name: 'Name' });
    expect(field).toHaveFocus();
    await waitFor(() => expect(sent.some(call => call.method === 'GET' && call.path === `/api/v1/resumes/${uuid(1)}`)).toBe(true));
    fireEvent.change(field, { target: { value: 'Renamed' } });
    fireEvent.submit(field.closest('form')!);
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument());
    const [put] = unsafe();
    expect(put?.method).toBe('PUT');
    expect(put?.path).toBe(`/api/v1/resumes/${uuid(1)}/document`);
    expect(headerOf(put!, 'If-Match')).toBe('"2"');
    expect(headerOf(put!, 'Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(String(put?.init.body))).toEqual({ ...resume(1, 'Renamed').document });
    expect(await screen.findByText('Renamed.')).toBeInTheDocument();
  });

  it('F08 blocks an over-long title before any request', async () => {
    stub(library(() => json({})));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Backend' }));
    const field = await screen.findByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: '\u{1F600}'.repeat(151) } });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/151 of 150/)).toBeInTheDocument();
    fireEvent.submit(field.closest('form')!);
    fireEvent.change(field, { target: { value: '\u{1F600}'.repeat(150) } });
    expect(field).toHaveAttribute('aria-invalid', 'false');
    expect(unsafe()).toHaveLength(0);
  });

  it('F08 reports a stale version in words and refreshes the list', async () => {
    stub(library(() => problem(412, 'version_mismatch')));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Backend' }));
    const field = await screen.findByRole('textbox', { name: 'Name' });
    await waitFor(() => expect(sent.some(call => call.method === 'GET' && call.path === `/api/v1/resumes/${uuid(1)}`)).toBe(true));
    fireEvent.change(field, { target: { value: 'Renamed' } });
    fireEvent.submit(field.closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('This resume changed elsewhere. Reload and try again.');
    await waitFor(() => expect(sent.filter(call => call.path === '/api/v1/resumes?state=active')).toHaveLength(2));
  });

  it('F09 moves a resume to the trash after confirmation', async () => {
    stub(library(() => json({ id: uuid(1), version: 3, updatedAt: '2026-11-02T10:00:00Z', deletedAt: '2026-11-02T10:00:00Z', purgeAt: '2026-12-02T10:00:00Z' })));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Backend' }));
    const dialog = await screen.findByRole('dialog', { name: /delete/i });
    expect(within(dialog).getByText(/30 days/)).toBeInTheDocument();
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons.map(button => button.textContent)).toEqual(['Cancel', 'Move to trash']);
    expect(buttons[0]).toHaveFocus();
    fireEvent.click(buttons[1]!);
    const status = await screen.findByText(/moved to trash/i);
    await waitFor(() => expect(status).toHaveFocus());
    expect(within(status).getByRole('link', { name: /trash/i })).toHaveAttribute('href', '/resumes/trash');
    const [call] = unsafe();
    expect(call?.method).toBe('DELETE');
    expect(call?.path).toBe(`/api/v1/resumes/${uuid(1)}`);
    expect(headerOf(call!, 'If-Match')).toBe('"2"');
    expect(headerOf(call!, 'Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('F10 cancel sends nothing and returns focus to the opener', async () => {
    stub(library(() => json({})));
    at('/resumes');
    const trigger = await screen.findByRole('button', { name: 'Delete Backend' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: /delete/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(unsafe()).toHaveLength(0);
  });

  it('F11 blocks a duplicate submit while the request is pending', async () => {
    let release: (response: Response) => void = () => {};
    stub(library(() => new Promise<Response>(resolve => { release = resolve; })));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Backend' }));
    const dialog = await screen.findByRole('dialog', { name: /delete/i });
    const confirm = within(dialog).getByRole('button', { name: 'Move to trash' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    expect(unsafe()).toHaveLength(1);
    release(json({ id: uuid(1), version: 3, updatedAt: '2026-11-02T10:00:00Z', deletedAt: '2026-11-02T10:00:00Z', purgeAt: '2026-12-02T10:00:00Z' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('export from the list, FR-LIB-06', () => {
  const saved: string[] = [];
  const library = (document: Resume = resume(1, 'Backend CV')) => (url: URL, init: RequestInit) => {
    if (init.method === 'POST') return json({}, 201);
    return url.pathname === '/api/v1/resumes' ? json(page([summary(1, 'Backend CV')])) : json(document);
  };
  beforeEach(() => {
    saved.length = 0;
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) { saved.push(this.download); });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('B01 each active card exports PDF and TXT, and a trash card does not', async () => {
    stub(library());
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Export PDF Backend CV' }));
    await waitFor(() => expect(saved).toEqual(['Backend-CV.pdf']), { timeout: 20_000 });
    expect(await screen.findByText('Exported Backend-CV.pdf.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export TXT Backend CV' }));
    await waitFor(() => expect(saved).toEqual(['Backend-CV.pdf', 'Backend-CV.txt']));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent.filter(call => call.method === 'POST' && call.path.endsWith('/snapshots'))).toHaveLength(2);
    cleanupAndOpenTrash();
    stub(() => json(page([summary(2, 'Old CV', { deletedAt: '2026-11-01T10:00:00Z', purgeAt: '2026-11-15T12:00:00Z' })])));
    at('/resumes/trash');
    await screen.findByRole('button', { name: 'Restore Old CV' });
    expect(screen.queryByRole('button', { name: /^Export/ })).toBeNull();
  });
  it('B02 a resume with no full name: no file, and the page says what is missing', async () => {
    const unnamed = resume(1, 'Backend CV');
    stub(library({ ...unnamed, document: { ...unnamed.document, header: { ...unnamed.document.header, fullName: ' ' } } }));
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Export TXT Backend CV' }));
    expect(await screen.findByText(/add a full name to .*Backend CV/i)).toBeInTheDocument();
    expect(saved).toEqual([]);
  });
  it('B03 an unverified address: the buttons explain, with the same link', async () => {
    emailVerified = false;
    stub(library());
    at('/resumes');
    const button = await screen.findByRole('button', { name: 'Export PDF Backend CV' });
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'));
    expect(button).toHaveAccessibleDescription(/verify your e-mail address/i);
    expect(screen.getByRole('link', { name: 'Resend verification' })).toHaveAttribute('href', '/verify-email');
    fireEvent.click(button);
    await new Promise(done => setTimeout(done, 30));
    expect(saved).toEqual([]);
    expect(sent.filter(call => /resumes\/[^/?]+$/.test(call.path))).toEqual([]);
  });
  it('B04 an expired session goes to log in; a resume gone elsewhere refreshes the list', async () => {
    let status = 401;
    stub((url, init) => {
      if (init.method === 'POST') return json({}, 201);
      if (url.pathname === '/api/v1/resumes') return json(page([summary(1, 'Backend CV')]));
      return status === 401 ? problem(401, 'unauthenticated') : problem(404, 'not_found');
    });
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Export PDF Backend CV' }));
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    cleanupAndOpenTrash();
    status = 404;
    sent.length = 0;
    at('/resumes');
    fireEvent.click(await screen.findByRole('button', { name: 'Export PDF Backend CV' }));
    expect(await screen.findByText('This resume is no longer available.')).toBeInTheDocument();
    await waitFor(() => expect(sent.filter(call => call.path === '/api/v1/resumes?state=active')).toHaveLength(2));
    expect(saved).toEqual([]);
  });
});

describe('trash page', () => {
  const trashed = (n: number, title: string, purgeAt: string) => summary(n, title, { deletedAt: '2026-11-01T10:00:00Z', purgeAt });

  it('F09 lists days left, and restores and purges with If-Match', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-05T12:00:00Z') });
    let items = [trashed(1, 'Old CV', '2026-11-15T12:00:00Z'), trashed(2, 'Older CV', '2026-11-05T11:00:00Z')];
    stub((url, init) => {
      if (init.method === 'POST') {
        const id = url.pathname.split('/')[4];
        items = items.filter(item => item.id !== id);
        return url.pathname.endsWith('/purge') ? new Response(null, { status: 204 }) : json({ id, version: 9, updatedAt: '2026-11-05T12:00:00Z', deletedAt: null, purgeAt: null });
      }
      return json(page(items));
    });
    at('/resumes/trash');
    const card = (await screen.findByRole('heading', { level: 2, name: 'Old CV' })).closest('article') as HTMLElement;
    expect(sent.find(call => call.path.startsWith('/api/v1/resumes'))?.path).toBe('/api/v1/resumes?state=trashed');
    expect(within(card).getByText('10 days left')).toBeInTheDocument();
    expect(within(card).getByText(/deleted 1 Nov(ember)? 2026/i)).toBeInTheDocument();
    expect(within(card).queryByRole('link', { name: /open/i })).not.toBeInTheDocument();
    expect(screen.getByText('Deletes today')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Trash' })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(within(card).getByRole('button', { name: 'Restore Old CV' }));
    const restored = await screen.findByText(/restored/i);
    await waitFor(() => expect(restored).toHaveFocus());
    expect(unsafe()[0]?.path).toBe(`/api/v1/resumes/${uuid(1)}/restore`);
    expect(headerOf(unsafe()[0]!, 'If-Match')).toBe('"2"');

    fireEvent.click(await screen.findByRole('button', { name: 'Delete permanently Older CV' }));
    const dialog = await screen.findByRole('dialog', { name: /delete permanently/i });
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons.map(button => button.textContent)).toEqual(['Cancel', 'Delete permanently']);
    expect(buttons[0]).toHaveFocus();
    fireEvent.click(buttons[1]!);
    expect(await screen.findByText('Trash is empty')).toBeInTheDocument();
    expect(unsafe()[1]?.path).toBe(`/api/v1/resumes/${uuid(2)}/purge`);
    expect(headerOf(unsafe()[1]!, 'If-Match')).toBe('"3"');
    expect(headerOf(unsafe()[1]!, 'Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('F10 cancelling a purge sends nothing', async () => {
    stub(() => json(page([trashed(1, 'Old CV', '2026-11-15T12:00:00Z')])));
    at('/resumes/trash');
    fireEvent.click(await screen.findByRole('button', { name: 'Delete permanently Old CV' }));
    const dialog = await screen.findByRole('dialog', { name: /delete permanently/i });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(unsafe()).toHaveLength(0);
  });

  it('F09 refreshes and explains when a card is already gone', async () => {
    let calls = 0;
    stub((url, init) => {
      if (init.method === 'POST') return problem(404, 'not_found');
      calls++;
      return json(page(calls === 1 ? [trashed(1, 'Old CV', '2026-11-15T12:00:00Z')] : []));
    });
    at('/resumes/trash');
    fireEvent.click(await screen.findByRole('button', { name: 'Restore Old CV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer available/i);
    expect(await screen.findByText('Trash is empty')).toBeInTheDocument();
  });
});
