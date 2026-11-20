import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { choose, optionsOf } from '../../test/select';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { removeLocalData } from '../../entities/resume/local-data';
import type { Section } from '../../entities/resume/operations';
import { fixtureDocument, installApi, paintedRuns, previewReady, pt, RESUME_ID, USER_ID, type ResumeDocument } from './test-fixture';

const EDIT = `/resumes/${RESUME_ID}/edit`;
const workspaceReady = async (title: () => Promise<unknown>) => {
  const listening = vi.spyOn(window, 'addEventListener');
  await title();
  await waitFor(() => expect(listening.mock.calls.some(([type]) => type === 'beforeinput')).toBe(true));
  listening.mockRestore();
};
const open = async (document: ResumeDocument = fixtureDocument()) => {
  const api = installApi({ resume: { document } });
  window.history.replaceState(null, '', EDIT);
  await workspaceReady(async () => {
    render(<App />);
    await screen.findByRole('textbox', { name: 'Resume title' });
  });
  await previewReady();
  fireEvent.click(document_tab());
  return api;
};
const document_tab = () => window.document.getElementById('right-tab-Design')!;
const design = () => within(screen.getByRole('region', { name: 'Design' }));
const previewSheet = () => screen.getByRole('region', { name: 'Preview' }).querySelector<HTMLElement>('[data-template]')!;
const firstRun = (role: string) => paintedRuns(role)[0]!;
const headerRegion = () => previewSheet().querySelector<HTMLElement>('[data-preview-header]')!;
const thumbnails = () => screen.getByRole('region', { name: 'Design' }).querySelectorAll<HTMLElement>('.page-thumbnail');
const rgb = (hex: string) => `rgb(${[1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`;
const undo = () => fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
const puts = (api: ReturnType<typeof installApi>) => api.calls.filter(call => call.method === 'PUT' && call.path.endsWith('/document'));
const lastPut = async (api: ReturnType<typeof installApi>, count = 1) => {
  await waitFor(() => expect(puts(api).length).toBeGreaterThanOrEqual(count), { timeout: 5000 });
  return puts(api).at(-1)!.body as ResumeDocument;
};
const radio = (name: string) => design().getByRole('radio', { name });

beforeEach(async () => { window.document.cookie = 'XSRF-TOKEN=synthetic-csrf'; await removeLocalData(USER_ID); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); window.history.replaceState(null, '', '/'); });

describe('template picker', () => {
  it('C01 a radio group of four named templates, T1 selected, with thumbnails of the own content (FR-TPL-02, ADR-054)', async () => {
    await open();
    const group = design().getByRole('radiogroup', { name: 'Template' });
    expect(within(group).getAllByRole('radio').map(item => (item as HTMLInputElement).value)).toEqual(['T1', 'T2', 'T3', 'T4']);
    expect(radio('Classic Timeline')).toBeChecked();
    expect(radio('Compact')).not.toBeChecked();
    expect(radio('Sidebar')).not.toBeChecked();
    expect(radio('Panel')).not.toBeChecked();
    await waitFor(() => expect(thumbnails()).toHaveLength(4), { timeout: 20_000 });
    for (const thumbnail of thumbnails()) expect(thumbnail).toHaveTextContent(/Synthetic Person/i);
    expect(Array.from(thumbnails()).map(thumbnail => thumbnail.getAttribute('data-template'))).toEqual(['T1', 'T2', 'T3', 'T4']);
  });
  it('C02 the thumbnails update after an edit', async () => {
    await open();
    fireEvent.change(screen.getByRole('textbox', { name: /full name/i }), { target: { value: 'Renamed Person' } });
    await waitFor(() => {
      expect(thumbnails()).toHaveLength(4);
      for (const thumbnail of thumbnails()) expect(thumbnail).toHaveTextContent(/Renamed Person/i);
    }, { timeout: 20_000 });
  });
  it('C03 no thumbnail is rendered while the Design tab is not showing', async () => {
    await open();
    fireEvent.click(window.document.getElementById('right-tab-Preview')!);
    expect(thumbnails()).toHaveLength(0);
  });
  it('C04 a switch changes only the template ID, reaches the PUT, and one undo returns (FR-TPL-03, FR-PER-04)', async () => {
    const api = await open();
    fireEvent.click(radio('Sidebar'));
    expect(previewSheet()).toHaveAttribute('data-template', 'T3');
    expect(radio('Sidebar')).toBeChecked();
    const body = await lastPut(api);
    expect(body).toEqual({ ...fixtureDocument(), templateId: 'T3' });
    undo();
    expect(previewSheet()).toHaveAttribute('data-template', 'T1');
    expect(radio('Classic Timeline')).toBeChecked();
  });
});

describe('accent', () => {
  it('C05 three named swatches with the choice marked and named as text; a click repaints, undo returns (FR-CLR-01, 03)', async () => {
    await open();
    const group = design().getByRole('radiogroup', { name: 'Accent colour' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(radio('Blue')).toBeChecked();
    expect(within(group).getByTestId('swatch-check')).toBeInTheDocument();
    expect(design().getByTestId('swatch-name')).toHaveTextContent('Blue');
    fireEvent.click(radio('Navy'));
    expect(firstRun('name').style.color).toBe(rgb('#335776'));
    expect(firstRun('body').style.color).toBe(rgb('#050505'));
    expect(design().getByTestId('swatch-name')).toHaveTextContent('Navy');
    undo();
    expect(firstRun('name').style.color).toBe(rgb('#2A68A0'));
  });
  it('C06 each template shows its own three, keeping the preset index (FR-TPL-03, ADR-024)', async () => {
    await open();
    fireEvent.click(radio('Navy'));
    fireEvent.click(radio('Compact'));
    expect(within(design().getByRole('radiogroup', { name: 'Accent colour' })).getAllByRole('radio').map(item => item.getAttribute('aria-label'))).toEqual(['Teal', 'Slate', 'Plum']);
    expect(radio('Slate')).toBeChecked();
    fireEvent.click(radio('Sidebar'));
    expect(within(design().getByRole('radiogroup', { name: 'Accent colour' })).getAllByRole('radio').map(item => item.getAttribute('aria-label'))).toEqual(['Navy', 'Forest', 'Burgundy']);
    expect(radio('Forest')).toBeChecked();
    expect(firstRun('sectionTitle').style.color).toBe(rgb('#22584D'));
  });
  it('C07 no free colour picker or hex field exists (FR-CLR-04)', async () => {
    await open();
    const region = screen.getByRole('region', { name: 'Design' });
    expect(region.querySelector('input[type=color]')).toBeNull();
    expect(region.querySelectorAll('input[type=text]')).toHaveLength(0);
    expect(design().queryByRole('textbox')).toBeNull();
  });
});

describe('type and spacing', () => {
  it('C08 font size presets, Medium first selected (FR-LAY-01)', async () => {
    await open();
    expect(radio('Medium')).toBeChecked();
    fireEvent.click(radio('Large'));
    expect(firstRun('body').style.fontSize).toBe('12pt');
    fireEvent.click(radio('Small'));
    expect(firstRun('body').style.fontSize).toBe('9pt');
    undo();
    expect(firstRun('body').style.fontSize).toBe('12pt');
  });
  it('C09 body font offers the three of the template; the choice is stored and reaches the sheet (FR-LAY-08)', async () => {
    const api = await open();
    const select = design().getByRole('combobox', { name: 'Body font' });
    expect(optionsOf(select).map(item => item.textContent)).toEqual(['Roboto', 'IBM Plex Sans', 'PT Serif']);
    expect(select).toHaveAttribute('data-value', 'roboto');
    choose(select, 'pt-serif');
    await waitFor(() => expect(firstRun('body').style.fontFamily).toContain('doc-pt-serif-regular'), { timeout: 20_000 });
    expect((await lastPut(api)).layout.bodyFont).toBe('pt-serif');
  });
  it('C10 sliders run 0 to 20, step 1, show their value and change the sheet (FR-LAY-02…04, §5.10)', async () => {
    const base = fixtureDocument();
    const summary = { kind: 'paragraph', inlines: [{ kind: 'text', value: 'one', bold: false, italic: false, underline: false }, { kind: 'lineBreak' }, { kind: 'text', value: 'two', bold: false, italic: false, underline: false }] };
    await open({ ...base, sections: (base.sections as Section[]).map(item => item.title === 'Summary' ? { ...item, content: { body: [summary] } } : item) } as ResumeDocument);
    const titleGap = () => pt(paintedRuns('sectionTitle')[1]!.style.top) - pt(paintedRuns('sectionTitle')[0]!.style.top);
    const entryGap = () => pt(paintedRuns('entryTitle')[1]!.style.top) - pt(paintedRuns('entryTitle')[0]!.style.top);
    const lineGap = () => pt(paintedRuns('body')[1]!.style.top) - pt(paintedRuns('body')[0]!.style.top);
    const [titles, entries] = [titleGap(), entryGap()];
    for (const [name, initial] of [['Section spacing', '10'], ['Entry spacing', '10'], ['Line spacing', '1']] as const) {
      const slider = design().getByRole('slider', { name });
      expect(slider).toHaveAttribute('min', '0');
      expect(slider).toHaveAttribute('max', '20');
      expect(slider).toHaveAttribute('step', '1');
      expect(slider).toHaveValue(initial);
      expect(slider).toHaveAttribute('aria-valuetext', initial);
      expect(design().getByTestId(`value-${name}`)).toHaveTextContent(initial);
    }
    fireEvent.change(design().getByRole('slider', { name: 'Section spacing' }), { target: { value: '15' } });
    expect(titleGap() - titles).toBeCloseTo(5, 3);
    expect(design().getByTestId('value-Section spacing')).toHaveTextContent('15');
    fireEvent.change(design().getByRole('slider', { name: 'Entry spacing' }), { target: { value: '0' } });
    expect(entryGap() - entries).toBeCloseTo(-10, 3);
    fireEvent.change(design().getByRole('slider', { name: 'Line spacing' }), { target: { value: '20' } });
    expect(lineGap()).toBeCloseTo(22, 3);
  });
  it('C11 double-click returns a slider to the template default, as its own undo step (§5.10)', async () => {
    await open();
    const slider = design().getByRole('slider', { name: 'Section spacing' });
    fireEvent.change(slider, { target: { value: '15' } });
    fireEvent.doubleClick(slider);
    expect(slider).toHaveValue('10');
    undo();
    expect(design().getByRole('slider', { name: 'Section spacing' })).toHaveValue('15');
  });
  it('C12 a burst on one slider is one undo step; a different slider is another (FR-PER-04)', async () => {
    await open();
    const section = design().getByRole('slider', { name: 'Section spacing' });
    for (const value of ['11', '12', '13']) fireEvent.change(section, { target: { value } });
    fireEvent.change(design().getByRole('slider', { name: 'Line spacing' }), { target: { value: '4' } });
    undo();
    expect(design().getByRole('slider', { name: 'Line spacing' })).toHaveValue('1');
    expect(section).toHaveValue('13');
    undo();
    expect(section).toHaveValue('10');
  });
});

describe('page', () => {
  it('C13 A4 is the default and US Letter changes the geometry (FR-LAY-05)', async () => {
    await open();
    expect(radio('A4')).toBeChecked();
    fireEvent.click(radio('US Letter'));
    const sheet = previewSheet().querySelector<HTMLElement>('[data-page-sheet="1"]')!;
    expect([sheet.style.width, sheet.style.height]).toEqual(['612pt', '792pt']);
  });
  it('C14 margin presets set all four sides (FR-LAY-06)', async () => {
    const api = await open();
    expect(radio('Normal')).toBeChecked();
    fireEvent.click(radio('Wide'));
    expect([headerRegion().style.top, headerRegion().style.left, headerRegion().style.width]).toEqual(['36pt', '36pt', `${595 - 72}pt`]);
    expect((await lastPut(api)).layout.margins).toEqual({ top: 36, right: 36, bottom: 36, left: 36 });
  });
  it('C15 a custom margin applies on commit, by blur and by Enter, including half points (FR-LAY-06)', async () => {
    await open();
    fireEvent.click(radio('Custom'));
    const field = design().getByRole('spinbutton', { name: /custom margin/i });
    expect(field).toHaveValue(23);
    fireEvent.change(field, { target: { value: '30.5' } });
    expect(headerRegion().style.left).toBe('23pt');
    fireEvent.blur(field);
    expect([headerRegion().style.top, headerRegion().style.left, headerRegion().style.width]).toEqual(['30.5pt', '30.5pt', `${595 - 61}pt`]);
    expect(radio('Custom')).toBeChecked();
    fireEvent.change(field, { target: { value: '40' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(headerRegion().style.top).toBe('40pt');
  });
  it('C16 invalid custom text shows an error and never reaches the document (FR-LAY-06)', async () => {
    const api = await open();
    fireEvent.click(radio('Custom'));
    const field = design().getByRole('spinbutton', { name: /custom margin/i });
    for (const value of ['5', '51', '30.3', '']) {
      fireEvent.change(field, { target: { value } });
      fireEvent.blur(field);
      expect(design().getByText(/between 10 and 50/i)).toBeInTheDocument();
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(headerRegion().style.top).toBe('23pt');
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(puts(api)).toEqual([]);
    fireEvent.change(field, { target: { value: '20' } });
    fireEvent.blur(field);
    expect(design().queryByText(/between 10 and 50/i)).toBeNull();
    expect(headerRegion().style.top).toBe('20pt');
  });
  it('C17 a document with four different margins shows Custom with the top value and is not rewritten (DD-P10-07)', async () => {
    const document = fixtureDocument();
    const api = await open({ ...document, layout: { ...document.layout, margins: { top: 11, right: 12, bottom: 13, left: 14 } } });
    expect(radio('Custom')).toBeChecked();
    expect(design().getByRole('spinbutton', { name: /custom margin/i })).toHaveValue(11);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(puts(api)).toEqual([]);
    expect(headerRegion().style.width).toBe(`${595 - 14 - 12}pt`);
  });
});

describe('page count and fit (FR-PRV-04, FR-PRV-05)', () => {
  const long = (lines: number, spacing: Partial<ResumeDocument['layout']> = {}) => {
    const base = fixtureDocument();
    const body = [{ kind: 'paragraph', inlines: Array.from({ length: lines }, () => [{ kind: 'text', value: 'line', bold: false, italic: false, underline: false }, { kind: 'lineBreak' }]).flat() }];
    return { ...base, layout: { ...base.layout, ...spacing }, sections: (base.sections as Section[]).map(item => item.title === 'Summary' ? { ...item, content: { body } } : item) } as ResumeDocument;
  };
  const counted = () => Number(/\d+/.exec(design().getByTestId('page-count').textContent!)![0]);
  it('C30 the counter sits with the sliders, and changes while one moves', async () => {
    await open(long(30));
    const count = design().getByTestId('page-count');
    expect(count).toHaveTextContent('1 page');
    expect(count.closest('.design-card')!.querySelector('input[type=range]')).not.toBeNull();
    fireEvent.change(design().getByRole('slider', { name: 'Line spacing' }), { target: { value: '20' } });
    expect(design().getByTestId('page-count')).toHaveTextContent(/^2 pages$/);
    fireEvent.change(design().getByRole('slider', { name: 'Line spacing' }), { target: { value: '1' } });
    expect(design().getByTestId('page-count')).toHaveTextContent(/^1 page$/);
  });
  it('C31 Fit applies, says so, and one undo restores it', async () => {
    const api = await open(long(45, { lineSpacing: 6 }));
    const pages = counted();
    expect(pages).toBeGreaterThan(1);
    choose(design().getByRole('combobox', { name: 'Fit to pages' }), String(pages - 1));
    fireEvent.click(design().getByRole('button', { name: 'Fit' }));
    expect(counted()).toBe(pages - 1);
    expect(Number((design().getByRole('slider', { name: 'Line spacing' }) as HTMLInputElement).value)).toBeLessThan(6);
    expect(design().getByTestId('fit-result')).toHaveTextContent(new RegExp(`fits on ${pages - 1} page`, 'i'));
    const body = await lastPut(api);
    expect(body.sections).toEqual(long(45).sections);
    undo();
    expect(design().getByRole('slider', { name: 'Line spacing' })).toHaveValue('6');
  });
  it('C32 a fit that cannot succeed says so and changes nothing', async () => {
    const api = await open(long(400));
    choose(design().getByRole('combobox', { name: 'Fit to pages' }), '1');
    fireEvent.click(design().getByRole('button', { name: 'Fit' }));
    expect(design().getByTestId('fit-result')).toHaveTextContent(/cannot fit on 1 page/i);
    expect(design().getByRole('slider', { name: 'Line spacing' })).toHaveValue('1');
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(puts(api)).toEqual([]);
  });
  it('C33 the target list runs from one page to the current count', async () => {
    await open(long(150));
    const count = Number(/\d+/.exec(design().getByTestId('page-count').textContent!)![0]);
    expect(count).toBeGreaterThan(2);
    expect(optionsOf(design().getByRole('combobox', { name: 'Fit to pages' })).map(item => item.textContent)).toEqual(Array.from({ length: count }, (_, index) => String(index + 1)));
  });
});

describe('language and placement', () => {
  it('C18 language and date format change the draft (FR-LAY-09, §5.6)', async () => {
    const api = await open();
    choose(design().getByRole('combobox', { name: 'Language' }), 'uk');
    expect(within(previewSheet()).getAllByText('січень 2020 - дотепер').length).toBeGreaterThan(0);
    const format = design().getByRole('combobox', { name: 'Date format' });
    expect(optionsOf(format).map(item => item.dataset.value)).toEqual(['MonthYearLong', 'MonthYearShort', 'Numeric', 'YearOnly']);
    choose(format, 'Numeric');
    expect(within(previewSheet()).getAllByText('01/2020 - дотепер').length).toBeGreaterThan(0);
    const body = await lastPut(api);
    expect([body.language, body.dateFormat]).toEqual(['uk', 'Numeric']);
  });
  it('C19 placement shows only under T3, with the type default named; a change moves the section (D-13, ADR-025)', async () => {
    const api = await open();
    expect(design().queryByRole('group', { name: 'Column for each section' })).toBeNull();
    fireEvent.click(radio('Sidebar'));
    const group = within(design().getByRole('group', { name: 'Column for each section' }));
    const skills = group.getByRole('combobox', { name: 'Skills' });
    expect(skills).toHaveAttribute('data-value', '');
    expect(optionsOf(skills)[0]).toHaveTextContent('Sidebar (default)');
    expect(optionsOf(group.getByRole('combobox', { name: 'Summary' }))[0]).toHaveTextContent('Main (default)');
    const skillsId = (fixtureDocument().sections as Section[]).find(item => item.title === 'Skills')!.id;
    const skillsLeft = () => pt(previewSheet().querySelector<HTMLElement>(`[data-section-id="${skillsId}"]`)!.style.left);
    const summaryLeft = () => pt(previewSheet().querySelector<HTMLElement>('[aria-label="Edit Summary"]')!.style.left);
    expect(skillsLeft()).toBeGreaterThan(summaryLeft() + 100);
    choose(skills, 'main');
    expect(skillsLeft()).toBe(summaryLeft());
    const body = await lastPut(api);
    expect((body.sections as Section[]).find(item => item.id === skillsId)!.placement).toBe('main');
    fireEvent.click(radio('Classic Timeline'));
    expect(skillsLeft()).toBe(summaryLeft());
    expect(previewSheet()).toHaveAttribute('data-template', 'T1');
  });
});

describe('reset', () => {
  const dirty = () => {
    const document = fixtureDocument();
    return {
      ...document, accentPreset: 2 as const, language: 'es' as const, dateFormat: 'YearOnly' as const,
      layout: { ...document.layout, fontPreset: 'L' as const, sectionSpacing: 1, entrySpacing: 2, lineSpacing: 3, pageSize: 'Letter' as const, margins: { top: 40, right: 40, bottom: 40, left: 40 }, bodyFont: 'pt-serif' },
      sections: (document.sections as Section[]).map(item => ({ ...item, listColumns: 1, placement: 'sidebar' })),
    } as ResumeDocument;
  };
  it('C20 restores the design and leaves font, language, date format, placement and content; announces, keeps focus (FR-LAY-07, DD-P10-06)', async () => {
    const api = await open(dirty());
    const button = design().getByRole('button', { name: 'Reset design' });
    button.focus();
    fireEvent.click(button);
    expect(radio('Blue')).toBeChecked();
    expect(radio('Medium')).toBeChecked();
    expect(radio('A4')).toBeChecked();
    expect(radio('Normal')).toBeChecked();
    expect(screen.getByTestId('announcer')).toHaveTextContent('Design reset. Undo is available.');
    expect(window.document.activeElement).toBe(button);
    const body = await lastPut(api);
    expect(body.layout).toEqual({ fontPreset: 'M', sectionSpacing: 10, entrySpacing: 10, lineSpacing: 1, pageSize: 'A4', margins: { top: 23, right: 23, bottom: 23, left: 23 }, bodyFont: 'pt-serif' });
    expect(body.accentPreset).toBe(0);
    expect([body.language, body.dateFormat]).toEqual(['es', 'YearOnly']);
    expect((body.sections as Section[]).every(item => item.listColumns === null && item.placement === 'sidebar')).toBe(true);
    expect(body.title).toBe('Synthetic resume');
  });
  it('C21 one undo restores all of it (FR-LAY-07)', async () => {
    await open(dirty());
    fireEvent.click(design().getByRole('button', { name: 'Reset design' }));
    undo();
    expect(radio('Graphite')).toBeChecked();
    expect(radio('Large')).toBeChecked();
    expect(radio('US Letter')).toBeChecked();
    expect(design().getByRole('slider', { name: 'Line spacing' })).toHaveValue('3');
    expect(headerRegion().style.top).toBe('40pt');
  });
  it('C22 reset uses the active template defaults, not T1 (FR-LAY-07, ADR-024)', async () => {
    const document = dirty();
    await open({ ...document, templateId: 'T3' });
    fireEvent.click(design().getByRole('button', { name: 'Reset design' }));
    expect(design().getByRole('slider', { name: 'Section spacing' })).toHaveValue('10');
    expect(radio('Navy')).toBeChecked();
    act(() => { fireEvent.click(radio('Compact')); });
    fireEvent.click(design().getByRole('button', { name: 'Reset design' }));
    expect(design().getByRole('slider', { name: 'Section spacing' })).toHaveValue('6');
    expect(design().getByRole('slider', { name: 'Entry spacing' })).toHaveValue('6');
  });
});
