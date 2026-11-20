// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { blankResumeDocument, type ResumeDocument } from './index';
import { resetDesign, setAccent, setBodyFont, setDateFormat, setFontPreset, setLanguage, setMargins, setPageSize, setPlacement, setSpacing, switchTemplate, MARGIN_PRESETS, isValidCustomMargin, marginChoice } from './design-operations';
import { definitionOf } from '../template';

const styled = (): ResumeDocument => {
  const base = blankResumeDocument();
  return {
    ...base, accentPreset: 2, language: 'uk', dateFormat: 'Numeric',
    layout: { fontPreset: 'L', sectionSpacing: 3, entrySpacing: 4, lineSpacing: 5, pageSize: 'Letter', margins: { top: 40, right: 40, bottom: 40, left: 40 }, bodyFont: 'pt-serif' },
    sections: base.sections.map((section, index) => ({ ...section, listColumns: index % 2 ? 1 : 2, placement: index % 2 ? 'sidebar' : 'main' })) as ResumeDocument['sections'],
  };
};

describe('template switch (FR-TPL-03, FR-TPL-04)', () => {
  it('O01 changes templateId and nothing else', () => {
    const before = styled();
    const after = switchTemplate(before, 'T2');
    expect(after.templateId).toBe('T2');
    expect({ ...after, templateId: before.templateId }).toEqual(before);
  });
  it('O02 T1 → T2 → T3 → T1 is deep equal', () => {
    const before = styled();
    expect(switchTemplate(switchTemplate(switchTemplate(before, 'T2'), 'T3'), 'T1')).toEqual(before);
  });
  it('O03 switching to the active template is no edit', () => {
    const before = styled();
    expect(switchTemplate(before, before.templateId)).toBe(before);
  });
});

describe('reset design (FR-LAY-07)', () => {
  it('O04 restores layout, columns and colour to the active template defaults', () => {
    const after = resetDesign(styled());
    const t1 = definitionOf('T1').defaults;
    expect(after.layout).toMatchObject({ fontPreset: t1.fontPreset, sectionSpacing: t1.sectionSpacing, entrySpacing: t1.entrySpacing, lineSpacing: t1.lineSpacing, pageSize: t1.pageSize, margins: { top: 23, right: 23, bottom: 23, left: 23 } });
    expect(after.accentPreset).toBe(0);
    expect(after.sections.every(section => section.listColumns === null)).toBe(true);
  });
  it('O05 uses the defaults of T2 when T2 is active', () => {
    const after = resetDesign({ ...styled(), templateId: 'T2' });
    expect(after.layout.sectionSpacing).toBe(definitionOf('T2').defaults.sectionSpacing);
    expect(after.layout.entrySpacing).toBe(definitionOf('T2').defaults.entrySpacing);
  });
  it('O06 leaves font, language, date format, placement, template and content alone (DD-P10-06)', () => {
    const before = styled();
    const after = resetDesign(before);
    expect(after.layout.bodyFont).toBe('pt-serif');
    expect(after).toMatchObject({ language: 'uk', dateFormat: 'Numeric', templateId: before.templateId, title: before.title, header: before.header });
    expect(after.sections.map(section => section.placement)).toEqual(before.sections.map(section => section.placement));
    expect(after.sections.map(section => section.content)).toEqual(before.sections.map(section => section.content));
  });
});

describe('setters', () => {
  it('O07 each returns a new document and leaves the input unchanged; an equal value is no edit', () => {
    const before = styled();
    const frozen = structuredClone(before);
    const edits: [(document: ResumeDocument) => ResumeDocument, (document: ResumeDocument) => unknown, unknown][] = [
      [document => setAccent(document, 1), document => document.accentPreset, 1],
      [document => setFontPreset(document, 'S'), document => document.layout.fontPreset, 'S'],
      [document => setSpacing(document, 'sectionSpacing', 7), document => document.layout.sectionSpacing, 7],
      [document => setSpacing(document, 'entrySpacing', 8), document => document.layout.entrySpacing, 8],
      [document => setSpacing(document, 'lineSpacing', 9), document => document.layout.lineSpacing, 9],
      [document => setPageSize(document, 'A4'), document => document.layout.pageSize, 'A4'],
      [document => setBodyFont(document, 'roboto'), document => document.layout.bodyFont, 'roboto'],
      [document => setLanguage(document, 'es'), document => document.language, 'es'],
      [document => setDateFormat(document, 'YearOnly'), document => document.dateFormat, 'YearOnly'],
    ];
    for (const [edit, read, value] of edits) {
      const after = edit(before);
      expect(after).not.toBe(before);
      expect(read(after)).toBe(value);
      expect(edit(after)).toBe(after);
    }
    expect(before).toEqual(frozen);
  });
  it('O08 margins set all four sides (FR-LAY-06, DD-P10-07)', () => {
    expect(setMargins(styled(), 16).layout.margins).toEqual({ top: 16, right: 16, bottom: 16, left: 16 });
    expect(MARGIN_PRESETS).toEqual([{ id: 'narrow', label: 'Narrow', value: 16 }, { id: 'normal', label: 'Normal', value: 23 }, { id: 'wide', label: 'Wide', value: 36 }]);
  });
  it('O09 custom margin bounds follow the contract: 10 to 50 in steps of 0.5', () => {
    for (const good of [10, 10.5, 23, 50]) expect(isValidCustomMargin(good), String(good)).toBe(true);
    for (const bad of [9.5, 50.5, 12.3, Number.NaN]) expect(isValidCustomMargin(bad), String(bad)).toBe(false);
  });
  it('O10 the shown choice reads the document; four different values show Custom', () => {
    expect(marginChoice({ top: 23, right: 23, bottom: 23, left: 23 })).toBe('normal');
    expect(marginChoice({ top: 16, right: 16, bottom: 16, left: 16 })).toBe('narrow');
    expect(marginChoice({ top: 30, right: 30, bottom: 30, left: 30 })).toBe('custom');
    expect(marginChoice({ top: 23, right: 23, bottom: 23, left: 30 })).toBe('custom');
  });
  it('O11 placement edits one section; null restores the default', () => {
    const before = styled();
    const id = before.sections[0]!.id;
    const after = setPlacement(before, id, null);
    expect(after.sections[0]!.placement).toBeNull();
    expect(after.sections[1]).toBe(before.sections[1]);
  });
});
