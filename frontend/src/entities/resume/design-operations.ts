import { definitionOf } from '../template';
import type { ResumeDocument, Section } from './operations';

type D = ResumeDocument;
type Layout = D['layout'];

/** FR-LAY-06. */
export const MARGIN_PRESETS = [{ id: 'narrow', label: 'Narrow', value: 16 }, { id: 'normal', label: 'Normal', value: 23 }, { id: 'wide', label: 'Wide', value: 36 }] as const;

const withLayout = (document: D, change: Partial<Layout>): D => ({ ...document, layout: { ...document.layout, ...change } });

/** FR-TPL-03: only the ID changes, so everything else, and T1 → T2 → T1, holds by construction. */
export const switchTemplate = (document: D, id: D['templateId']): D => id === document.templateId ? document : { ...document, templateId: id };

/** FR-LAY-07, DD-P10-06: body font, language, date format and placement are not in the FR's list. */
export function resetDesign(document: D): D {
  const { defaults } = definitionOf(document.templateId);
  const { margin } = defaults;
  return {
    ...document,
    accentPreset: defaults.accentPreset,
    layout: {
      ...document.layout,
      fontPreset: defaults.fontPreset,
      sectionSpacing: defaults.sectionSpacing,
      entrySpacing: defaults.entrySpacing,
      lineSpacing: defaults.lineSpacing,
      pageSize: defaults.pageSize,
      margins: { top: margin, right: margin, bottom: margin, left: margin },
    },
    sections: document.sections.map(section => section.listColumns === null ? section : { ...section, listColumns: null }) as D['sections'],
  };
}

export const setAccent = (document: D, index: D['accentPreset']): D => index === document.accentPreset ? document : { ...document, accentPreset: index };
export const setFontPreset = (document: D, value: Layout['fontPreset']): D => value === document.layout.fontPreset ? document : withLayout(document, { fontPreset: value });
export const setSpacing = (document: D, key: 'sectionSpacing' | 'entrySpacing' | 'lineSpacing', value: number): D => value === document.layout[key] ? document : withLayout(document, { [key]: value });
export const setPageSize = (document: D, value: Layout['pageSize']): D => value === document.layout.pageSize ? document : withLayout(document, { pageSize: value });
export const setBodyFont = (document: D, value: string | null): D => value === document.layout.bodyFont ? document : withLayout(document, { bodyFont: value });
export const setLanguage = (document: D, value: D['language']): D => value === document.language ? document : { ...document, language: value };
export const setDateFormat = (document: D, value: D['dateFormat']): D => value === document.dateFormat ? document : { ...document, dateFormat: value };

/** DD-P10-07: the control sets all four sides. */
export function setMargins(document: D, value: number): D {
  const { top, right, bottom, left } = document.layout.margins;
  if (top === value && right === value && bottom === value && left === value) return document;
  return withLayout(document, { margins: { top: value, right: value, bottom: value, left: value } });
}

export function setPlacement(document: D, sectionId: string, value: Section['placement']): D {
  return { ...document, sections: document.sections.map(section => section.id === sectionId ? { ...section, placement: value } : section) as D['sections'] };
}

/** The contract's `Margins`: 10 to 50 in steps of 0.5. */
export const isValidCustomMargin = (value: number) => Number.isFinite(value) && value >= 10 && value <= 50 && Number.isInteger(value * 2);

export function marginChoice(margins: Layout['margins']): typeof MARGIN_PRESETS[number]['id'] | 'custom' {
  const { top, right, bottom, left } = margins;
  if (top !== right || top !== bottom || top !== left) return 'custom';
  return MARGIN_PRESETS.find(preset => preset.value === top)?.id ?? 'custom';
}
