import { createHash } from 'node:crypto';
import type { Page, Route } from '@playwright/test';

export const USER_A = '00000000-0000-4000-8000-000000000001';
export const USER_B = '00000000-0000-4000-8000-000000000002';
export const RESUME_ID = '01934f6e-7a2b-7c3d-8e4f-000000000001';
const sid = (n: number) => `01934f6e-7a2b-7c3d-8e4f-2000000000${String(n).padStart(2, '0')}`;
const session = (id: string, emailVerified = true) => ({ authenticated: true, user: { id, email: 'person-a@example.invalid', emailVerified, createdAt: '2026-10-01T08:00:00Z' } });
export const run = (value: string, marks: Partial<Record<'bold' | 'italic' | 'underline', boolean>> = {}) => ({ kind: 'text', value, bold: false, italic: false, underline: false, ...marks });
const shell = { hidden: false, listColumns: null, placement: null };
export const entry = (n: number, title: string) => ({ id: sid(50 + n), title, organization: 'Org', location: '', start: null, end: null, dateText: '', description: [], pageBreakBefore: false });
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/p9vLWQAAAABJRU5ErkJggg==', 'base64');

export function document(): Record<string, unknown> & { sections: { id: string; title: string; type: string; hidden: boolean; content: Record<string, unknown> }[]; title: string } {
  return {
    title: 'Synthetic resume', templateId: 'T1', accentPreset: 0, language: 'en', dateFormat: 'MonthYearLong',
    layout: { fontPreset: 'M', sectionSpacing: 10, entrySpacing: 10, lineSpacing: 1, pageSize: 'A4', margins: { top: 23, right: 23, bottom: 23, left: 23 }, bodyFont: null },
    header: { fullName: 'Synthetic Person', headline: 'Engineer', showPhoto: true, contacts: [] },
    sections: [
      { ...shell, id: sid(1), type: 'text', title: 'Summary', content: { body: [{ kind: 'paragraph', inlines: [run('Summary text')] }] } },
      { ...shell, id: sid(2), type: 'entries', title: 'Experience', content: { labels: null, entries: [entry(1, 'First job'), entry(2, 'Second job')] } },
      { ...shell, id: sid(3), type: 'list', title: 'Skills', content: { items: [{ id: sid(60), text: [run('Go')] }, { id: sid(61), text: [run('SQL')] }] } },
      { ...shell, id: sid(4), type: 'inline', title: 'Languages', content: { body: [{ kind: 'paragraph', inlines: [run('English')] }] } },
    ],
  };
}

type Stored = { id: string; version: number; deletedAt: string | null; purgeAt: string | null; photo: unknown; document: ReturnType<typeof document>; lastWrite: { key: string; hash: string; version: number } | null };
export type Write = { key: string; ifMatch: string; body: string; title: string };

/** A stateful same-origin API that enforces the client's obligations (DD-P08-22). `violations` must stay empty. */
export class EditorApi {
  readonly resumes = new Map<string, Stored>();
  readonly violations: string[] = [];
  readonly writes: Write[] = [];
  readonly creates: { key: string; body: Record<string, unknown> }[] = [];
  readonly photoCalls: string[] = [];
  readonly clientEvents: Record<string, unknown>[] = [];
  readonly snapshots: string[] = [];
  /** What `getPhotoRendition` answers; the 1 px PNG otherwise. */
  rendition: Buffer | null = null;
  emailVerified = true;
  documentReads = 0;
  /** The library's list holds the main resume (P11 thumbnails); other specs open the editor directly. */
  listed = false;
  readonly keys = new Map<string, { hash: string; status: number; body: string; headers: Record<string, string> }>();
  user = USER_A;
  signedIn = true;
  /** One-shot behaviours for document writes. */
  applyThenAbortNext = false;
  blockWrites = false;
  limitReached = false;
  private held: (() => void)[] = [];
  private copies = 0;

  constructor(seed = document()) { this.resumes.set(RESUME_ID, { id: RESUME_ID, version: 7, deletedAt: null, purgeAt: null, photo: null, document: seed, lastWrite: null }); }
  get main() { return this.resumes.get(RESUME_ID)!; }

  /** Another device saved a newer version. */
  writeElsewhere(title: string) { this.main.version++; this.main.document = { ...this.main.document, title }; this.main.lastWrite = null; }
  release() { this.blockWrites = false; for (const resume of this.held.splice(0)) resume(); }

  async install(page: Page) {
    await page.context().addCookies([{ name: 'XSRF-TOKEN', value: 'synthetic-csrf', url: 'http://127.0.0.1:4173' }]);
    await page.route('**/api/v1/**', route => this.handle(route));
  }

  private json(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
    return route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store', ...headers }, body: JSON.stringify(body) });
  }
  private problem(route: Route, status: number, code: string, headers: Record<string, string> = {}) {
    return route.fulfill({ status, contentType: 'application/problem+json', headers, body: JSON.stringify({ type: 'about:blank', title: 'Error', status, code, traceId: 'synthetic-trace' }) });
  }
  private view(stored: Stored) {
    const { lastWrite: _lastWrite, ...rest } = stored;
    return { ...rest, createdAt: '2026-10-20T09:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z' };
  }

  private async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname.replace('/api/v1', '');
    const headers = request.headers();
    if (path === '/session') return this.json(route, 200, this.signedIn ? session(this.user, this.emailVerified) : { authenticated: false, user: null });
    if (path === '/auth/logout') { this.signedIn = false; return route.fulfill({ status: 204 }); }
    if (method !== 'GET' && headers['x-xsrf-token'] !== 'synthetic-csrf') { this.violations.push(`csrf ${method} ${path}`); return this.problem(route, 403, 'csrf_token_invalid'); }
    if (path === '/client-events' && method === 'POST') { this.clientEvents.push(...(JSON.parse(request.postData() ?? '{}').events as Record<string, unknown>[])); return route.fulfill({ status: 202 }); }
    if (path === '/resumes' && method === 'GET') {
      const items = this.listed && url.searchParams.get('state') !== 'trashed' ? [...this.resumes.values()].map(({ document: stored, photo: _photo, lastWrite: _write, ...rest }) => ({ ...rest, title: stored.title, templateId: stored.templateId, createdAt: '2026-10-20T09:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z' })) : [];
      return this.json(route, 200, { items, nextCursor: null });
    }
    if (path === '/resumes' && method === 'POST') return this.create(route, headers);
    const match = /^\/resumes\/([^/]+)(\/.*)?$/.exec(path);
    const stored = match ? this.resumes.get(match[1]!) : undefined;
    if (!stored) return this.problem(route, 404, 'not_found');
    const tail = match![2] ?? '';
    if (method === 'GET' && !tail) { this.documentReads++; return this.json(route, 200, this.view(stored), { ETag: `"${stored.version}"` }); }
    if (tail.startsWith('/photo/')  && method === 'GET') return route.fulfill({ status: 200, contentType: this.rendition ? 'image/jpeg' : 'image/png', headers: { 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' }, body: this.rendition ?? PNG });
    if (tail.startsWith('/snapshots') && method === 'GET') {
      const meta = { id: sid(80), resumeId: stored.id, resumeVersion: 3, reason: 'auto', createdAt: '2026-10-30T10:00:00.000Z', expiresAt: '2026-11-29T10:00:00.000Z' };
      if (tail === '/snapshots') return this.json(route, 200, { items: [meta], nextCursor: null });
      return this.json(route, 200, { ...meta, document: { ...document(), title: 'Restored title' } });
    }
    const key = headers['idempotency-key'];
    if (!key) { this.violations.push(`key ${method} ${path}`); return this.problem(route, 400, 'idempotency_key_required'); }
    if (tail === '/document' && method === 'PUT') return this.write(route, stored, headers, key);
    if (tail === '/snapshots' && method === 'POST') {
      this.snapshots.push(JSON.parse(route.request().postData() ?? '{}').reason);
      return this.json(route, 201, { id: sid(81), resumeId: stored.id, resumeVersion: stored.version, reason: 'before_export', createdAt: '2026-11-02T10:00:00.000Z', expiresAt: '2026-12-02T10:00:00.000Z' });
    }
    if (tail === '/photo' || tail === '/photo/crop') return this.photo(route, stored, method, tail, headers, key);
    return this.problem(route, 404, 'not_found');
  }

  private async write(route: Route, stored: Stored, headers: Record<string, string>, key: string) {
    const body = route.request().postData() ?? '';
    const parsed = JSON.parse(body);
    const hash = createHash('sha256').update(body).digest('hex');
    this.writes.push({ key, ifMatch: headers['if-match'] ?? '', body, title: parsed.title });
    if (this.blockWrites) await new Promise<void>(resolve => this.held.push(resolve));
    if (stored.lastWrite?.key === key) {
      if (stored.lastWrite.hash !== hash) { this.violations.push(`key reuse ${key}`); return this.problem(route, 422, 'idempotency_key_reused'); }
      return this.json(route, 200, { id: stored.id, version: stored.lastWrite.version, updatedAt: '2026-11-02T10:00:00.000Z', warnings: [] }, { ETag: `"${stored.lastWrite.version}"` });
    }
    if (!headers['if-match']) { this.violations.push('if-match missing'); return this.problem(route, 428, 'precondition_required'); }
    if (headers['if-match'] !== `"${stored.version}"`) return this.problem(route, 412, 'version_mismatch');
    stored.version++;
    stored.document = parsed;
    stored.lastWrite = { key, hash, version: stored.version };
    if (this.applyThenAbortNext) { this.applyThenAbortNext = false; return route.abort('connectionreset'); }
    return this.json(route, 200, { id: stored.id, version: stored.version, updatedAt: '2026-11-02T10:00:00.000Z', warnings: [] }, { ETag: `"${stored.version}"` });
  }

  private async create(route: Route, headers: Record<string, string>) {
    const key = headers['idempotency-key'] ?? '';
    if (!key) { this.violations.push('key create'); return this.problem(route, 400, 'idempotency_key_required'); }
    const raw = route.request().postData() ?? '';
    const hash = createHash('sha256').update(raw).digest('hex');
    const seen = this.keys.get(key);
    if (seen) {
      if (seen.hash !== hash) { this.violations.push(`copy key reuse ${key}`); return this.problem(route, 422, 'idempotency_key_reused'); }
      return route.fulfill({ status: seen.status, contentType: 'application/json', headers: seen.headers, body: seen.body });
    }
    if (this.limitReached) return this.problem(route, 409, 'limit_reached');
    const body = JSON.parse(raw);
    this.creates.push({ key, body });
    const id = `01934f6e-7a2b-7c3d-8e4f-9000000000${String(++this.copies).padStart(2, '0')}`;
    const stored: Stored = { id, version: 1, deletedAt: null, purgeAt: null, photo: null, document: body.document, lastWrite: null };
    this.resumes.set(id, stored);
    const answer = { hash, status: 201, body: JSON.stringify(this.view(stored)), headers: { ETag: '"1"', Location: `/api/v1/resumes/${id}`, 'Cache-Control': 'no-store' } };
    this.keys.set(key, answer);
    return route.fulfill({ status: 201, contentType: 'application/json', headers: answer.headers, body: answer.body });
  }

  private photo(route: Route, stored: Stored, method: string, tail: string, headers: Record<string, string>, key: string) {
    this.photoCalls.push(`${method} ${tail}`);
    if (!key) this.violations.push('key photo');
    if (headers['if-match'] !== `"${stored.version}"`) return this.problem(route, 412, 'version_mismatch');
    stored.version++;
    if (method === 'DELETE') { stored.photo = null; return this.json(route, 200, { id: stored.id, version: stored.version, updatedAt: '2026-11-02T10:00:00.000Z', deletedAt: null, purgeAt: null }); }
    const crop = tail === '/photo/crop' ? route.request().postDataJSON() : { x: 0, y: 0, width: 1, height: 1 };
    stored.photo = { id: sid(70), mime: 'image/png', width: 1, height: 1, bytes: PNG.length, crop, updatedAt: '2026-11-02T10:00:00.000Z' };
    return this.json(route, 200, { id: stored.id, version: stored.version, updatedAt: '2026-11-02T10:00:00.000Z', photo: stored.photo });
  }
}
