import type { ResumeDocument, Section } from '../resume/operations';
import { DOCUMENT_FONTS, type DocumentFont } from './fonts';
import { t1 } from './t1';
import { t2 } from './t2';
import { t3 } from './t3';
import { t4 } from './t4';
import type { ColorRole, FontPreset, ListKind, StyleId, TemplateDefinition, TextStyle } from './types';

export type { ColorRole, ListKind, StyleId, TemplateDefinition, TextStyle } from './types';
export { COVERAGE_FALLBACK, DOCUMENT_FONTS, FONT_FACES, type DocumentFont, type FontFace } from './fonts';

export const TEMPLATES: readonly TemplateDefinition[] = [t1, t2, t3, t4];

export type ResolvedStyle = Omit<TextStyle, 'color'> & { lineHeight: number; color: string };
export type ResolvedDesign = {
  definition: TemplateDefinition;
  accent: string;
  accentName: string;
  font: DocumentFont;
  fontOptions: readonly DocumentFont[];
  styles: Record<StyleId, ResolvedStyle>;
  sectionSpaceAbove: number;
  entryGap: number;
  link: { color: string; underline: false };
  marker: TemplateDefinition['marker'] & { fill: string };
  photo: TemplateDefinition['header']['photo'];
  /** Every colour role resolved for this document's accent preset (ADR-054). */
  colors: Record<ColorRole, string>;
  /** ADR-054: the sidebar zone's own design when the template overrides it; null when the sidebar uses this design. */
  sidebar: ResolvedDesign | null;
  /** ADR-054: the split header's title over the contacts, in the document's language; null when the template has none. */
  contactsTitle: string | null;
  sectionRule: { height: number; gap: number; fill: string } | null;
  page: { width: number; height: number; margins: { top: number; right: number; bottom: number; left: number }; contentWidth: number; continuationTop: number };
};

const PAGE_SIZES = { A4: { width: 595, height: 842 }, Letter: { width: 612, height: 792 } } as const;
/** Tenths, so a factor cannot pick up a binary rounding error before the 0.5 pt step (ADR-027). */
const PRESET_TENTHS: Record<FontPreset, number> = { S: 9, M: 10, L: 12 };

export function definitionOf(id: string): TemplateDefinition {
  return TEMPLATES.find(template => template.id === id) ?? t1;
}

function luminance(hex: string) {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio against white. */
export const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

/** ADR-027: the Medium size times the factor, to the nearest 0.5 pt. */
export function scaledSize(size: number, preset: FontPreset): number {
  return Math.round((size * PRESET_TENTHS[preset] * 2) / 10) / 2;
}

/** FR-LAY-04, ADR-028. */
export const lineHeightOf = (size: number, lineSpacing: number) => Math.round(size * 1.2) + lineSpacing * 0.5;

/** FR-SEC-11, DD-P10-05, DD-P10-08: keyed on the section type; an explicit value always wins. */
export function listColumnsFor(section: Section, definition: TemplateDefinition): ListKind {
  if (section.listColumns) return section.listColumns;
  if (section.type === 'list') return definition.list.defaultColumns;
  if (section.type === 'entries') return definition.entries.defaultColumns;
  return definition.text.defaultColumns;
}

/** ADR-025. `null` for a single-zone template, which ignores the field and keeps it. */
export function placementFor(section: Section, definition: TemplateDefinition): 'main' | 'sidebar' | null {
  if (!definition.zones) return null;
  return section.placement ?? definition.zones.defaults[section.type];
}

export function resolveDesign(document: ResumeDocument, definition: TemplateDefinition = definitionOf(document.templateId)): ResolvedDesign {
  const { layout } = document;
  const accent = definition.accents[document.accentPreset] ?? definition.accents[0];
  const colorOf = (role: ColorRole): string => {
    switch (role) {
      case 'accent': return accent.hex;
      case 'panel': return accent.panel ?? '#FFFFFF';
      case 'tint': return accent.tint ?? '#FFFFFF';
      case 'heading': return definition.colors.heading ?? definition.colors.ink;
      case 'muted': return definition.colors.muted ?? definition.colors.ink;
      default: return definition.colors[role];
    }
  };
  const roles: ColorRole[] = ['ink', 'accent', 'onAccent', 'heading', 'muted', 'panel', 'tint'];
  const styles = Object.fromEntries((Object.entries(definition.styles) as [StyleId, TextStyle][]).map(([id, style]) => {
    const size = scaledSize(style.size, layout.fontPreset);
    return [id, { ...style, size, lineHeight: lineHeightOf(size, layout.lineSpacing), color: colorOf(style.color) }];
  })) as Record<StyleId, ResolvedStyle>;
  const { width, height } = PAGE_SIZES[layout.pageSize];
  const margins = { ...layout.margins };
  const fontId = layout.bodyFont && definition.fonts.includes(layout.bodyFont) ? layout.bodyFont : definition.fonts[0];
  return {
    definition,
    accent: accent.hex,
    accentName: accent.name,
    font: DOCUMENT_FONTS[fontId] as DocumentFont,
    fontOptions: definition.fonts.map(id => DOCUMENT_FONTS[id] as DocumentFont),
    styles,
    sectionSpaceAbove: 10 + layout.sectionSpacing,
    entryGap: definition.entryGapFactor === undefined ? layout.entrySpacing : layout.entrySpacing * definition.entryGapFactor,
    link: { color: colorOf(definition.link.color), underline: false },
    marker: { ...definition.marker, fill: colorOf(definition.marker.color) },
    photo: definition.header.photo,
    colors: Object.fromEntries(roles.map(role => [role, colorOf(role)])) as Record<ColorRole, string>,
    sidebar: sidebarDesign(document, definition),
    contactsTitle: definition.header.contactsTitle?.[document.language] ?? null,
    sectionRule: definition.sectionRule ? { height: definition.sectionRule.height, gap: definition.sectionRule.gap, fill: colorOf(definition.sectionRule.color) } : null,
    page: { width, height, margins, contentWidth: width - margins.left - margins.right, continuationTop: margins.top + definition.continuationTopExtra },
  };
}

/** ADR-054: the sidebar's overrides merged over the definition, resolved as a design of their own. */
function sidebarDesign(document: ResumeDocument, definition: TemplateDefinition): ResolvedDesign | null {
  if (!definition.zones?.sidebarOverrides) return null;
  const { sidebarOverrides: overrides, ...zones } = definition.zones;
  return resolveDesign(document, {
    ...definition,
    styles: { ...definition.styles, ...overrides.styles },
    entries: { ...definition.entries, ...overrides.entries },
    gaps: { ...definition.gaps, ...overrides.gaps },
    sectionRule: overrides.sectionRule === undefined ? definition.sectionRule ?? null : overrides.sectionRule,
    ...(overrides.entryGapFactor === undefined ? {} : { entryGapFactor: overrides.entryGapFactor }),
    zones,
  });
}
