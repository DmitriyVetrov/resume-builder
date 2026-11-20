import { describe, expect, it } from 'vitest';
import corpus from '../../../../../tests/fixtures/rich-text/corpus.json';
import { normalizeBlocks, plainText, type Block, type Inline } from '../../../entities/resume/rich-text';
import { isSafeUrl } from '../../../entities/resume/safe-url';
import { astToDoc, docToAst } from './convert';

const cases = corpus as unknown as { name: string; blocks: Block[] }[];
const t = (value: string, marks: Partial<Record<'bold' | 'italic' | 'underline', boolean>> = {}) => ({ kind: 'text' as const, value, bold: false, italic: false, underline: false, ...marks });

/** A seeded generator (DD-P09-09): a failure prints its seed and reproduces. */
function random(seed: number) {
  let state = seed;
  const next = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
  const words = ['a', ' ', 'word ', 'Ñandú', 'Їжак', 'Ľub', '😀', '<b>', '&amp;', '  x  ', '\t', 'long'.repeat(40)];
  const urls = ['https://a.invalid', 'http://b.invalid/x?y=1', 'mailto:p@e.invalid', 'tel:+34600'];
  const run = () => t(pick(words), { bold: next() < .4, italic: next() < .3, underline: next() < .2 });
  const inline = (): Inline => {
    const roll = next();
    if (roll < .15) return { kind: 'lineBreak' };
    if (roll < .35) return { kind: 'link', url: pick(urls), children: Array.from({ length: 1 + Math.floor(next() * 3) }, run) };
    return run();
  };
  const inlines = () => Array.from({ length: Math.floor(next() * 6) }, inline);
  const block = (): Block => next() < .6 ? { kind: 'paragraph', inlines: inlines() } : { kind: 'bulletList', items: Array.from({ length: 1 + Math.floor(next() * 3) }, inlines) };
  return { blocks: () => Array.from({ length: Math.floor(next() * 5) }, block), inlines };
}

function assertContractRules(blocks: Block[]) {
  const inlines = (items: Inline[]) => {
    let previous: Inline | undefined;
    for (const inline of items) {
      if (inline.kind === 'text') expect(inline.value.length).toBeGreaterThan(0);
      if (inline.kind === 'link') {
        expect(isSafeUrl(inline.url)).toBe(true);
        expect(inline.children.length).toBeGreaterThan(0);
        for (const child of inline.children) { expect(child.kind).toBe('text'); expect(child.value.length).toBeGreaterThan(0); }
      }
      if (previous?.kind === 'text' && inline.kind === 'text') expect([previous.bold, previous.italic, previous.underline]).not.toEqual([inline.bold, inline.italic, inline.underline]);
      previous = inline;
    }
  };
  for (const block of blocks) {
    if (block.kind === 'paragraph') inlines(block.inlines);
    else { expect(block.items.length).toBeGreaterThan(0); block.items.forEach(inlines); }
  }
}

describe('AST and engine document', () => {
  it.each(cases.map(item => [item.name, item.blocks] as const))('R01 corpus round trip: %s', (_name, blocks) => {
    expect(normalizeBlocks(blocks)).toEqual(blocks);
    expect(docToAst(astToDoc(blocks, 'block'), 'block')).toEqual(blocks);
  });

  it('R02 property: 500 seeded documents round-trip to their canonical form and obey the contract', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const generated = random(seed).blocks();
      const canonical = normalizeBlocks(generated);
      const round = docToAst(astToDoc(generated, 'block'), 'block');
      const expected = canonical.length === 1 && canonical[0]!.kind === 'paragraph' && canonical[0]!.inlines.length === 0 ? [] : canonical;
      expect(round, `seed ${seed}`).toEqual(expected);
      expect(plainText(round), `seed ${seed}`).toBe(plainText(generated));
      assertContractRules(round);
    }
  });

  it('R03 property: 500 seeded single paragraphs round-trip in the line and inline variants', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const paragraph: Block[] = [{ kind: 'paragraph', inlines: random(seed).inlines() }];
      const canonical = normalizeBlocks(paragraph);
      expect(docToAst(astToDoc(paragraph, 'line'), 'line'), `seed ${seed}`).toEqual(canonical);
      expect(docToAst(astToDoc(paragraph, 'inline'), 'inline'), `seed ${seed}`).toEqual(canonical);
    }
  });

  it('R04 a lone empty paragraph equals an empty block field, and a single-line field always has one paragraph', () => {
    expect(docToAst(astToDoc([{ kind: 'paragraph', inlines: [] }], 'block'), 'block')).toEqual([]);
    expect(docToAst(astToDoc([], 'block'), 'block')).toEqual([]);
    expect(docToAst(astToDoc([], 'inline'), 'inline')).toEqual([{ kind: 'paragraph', inlines: [] }]);
    expect(docToAst(astToDoc([], 'line'), 'line')).toEqual([{ kind: 'paragraph', inlines: [] }]);
  });

  it('R05 a line field takes only one paragraph even from a richer AST', () => {
    const doc = astToDoc([{ kind: 'paragraph', inlines: [t('a')] }, { kind: 'bulletList', items: [[t('b')]] }], 'line');
    expect(docToAst(doc, 'line')).toEqual([{ kind: 'paragraph', inlines: [t('a'), t(' '), t('b')] }].map(block => normalizeBlocks([block as Block])[0]));
  });
});
