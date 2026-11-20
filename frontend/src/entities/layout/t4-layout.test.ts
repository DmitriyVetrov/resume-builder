// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { switchTemplate } from '../resume/design-operations';
import type { ResumeDocument, Section } from '../resume/operations';
import { anchorAt, canonicalHash, type FontBook, type Line, type PageModel, type Shape } from './index';
import { planStructure, type StructureNode } from './pdf-structure';
import { documentOf, entriesSection, entry, filler, fixture, lines, listSection, paragraph, run, run_, SWEEP, testFonts, text, textSection } from './test-kit';

/**
 * TPL-01, ADR-054: T4 "Panel" on the one engine. Geometry from the ADR's tokens on A4 with 23 pt margins:
 * content 549 pt; main 66 % = 362.34; sidebar 549 - 362.34 - 18 = 168.66 at the left margin; text inside the
 * panel's 10 pt padding.
 */
const MARGIN = 23;
const SIDEBAR = { x: 23, width: 168.66, textX: 33, textWidth: 148.66 };
const MAIN = { x: 209.66, width: 362.34 };
const PANEL = { x: 23, y: 23, width: 168.66, height: 842 - 46 };
const TEAL = '#157A95';
const NAVY = '#1F3446';
const MUTED = '#5B6673';

let fonts: FontBook;
beforeAll(() => { fonts = testFonts(); });
const go = (document: ResumeDocument, photo = true) => run_(document, fonts, photo);
const mirror = (name = 'panel-mirror') => fixture(name);
const byText = (model: PageModel, value: string) => lines(model).find(line => text(line) === value);
const role = (model: PageModel, name: Line['role']) => lines(model).filter(line => line.role === name);
const shapes = (model: PageModel, name: Shape['role']) => model.pages.flatMap(page => page.shapes.filter(shape => shape.role === name));
const inSidebar = (line: Line) => line.x >= SIDEBAR.textX - 0.01 && line.x < MAIN.x - 1;
const inMain = (line: Line) => line.x >= MAIN.x - 0.01;
const withContacts = (document: ResumeDocument) => ({ ...document, header: { ...document.header, contacts: mirror().header.contacts } });

describe('T4 Panel layout (ADR-054)', () => {
  it('L-01 zones: the sidebar column is at the left margin with the panel padding, main follows after the gutter', () => {
    const model = go(mirror());
    const summary = lines(model).find(line => line.anchor?.sectionId === mirror().sections[0]!.id)!;
    expect(summary.x).toBeCloseTo(MAIN.x, 2);
    const english = byText(model, 'English')!;
    expect(english.x).toBeCloseTo(SIDEBAR.textX, 2);
    for (const line of lines(model)) {
      if (inSidebar(line)) expect(line.x + line.width, text(line)).toBeLessThanOrEqual(SIDEBAR.textX + SIDEBAR.textWidth + 0.01);
      else expect(line.x + line.width, text(line)).toBeLessThanOrEqual(MAIN.x + MAIN.width + 0.01);
    }
  });
  it('L-02 the panel is the first shape on every page, from the top to the bottom margin, in the preset panel colour', () => {
    for (const [preset, fill] of [[0, '#F2F6F7'], [1, '#F2F5F9'], [2, '#F8F2F4']] as const) {
      const model = go({ ...mirror('panel-mirror-long'), accentPreset: preset });
      expect(model.pages.length).toBeGreaterThan(1);
      for (const page of model.pages) {
        const first = page.shapes[0]!;
        expect(first.role, `page ${page.number}`).toBe('panel');
        expect(first.fill).toBe(fill);
        expect(first.x).toBeCloseTo(PANEL.x, 2);
        expect(first.y).toBeCloseTo(PANEL.y, 2);
        expect(first.width).toBeCloseTo(PANEL.width, 2);
        expect(first.height).toBeCloseTo(PANEL.height, 2);
        expect(page.shapes.filter(shape => shape.role === 'panel')).toHaveLength(1);
      }
    }
  });
  it('L-03 split header: name and headline atop main; the localised contacts title and bulleted contacts atop the sidebar', () => {
    const model = go(mirror());
    const name = role(model, 'name')[0]!;
    expect(text(name)).toBe('Jonas EKWALL');
    expect(name.x).toBeCloseTo(MAIN.x, 2);
    expect(name.y).toBeCloseTo(MARGIN, 2);
    const headline = role(model, 'headline')[0]!;
    expect(text(headline)).toBe('DevOps / Platform Engineer');
    expect(headline.x).toBeCloseTo(MAIN.x, 2);
    expect(headline.y).toBeGreaterThan(name.y);
    expect(headline.runs[0]!.color).toBe(TEAL);
    const title = byText(model, 'CONTACT')!;
    expect(title).toBeDefined();
    expect(title.anchor?.sectionId ?? null).toBeNull();
    expect(title.x).toBeCloseTo(SIDEBAR.textX, 2);
    expect(title.runs[0]!.color).toBe(TEAL);
    const contacts = role(model, 'contact');
    expect(contacts.map(text)).toEqual(mirror().header.contacts.map(item => item.text));
    const markers = model.pages[0]!.shapes.filter(shape => shape.role === 'marker' && shape.x < MAIN.x);
    for (const line of contacts) {
      expect(line.y).toBeGreaterThan(title.y);
      expect(line.x).toBeGreaterThan(SIDEBAR.textX);
      expect(inSidebar(line)).toBe(true);
      expect(markers.some(marker => marker.y >= line.y && marker.y <= line.y + line.height && marker.fill === TEAL), text(line)).toBe(true);
    }
    expect(byText(go({ ...mirror(), language: 'es' }), 'CONTACTO')).toBeDefined();
    expect(byText(go({ ...mirror(), language: 'uk' }), 'КОНТАКТИ')).toBeDefined();
    const none = go({ ...mirror(), header: { ...mirror().header, contacts: [] } });
    expect(byText(none, 'CONTACT')).toBeUndefined();
    expect(role(none, 'contact')).toEqual([]);
  });
  it('L-04 the 80 pt round photo is centred in the sidebar with two tint circles behind it; none without a photo', () => {
    const model = go(mirror());
    const [image] = model.pages[0]!.images;
    expect(image).toMatchObject({ width: 80, height: 80, radius: 40 });
    expect(image!.x).toBeCloseTo(SIDEBAR.x + (SIDEBAR.width - 80) / 2, 2);
    expect(image!.y).toBeCloseTo(MARGIN + 10, 2);
    const decor = shapes(model, 'decor');
    expect(decor).toHaveLength(2);
    for (const circle of decor) {
      expect(circle.fill).toBe('#D3E9EF');
      expect(circle.radius).toBeCloseTo(circle.width / 2, 3);
      expect(circle.x).toBeGreaterThanOrEqual(PANEL.x);
      expect(circle.x + circle.width).toBeLessThanOrEqual(PANEL.x + PANEL.width);
    }
    const title = byText(model, 'CONTACT')!;
    expect(title.y).toBeGreaterThan(Math.max(...decor.map(circle => circle.y + circle.height), image!.y + 80));
    const bare = go(mirror(), false);
    expect(bare.pages[0]!.images).toEqual([]);
    expect(shapes(bare, 'decor')).toEqual([]);
    expect(byText(bare, 'CONTACT')!.y).toBeCloseTo(MARGIN + 10, 2);
  });
  it('L-05 a 0.75 pt rule under each section title, across its column: navy in main, accent in the sidebar', () => {
    const model = go(mirror());
    const rules = shapes(model, 'rule');
    const check = (title: string, x: number, width: number, fill: string) => {
      const line = byText(model, title)!;
      expect(line, title).toBeDefined();
      const rule = rules.find(shape => Math.abs(shape.x - x) < 0.01 && shape.y >= line.y + line.height - 0.01 && shape.y < line.y + line.height + 6)!;
      expect(rule, title).toBeDefined();
      expect(rule).toMatchObject({ height: 0.75, fill });
      expect(rule.width).toBeCloseTo(width, 2);
    };
    check('WORK EXPERIENCE', MAIN.x, MAIN.width, NAVY);
    check('LANGUAGES', SIDEBAR.textX, SIDEBAR.textWidth, TEAL);
    check('CONTACT', SIDEBAR.textX, SIDEBAR.textWidth, TEAL);
    // The untitled summary has no title, so no rule.
    const summaryTop = Math.min(...lines(model).filter(line => line.anchor?.sectionId === mirror().sections[0]!.id).map(line => line.y));
    expect(rules.filter(shape => shape.x >= MAIN.x - 0.01 && shape.y < summaryTop)).toEqual([]);
  });
  it('L-06 a main entry: accent dot, "Title | dates" on one baseline, then "Organization · Location" in italic muted', () => {
    const model = go(mirror());
    const title = byText(model, 'Platform Engineer & Founder')!;
    expect(title, 'the title as typed').toBeDefined();
    expect(title.role).toBe('entryTitle');
    expect(title.x).toBeGreaterThan(MAIN.x);
    const dates = byText(model, '| 2024 - Present')!;
    expect(dates.role).toBe('entryDates');
    expect(dates.baseline).toBeCloseTo(title.baseline, 3);
    expect(dates.x).toBeGreaterThan(title.x + title.width);
    expect(dates.runs.at(-1)!.color).toBe(TEAL);
    expect(dates.runs.at(-1)!.face).toBe('roboto/bold');
    const organization = byText(model, 'Self-employed · Lausanne, Switzerland')!;
    expect(organization.x).toBeCloseTo(title.x, 2);
    expect(organization.y).toBeGreaterThan(title.y);
    expect(organization.runs.every(item => item.color === MUTED && item.face === 'roboto/italic')).toBe(true);
    const dot = shapes(model, 'dot').find(shape => shape.y >= title.y && shape.y <= title.y + title.height)!;
    expect(dot).toBeDefined();
    expect(dot.fill).toBe(TEAL);
    expect(dot.x).toBeGreaterThanOrEqual(MAIN.x - 0.01);
    expect(dot.x + dot.width).toBeLessThan(title.x);
    expect(byText(model, 'Jan 2026 - May 2026')).toBeUndefined();
    expect(byText(model, '| Jan 2026 - May 2026')).toBeDefined();
  });
  it('L-07 a title too long for the row pushes the dates line to the next row', () => {
    const long = 'Principal Platform Reliability and Developer Experience Engineering Lead for Cloud';
    const document = documentOf([entriesSection('e', 'Work', [{ ...entry('a', long), organization: 'Org', location: 'Place' }])], 'T4');
    const model = go(document);
    const titles = role(model, 'entryTitle');
    const dates = role(model, 'entryDates')[0]!;
    const last = titles.at(-1)!;
    expect(dates.runs.map(item => item.text).join('').startsWith('| '), 'the dates line starts with its separator').toBe(true);
    const fitsBeside = last.x + last.width + 4 + dates.width <= MAIN.x + MAIN.width;
    if (fitsBeside) expect(dates.baseline).toBeCloseTo(last.baseline, 3);
    else { expect(dates.y).toBeGreaterThan(last.y); expect(dates.x).toBeCloseTo(last.x, 2); }
    const huge = documentOf([entriesSection('e', 'Work', [{ ...entry('a', `${long} ${long}`.slice(0, 150)), organization: 'Org', location: 'Place' }])], 'T4');
    const wrapped = go(huge);
    const wrappedDates = role(wrapped, 'entryDates')[0]!;
    const wrappedLast = role(wrapped, 'entryTitle').at(-1)!;
    expect(wrappedDates.y + 0.01 >= wrappedLast.y).toBe(true);
    expect(wrappedDates.x + wrappedDates.width).toBeLessThanOrEqual(MAIN.x + MAIN.width + 0.01);
  });
  it('L-08 a compact sidebar entry: no dot; the muted line carries organisation, location and dates; descriptions are muted', () => {
    const model = go(mirror());
    const english = byText(model, 'English')!;
    expect(english, 'the pair label as typed').toBeDefined();
    expect(english.role).toBe('entryTitle');
    expect(english.runs[0]!.color).toBe(NAVY);
    const fluent = byText(model, 'Fluent')!;
    expect(fluent.x).toBeCloseTo(SIDEBAR.textX, 2);
    expect(fluent.runs[0]!.color).toBe(MUTED);
    expect(fluent.y).toBeGreaterThan(english.y);
    // The muted line may wrap in the 148.66 pt column; its lines, joined, carry organisation and dates in order.
    const degree = (mirror().sections[4] as Extract<Section, { type: 'entries' }>).content.entries[2]!;
    expect(lines(model).filter(line => line.anchor?.entryId === degree.id && line.role === 'entryOrganization').map(text).join(' ')).toBe('B.Sc., Information Systems, 1999 - 2003');
    expect(shapes(model, 'dot').filter(shape => shape.x < MAIN.x - 1)).toEqual([]);
    const programme = lines(model).filter(line => line.anchor?.sectionId === mirror().sections[5]!.id && line.role === 'body');
    expect(programme.length).toBeGreaterThan(0);
    for (const line of programme) for (const item of line.runs.filter(part => !part.link)) expect(item.color).toBe(MUTED);
    expect(programme.flatMap(line => line.runs).find(item => item.link)!.color).toBe(TEAL);
  });
  it('L-09 the long mirror runs to two pages; the sidebar continues on page 2 at the continuation top, in its column', () => {
    const model = go(mirror('panel-mirror-long'));
    expect(model.pages).toHaveLength(2);
    const second = model.pages[1]!;
    const sidebarLines = second.lines.filter(inSidebar);
    expect(sidebarLines.length).toBeGreaterThan(0);
    expect(Math.min(...sidebarLines.map(line => line.y))).toBeCloseTo(MARGIN + 8, 2);
    expect(second.lines.filter(inMain).length).toBeGreaterThan(0);
    expect(second.lines.some(line => line.role === 'name' || line.role === 'contact')).toBe(false);
  });
  it('L-10 the header halves are two selection regions; a point on a contact or on the name selects the header', () => {
    const model = go(mirror());
    const page = model.pages[0]!;
    const header = page.regions.filter(region => region.sectionId === null);
    expect(header).toHaveLength(2);
    expect(header.some(region => Math.abs(region.x - MAIN.x) < 0.01)).toBe(true);
    expect(header.some(region => region.x < MAIN.x - 1)).toBe(true);
    const contact = role(model, 'contact')[2]!;
    expect(anchorAt(page, contact.x + 2, contact.y + 2)).toMatchObject({ sectionId: null });
    const name = role(model, 'name')[0]!;
    expect(anchorAt(page, name.x + 2, name.y + 2)).toMatchObject({ sectionId: null });
  });
  it('L-11 placement overrides: a list set to main sits in main; entries set to the sidebar are compact', () => {
    const skills = { ...listSection('l', 'Skills', [{ id: 'i1', lines: 1 }], null), placement: 'main' } as Section;
    const jobs = { ...entriesSection('e', 'Jobs', [entry('a', 'Role A')]), placement: 'sidebar' } as Section;
    const model = go(documentOf([skills, jobs], 'T4'));
    expect(lines(model).filter(line => line.anchor?.sectionId === 'l').every(inMain)).toBe(true);
    const role_ = byText(model, 'Role A')!;
    expect(inSidebar(role_)).toBe(true);
    expect(shapes(model, 'dot')).toEqual([]);
    expect(role(model, 'entryDates').filter(inSidebar)).toEqual([]);
  });
  it('L-12 tagged order is T3\'s: header (name, headline, contacts title, contacts), figure, then sections in document order', () => {
    const document = mirror();
    const plan = planStructure(go(document), document);
    const tags = plan.root.children.map(node => node.tag);
    expect(tags.slice(0, 5)).toEqual(['H1', 'P', 'P', 'P', 'Figure']);
    const firstText = (node: StructureNode) => node.lines.map(text).join(' ');
    expect(firstText(plan.root.children[0]!)).toBe('Jonas EKWALL');
    expect(firstText(plan.root.children[2]!)).toBe('CONTACT');
    expect(plan.root.children[3]!.lines.map(text)).toEqual(document.header.contacts.map(item => item.text));
    const sections = plan.root.children.slice(5);
    expect(sections.map(node => node.tag)).toEqual(document.sections.map(() => 'Sect'));
    expect(sections.map(node => node.lines[0]?.anchor?.sectionId ?? node.children[0]?.lines[0]?.anchor?.sectionId)).toEqual(document.sections.map(item => item.id));
  });
  it('L-13 contact and description links are link rectangles on the page', () => {
    const urls = go(mirror()).pages[0]!.links.map(link => link.url);
    for (const url of ['mailto:jonas.ekwall@example.invalid', 'https://example.invalid/in/jekwall', 'https://example.invalid/aurora', 'https://example.invalid/brightnote', 'https://example.invalid/kestrel', 'https://example.invalid/programme']) expect(urls, url).toContain(url);
  });
  it('L-14 the mirror fits one A4 page at Medium; T1 → T4 → T3 → T1 restores the hash; the result is deterministic', () => {
    expect(go(mirror()).pages).toHaveLength(1);
    const document = { ...mirror(), templateId: 'T1' as const };
    const first = canonicalHash(go(document));
    const back = switchTemplate(switchTemplate(switchTemplate(document, 'T4'), 'T3'), 'T1');
    expect(back).toEqual(document);
    expect(canonicalHash(go(back))).toBe(first);
    const t4 = switchTemplate(document, 'T4');
    expect(canonicalHash(go(t4))).toBe(canonicalHash(go(structuredClone(t4))));
    expect(canonicalHash(go(t4))).not.toBe(first);
  });
  it('L-15 sweep: no line passes the bottom margin or leaves its column, and the header halves stay on page 1 (PG-06)', () => {
    const contacts = withContacts(documentOf([], 'T4'));
    for (const count of SWEEP) {
      const document = { ...contacts, sections: [filler(count), { ...listSection('l', 'Skills', [{ id: 'i1', lines: 2 }, { id: 'i2', lines: 3 }], null) }, entriesSection('e', 'Jobs', [entry('a', 'Role', [{ kind: 'paragraph', inlines: [run('Some description text.')] }])])] } as ResumeDocument;
      const model = go(document);
      for (const page of model.pages) for (const line of page.lines) {
        expect(line.y + line.height, `${count}: ${text(line)}`).toBeLessThanOrEqual(page.height - MARGIN + 0.01);
        expect(inSidebar(line) || inMain(line), `${count}: ${text(line)}`).toBe(true);
      }
      const headerPages = model.pages.flatMap((page, index) => page.lines.some(line => line.anchor?.sectionId === null) ? [index] : []);
      expect(headerPages, `${count}`).toEqual([0]);
    }
  });
  // R1 review: a header half is measured against page 1's room, and only a half longer than that page breaks.
  const contactsOf = (count: number, length: number) => Array.from({ length: count }, (_, index) => ({ id: `c${index}`, text: `${'contact text '.repeat(16).slice(0, length - 3)} ${String(index).padStart(2, '0')}`, url: null, kind: 'other' as const }));
  const withLayout = (contacts: ReturnType<typeof contactsOf>, fontPreset: 'S' | 'M' | 'L', lineSpacing: number) => {
    const base = documentOf([textSection('t', 'Text', [paragraph(2)])], 'T4');
    return { ...base, layout: { ...base.layout, fontPreset, lineSpacing }, header: { ...base.header, fullName: 'Alex Sample', headline: 'Platform Engineer', contacts } } as ResumeDocument;
  };
  const headerHints = (model: PageModel) => model.hints.filter(hint => hint.kind === 'oversized' && hint.sectionId === null);
  it('L-16 contract maximum (20 contacts of 200 characters, L, spacing 20): the sidebar half breaks between lines with the hint on every page it covers (PG-09 over PG-06, ADR-010 §10); the main half stays whole on page 1', () => {
    const model = go(withLayout(contactsOf(20, 200), 'L', 20));
    expect(model.pages.length).toBeGreaterThan(1);
    const contactPages = model.pages.flatMap((page, index) => page.lines.some(line => line.role === 'contact') ? [index + 1] : []);
    expect(contactPages.length).toBeGreaterThan(1);
    for (const page of model.pages) for (const line of page.lines.filter(item => item.role === 'contact')) {
      expect(line.y + line.height, text(line)).toBeLessThanOrEqual(page.height - MARGIN + 0.01);
      expect(inSidebar(line), text(line)).toBe(true);
    }
    expect(headerHints(model).map(hint => hint.page)).toEqual(contactPages);
    for (const name of ['name', 'headline'] as const) {
      expect(model.pages[0]!.lines.some(line => line.role === name), name).toBe(true);
      expect(model.pages.slice(1).flatMap(page => page.lines).some(line => line.role === name), name).toBe(false);
    }
  });
  it('L-17 a sidebar half taller than a continuation page but within page 1 stays whole on page 1 with no hint (PG-06)', () => {
    for (const [preset, spacing, count, length] of [['S', 12, 10, 170], ['S', 12, 10, 190], ['S', 15, 15, 90], ['S', 15, 15, 120], ['S', 20, 13, 90]] as const) {
      const label = `${preset} ${spacing} ${count}x${length}`;
      const model = go(withLayout(contactsOf(count, length), preset, spacing));
      expect(model.pages.slice(1).some(page => page.lines.some(line => line.role === 'contact')), label).toBe(false);
      expect(headerHints(model), label).toEqual([]);
    }
  });
});
