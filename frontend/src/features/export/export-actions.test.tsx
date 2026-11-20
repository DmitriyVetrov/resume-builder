import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { removeLocalData } from '../../entities/resume/local-data';
import { fixtureDocument, installApi, json, previewReady, RESUME_ID, USER_ID } from '../editor/test-fixture';

const saved: { name: string; blob: Blob }[] = [];
const bytesOf = (blob: Blob) => new Promise<Uint8Array>((done, fail) => {
  const reader = new FileReader();
  reader.onload = () => done(new Uint8Array(reader.result as ArrayBuffer));
  reader.onerror = () => fail(reader.error);
  reader.readAsArrayBuffer(blob);
});
const textOf = async (blob: Blob) => new TextDecoder().decode(await bytesOf(blob));
const open = async (api = installApi()) => {
  window.history.replaceState(null, '', `/resumes/${RESUME_ID}/edit`);
  render(<App />);
  await screen.findByRole('textbox', { name: 'Resume title' });
  await previewReady();
  return api;
};
const button = (name: string) => screen.getByRole('button', { name });
const unnamed = () => { const document = fixtureDocument(); return { ...document, header: { ...document.header, fullName: '' } }; };

beforeEach(async () => {
  saved.length = 0;
  document.cookie = 'XSRF-TOKEN=synthetic-csrf';
  await removeLocalData(USER_ID);
  localStorage.clear();
  sessionStorage.clear();
  const blobs = new Map<string, Blob>();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (blob: Blob) => { const href = `blob:test/${blobs.size}`; blobs.set(href, blob); return href; }, revokeObjectURL: () => {} }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) { saved.push({ name: this.download, blob: blobs.get(this.href)! }); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

describe('export actions in the top bar', () => {
  it('A01 one click on Export PDF downloads the sanitized name, with no dialog (FR-PDF-01, FR-PDF-06)', async () => {
    await open();
    fireEvent.click(button('Export PDF'));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.name).toBe('Synthetic-resume.pdf');
    expect(saved[0]!.blob.type).toBe('application/pdf');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(button('Export TXT'));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved[1]!.name).toBe('Synthetic-resume.txt');
    expect(await textOf(saved[1]!.blob)).toContain('Synthetic Person\nEngineer\n');
  });
  it('A02 with no full name the buttons stay reachable, explain, and "Edit header" leads to the fix (FR-TYP-03)', async () => {
    await open(installApi({ resume: { document: { ...fixtureDocument(), header: { ...fixtureDocument().header, fullName: '   ' } } } }));
    for (const name of ['Export PDF', 'Export TXT']) {
      expect(button(name)).toHaveAttribute('aria-disabled', 'true');
      expect(button(name)).not.toBeDisabled();
      expect(button(name)).toHaveAccessibleDescription(/add your full name/i);
    }
    expect(screen.getByText(/add your full name to export/i)).toBeVisible();
    fireEvent.click(button('Export PDF'));
    fireEvent.click(button('Export TXT'));
    await act(async () => { await new Promise(done => setTimeout(done, 50)); });
    expect(saved).toEqual([]);
    fireEvent.click(button('Edit header'));
    const field = screen.getByRole('textbox', { name: 'Full name' });
    await waitFor(() => expect(field).toHaveFocus());
    fireEvent.change(field, { target: { value: 'Ana' } });
    await waitFor(() => expect(button('Export PDF')).toHaveAttribute('aria-disabled', 'false'));
    expect(screen.queryByText(/add your full name/i)).toBeNull();
    fireEvent.click(button('Export PDF'));
    await waitFor(() => expect(saved).toHaveLength(1));
  });
  it('A03 an unverified address: the same, with a link to resend the verification (ADR-013)', async () => {
    await open(installApi({ emailVerified: false }));
    expect(button('Export PDF')).toHaveAttribute('aria-disabled', 'true');
    expect(button('Export PDF')).toHaveAccessibleDescription(/verify your e-mail address/i);
    expect(screen.getByRole('link', { name: 'Resend verification' })).toHaveAttribute('href', '/verify-email');
    fireEvent.click(button('Export PDF'));
    await act(async () => { await new Promise(done => setTimeout(done, 50)); });
    expect(saved).toEqual([]);
  });
  it('A04 both missing: both reasons', async () => {
    await open(installApi({ emailVerified: false, resume: { document: unnamed() } }));
    expect(button('Export TXT')).toHaveAccessibleDescription(/add your full name.*verify your e-mail address/i);
  });
  it('A05 a finished export is announced with its file name', async () => {
    await open();
    fireEvent.click(button('Export TXT'));
    await waitFor(() => expect(screen.getByTestId('announcer')).toHaveTextContent('Exported Synthetic-resume.txt.'));
    expect(screen.getByText('Exported Synthetic-resume.txt.', { selector: '.export-note' })).toBeVisible();
  });
  it('A06 characters outside the font are named after the export (DD-P12-07)', async () => {
    const document = fixtureDocument();
    await open(installApi({ resume: { document: { ...document, header: { ...document.header, headline: 'Hola 😀 漢' } } } }));
    fireEvent.click(button('Export PDF'));
    expect(await screen.findByText(/not in this template's font.*😀 漢/i, { selector: '.export-note' })).toBeVisible();
    expect(saved).toHaveLength(1);
  });
  it('A07 a second click while one runs starts nothing', async () => {
    const api = await open();
    fireEvent.click(button('Export PDF'));
    fireEvent.click(button('Export PDF'));
    fireEvent.click(button('Export TXT'));
    await waitFor(() => expect(saved.length).toBeGreaterThan(0));
    await act(async () => { await new Promise(done => setTimeout(done, 100)); });
    expect(saved).toHaveLength(1);
    expect(api.calls.filter(call => call.method === 'POST' && call.path.endsWith('/snapshots'))).toHaveLength(1);
  });
  it('A08 the line ending option persists per user and reaches Export TXT and Copy (FR-TXT-05, FR-TXT-06)', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { clipboard: { writeText } }));
    await open();
    const box = screen.getByRole('checkbox', { name: /windows line endings/i });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    fireEvent.click(button('Export TXT'));
    await waitFor(() => expect(saved).toHaveLength(1));
    const text = await textOf(saved[0]!.blob);
    expect(text).toContain('\r\n');
    expect(text).not.toMatch(/(^|[^\r])\n/);
    fireEvent.click(button('Copy as text'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]).toEqual([text]);
    expect(await screen.findByText('Copied as text.', { selector: '.export-note' })).toBeVisible();
    expect(localStorage.getItem(`resumiser:txt-line-ending:${USER_ID}`)).toBe('crlf');
    await removeLocalData(USER_ID);
    expect(localStorage.getItem(`resumiser:txt-line-ending:${USER_ID}`)).toBeNull();
  });
  it('A09 verifying in another tab: the next window focus re-reads the session and enables export', async () => {
    const api = await open(installApi({ emailVerified: false }));
    expect(button('Export PDF')).toHaveAttribute('aria-disabled', 'true');
    api.emailVerified = true;
    await act(async () => { window.dispatchEvent(new Event('focus')); await new Promise(done => setTimeout(done, 20)); });
    await waitFor(() => expect(button('Export PDF')).toHaveAttribute('aria-disabled', 'false'));
    expect(screen.queryByRole('link', { name: 'Resend verification' })).toBeNull();
  });
  it('A10 after an acknowledged write the PDF carries that write\'s date (ADR-010 §7, DD-P12-02)', async () => {
    const api = await open(installApi({ override: call => call.method === 'PUT' && call.path.endsWith('/document') ? json({ id: RESUME_ID, version: 8, updatedAt: '2026-11-03T04:05:06Z', warnings: [] }) : undefined }));
    fireEvent.click(button('Export PDF'));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(Buffer.from(await bytesOf(saved[0]!.blob)).toString('latin1')).toContain('D:20261101174210Z');
    fireEvent.change(screen.getByRole('textbox', { name: 'Resume title' }), { target: { value: 'New title' } });
    await waitFor(() => expect(api.calls.some(call => call.method === 'PUT' && call.path.endsWith('/document'))).toBe(true), { timeout: 5000 });
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent('Saved'));
    fireEvent.click(button('Export PDF'));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved[1]!.name).toBe('New-title.pdf');
    expect(Buffer.from(await bytesOf(saved[1]!.blob)).toString('latin1')).toContain('D:20261103040506Z');
  });
  it('a failed export is an alert, and the next click can succeed', async () => {
    let fail = true;
    const photo = { id: 'p', mime: 'image/jpeg' as const, width: 600, height: 600, bytes: 1, crop: { x: 0, y: 0, width: 600, height: 600 }, updatedAt: '2026-11-01T17:42:10Z' };
    await open(installApi({ resume: { photo }, override: call => call.path.includes('/photo/rendition') && fail ? new Response(null, { status: 500 }) : undefined }));
    fireEvent.click(button('Export PDF'));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/photo could not be loaded/i)).toBeVisible();
    expect(saved).toEqual([]);
    expect(button('Export PDF')).toHaveAttribute('aria-disabled', 'false');
    fail = false;
    fireEvent.click(button('Export TXT'));
    await waitFor(() => expect(saved).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
