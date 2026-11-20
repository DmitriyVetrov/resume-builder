// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ResumeDocument } from '../resume/operations';
import { layout } from './engine';
import type { Line, PageModel } from './page-model';
import { planStructure, type StructureNode } from './pdf-structure';
import { documentOf, entriesSection, entry, filler, fixture, listSection, paragraph, pageOfLine, testFonts, text, textSection } from './test-kit';

const fonts = testFonts();
const model = (document: ResumeDocument, photo = false) => layout(document, fonts, { photo, engineVersion: 'test' });
const words = (node: StructureNode) => node.lines.map(text).join(' ');
const tags = (node: StructureNode): string[] => node.children.map(child => child.tag);
const find = (node: StructureNode, tag: string): StructureNode[] => [...node.children.filter(child => child.tag === tag), ...node.children.flatMap(child => find(child, tag))];
const walk = (node: StructureNode): StructureNode[] => [node, ...node.children.flatMap(walk)];
const allLines = (result: PageModel) => result.pages.flatMap(page => page.lines);
const bullets = (count: number, lines: number) => ({ kind: 'bulletList' as const, items: Array.from({ length: count }, (_, index) => [{ kind: 'text' as const, value: Array.from({ length: lines }, (__, n) => `word${index}x${n}`).join(' ').repeat(lines > 1 ? 30 : 1), bold: false, italic: false, underline: false }]) });

describe('PDF tag plan, FR-PDF-08', () => {
  it('S01 header: H1, a P for the headline, one P for all contacts, and a Figure when a photo is placed', () => {
    const document = fixture('one-page');
    const { root, figure } = planStructure(model(document, true), document);
    expect(tags(root).slice(0, 4)).toEqual(['H1', 'P', 'P', 'Figure']);
    expect(words(root.children[0]!)).toContain('LUCÍA');
    expect(root.children[3]).toBe(figure);
    const bare = planStructure(model(document, false), document);
    expect(bare.figure).toBeNull();
    expect(tags(bare.root)).not.toContain('Figure');
  });
  it('S02 sections are in document order on T3, whatever the column', () => {
    const document = { ...fixture('four-pages'), templateId: 'T3' as const };
    const { root } = planStructure(model(document), document);
    const titles = find(root, 'H2').map(words);
    expect(titles).toEqual(document.sections.map(section => section.title.toUpperCase()));
    const sect = root.children.filter(child => child.tag === 'Sect');
    expect(sect).toHaveLength(document.sections.length);
    expect(sect[0]!.children[0]!.tag).toBe('H2');
  });
  it('S03 a list section gives L, LI, LBody per item, and two columns keep item order', () => {
    const items = [{ id: 'a', lines: 1 }, { id: 'b', lines: 1 }, { id: 'c', lines: 1 }];
    const document = documentOf([listSection('s', 'Skills', items, 2)]);
    const { root } = planStructure(model(document), document);
    const list = find(root, 'L');
    expect(list).toHaveLength(1);
    expect(tags(list[0]!)).toEqual(['LI', 'LI', 'LI']);
    expect(list[0]!.children.map(item => tags(item))).toEqual([['LBody'], ['LBody'], ['LBody']]);
    expect(find(list[0]!, 'LBody').map(body => body.lines.length)).toEqual([1, 1, 1]);
  });
  it('S04 a bullet or a paragraph crossing a page stays one element', () => {
    for (const fill of [40, 44, 48, 52, 56, 60, 64, 68]) {
      const document = documentOf([filler(fill), textSection('b', 'Body', [bullets(1, 12), paragraph(12, 'para')])]);
      const result = model(document);
      const { root } = planStructure(result, document);
      const section = root.children.filter(child => child.tag === 'Sect')[1]!;
      const items = find(section, 'LI');
      expect(items).toHaveLength(1);
      expect(find(section, 'P')).toHaveLength(1);
      const body = find(section, 'LBody')[0]!;
      const spans = new Set(body.lines.map(line => pageOfLine(result, line)));
      if (spans.size > 1) return;
    }
    throw new Error('No fill made the bullet cross a page');
  });
  it('S05 an entry is a nested Sect: H3, organization, one P for location and dates, then its description', () => {
    const description = [paragraph(1, 'about'), bullets(2, 1)];
    const document = documentOf([entriesSection('s', 'Work', [entry('e1', 'First', description), entry('e2', 'Second')])]);
    const { root } = planStructure(model(document), document);
    const section = root.children.find(child => child.tag === 'Sect')!;
    expect(tags(section)).toEqual(['H2', 'Sect', 'Sect']);
    const first = section.children[1]!;
    expect(tags(first)).toEqual(['H3', 'P', 'P', 'P', 'L']);
    expect(words(first.children[0]!)).toBe('FIRST');
    expect(words(first.children[1]!)).toBe('Org');
    expect(first.children[2]!.lines.length).toBe(2);
    expect(words(first.children[3]!)).toContain('about');
  });
  it('S06 every line of every page is in exactly one node', () => {
    for (const name of ['one-page', 'two-pages', 'four-pages', 'minimal', 'title-at-bottom', 'long-paragraph', 'long-bullet', 'many-rows', 'manual-break', 'oversized', 'rich-marks', 'contacts-heavy']) {
      for (const templateId of ['T1', 'T2', 'T3'] as const) {
        const document = { ...fixture(name), templateId };
        const result = model(document, true);
        const { root, nodeOf } = planStructure(result, document);
        const placed = walk(root).flatMap(node => node.lines);
        const lines = allLines(result);
        expect(placed.length, `${name} ${templateId}`).toBe(lines.length);
        expect(new Set(placed).size).toBe(lines.length);
        for (const line of lines) expect(nodeOf.get(line)?.lines, `${name} ${templateId}`).toContain(line);
      }
    }
  });
  it('S07 Line.block carries no geometry: stripping it leaves the page model the layout always had', () => {
    const document = fixture('four-pages');
    const result = model(document, true);
    const blocks = allLines(result).map((line: Line) => line.block);
    expect(blocks.some(block => block?.startsWith('p'))).toBe(true);
    expect(blocks.some(block => block?.startsWith('l'))).toBe(true);
    for (const line of allLines(result)) {
      expect(Object.keys(line).sort()).toEqual(['anchor', 'baseline', 'block', 'height', 'role', 'runs', 'width', 'x', 'y']);
    }
  });
});
