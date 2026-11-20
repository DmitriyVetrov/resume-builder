import { describe, expect, it, vi } from 'vitest';
import clipboard from '../../../../../tests/fixtures/rich-text/clipboard.json';
import type { Block, Inline } from '../../../entities/resume/rich-text';
import { htmlToBlocks, plainTextToBlocks } from './clipboard';

const fixtures = clipboard as unknown as { name: string; html: string; blocks: Block[] }[];
const t = (value: string, marks: Partial<Record<'bold' | 'italic' | 'underline', boolean>> = {}) => ({ kind: 'text' as const, value, bold: false, italic: false, underline: false, ...marks });
const p = (...inlines: Inline[]): Block => ({ kind: 'paragraph', inlines });
const ul = (...items: Inline[][]): Block => ({ kind: 'bulletList', items });

describe('clipboard reader', () => {
  it.each(fixtures.map(item => [item.name, item.html, item.blocks] as const))('P01 %s keeps only what the AST can hold', (_name, html, blocks) => {
    expect(htmlToBlocks(html)).toEqual(blocks);
  });

  it('P02b resource-bearing tags are gone before the parser sees the HTML, so nothing can fetch', () => {
    const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');
    const html = '<p>keep</p><img src="https://t.invalid/a.png"><IMG/src=x><iframe src="https://t.invalid"></iframe><video poster="https://t.invalid/v"><source src="https://t.invalid/s"></video><link rel="stylesheet" href="https://t.invalid/c"><object data="https://t.invalid/o"></object><embed src="https://t.invalid/e"><audio src="https://t.invalid/m"></audio><body background="https://t.invalid/b"><input type="image" src="https://t.invalid/i"><base href="https://t.invalid/"><svg><image href="https://t.invalid/g"></image></svg>';
    expect(htmlToBlocks(html)).toEqual([p(t('keep'))]);
    const parsed = String(parse.mock.calls[0]?.[0]);
    parse.mockRestore();
    expect(parsed).not.toMatch(/t\.invalid/);
    expect(parsed).not.toMatch(/src=x/i);
  });

  it('P02 hostile HTML runs nothing while parsing', () => {
    const before = document.querySelectorAll('*').length;
    htmlToBlocks(fixtures.find(item => item.name === 'hostile')!.html);
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    expect(document.querySelectorAll('*').length).toBe(before);
  });

  it.each([
    ['<p><span style="font-weight:600">a</span><span style="font-weight:500">b</span><span style="font-weight:bolder">c</span></p>', [p(t('a', { bold: true }), t('b'), t('c', { bold: true }))]],
    ['<p><b><span style="font-weight:normal">a</span>b</b></p>', [p(t('a'), t('b', { bold: true }))]],
    ['<p><span style="font-style:oblique">a</span><span style="text-decoration:underline overline">b</span></p>', [p(t('a', { italic: true }), t('b', { underline: true }))]],
    ['<p style="color:red;font-size:40px;font-family:Impact">styled</p>', [p(t('styled'))]],
    ['<p><a href="https://a.invalid"><u>x</u></a></p>', [p({ kind: 'link', url: 'https://a.invalid', children: [t('x')] })]],
    ['<p>a<br><br></p>', [p(t('a'))]],
    ['<p>  many   spaces\n here </p>', [p(t('many spaces here'))]],
    ['<p>&nbsp;</p><p><br></p><p>x</p>', [p(t('x'))]],
  ] as const)('P03 %s', (html, blocks) => {
    expect(htmlToBlocks(html)).toEqual(blocks);
  });

  it('P04 plain text: bullets by prefix, numbers stay text, blank lines separate', () => {
    expect(plainTextToBlocks('Intro\n- one\n* two\n• three\n· four\n\n1. kept\nlast')).toEqual([p(t('Intro')), ul([t('one')], [t('two')], [t('three')], [t('four')]), p(t('1. kept')), p(t('last'))]);
    expect(plainTextToBlocks('a\r\nb')).toEqual([p(t('a')), p(t('b'))]);
    expect(plainTextToBlocks('')).toEqual([]);
  });
});
