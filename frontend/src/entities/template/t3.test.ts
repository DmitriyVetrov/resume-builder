// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { t3 } from './t3';

describe('T3 Sidebar, ADR-024', () => {
  it('D24 tokens', () => {
    expect(t3).toMatchObject({ id: 'T3', name: 'Sidebar', fonts: ['roboto', 'ibm-plex-sans', 'pt-serif'] });
    expect(t3.accents).toEqual([{ name: 'Navy', hex: '#2F4F6F' }, { name: 'Forest', hex: '#22584D' }, { name: 'Burgundy', hex: '#7A2E3A' }]);
    expect(t3.defaults).toEqual({ fontPreset: 'M', sectionSpacing: 10, entrySpacing: 10, lineSpacing: 1, margin: 23, pageSize: 'A4', accentPreset: 0 });
    expect(t3.styles.name).toEqual({ size: 24, bold: false, italic: false, upper: true, color: 'onAccent' });
    expect(t3.styles.headline).toEqual({ size: 11, bold: true, italic: false, upper: true, color: 'onAccent' });
    expect(t3.styles.contact).toEqual({ size: 9.5, bold: false, italic: false, upper: false, color: 'onAccent' });
    expect(t3.styles.sectionTitle).toEqual({ size: 12, bold: true, italic: false, upper: true, color: 'accent' });
    expect(t3.styles.body).toEqual({ size: 10, bold: false, italic: false, upper: false, color: 'ink' });
    expect(t3.styles.entryTitle).toEqual({ size: 11, bold: true, italic: false, upper: false, color: 'ink' });
    expect(t3.styles.entryOrganization).toEqual({ size: 10, bold: false, italic: false, upper: false, color: 'ink' });
    expect(t3.styles.entryDates).toEqual({ size: 10, bold: false, italic: true, upper: false, color: 'ink' });
    expect(t3.header).toMatchObject({ kind: 'band', photo: { size: 64, radius: 32 }, rule: null, contacts: 'band-line', icons: false });
    expect(t3.zones).toEqual({ main: 0.64, sidebar: 0.36, gutter: 16, defaults: { text: 'main', entries: 'main', list: 'sidebar', inline: 'sidebar' } });
    expect(t3.list.defaultColumns).toBe(1);
    expect(t3.entries).toMatchObject({ marker: 'none', defaultColumns: 1, timeline: null });
    expect(t3.gaps.sectionTitle).toBe(6);
    expect(t3.continuationTopExtra).toBe(8);
    expect(t3.link).toEqual({ color: 'accent', underline: false });
  });
});
