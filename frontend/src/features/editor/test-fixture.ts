import { waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';
import type { components } from '../../shared/api/generated/schema';

type Schemas = components['schemas'];
export type Resume = Schemas['Resume'];
export type ResumeDocument = Schemas['ResumeDocument'];
export const RESUME_ID = '01934f6e-7a2b-7c3d-8e4f-000000000001';
export const USER_ID = '00000000-0000-4000-8000-000000000001';
const sid = (n: number) => `01934f6e-7a2b-7c3d-8e4f-1000000000${String(n).padStart(2, '0')}`;
const run = (value: string) => ({ kind: 'text' as const, value, bold: false, italic: false, underline: false });
const shell = { hidden: false, listColumns: null, placement: null };

export const fixtureEntry = (id: number, title: string): Schemas['Entry'] => ({ id: sid(50 + id), title, organization: 'Org', location: '', start: { kind: 'date', year: 2020, month: 1 }, end: { kind: 'present' }, dateText: '', description: [], pageBreakBefore: false });
export function fixtureDocument(): ResumeDocument {
  return {
    title: 'Synthetic resume', templateId: 'T1', accentPreset: 0, language: 'en', dateFormat: 'MonthYearLong',
    layout: { fontPreset: 'M', sectionSpacing: 10, entrySpacing: 10, lineSpacing: 1, pageSize: 'A4', margins: { top: 23, right: 23, bottom: 23, left: 23 }, bodyFont: null },
    header: { fullName: 'Synthetic Person', headline: 'Engineer', showPhoto: true, contacts: [{ id: sid(40), text: 'person@example.invalid', url: null, kind: 'email' }] },
    sections: [
      { ...shell, id: sid(1), type: 'text', title: 'Summary', content: { body: [{ kind: 'paragraph', inlines: [run('Summary text')] }] } },
      { ...shell, id: sid(2), type: 'entries', title: 'Experience', content: { labels: { title: 'Role', organization: null, location: null }, entries: [fixtureEntry(1, 'First job'), fixtureEntry(2, 'Second job')] } },
      { ...shell, id: sid(3), type: 'list', title: 'Skills', listColumns: 2, content: { items: [{ id: sid(60), text: [run('Go')] }, { id: sid(61), text: [run('SQL')] }] } },
      { ...shell, id: sid(4), type: 'inline', title: 'Languages', content: { body: [{ kind: 'paragraph', inlines: [] }] } },
      { ...shell, id: sid(5), type: 'text', title: 'Secret hobby', hidden: true, content: { body: [{ kind: 'paragraph', inlines: [run('Hidden text')] }] } },
    ],
  };
}
export const fixturePhoto: Schemas['PhotoInfo'] = { id: sid(70), mime: 'image/jpeg', width: 1000, height: 600, bytes: 1234, crop: { x: 200, y: 0, width: 600, height: 600 }, updatedAt: '2026-11-01T17:42:10Z' };

export function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
export function problem(status: number, code: string) {
  return new Response(JSON.stringify({ type: 'about:blank', title: 'Error', status, code, traceId: 'synthetic-trace' }), { status, headers: { 'Content-Type': 'application/problem+json' } });
}
export type Call = { method: string; path: string; init: RequestInit; body: unknown };

/** A stateful stand-in for the API. `override` answers first, so a test can inject any failure. */
/** The preview has painted at least one page: the engine and fonts load once per test file. */
export const previewReady = () => waitFor(() => expect(document.querySelector('[data-page-sheet]')).not.toBeNull(), { timeout: 20_000 });
const previewRegion = () => document.querySelector('[aria-label="Preview"]') as HTMLElement;
export const paintedRuns = (role: string, root: ParentNode = previewRegion()) => Array.from(root.querySelectorAll<HTMLElement>(`[data-role="${role}"]`));
export const pt = (value: string) => parseFloat(value);

export function installApi(options: { resume?: Partial<Resume>; override?: (call: Call) => Response | undefined; emailVerified?: boolean } = {}) {
  const state = {
    resume: { id: RESUME_ID, version: 7, createdAt: '2026-10-20T09:00:00Z', updatedAt: '2026-11-01T17:42:10Z', deletedAt: null, purgeAt: null, photo: null, document: fixtureDocument(), ...options.resume } as Resume,
    calls: [] as Call[],
    override: options.override,
    emailVerified: options.emailVerified ?? true,
  };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace('/api/v1', '') + url.search;
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    const call = { method, path, init, body };
    state.calls.push(call);
    if (path === '/session') return json({ authenticated: true, user: { id: USER_ID, email: 'person-a@example.invalid', emailVerified: state.emailVerified, createdAt: '2026-10-01T08:00:00Z' } });
    const injected = state.override?.(call);
    if (injected) return injected;
    const base = `/resumes/${RESUME_ID}`;
    if (path === base && method === 'GET') return json(state.resume);
    if (path === `${base}/document` && method === 'PUT') {
      state.resume = { ...state.resume, version: state.resume.version + 1, document: body as ResumeDocument };
      return json({ id: RESUME_ID, version: state.resume.version, updatedAt: state.resume.updatedAt, warnings: [] });
    }
    if (path.startsWith(`${base}/snapshots?`) || path === `${base}/snapshots`) return json({ items: [{ id: sid(80), resumeId: RESUME_ID, resumeVersion: 3, reason: 'auto', createdAt: '2026-10-30T10:00:00Z', expiresAt: '2026-11-29T10:00:00Z' }], nextCursor: null });
    if (path === `${base}/snapshots/${sid(80)}`) return json({ id: sid(80), resumeId: RESUME_ID, resumeVersion: 3, reason: 'auto', createdAt: '2026-10-30T10:00:00Z', expiresAt: '2026-11-29T10:00:00Z', document: { ...fixtureDocument(), title: 'Old title' } });
    if (path === `${base}/photo` && method === 'POST') {
      state.resume = { ...state.resume, version: state.resume.version + 1, photo: fixturePhoto };
      return json({ id: RESUME_ID, version: state.resume.version, updatedAt: state.resume.updatedAt, photo: fixturePhoto });
    }
    if (path === `${base}/photo/crop` && method === 'PUT') {
      const photo = { ...fixturePhoto, crop: body as Schemas['PhotoCrop'] };
      state.resume = { ...state.resume, version: state.resume.version + 1, photo };
      return json({ id: RESUME_ID, version: state.resume.version, updatedAt: state.resume.updatedAt, photo });
    }
    if (path === `${base}/photo` && method === 'DELETE') {
      state.resume = { ...state.resume, version: state.resume.version + 1, photo: null };
      return json({ id: RESUME_ID, version: state.resume.version, updatedAt: state.resume.updatedAt, deletedAt: null, purgeAt: null });
    }
    if (path === '/resumes' && method === 'POST') return json({ ...state.resume, id: sid(90), version: 1, document: (body as { document: ResumeDocument }).document }, 201);
    return problem(404, 'not_found');
  }));
  return state;
}
