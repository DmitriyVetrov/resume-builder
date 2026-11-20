// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { t2 } from './t2';

describe('T2 Compact, ADR-024', () => {
  it('X01 identity, fonts and defaults', () => {
    expect(t2).toMatchObject({ id: 'T2', name: 'Compact', fonts: ['ibm-plex-sans', 'roboto', 'pt-serif'] });
    expect(t2.defaults).toEqual({ fontPreset: 'M', sectionSpacing: 6, entrySpacing: 6, lineSpacing: 1, margin: 23, pageSize: 'A4', accentPreset: 0 });
  });
  it('X02 accents', () => {
    expect(t2.accents).toEqual([{ name: 'Teal', hex: '#0F6A5B' }, { name: 'Slate', hex: '#335776' }, { name: 'Plum', hex: '#6A4A9C' }]);
  });
  it('X03 accent roles: headline, organization, dates, header rule, links', () => {
    expect(t2.styles.headline.color).toBe('accent');
    expect(t2.styles.entryOrganization.color).toBe('accent');
    expect(t2.styles.entryDates.color).toBe('accent');
    expect(t2.header.rule).toMatchObject({ height: 1, color: 'accent' });
    expect(t2.link).toEqual({ color: 'accent', underline: false });
    for (const style of ['name', 'contact', 'sectionTitle', 'body', 'listItem', 'entryTitle', 'entryLocation'] as const) expect(t2.styles[style].color, style).toBe('ink');
  });
  it('X04 type styles', () => {
    expect(t2.styles.name).toEqual({ size: 22, bold: true, italic: false, upper: false, color: 'ink' });
    expect(t2.styles.headline).toEqual({ size: 11, bold: false, italic: false, upper: false, color: 'accent' });
    expect(t2.styles.contact).toEqual({ size: 9, bold: false, italic: false, upper: false, color: 'ink' });
    expect(t2.styles.sectionTitle).toEqual({ size: 11, bold: true, italic: false, upper: true, color: 'ink' });
    expect(t2.styles.body).toEqual({ size: 9.5, bold: false, italic: false, upper: false, color: 'ink' });
    expect(t2.styles.listItem).toEqual({ size: 9, bold: false, italic: false, upper: false, color: 'ink' });
    expect(t2.styles.entryTitle).toEqual({ size: 9.5, bold: true, italic: false, upper: true, color: 'ink' });
    expect(t2.styles.entryOrganization).toEqual({ size: 9.5, bold: false, italic: false, upper: false, color: 'accent' });
    expect(t2.styles.entryLocation).toEqual({ size: 9.5, bold: false, italic: false, upper: false, color: 'ink' });
    expect(t2.styles.entryDates).toEqual({ size: 9.5, bold: false, italic: false, upper: false, color: 'accent' });
  });
  it('X05 chips for contacts and lists, with icons', () => {
    const chip = { fill: '#E9EDF1', radius: 4, paddingX: 6, paddingY: 3, gap: 4 };
    expect(t2.header).toMatchObject({ kind: 'plain', contacts: 'chips', icons: true, chip });
    expect(t2.list).toMatchObject({ defaultColumns: 'chips', chip });
  });
  it('X06 no photo', () => {
    expect(t2.header.photo).toBeNull();
  });
  it('X07 single zone, no timeline', () => {
    expect(t2.zones).toBeNull();
    expect(t2.entries).toMatchObject({ marker: 'none', defaultColumns: 1, timeline: null });
  });
  it('X08 gaps and continuation', () => {
    expect(t2.gaps.sectionTitle).toBe(6);
    expect(t2.continuationTopExtra).toBe(8);
    expect(t2.colors).toMatchObject({ ink: '#050505' });
  });
});
