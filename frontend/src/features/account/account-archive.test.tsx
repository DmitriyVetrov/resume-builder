import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import type { ArchiveManifest, ArchiveOptions, ArchiveResult } from './archive';

const signedIn = { authenticated: true, user: { id: '00000000-0000-4000-8000-000000000001', email: 'person-a@example.invalid', emailVerified: true, createdAt: '2026-11-03T12:00:00Z' } };
const unverified = { ...signedIn, user: { ...signedIn.user, emailVerified: false } };
const manifest = (failed = 0): ArchiveManifest => ({
  exportedAt: '2026-11-12T10:00:00.000Z', engineVersion: '1.1.0',
  resumes: [
    { id: 'r1', title: 'One', state: 'active', files: ['One.pdf', 'One.txt'], missing: failed ? [{ file: 'One.pdf', reason: 'pdf_write' }] : [] },
    { id: 'r2', title: 'Two', state: 'trashed', files: ['Two.pdf', 'Two.txt'], missing: [] },
  ],
});

let behaviour: (options: ArchiveOptions) => Promise<ArchiveResult>;
vi.mock('./archive', async original => ({
  ...await original<typeof import('./archive')>(),
  buildArchive: (options: ArchiveOptions) => behaviour(options),
}));

const saved: { name: string; type: string }[] = [];
beforeEach(() => {
  saved.length = 0;
  window.history.replaceState({}, '', '/account');
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test/1'), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) { saved.push({ name: this.download, type: '' }); });
  document.cookie = 'XSRF-TOKEN=synthetic-csrf';
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function api(session = signedIn) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    if (path === '/api/v1/auth/reauthenticate') return new Response(null, { status: 204 });
    return new Response(JSON.stringify(session), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
}

async function start() {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /download your data/i }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(dialog.querySelector('input[type="password"]')!, { target: { value: 'synthetic-password-123' } });
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
}

describe('Download your data (AC-P13-14, AC-P13-18)', () => {
  it('UI01 re-authenticates, shows progress in a status region and downloads one ZIP', async () => {
    api();
    let release!: () => void;
    behaviour = async ({ onProgress }) => {
      onProgress?.({ done: 0, total: 2 });
      onProgress?.({ done: 1, total: 2 });
      await new Promise<void>(done => { release = done; });
      onProgress?.({ done: 2, total: 2 });
      return { blob: new Blob(['zip'], { type: 'application/zip' }), fileName: 'resumiser-data-2026-11-12.zip', manifest: manifest() };
    };
    await start();
    const status = await screen.findByText(/preparing your archive: 1 of 2 resumes/i);
    expect(status.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('progressbar')).toBeVisible();
    release();
    expect(await screen.findByText(/downloaded resumiser-data-2026-11-12\.zip/i)).toBeVisible();
    expect(saved.map(file => file.name)).toEqual(['resumiser-data-2026-11-12.zip']);
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
  });

  it('UI02 Cancel takes focus while preparing, stops the build and downloads nothing', async () => {
    api();
    behaviour = ({ signal, onProgress }) => new Promise((_, fail) => {
      onProgress?.({ done: 0, total: 2 });
      signal?.addEventListener('abort', () => fail(new DOMException('Aborted', 'AbortError')));
    });
    await start();
    // The re-authentication dialog has a Cancel of its own; the archive's appears once preparing starts.
    await screen.findByText(/preparing your archive/i);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const cancel = screen.getByRole('button', { name: /cancel/i });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.click(cancel);
    expect(await screen.findByText(/archive cancelled\. nothing was downloaded\./i)).toBeVisible();
    expect(saved).toEqual([]);
  });

  it('UI03 a partial archive says which part is missing; an unverified address cannot start one', async () => {
    api();
    behaviour = async () => ({ blob: new Blob(['zip']), fileName: 'resumiser-data-2026-11-12.zip', manifest: manifest(1) });
    await start();
    expect(await screen.findByText(/1 pdf could not be created and is listed in manifest\.json\./i)).toBeVisible();
  });

  it('UI03b an unverified address cannot start one and is told why', async () => {
    api(unverified);
    render(<App />);
    const action = await screen.findByRole('button', { name: /download your data/i });
    expect(action).toBeDisabled();
    expect(screen.getByText(/verify your email before downloading your data/i)).toBeVisible();
  });
});
