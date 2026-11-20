import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { choose } from '../../test/select';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { removeLocalData } from '../../entities/resume/local-data';
import { loadFontFile } from '../preview-paint/font-source';
import { resetPreviewRuntime } from '../preview-paint/runtime';
import { fixtureDocument, installApi, paintedRuns, previewReady, pt, RESUME_ID, USER_ID, type ResumeDocument } from './test-fixture';

const fixture = (name: string): ResumeDocument => JSON.parse(readFileSync(resolve(import.meta.dirname, `../../../../tests/fixtures/resumes/${name}.json`), 'utf8'));
const region = (name: string) => screen.getByRole('region', { name });
const preview = () => within(region('Preview'));
async function open(document: ResumeDocument = fixtureDocument(), options: Parameters<typeof installApi>[0] = {}) {
  const api = installApi({ ...options, resume: { document, ...options.resume } });
  window.history.replaceState(null, '', `/resumes/${RESUME_ID}/edit`);
  render(<App />);
  await screen.findByRole('textbox', { name: 'Resume title' });
  await previewReady();
  return api;
}
const scaleOf = () => /scale\(([\d.]+)\)/.exec(region('Preview').querySelector<HTMLElement>('.page-stage')!.style.transform)![1]!;

beforeEach(async () => { document.cookie = 'XSRF-TOKEN=synthetic-csrf'; await removeLocalData(USER_ID); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

describe('pages (FR-PRV-01, FR-PRV-02)', () => {
  it('P01 one labelled group per page, numbered, with the template marked and no draft label', async () => {
    await open(fixture('two-pages'));
    expect(preview().queryByText(/draft view/i)).toBeNull();
    const groups = preview().getAllByRole('group', { name: /^Page \d of 2$/ });
    expect(groups).toHaveLength(2);
    expect(within(groups[0]!).getByText('1 / 2')).toBeInTheDocument();
    expect(within(groups[1]!).getByText('2 / 2')).toBeInTheDocument();
    expect(region('Preview').querySelector('[data-template]')).toHaveAttribute('data-template', 'T1');
    expect(preview().getByTestId('preview-page-count')).toHaveTextContent('2 pages');
  });
  it('P02 a page has its size in points, and runs carry the model text at model positions', async () => {
    const document = fixture('one-page');
    await open({ ...document, layout: { ...document.layout, pageSize: 'Letter' } });
    const sheet = region('Preview').querySelector<HTMLElement>('[data-page-sheet="1"]')!;
    expect([sheet.style.width, sheet.style.height]).toEqual(['612pt', '792pt']);
    expect(paintedRuns('sectionTitle').map(item => item.textContent)).toContain('RESUMEN PROFESIONAL');
    expect(pt(paintedRuns('name')[0]!.style.left)).toBeCloseTo(23, 3);
  });
  it('P03 an edit reaches the painted text, and a page it did not change is not repainted', async () => {
    await open(fixture('two-pages'));
    const first = region('Preview').querySelector('[data-page-sheet="1"]');
    const second = region('Preview').querySelector('[data-page-sheet="2"]');
    fireEvent.change(screen.getByRole('textbox', { name: 'Resume title' }), { target: { value: 'Only the title' } });
    await act(async () => { await Promise.resolve(); });
    expect(region('Preview').querySelector('[data-page-sheet="1"]')).toBe(first);
    expect(region('Preview').querySelector('[data-page-sheet="2"]')).toBe(second);
    fireEvent.change(screen.getByRole('textbox', { name: 'Full name' }), { target: { value: 'New Name' } });
    await waitFor(() => expect(paintedRuns('name')[0]).toHaveTextContent('NEW NAME'));
    expect(region('Preview').querySelector('[data-page-sheet="1"]')).not.toBe(first);
    expect(region('Preview').querySelector('[data-page-sheet="2"]')).toBe(second);
  });
});

describe('zoom (FR-PRV-06)', () => {
  it('P04 the options scale the sheet, 100% is true size, and the layout does not change', async () => {
    await open();
    const options = within(preview().getByRole('radiogroup', { name: 'Zoom' }));
    expect(options.getAllByRole('radio').map(item => item.closest('label')!.textContent)).toEqual(['Fit width', '75%', '100%', '125%']);
    expect(options.getByRole('radio', { name: 'Fit width' })).toBeChecked();
    const before = paintedRuns('name')[0]!.style.left;
    for (const [name, scale] of [['75%', '0.75'], ['100%', '1'], ['125%', '1.25']] as const) {
      fireEvent.click(options.getByRole('radio', { name }));
      expect(scaleOf()).toBe(scale);
      const frame = region('Preview').querySelector<HTMLElement>('.page-frame')!;
      expect(parseFloat(frame.style.width)).toBeCloseTo((595 * 96 / 72) * Number(scale), 1);
      expect(paintedRuns('name')[0]!.style.left).toBe(before);
    }
  });
  it('P05 fit width follows the panel', async () => {
    let notify: () => void = () => {};
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { notify = callback; } observe() {} disconnect() {} });
    await open();
    const scroller = region('Preview').querySelector<HTMLElement>('[data-preview-scroller]')!;
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 397 });
    act(() => notify());
    expect(Number(scaleOf())).toBeCloseTo(397 / (595 * 96 / 72), 3);
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 794 });
    act(() => notify());
    expect(Number(scaleOf())).toBeCloseTo(794 / (595 * 96 / 72), 3);
  });
});

describe('hints (FR-PRV-07)', () => {
  it('P06 an oversized item shows an outline and a text hint; an ordinary resume shows neither', async () => {
    await open(fixture('oversized'));
    expect(preview().getByRole('status', { name: 'Layout hints' })).toHaveTextContent(/longer than a page/i);
    expect(region('Preview').querySelectorAll('[data-hint="oversized"]').length).toBeGreaterThanOrEqual(2);
  });
  it('P06b no hint on an ordinary resume', async () => {
    await open(fixture('two-pages'));
    expect(preview().queryByRole('status', { name: 'Layout hints' })).toBeNull();
    expect(region('Preview').querySelector('[data-hint]')).toBeNull();
  });
});

describe('selection (FR-PRV-08, FR-EDT-03, FR-EDT-04)', () => {
  const stubSheetAtOrigin = () => vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const width = (this as HTMLElement).dataset.pageSheet ? 595 : 0;
    return { top: 0, left: 0, right: width, bottom: 0, width, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  it('P07 each section has one tab stop in document order, with Enter and Space; a continuation region is hidden from assistive technology', async () => {
    const document = fixture('two-pages');
    await open(document);
    const buttons = preview().getAllByRole('button').filter(item => item.hasAttribute('data-section-id'));
    const visibleSections = (document.sections as { id: string }[]).map(section => section.id);
    expect(buttons.map(item => item.getAttribute('data-section-id'))).toEqual(visibleSections);
    for (const button of buttons) expect(button).toHaveAttribute('tabindex', '0');
    const continued = region('Preview').querySelectorAll('[data-section-continued]');
    expect(continued.length).toBeGreaterThan(0);
    for (const item of continued) { expect(item).toHaveAttribute('aria-hidden', 'true'); expect(item).not.toHaveAttribute('tabindex'); expect(item).not.toHaveAttribute('data-section-id'); }
    fireEvent.keyDown(buttons[1]!, { key: ' ' });
    expect(within(region('Edit')).getByRole('heading', { level: 2, name: document.sections[1]!.title })).toBeInTheDocument();
  });
  it('P08 the header has a region and opens the header form', async () => {
    await open();
    fireEvent.click(preview().getByRole('button', { name: 'Edit Summary' }));
    fireEvent.click(preview().getByRole('button', { name: 'Edit Header' }));
    expect(within(region('Edit')).getByRole('heading', { level: 2, name: 'Header' })).toBeInTheDocument();
  });
  it('P09 a click on an entry opens that entry; on a list item it marks that row', async () => {
    await open();
    stubSheetAtOrigin();
    const at = (run: HTMLElement) => ({ clientX: pt(run.style.left) + 1, clientY: pt(run.style.top) + pt(run.style.fontSize) * 2 - 2 });
    const second = paintedRuns('entryTitle').find(item => item.textContent === 'SECOND JOB')!;
    fireEvent.click(preview().getByRole('button', { name: 'Edit Experience' }), at(second));
    expect(within(region('Edit')).getByRole('button', { name: /^Edit entry 2: Second job/ })).toHaveAttribute('aria-expanded', 'true');
    expect(region('Edit').querySelector('.is-revealed')).not.toBeNull();
    const item = paintedRuns('listItem').find(run => run.textContent === 'SQL')!;
    fireEvent.click(preview().getByRole('button', { name: 'Edit Skills' }), at(item));
    const revealed = region('Edit').querySelector('.is-revealed')!;
    expect(within(revealed as HTMLElement).getByRole('textbox', { name: 'Item 2' })).toBeInTheDocument();
  });
  it('P10 the selected section is marked on every page it occupies', async () => {
    const document = fixture('two-pages');
    await open(document);
    const crossing = (document.sections as { id: string }[]).find(section => region('Preview').querySelector(`[data-section-id="${section.id}"]`) && region('Preview').querySelector(`[data-section-continued="${section.id}"]`))!;
    fireEvent.click(region('Preview').querySelector(`[data-section-id="${crossing.id}"]`)!);
    expect(region('Preview').querySelector(`[data-section-id="${crossing.id}"]`)).toHaveClass('selected');
    expect(region('Preview').querySelector(`[data-section-continued="${crossing.id}"]`)).toHaveClass('selected');
  });
  it('P11 selection scrolls to the section first region at the current zoom', async () => {
    const document = fixtureDocument();
    await open(document);
    const scroller = region('Preview').querySelector<HTMLElement>('[data-preview-scroller]')!;
    const id = (document.sections as { id: string; title: string }[]).find(section => section.title === 'Skills')!.id;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const top = (this as HTMLElement).dataset.sectionId === id ? 500 : 40;
      return { top, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    fireEvent.click(within(screen.getByRole('list', { name: 'Resume sections' })).getByRole('button', { name: /^Skills/ }));
    expect(scroller.scrollTop).toBe(460);
    fireEvent.click(within(screen.getByRole('list', { name: 'Resume sections' })).getByRole('button', { name: /^Header/ }));
    expect(scroller.scrollTop).toBe(0);
  });
});

describe('failure and safety', () => {
  it('P12 a font failure shows Retry, reports one content-free event, leaves the forms working, and Retry recovers (AC-P11-16, AC-P11-13)', async () => {
    resetPreviewRuntime();
    vi.mocked(loadFontFile).mockRejectedValueOnce(new Error('offline'));
    const api = installApi({ resume: { document: fixtureDocument() } });
    window.history.replaceState(null, '', `/resumes/${RESUME_ID}/edit`);
    render(<App />);
    const alert = await screen.findByRole('alert', {}, { timeout: 20_000 });
    expect(alert).toHaveTextContent(/preview could not load/i);
    expect(screen.getByRole('textbox', { name: 'Full name' })).toBeEnabled();
    await waitFor(() => expect(api.calls.filter(call => call.path === '/client-events')).toHaveLength(1));
    const [event] = (api.calls.find(call => call.path === '/client-events')!.body as { events: Record<string, unknown>[] }).events;
    expect(event).toMatchObject({ type: 'preview_failed', code: 'font_load', resumeId: RESUME_ID });
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await previewReady();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('P12b a failed font does not leave the alert up once the resume uses a font that loaded', async () => {
    resetPreviewRuntime();
    const document = fixtureDocument();
    await open({ ...document, layout: { ...document.layout, bodyFont: 'roboto' } });
    vi.mocked(loadFontFile).mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(window.document.getElementById('right-tab-Design')!);
    const select = within(region('Design')).getByRole('combobox', { name: 'Body font' });
    choose(select, 'pt-serif');
    await screen.findByRole('alert', {}, { timeout: 20_000 });
    choose(select, 'roboto');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
  it('P13 no anchor exists in the preview, also with links in the document', async () => {
    await open(fixture('rich-marks'));
    expect(region('Preview').querySelectorAll('a')).toHaveLength(0);
    expect(paintedRuns('body').some(item => item.textContent === 'enlace')).toBe(true);
  });
  it('P14 a thumbnail is decoration: no section IDs, nothing focusable, hidden from assistive technology', async () => {
    await open();
    fireEvent.click(window.document.getElementById('right-tab-Design')!);
    const thumbnails = await waitFor(() => { const found = region('Design').querySelectorAll<HTMLElement>('.page-thumbnail'); expect(found.length).toBe(3); return found; }, { timeout: 20_000 });
    for (const thumbnail of thumbnails) {
      expect(thumbnail).toHaveAttribute('aria-hidden', 'true');
      expect(thumbnail.querySelector('[data-section-id],[tabindex],button,a')).toBeNull();
    }
  });
});
