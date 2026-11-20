import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { choose, optionsOf } from '../../test/select';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { removeLocalData } from '../../entities/resume/local-data';
import { fixturePhoto, installApi, paintedRuns, previewReady, problem, RESUME_ID, USER_ID } from './test-fixture';

const EDIT = `/resumes/${RESUME_ID}/edit`;
/**
 * `findBy` can resolve after a commit whose passive effects have not run, and `useSyncExternalStore` subscribes in
 * those effects. An event fired in that gap updates the store while the DOM catches up a moment later, so sync
 * assertions would flake under load. The workspace registers its window listeners in the same flush: wait for them.
 */
const workspaceReady = async (title: () => Promise<unknown>) => {
  const listening = vi.spyOn(window, 'addEventListener');
  await title();
  await waitFor(() => expect(listening.mock.calls.some(([type]) => type === 'beforeinput')).toBe(true));
  listening.mockRestore();
};
const open = async (api = installApi()) => {
  window.history.replaceState(null, '', EDIT);
  await workspaceReady(async () => {
    render(<App />);
    await screen.findByRole('textbox', { name: 'Resume title' });
  });
  await previewReady();
  return api;
};
const region = (name: string) => within(screen.getByRole('region', { name }));
const rows = () => within(screen.getByRole('list', { name: 'Resume sections' })).getAllByRole('button', { name: /^(Header|Summary|Experience|Skills|Languages|Secret hobby|Interests)/ });
const rowNames = () => rows().filter(row => row.hasAttribute('data-section-row')).map(row => row.getAttribute('data-section-row'));
const select = (name: string) => fireEvent.click(within(screen.getByRole('list', { name: 'Resume sections' })).getByRole('button', { name: new RegExp(`^${name}`) }));
const status = () => screen.getByTestId('save-status');
const puts = (api: ReturnType<typeof installApi>) => api.calls.filter(call => call.method === 'PUT' && call.path.endsWith('/document'));

beforeEach(async () => { document.cookie = 'XSRF-TOKEN=synthetic-csrf'; await removeLocalData(USER_ID); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); window.history.replaceState(null, '', '/'); });

describe('workspace frame', () => {
  it('W01 shows the panels, top bar, status and the export actions', async () => {
    await open();
    expect(screen.getByRole('heading', { level: 1, name: /editor/i })).toBeInTheDocument();
    for (const name of ['Sections', 'Edit', 'Preview']) expect(screen.getByRole('region', { name })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Resume title' })).toHaveValue('Synthetic resume');
    expect(status()).toHaveTextContent('Saved');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    for (const name of ['Export PDF', 'Export TXT']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute('aria-disabled', 'false');
      expect(button).not.toHaveAccessibleDescription();
    }
    expect(region('Preview').queryByText(/draft view/i)).toBeNull();
    expect(region('Preview').getByText('1 / 1')).toBeInTheDocument();
  });

  it('W02 lists Header and all sections in order with type, hidden and empty markers', async () => {
    await open();
    const list = within(screen.getByRole('list', { name: 'Resume sections' }));
    expect(rowNames()).toEqual(['Summary', 'Experience', 'Skills', 'Languages', 'Secret hobby']);
    expect(list.getByRole('button', { name: /^Header/ })).toBeInTheDocument();
    expect(list.getByRole('button', { name: /^Skills.*List section/ })).toBeInTheDocument();
    expect(list.getByRole('button', { name: /^Languages.*Inline section.*Empty/ })).toBeInTheDocument();
    expect(list.getByRole('button', { name: /^Secret hobby.*Text section.*Hidden/ })).toBeInTheDocument();
    const preview = region('Preview');
    expect(preview.getByText('Summary text')).toBeInTheDocument();
    expect(preview.queryByText('Hidden text')).not.toBeInTheDocument();
    expect(preview.queryByText('LANGUAGES')).not.toBeInTheDocument();
    // Even a blank resume has a keyboard way to scroll the preview (axe scrollable-region-focusable).
    expect(preview.getByRole('group', { name: 'Preview scroll area' })).toHaveAttribute('tabindex', '0');
  });

  it('W03 selecting a row opens its form; activating a preview section selects it', async () => {
    await open();
    expect(region('Edit').getByRole('heading', { level: 2, name: 'Header' })).toBeInTheDocument();
    select('Skills');
    expect(region('Edit').getByRole('heading', { level: 2, name: 'Skills' })).toBeInTheDocument();
    expect(region('Edit').getByRole('button', { name: 'Add item' })).toBeInTheDocument();
    fireEvent.click(region('Preview').getByRole('button', { name: 'Edit Summary' }));
    expect(region('Edit').getByRole('heading', { level: 2, name: 'Summary' })).toBeInTheDocument();
    fireEvent.keyDown(region('Preview').getByRole('button', { name: 'Edit Skills' }), { key: 'Enter' });
    expect(region('Edit').getByRole('heading', { level: 2, name: 'Skills' })).toBeInTheDocument();
  });

  it('W04 opens at the last selected section, and a section that is gone falls back to Header', async () => {
    const api = installApi();
    const skills = api.resume.document.sections[2]!.id;
    localStorage.setItem(`resumiser:last-section:${USER_ID}:${RESUME_ID}`, skills);
    window.history.replaceState(null, '', EDIT);
    let first: ReturnType<typeof render> | undefined;
    await workspaceReady(async () => {
      first = render(<App />);
      expect(await screen.findByRole('heading', { level: 2, name: 'Skills' })).toBeInTheDocument();
    });
    select('Summary');
    expect(localStorage.getItem(`resumiser:last-section:${USER_ID}:${RESUME_ID}`)).toBe(api.resume.document.sections[0]!.id);
    first?.unmount();
    localStorage.setItem(`resumiser:last-section:${USER_ID}:${RESUME_ID}`, 'gone');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Header' })).toBeInTheDocument();
  });

  it('W05 switches four narrow tabs with one selected, and selecting a section moves to Edit', async () => {
    await open();
    const tabs = screen.getByRole('tablist', { name: /editor panels/i });
    for (const name of ['Sections', 'Edit', 'Preview', 'Design']) {
      const tab = within(tabs).getByRole('tab', { name });
      fireEvent.click(tab);
      expect(tab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { name })).toBeInTheDocument();
    }
    expect(within(tabs).getAllByRole('tab', { selected: true })).toHaveLength(1);
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Sections' }));
    select('Skills');
    expect(within(tabs).getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true');
  });

  it('W06 warns before leaving only while edits are unacknowledged', async () => {
    let release: (value: Response) => void = () => {};
    const api = installApi({ override: call => { if (call.method === 'PUT') return undefined; return undefined; } });
    await open(api);
    const leave = () => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };
    expect(leave()).toBe(false);
    const held = new Promise<Response>(resolve => { release = resolve; });
    const fetchStub = vi.mocked(fetch);
    const real = fetchStub.getMockImplementation()!;
    fetchStub.mockImplementation(async (input, init) => init?.method === 'PUT' ? held : real(input, init));
    fireEvent.change(screen.getByRole('textbox', { name: 'Resume title' }), { target: { value: 'Changed' } });
    expect(leave()).toBe(true);
    expect(status()).toHaveTextContent('Saving');
    release(new Response(JSON.stringify({ id: RESUME_ID, version: 8, updatedAt: '2026-11-01T17:42:10Z', warnings: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await waitFor(() => expect(status()).toHaveTextContent('Saved'), { timeout: 2000 });
    expect(leave()).toBe(false);
  });
});

describe('load states', () => {
  it('W07 a missing resume says so, a trashed one is read-only with a Trash link, a 401 goes to login', async () => {
    installApi({ override: call => call.method === 'GET' && call.path.startsWith('/resumes/') ? problem(404, 'not_found') : undefined });
    window.history.replaceState(null, '', EDIT);
    const gone = render(<App />);
    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: /your resumes/i })).toHaveAttribute('href', '/resumes');
    gone.unmount();
    vi.unstubAllGlobals();
    installApi({ resume: { deletedAt: '2026-11-01T00:00:00Z', purgeAt: '2026-12-01T00:00:00Z' } });
    window.history.replaceState(null, '', EDIT);
    const trashed = render(<App />);
    expect(await screen.findByRole('link', { name: /trash/i })).toHaveAttribute('href', '/resumes/trash');
    expect(screen.queryByRole('textbox', { name: 'Resume title' })).not.toBeInTheDocument();
    trashed.unmount();
    vi.unstubAllGlobals();
    installApi({ override: call => call.path.startsWith('/resumes/') ? problem(401, 'unauthenticated') : undefined });
    window.history.replaceState(null, '', EDIT);
    render(<App />);
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(window.location.search).toContain(encodeURIComponent(EDIT));
  });
});

describe('section panel', () => {
  it('W08 the section bar has no rename, duplicate or drag controls; titles are edited in the card', async () => {
    await open();
    select('Skills');
    expect(screen.queryByRole('button', { name: 'Rename Skills' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicate Skills' })).not.toBeInTheDocument();
    expect(document.querySelector('.section-panel .drag-handle')).toBeNull();
    expect(screen.getByRole('button', { name: 'Move up Skills' })).not.toHaveTextContent('Move up');
  });

  it('W09 adds a section of a chosen type with any title and moves focus to its title', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add section' }));
    for (const type of ['Text', 'List', 'Entries', 'Inline']) expect(dialog.getByRole('radio', { name: new RegExp(`^${type}`) })).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('radio', { name: /^List/ }));
    fireEvent.change(dialog.getByRole('textbox', { name: 'Section title' }), { target: { value: 'Interests' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Add' }));
    expect(rowNames().at(-1)).toBe('Interests');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(region('Edit').getByRole('textbox', { name: 'Section title' })).toHaveFocus();
    expect(region('Edit').getByRole('button', { name: 'Add item' })).toBeInTheDocument();
  });

  it('W10 moves with buttons, announces, and keeps focus on a usable control at the boundary', async () => {
    await open();
    select('Experience');
    const up = screen.getByRole('button', { name: 'Move up Experience' });
    up.focus();
    fireEvent.click(up);
    expect(rowNames()).toEqual(['Experience', 'Summary', 'Skills', 'Languages', 'Secret hobby']);
    expect(screen.getByRole('button', { name: 'Move up Experience' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move down Experience' })).toHaveFocus();
    expect(screen.getByTestId('announcer')).toHaveTextContent('Moved Experience to position 1 of 5');
    const previewOrder = Array.from(document.querySelectorAll('[data-section-id]')).map(node => node.getAttribute('aria-label'));
    expect(previewOrder).toEqual(['Edit Experience', 'Edit Summary', 'Edit Skills']);
  });

  it('W11 hide removes from the preview and greys the row; show returns it', async () => {
    await open();
    select('Skills');
    fireEvent.click(screen.getByRole('button', { name: 'Hide Skills' }));
    expect(region('Preview').queryByText('Go')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Skills.*Hidden/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show Skills' }));
    expect(region('Preview').getByText('Go')).toBeInTheDocument();
  });

  it('W12 delete confirms, and Undo restores content and position', async () => {
    await open();
    select('Experience');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Experience' }));
    const dialog = within(screen.getByRole('dialog', { name: /delete/i }));
    expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    expect(rowNames()).toEqual(['Summary', 'Skills', 'Languages', 'Secret hobby']);
    const undo = screen.getByRole('button', { name: 'Undo delete' });
    expect(screen.getByText(/deleted experience/i)).toBeInTheDocument();
    fireEvent.click(undo);
    expect(rowNames()).toEqual(['Summary', 'Experience', 'Skills', 'Languages', 'Secret hobby']);
    expect(region('Preview').getByText('FIRST JOB')).toBeInTheDocument();
  });

  it('W14 undoes and redoes by shortcut and by button, across content and structure', async () => {
    await open();
    const title = screen.getByRole('textbox', { name: 'Resume title' });
    fireEvent.change(title, { target: { value: 'One' } });
    select('Skills');
    fireEvent.click(screen.getByRole('button', { name: 'Hide Skills' }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'z', ctrlKey: true });
    expect(screen.getByRole('button', { name: 'Hide Skills' })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'z', metaKey: true, shiftKey: true });
    expect(screen.getByRole('button', { name: 'Show Skills' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(title).toHaveValue('Synthetic resume');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(title).toHaveValue('One');
    expect(screen.getByTestId('announcer')).toHaveTextContent(/redid/i);
  });
});

describe('forms', () => {
  it('W15 edits the header and clamps by code points with a message', async () => {
    await open();
    const edit = region('Edit');
    fireEvent.change(edit.getByRole('textbox', { name: 'Full name' }), { target: { value: 'Олександр Núñez | Ľubomír' } });
    expect(paintedRuns('name')[0]).toHaveTextContent('ОЛЕКСАНДР NÚÑEZ | ĽUBOMÍR');
    fireEvent.change(edit.getByRole('textbox', { name: 'Full name' }), { target: { value: '😀'.repeat(125) } });
    expect(Array.from((edit.getByRole('textbox', { name: 'Full name' }) as HTMLInputElement).value)).toHaveLength(120);
    expect(edit.getByText(/limited to 120/i)).toBeInTheDocument();
  });

  it('W16 contact rows: add, derived link, @handle gets none, override, reorder, delete', async () => {
    await open();
    const edit = region('Edit');
    expect(edit.getByText(/links to mailto:person@example\.invalid/i)).toBeInTheDocument();
    fireEvent.click(edit.getByRole('button', { name: 'Add contact' }));
    const text = edit.getByRole('textbox', { name: 'Contact 2 text' });
    expect(text).toHaveFocus();
    fireEvent.change(text, { target: { value: '@handle' } });
    expect(edit.queryByText(/links to https/i)).not.toBeInTheDocument();
    fireEvent.change(edit.getByRole('textbox', { name: 'Contact 2 link' }), { target: { value: 'example.invalid/me' } });
    fireEvent.blur(edit.getByRole('textbox', { name: 'Contact 2 link' }));
    expect(edit.getByRole('textbox', { name: 'Contact 2 link' })).toHaveValue('https://example.invalid/me');
    choose(edit.getByRole('combobox', { name: 'Contact 2 kind' }), 'link');
    fireEvent.click(edit.getByRole('button', { name: 'Move up contact 2' }));
    expect(edit.getByRole('textbox', { name: 'Contact 1 text' })).toHaveValue('@handle');
    fireEvent.click(edit.getByRole('button', { name: 'Delete contact 1' }));
    expect(edit.getByRole('textbox', { name: 'Contact 1 text' })).toHaveValue('person@example.invalid');
  });

  it('W17 an entry edits all fields, warns on inverted dates and still saves', async () => {
    const api = await open();
    select('Experience');
    const edit = region('Edit');
    expect(edit.getByRole('textbox', { name: 'Role' })).toHaveValue('First job');
    for (const [name, value] of [['Organization', 'Acme'], ['Location', 'Valencia'], ['Date text', '']]) fireEvent.change(edit.getByRole('textbox', { name: name! }), { target: { value } });
    choose(edit.getByRole('combobox', { name: 'Start month' }), '6');
    fireEvent.change(edit.getByRole('spinbutton', { name: 'Start year' }), { target: { value: '2024' } });
    fireEvent.click(edit.getByRole('checkbox', { name: 'Present' }));
    choose(edit.getByRole('combobox', { name: 'End month' }), '1');
    fireEvent.change(edit.getByRole('spinbutton', { name: 'End year' }), { target: { value: '2020' } });
    expect(edit.getByText(/start date is after the end date/i)).toBeInTheDocument();
    fireEvent.click(edit.getByRole('checkbox', { name: 'Page break before' }));
    await waitFor(() => expect(puts(api).length).toBeGreaterThan(0), { timeout: 2000 });
    const stored = (puts(api).at(-1)!.body as { sections: { content: { entries: unknown[] } }[] }).sections[1]!.content.entries[0];
    expect(stored).toMatchObject({ organization: 'Acme', location: 'Valencia', start: { kind: 'date', year: 2024, month: 6 }, end: { kind: 'date', year: 2020, month: 1 }, pageBreakBefore: true });
  });

  it('W18 entries add, open one at a time, reorder and delete; labels change the form only', async () => {
    await open();
    select('Experience');
    const edit = region('Edit');
    fireEvent.click(edit.getByRole('button', { name: 'Move down entry 1' }));
    expect(edit.getByRole('button', { name: /^Edit entry 1: Second job/ })).toBeInTheDocument();
    expect(edit.queryByRole('button', { name: 'Duplicate entry 1' })).not.toBeInTheDocument();
    expect(document.querySelector('.drag-handle')).toBeNull();
    fireEvent.click(edit.getByRole('button', { name: 'Delete entry 2' }));
    expect(edit.queryByRole('button', { name: /^Edit entry 2:/ })).not.toBeInTheDocument();
    fireEvent.click(edit.getByRole('button', { name: 'Add entry' }));
    expect(edit.getByRole('textbox', { name: 'Role' })).toHaveFocus();
    const names = edit.getByText('Customize field names').closest('details')!;
    expect(names).not.toHaveAttribute('open');
    expect(edit.getByRole('button', { name: 'Add entry' }).compareDocumentPosition(names) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(edit.getByText('Customize field names'));
    expect(edit.getByRole('textbox', { name: 'Field name for Organization' })).toHaveValue('Organization');
    fireEvent.change(edit.getByRole('textbox', { name: 'Field name for Organization' }), { target: { value: 'Institution' } });
    expect(edit.getByRole('textbox', { name: 'Institution' })).toBeInTheDocument();
    expect(region('Preview').queryByText(/institution/i)).not.toBeInTheDocument();
  });

  it('W19 list items add, move and delete; columns and a lossless type change are offered', async () => {
    const api = await open();
    select('Skills');
    const edit = region('Edit');
    fireEvent.click(edit.getByRole('button', { name: 'Move down item 1' }));
    fireEvent.click(edit.getByRole('button', { name: 'Delete item 2' }));
    fireEvent.click(edit.getByRole('button', { name: 'Add item' }));
    choose(edit.getByRole('combobox', { name: 'List columns' }), '1');
    await waitFor(() => expect(puts(api).length).toBeGreaterThan(0), { timeout: 2000 });
    const type = edit.getByRole('combobox', { name: 'Section type' });
    const typeOptions = optionsOf(type);
    expect(typeOptions.find(option => /Entries/.test(option.textContent ?? ''))).toHaveAttribute('aria-disabled', 'true');
    expect(typeOptions.find(option => /^Text/.test(option.textContent ?? ''))).not.toHaveAttribute('aria-disabled');
    choose(type, 'text');
    expect(edit.queryByRole('button', { name: 'Add item' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Skills.*Text section/ })).toBeInTheDocument();
  });
});

describe('photo', () => {
  const photoFile = (bytes: number) => new File([new Uint8Array(bytes)], 'me.jpg', { type: 'image/jpeg' });

  it('W20 refuses a file over 5 MB with no request, and accepts exactly 5 MB and opens the crop', async () => {
    const api = await open();
    const input = screen.getByLabelText('Upload photo');
    fireEvent.change(input, { target: { files: [photoFile(5 * 1_048_576 + 1)] } });
    expect(await screen.findByText(/larger than 5 MB/i)).toBeInTheDocument();
    expect(api.calls.filter(call => call.path.includes('/photo'))).toEqual([]);
    fireEvent.change(input, { target: { files: [photoFile(5 * 1_048_576)] } });
    const dialog = within(await screen.findByRole('dialog', { name: /crop/i }));
    const call = api.calls.find(item => item.path.endsWith('/photo') && item.method === 'POST')!;
    expect(new Headers(call.init.headers).get('If-Match')).toBe('"7"');
    expect(new Headers(call.init.headers).get('Idempotency-Key')).toBeTruthy();
    expect(new Headers(call.init.headers).get('Content-Type')).toBeNull();
    expect(call.init.body).toBeInstanceOf(FormData);
    expect(dialog.getByRole('slider', { name: 'Zoom' })).toBeInTheDocument();
  });

  it('W21 crops by sliders, removes after confirmation, toggles show, and maps a server refusal', async () => {
    const api = installApi({ resume: { photo: fixturePhoto } });
    await open(api);
    const edit = region('Edit');
    expect(edit.getByRole('img', { name: /your photo/i })).toHaveAttribute('src', expect.stringContaining(`/resumes/${RESUME_ID}/photo/rendition`));
    fireEvent.click(edit.getByRole('checkbox', { name: 'Show photo' }));
    fireEvent.click(edit.getByRole('button', { name: 'Adjust crop' }));
    const dialog = within(await screen.findByRole('dialog', { name: /crop/i }));
    fireEvent.change(dialog.getByRole('slider', { name: 'Zoom' }), { target: { value: '2' } });
    fireEvent.change(dialog.getByRole('slider', { name: 'Horizontal position' }), { target: { value: '0' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save crop' }));
    await waitFor(() => expect(api.calls.some(call => call.path.endsWith('/photo/crop'))).toBe(true), { timeout: 3000 });
    const crop = api.calls.find(call => call.path.endsWith('/photo/crop'))!;
    expect(crop.body).toEqual({ x: 0, y: 150, width: 300, height: 300 });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    api.override = call => call.method === 'POST' && call.path.endsWith('/photo') ? problem(415, 'unsupported_media_type') : undefined;
    fireEvent.change(edit.getByLabelText('Replace photo'), { target: { files: [photoFile(10)] } });
    expect(await edit.findByText(/JPEG, PNG or WebP/i)).toBeInTheDocument();
    fireEvent.click(edit.getByRole('button', { name: 'Remove photo' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: /remove/i })).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.calls.some(call => call.method === 'DELETE')).toBe(true), { timeout: 3000 });
    expect(await screen.findByLabelText('Upload photo')).toBeInTheDocument();
  });
});

describe('conflict and history', () => {
  it('W22 a stale write keeps the edits as a linked copy and shows the latest version', async () => {
    const api = await open();
    const server = { ...api.resume.document, title: 'From another tab' };
    api.override = call => {
      if (call.method === 'PUT') { api.resume = { ...api.resume, version: 8, document: server }; return problem(412, 'version_mismatch'); }
      return undefined;
    };
    fireEvent.change(screen.getByRole('textbox', { name: 'Resume title' }), { target: { value: 'Mine' } });
    const link = await screen.findByRole('link', { name: 'Mine (conflict copy)' }, { timeout: 3000 });
    expect(link).toHaveAttribute('href', expect.stringMatching(/^\/resumes\/.+\/edit$/));
    expect(screen.getByText(/your unsaved changes were kept/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Resume title' })).toHaveValue('From another tab');
    const create = api.calls.find(call => call.method === 'POST' && call.path === '/resumes')!;
    expect(create.body).toMatchObject({ source: 'document', copyPhotoFromResumeId: RESUME_ID });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('W23 a refused copy offers retry and discard and locks editing until chosen', async () => {
    const api = await open();
    api.override = call => call.method === 'PUT' ? problem(412, 'version_mismatch') : call.method === 'POST' ? problem(409, 'limit_reached') : undefined;
    fireEvent.change(screen.getByRole('textbox', { name: 'Resume title' }), { target: { value: 'Mine' } });
    const retry = await screen.findByRole('button', { name: 'Retry saving as a copy' }, { timeout: 3000 });
    expect(screen.getByText(/200/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Resume title' })).toHaveValue('Mine');
    expect(screen.getByRole('region', { name: 'Edit', hidden: true }).closest('[inert]')).not.toBeNull();
    api.override = call => call.method === 'PUT' ? problem(412, 'version_mismatch') : undefined;
    fireEvent.click(retry);
    expect(await screen.findByRole('link', { name: 'Mine (conflict copy)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry saving as a copy' })).not.toBeInTheDocument();
  });

  it('W25 an edit typed while a remote reload is on its way is kept, not replaced', async () => {
    const api = await open();
    let release: (value: Response) => void = () => {};
    const fetchStub = vi.mocked(fetch);
    const real = fetchStub.getMockImplementation()!;
    fetchStub.mockImplementation(async (input, init) => (init?.method ?? 'GET') === 'GET' && String(input).endsWith(RESUME_ID) ? new Promise<Response>(resolve => { release = resolve; }) : real(input, init));
    const gets = () => fetchStub.mock.calls.filter(([input, init]) => (init?.method ?? 'GET') === 'GET' && String(input).endsWith(RESUME_ID)).length;
    const other = new BroadcastChannel('resumiser-resume-versions');
    other.postMessage({ userId: USER_ID, resumeId: RESUME_ID, tabId: 'another-tab', version: 99 });
    other.close();
    await waitFor(() => expect(gets()).toBe(2));
    const title = screen.getByRole('textbox', { name: 'Resume title' });
    fireEvent.change(title, { target: { value: 'Typed meanwhile' } });
    release(new Response(JSON.stringify({ ...api.resume, version: 99, document: { ...api.resume.document, title: 'Elsewhere' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(title).toHaveValue('Typed meanwhile');
    expect(screen.queryByText(/changed in another tab/i)).not.toBeInTheDocument();
  });

  it('W24 version history lists and restores as one undoable edit', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Version history' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Version history' }));
    fireEvent.click(await dialog.findByRole('button', { name: /^Restore/ }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Resume title' })).toHaveValue('Old title'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    expect(screen.getByRole('textbox', { name: 'Resume title' })).toHaveValue('Synthetic resume');
  });

});
