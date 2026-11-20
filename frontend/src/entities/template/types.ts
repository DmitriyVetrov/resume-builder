import type { components } from '../../shared/api/generated/schema';

type Schemas = components['schemas'];
export type FontPreset = Schemas['LayoutSettings']['fontPreset'];
export type PageSize = Schemas['LayoutSettings']['pageSize'];
export type StyleId = 'name' | 'headline' | 'contact' | 'sectionTitle' | 'body' | 'listItem' | 'entryTitle' | 'entryOrganization' | 'entryLocation' | 'entryDates';
/** `heading`, `muted`, `panel` and `tint` are ADR-054's; a template without them falls back to `ink` (and the panel and tint to white). */
export type ColorRole = 'ink' | 'accent' | 'onAccent' | 'heading' | 'muted' | 'panel' | 'tint';
export type TextStyle = { size: number; bold: boolean; italic: boolean; upper: boolean; color: ColorRole };
export type ListKind = 1 | 2 | 'chips';
export type Marker = { width: number; height: number; radius: number };
export type Chip = { fill: string; radius: number; paddingX: number; paddingY: number; gap: number };
/** An accent preset. `panel` and `tint` are the preset's sidebar panel fill and decoration fill (ADR-054). */
export type Accent = { name: string; hex: string; panel?: string; tint?: string };
/** ADR-054: how an entry's head is set. `classic` is T1–T3's; `title-dates` is "Title | dates" over "Organization · Location"; `compact` is the title over one muted line. */
export type EntryHead = 'classic' | 'title-dates' | 'compact';
type Gaps = { sectionTitle: number; paragraph: number; listRow: number; descriptionTop: number; descriptionRow: number; titleOrganization: number; columnGutter: number };
type Entries = {
  marker: 'timeline' | 'none' | 'dot'; defaultColumns: 1 | 2; indent: number; timeline: { x: number; width: number; dot: Marker; dotTop: number } | null;
  head?: EntryHead;
  /** The `dot` marker, at the column's left edge, centred on the first title row. */
  dot?: { size: number };
};
/** ADR-054: what differs in the sidebar zone, merged over the definition and resolved as the sidebar's own design. */
export type SidebarOverrides = { styles?: Partial<Record<StyleId, TextStyle>>; entries?: Partial<Entries>; gaps?: Partial<Gaps>; sectionRule?: SectionRule | null; entryGapFactor?: number };
/** ADR-054: a rule under every section title, across the column. */
export type SectionRule = { height: number; gap: number; color: ColorRole };

/**
 * FR-TPL-05: a template is data, design tokens plus layout rules, separate from content.
 * Sizes are the Medium preset in points (ADR-027 scales them). Plain JSON by design: no functions.
 */
export type TemplateDefinition = {
  id: string;
  name: string;
  accents: readonly [Accent, Accent, Accent];
  /** The first is the default (FR-LAY-08). */
  fonts: readonly [string, string, string];
  defaults: { fontPreset: FontPreset; sectionSpacing: number; entrySpacing: number; lineSpacing: number; margin: number; pageSize: PageSize; accentPreset: 0 };
  styles: Record<StyleId, TextStyle>;
  colors: { ink: string; line: string; onAccent: string; heading?: string; muted?: string };
  link: { color: ColorRole; underline: false };
  gaps: Gaps;
  sectionRule?: SectionRule | null;
  continuationTopExtra: number;
  /** ADR-054: the gap between entries is the layout's entry spacing times this (default 1). */
  entryGapFactor?: number;
  marker: Marker & { slot: number; top: number; color: ColorRole };
  header: {
    kind: 'plain' | 'band' | 'split';
    photo: { size: number; radius: number; gap: number } | null;
    rule: { height: number; color: 'line' | 'accent'; offset: number; contactGap: number } | null;
    contacts: 'separated' | 'chips' | 'band-line' | 'list';
    icons: boolean;
    chip: Chip | null;
    bandPadding: number;
    /** `split`: circles behind the photo, relative to the photo's box, filled with the preset's tint. */
    decor?: readonly { x: number; y: number; size: number }[];
    /** `split`: the title over the contacts, by document language. */
    contactsTitle?: Record<'en' | 'es' | 'uk', string>;
  };
  list: { defaultColumns: ListKind; oneColumnStyle: StyleId; indent: number; twoColumnIndent: number; chip: Chip | null };
  entries: Entries;
  text: { defaultColumns: 1 | 2 };
  zones: {
    main: number; sidebar: number; gutter: number; defaults: Record<'text' | 'entries' | 'list' | 'inline', 'main' | 'sidebar'>;
    /** Default `right` (T3). */
    side?: 'left' | 'right';
    /** A filled panel behind the sidebar on every page, inset by the page margins; the sidebar text keeps `padding` from its edges. */
    panel?: { padding: number };
    sidebarOverrides?: SidebarOverrides;
  } | null;
};
