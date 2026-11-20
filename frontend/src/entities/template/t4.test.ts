import { describe, expect, it } from 'vitest';
import { newSection, type ResumeDocument, type Section } from '../resume/operations';
import { DOCUMENT_FONTS, definitionOf, placementFor, resolveDesign, TEMPLATES } from './index';

/** TPL-01, ADR-054: T4 "Panel". The token values below are the ADR's table; the tests do not read them back from the definition. */
const doc = (change: Partial<ResumeDocument> = {}): ResumeDocument => ({
  title: '', templateId: 'T4', accentPreset: 0, language: 'en', dateFormat: 'MonthYearLong',
  layout: { fontPreset: 'M', sectionSpacing: 6, entrySpacing: 6, lineSpacing: 1, pageSize: 'A4', margins: { top: 23, right: 23, bottom: 23, left: 23 }, bodyFont: null },
  header: { fullName: 'Synthetic Person', headline: '', showPhoto: true, contacts: [] },
  sections: [],
  ...change,
}) as ResumeDocument;
const section = (type: Section['type'], change: Partial<Section> = {}) => ({ ...newSection(type, 'x'), ...change }) as Section;

/** WCAG 2.x relative luminance and contrast ratio, computed here so the check does not trust the code under test. */
function luminance(hex: string) {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, r) => r - p) as [number, number]; return (x + 0.05) / (y + 0.05); };

const PRESETS = [
  { name: 'Teal', hex: '#157A95', panel: '#F2F6F7', tint: '#D3E9EF' },
  { name: 'Steel', hex: '#2E5E8C', panel: '#F2F5F9', tint: '#D8E3EF' },
  { name: 'Plum', hex: '#8A3B5C', panel: '#F8F2F4', tint: '#EFD9E2' },
];

describe('T4 Panel (ADR-054)', () => {
  it('T-01 the registry has T1 to T4 in order, and definitionOf("T4") is Panel, plain data', () => {
    expect(TEMPLATES.map(item => item.id)).toEqual(['T1', 'T2', 'T3', 'T4']);
    const t4 = definitionOf('T4');
    expect(t4.id).toBe('T4');
    expect(t4.name).toBe('Panel');
    expect(JSON.parse(JSON.stringify(t4))).toEqual(t4);
  });
  it('T-02 zones: sidebar on the left, 34 % of the content width, 18 pt gutter, 10 pt panel padding; defaults by type (ADR-025)', () => {
    const { zones } = definitionOf('T4');
    expect(zones?.side).toBe('left');
    expect(zones?.main).toBeCloseTo(0.66, 5);
    expect(zones?.gutter).toBe(18);
    expect(zones?.panel?.padding).toBe(10);
    expect(zones?.defaults).toEqual({ text: 'main', entries: 'main', list: 'sidebar', inline: 'sidebar' });
    const t4 = definitionOf('T4');
    expect(placementFor(section('list'), t4)).toBe('sidebar');
    expect(placementFor(section('entries'), t4)).toBe('main');
    expect(placementFor(section('entries', { placement: 'sidebar' }), t4)).toBe('sidebar');
    // T3 keeps its right sidebar: no side means right.
    expect(definitionOf('T3').zones?.side ?? 'right').toBe('right');
  });
  it('T-03 every accent is >= 4.5:1 on white and on its panel; muted, heading and ink are >= 4.5:1 on every panel (AC-TPL-07)', () => {
    const t4 = definitionOf('T4');
    expect(t4.accents.map(accent => ({ ...accent }))).toEqual(PRESETS);
    for (const [index, preset] of PRESETS.entries()) {
      const design = resolveDesign(doc({ accentPreset: index as 0 | 1 | 2 }));
      expect(design.accent).toBe(preset.hex);
      expect(contrast(design.accent, '#FFFFFF'), `${preset.name} on white`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(design.accent, preset.panel), `${preset.name} on panel`).toBeGreaterThanOrEqual(4.5);
      for (const role of ['muted', 'heading', 'ink'] as const) {
        const color = design.colors?.[role] ?? '#FFFFFF';
        expect(contrast(color, preset.panel), `${role} on ${preset.name} panel`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(color, '#FFFFFF'), `${role} on white`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('T-04 colour roles: heading navy, ink, muted, and panel and tint following the accent preset', () => {
    for (const [index, preset] of PRESETS.entries()) {
      const { colors } = resolveDesign(doc({ accentPreset: index as 0 | 1 | 2 }));
      expect(colors).toMatchObject({ accent: preset.hex, panel: preset.panel, tint: preset.tint, heading: '#1F3446', ink: '#2B3440', muted: '#5B6673' });
    }
    const design = resolveDesign(doc());
    expect(design.styles.name).toMatchObject({ size: 22, bold: true, color: '#1F3446' });
    expect(design.styles.headline).toMatchObject({ size: 13, bold: true, color: '#157A95' });
    expect(design.styles.sectionTitle).toMatchObject({ size: 11, bold: true, upper: true, color: '#1F3446' });
    expect(design.styles.body).toMatchObject({ size: 8.5, color: '#2B3440' });
    expect(design.styles.entryTitle).toMatchObject({ size: 8.5, bold: true, color: '#1F3446' });
    expect(design.styles.entryDates).toMatchObject({ size: 8.5, bold: true, color: '#157A95' });
    expect(design.styles.entryOrganization).toMatchObject({ size: 8.5, italic: true, color: '#5B6673' });
  });
  it('T-05 the sidebar design merges the overrides; T3 has none', () => {
    const sidebar = resolveDesign(doc()).sidebar;
    expect(sidebar?.styles.sectionTitle).toMatchObject({ size: 8.5, bold: true, upper: true, color: '#157A95' });
    expect(sidebar?.styles.body.color).toBe('#5B6673');
    expect(sidebar?.definition.entries.head).toBe('compact');
    expect(sidebar?.definition.entries.marker).toBe('none');
    expect(resolveDesign(doc()).definition.entries).toMatchObject({ head: 'title-dates', marker: 'dot' });
    // DD-TPL-18: the sidebar's entry gap is a third of the entry spacing; main and other templates keep it whole.
    expect(resolveDesign(doc()).sidebar?.entryGap).toBeCloseTo(2, 5);
    expect(resolveDesign(doc()).entryGap).toBe(6);
    expect(resolveDesign(doc({ templateId: 'T3' })).entryGap).toBe(6);
    expect(resolveDesign(doc({ templateId: 'T3' })).sidebar ?? null).toBeNull();
    expect(resolveDesign(doc({ templateId: 'T1' })).sidebar ?? null).toBeNull();
  });
  it('T-06 fonts Roboto, IBM Plex Sans, PT Serif (Roboto default); a split header with a localised contacts title', () => {
    const t4 = definitionOf('T4');
    expect(t4.fonts).toEqual(['roboto', 'ibm-plex-sans', 'pt-serif']);
    for (const font of t4.fonts) expect(DOCUMENT_FONTS[font]).toBeDefined();
    expect(resolveDesign(doc()).font.id).toBe('roboto');
    expect(t4.header.kind).toBe('split');
    expect(t4.header.contacts).toBe('list');
    expect(t4.header.photo).toMatchObject({ size: 80, radius: 40 });
    expect(t4.header.decor).toHaveLength(2);
    expect(resolveDesign(doc()).contactsTitle).toBe('Contact');
    expect(resolveDesign(doc({ language: 'es' })).contactsTitle).toBe('Contacto');
    expect(resolveDesign(doc({ language: 'uk' })).contactsTitle).toBe('Контакти');
    expect(resolveDesign(doc({ templateId: 'T1' })).contactsTitle ?? null).toBeNull();
    expect(t4.sectionRule).toMatchObject({ height: 0.75 });
    expect(t4.defaults).toMatchObject({ fontPreset: 'M', margin: 23, pageSize: 'A4', accentPreset: 0 });
  });
});
