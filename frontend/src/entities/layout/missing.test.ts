// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ResumeDocument } from '../resume/operations';
import { layout } from './engine';
import { missingCharacters } from './missing';
import { documentOf, testFonts, textSection } from './test-kit';

const fonts = testFonts();
const FACES = ['regular', 'italic', 'bold', 'bold-italic'];
const withBody = (value: string, bodyFont: string | null = null): ResumeDocument => {
  const document = documentOf([textSection('s', 'Body', [{ kind: 'paragraph', inlines: [{ kind: 'text', value, bold: false, italic: false, underline: false }] }])]);
  return { ...document, layout: { ...document.layout, bodyFont } };
};
const missing = (document: ResumeDocument, limit?: number) => missingCharacters(layout(document, fonts, { photo: false, engineVersion: 'test' }), fonts, limit);
const uncovered = (font: string, from: number, to: number) => {
  const out = new Set<number>();
  for (const face of FACES) for (let code = from; code <= to; code++) if (!fonts.font(`${font}/${face}`).hasGlyphForCodePoint(code)) out.add(code);
  return [...out];
};
const hex = (codes: number[]) => codes.map(code => code.toString(16));
const LANGUAGES = {
  spanish: 'abcdefghijklmnñopqrstuvwxyzáéíóúüABCDEFGHIJKLMNÑOPQRSTUVWXYZÁÉÍÓÚÜ¿¡€',
  ukrainian: 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюяАБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ’',
  slovak: 'aáäbcčdďdzeéfghiíjklĺľmnňoóôpqrŕsštťuúvwxyýzžAÁÄBCČDĎEÉFGHIÍJKLĹĽMNŇOÓÔPQRŔSŠTŤUÚVWXYÝZŽ',
  separators: '•—–|…·',
};

const runsOf = (document: ResumeDocument, needle: string) => layout(document, fonts, { photo: false, engineVersion: 'test' }).pages.flatMap(page => page.lines).filter(line => line.role === 'body' && line.runs.map(run => run.text).join('').includes(needle))[0]!;

describe('characters outside the font, DD-P12-07, DD-P12-22', () => {
  it('M01 reports emoji and CJK once each, by code point', () => {
    expect(missing(withBody('Ok 😀 漢 😀 字 🎉')).characters).toEqual(['😀', '漢', '字', '🎉']);
    expect(missing(withBody('😀')).more).toBe(0);
  });
  it('M02 ignores covered, space and default-ignorable characters, and caps the list', () => {
    expect(missing(withBody('Lucía Ґанна Šťastná​‍­️ ')).characters).toEqual([]);
    const result = missing(withBody('一二三四五六七八九十百千'), 10);
    expect(result.characters).toHaveLength(10);
    expect(result.more).toBe(2);
  });
  it('M03 Spanish, Ukrainian and Slovak are on all twelve faces (NFR-07)', () => {
    for (const font of ['roboto', 'ibm-plex-sans', 'pt-serif']) for (const face of FACES) for (const [language, letters] of Object.entries(LANGUAGES)) {
      const absent = Array.from(letters).filter(letter => !fonts.font(`${font}/${face}`).hasGlyphForCodePoint(letter.codePointAt(0)!));
      expect(absent, `${font}/${face} ${language}`).toEqual([]);
    }
  });
  it('M04 PT Serif itself lacks exactly the recorded letters; the fallback covers them, so nothing is reported (DD-P12-22)', () => {
    expect(hex(uncovered('pt-serif', 0xa1, 0x17f))).toEqual(['10a', '10b', '114', '115', '120', '121', '128', '129', '12c', '12d', '132', '133', '138', '13f', '140', '149', '14a', '14b', '14e', '14f', '166', '167', '168', '169', '174', '175', '176', '177']);
    expect(hex(uncovered('pt-serif', 0x400, 0x45f))).toEqual(['400', '40d', '450', '45d']);
    expect(missing(withBody('Ŵales', 'pt-serif')).characters).toEqual([]);
    expect(missing(withBody('Ŵales', 'roboto')).characters).toEqual([]);
  });
  it('M06 on PT Serif, every letter of Latin-1, Latin Extended-A and basic Cyrillic has a glyph, on every style (NFR-07)', () => {
    const letters = [[0xa1, 0x17f], [0x400, 0x45f]].flatMap(([from, to]) => Array.from({ length: to! - from! + 1 }, (_, index) => String.fromCodePoint(from! + index)));
    const paragraphOf = (marks: Record<string, boolean>) => ({ kind: 'paragraph', inlines: [{ kind: 'text', value: letters.join(' '), bold: false, italic: false, underline: false, ...marks }] });
    const document = documentOf([textSection('s', 'Body', [paragraphOf({}), paragraphOf({ bold: true }), paragraphOf({ italic: true }), paragraphOf({ bold: true, italic: true })])]);
    expect(missing({ ...document, layout: { ...document.layout, bodyFont: 'pt-serif' } }).characters).toEqual([]);
  });
  it('M07 a gap letter takes the fallback in the same style, and only that letter does', () => {
    const line = runsOf(withBody('Good Ŵales end', 'pt-serif'), 'Ŵ');
    expect(line.runs.map(run => [run.text, run.face])).toEqual([['Good ', 'pt-serif/regular'], ['Ŵ', 'roboto/regular'], ['ales end', 'pt-serif/regular']]);
    const bold = documentOf([textSection('s', 'Body', [{ kind: 'paragraph', inlines: [{ kind: 'text', value: 'aЍb', bold: true, italic: true, underline: false }] }])]);
    expect(runsOf({ ...bold, layout: { ...bold.layout, bodyFont: 'pt-serif' } }, 'Ѝ').runs.map(run => run.face)).toEqual(['pt-serif/bold-italic', 'roboto/bold-italic', 'pt-serif/bold-italic']);
    expect(runsOf(withBody('Good Ŵales end', 'roboto'), 'Ŵ').runs).toHaveLength(1);
    expect(runsOf(withBody('Good Ŵales end', 'ibm-plex-sans'), 'Ŵ').runs).toHaveLength(1);
  });
  it('M08 a line that starts with a gap letter sits on the same baseline as any other line of its style', () => {
    const a = runsOf(withBody('Ŵales', 'pt-serif'), 'ales');
    const b = runsOf(withBody('Wales', 'pt-serif'), 'ales');
    expect(a.baseline).toBe(b.baseline);
  });
  it('M09 a character neither font has stays in the document font and is reported', () => {
    const line = runsOf(withBody('Hi 😀 there', 'pt-serif'), 'Hi');
    expect(line.runs).toHaveLength(1);
    expect(line.runs[0]!.face).toBe('pt-serif/regular');
    expect(missing(withBody('Hi 😀 there', 'pt-serif')).characters).toEqual(['😀']);
  });
  it('M05 Roboto and IBM Plex Sans cover Latin-1, Latin Extended-A and basic Cyrillic on all faces', () => {
    for (const font of ['roboto', 'ibm-plex-sans']) {
      expect(uncovered(font, 0xa1, 0x17f), font).toEqual([]);
      expect(uncovered(font, 0x400, 0x45f), font).toEqual([]);
    }
  });
});
