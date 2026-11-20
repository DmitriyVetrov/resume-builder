import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDataSummary, pruneThumbnails, readThumbnail, removeLocalData, writeThumbnail } from '../../entities/resume/local-data';
import { ENGINE_VERSION } from '../../entities/layout/version';
import { fixtureDocument, type ResumeDocument } from '../editor/test-fixture';
import { LibraryThumbnail } from './LibraryThumbnail';

const USER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const id = (n: number) => `01934f6e-7a2b-7c3d-8e4f-${String(n).padStart(12, '0')}`;
const summary = (n: number, version = 3) => ({ id: id(n), version, title: 'T', templateId: 'T1' as const, createdAt: '2026-10-20T09:00:00Z', updatedAt: '2026-11-01T17:42:10Z', deletedAt: null, purgeAt: null });
const painted = (container: HTMLElement) => waitFor(() => { const found = container.querySelector('[data-page-sheet]'); expect(found).not.toBeNull(); return found as HTMLElement; }, { timeout: 20_000 });
const resume = (n: number, version: number, fullName: string) => { const document = fixtureDocument(); return { id: id(n), version, createdAt: '2026-10-20T09:00:00Z', updatedAt: '2026-11-01T17:42:10Z', deletedAt: null, purgeAt: null, photo: null, document: { ...document, header: { ...document.header, fullName } } as ResumeDocument }; };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status < 400 ? 'application/json' : 'application/problem+json' } });
function stub(answer: (n: number) => Response | Promise<Response>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    calls.push(path);
    return answer(Number(path.slice(-12)));
  }));
  return calls;
}
const cachedPage = (name: string) => ({ number: 1, width: 595, height: 842, lines: [{ x: 23, y: 23, width: 100, height: 30, baseline: 40, role: 'name', anchor: null, runs: [{ text: name, x: 0, width: 100, face: 'roboto/bold', size: 24, color: '#000000', underline: false, link: null, parts: [] }] }], shapes: [], images: [], icons: [], regions: [], links: [] });

beforeEach(async () => { await removeLocalData(USER); await removeLocalData(OTHER); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('library thumbnails (FR-LIB-01, ADR-010 §9)', () => {
  it('K01 a card paints page 1 of the fetched document, as decoration', async () => {
    stub(n => json(resume(n, 3, 'First Person')));
    const { container } = render(<LibraryThumbnail item={summary(1)} userId={USER} />);
    const sheet = await painted(container);
    expect(sheet).toHaveTextContent('FIRST PERSON');
    expect(sheet.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(sheet.querySelector('a,button,[tabindex]')).toBeNull();
    await waitFor(async () => expect((await readThumbnail(USER, id(1)))?.version).toBe(3));
  });
  it('K02 a cached row of the same version needs no fetch', async () => {
    await writeThumbnail({ userId: USER, resumeId: id(2), version: 3, engineVersion: ENGINE_VERSION, page: cachedPage('CACHED NAME'), photoUrl: null });
    const calls = stub(() => json({}, 500));
    const { container } = render(<LibraryThumbnail item={summary(2)} userId={USER} />);
    expect(await painted(container)).toHaveTextContent('CACHED NAME');
    expect(calls).toEqual([]);
  });
  it('K03 a new version, or a new engine, renders again and replaces the row', async () => {
    await writeThumbnail({ userId: USER, resumeId: id(3), version: 2, engineVersion: ENGINE_VERSION, page: cachedPage('OLD VERSION'), photoUrl: null });
    await writeThumbnail({ userId: USER, resumeId: id(4), version: 3, engineVersion: 'older', page: cachedPage('OLD ENGINE'), photoUrl: null });
    stub(n => json(resume(n, 3, 'Fresh Person')));
    for (const n of [3, 4]) {
      const { container, unmount } = render(<LibraryThumbnail item={summary(n)} userId={USER} />);
      expect(await painted(container)).toHaveTextContent('FRESH PERSON');
      await waitFor(async () => expect(await readThumbnail(USER, id(n))).toMatchObject({ version: 3, engineVersion: ENGINE_VERSION }));
      unmount();
    }
  });
  it('K04 another user\'s row is not used', async () => {
    await writeThumbnail({ userId: OTHER, resumeId: id(5), version: 3, engineVersion: ENGINE_VERSION, page: cachedPage('SOMEONE ELSE'), photoUrl: null });
    stub(n => json(resume(n, 3, 'My Own')));
    const { container } = render(<LibraryThumbnail item={summary(5)} userId={USER} />);
    const sheet = await painted(container);
    expect(sheet).toHaveTextContent('MY OWN');
    expect(sheet).not.toHaveTextContent('SOMEONE ELSE');
  });
  it('K05 a failed fetch keeps the placeholder', async () => {
    const calls = stub(() => json({ title: 'x', status: 500, code: 'internal', traceId: 't' }, 500));
    const { container } = render(<LibraryThumbnail item={summary(6)} userId={USER} />);
    await waitFor(() => expect(calls.length).toBe(1));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(container.querySelector('[data-page-sheet]')).toBeNull();
    expect(container.querySelector('.page-thumb')).not.toBeNull();
    expect(screen.getByText('T1')).toBeInTheDocument();
  });
  it('K06 removing local data clears the rows, and the summary counts them (T-ID-06)', async () => {
    expect((await localDataSummary(USER)).hasData).toBe(false);
    await writeThumbnail({ userId: USER, resumeId: id(7), version: 1, engineVersion: ENGINE_VERSION, page: cachedPage('X'), photoUrl: null });
    await writeThumbnail({ userId: OTHER, resumeId: id(7), version: 1, engineVersion: ENGINE_VERSION, page: cachedPage('Y'), photoUrl: null });
    expect(await localDataSummary(USER)).toEqual({ hasData: true, unsynced: false });
    await removeLocalData(USER);
    expect(await readThumbnail(USER, id(7))).toBeNull();
    expect((await localDataSummary(USER)).hasData).toBe(false);
    expect(await readThumbnail(OTHER, id(7))).not.toBeNull();
  });
  it('K07 pruning keeps only the listed resumes of that user', async () => {
    for (const n of [8, 9]) await writeThumbnail({ userId: USER, resumeId: id(n), version: 1, engineVersion: ENGINE_VERSION, page: cachedPage('X'), photoUrl: null });
    await writeThumbnail({ userId: OTHER, resumeId: id(8), version: 1, engineVersion: ENGINE_VERSION, page: cachedPage('Y'), photoUrl: null });
    await pruneThumbnails(USER, new Set([id(8)]));
    expect(await readThumbnail(USER, id(8))).not.toBeNull();
    expect(await readThumbnail(USER, id(9))).toBeNull();
    expect(await readThumbnail(OTHER, id(8))).not.toBeNull();
  });
  it('K08 a 404 removes that row', async () => {
    await writeThumbnail({ userId: USER, resumeId: id(10), version: 1, engineVersion: ENGINE_VERSION, page: cachedPage('GONE'), photoUrl: null });
    const calls = stub(() => json({ title: 'x', status: 404, code: 'not_found', traceId: 't' }, 404));
    render(<LibraryThumbnail item={summary(10)} userId={USER} />);
    await waitFor(() => expect(calls.length).toBe(1));
    await waitFor(async () => expect(await readThumbnail(USER, id(10))).toBeNull());
  });
  it('K09 at most three fetches run at once', async () => {
    let active = 0;
    let peak = 0;
    const release: (() => void)[] = [];
    stub(n => { active++; peak = Math.max(peak, active); return new Promise<Response>(done => release.push(() => { active--; done(json(resume(n, 3, 'Queued'))); })); });
    for (let n = 20; n < 28; n++) render(<LibraryThumbnail item={summary(n)} userId={USER} />);
    await waitFor(() => expect(release.length).toBe(3));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(peak).toBe(3);
    for (let released = 0; released < 8; released++) {
      await waitFor(() => expect(release.length).toBeGreaterThan(0), { timeout: 20_000 });
      release.shift()!();
    }
    expect(peak).toBe(3);
  });
});
