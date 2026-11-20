import { describe, expect, it } from 'vitest';
import { isSafeUrl, normalizeUrl } from './safe-url';
import { codePointLength, normalizeBlocks, normalizeInlines, plainText, type Block, type Inline } from './rich-text';

const t = (value: string, marks: Partial<Record<'bold' | 'italic' | 'underline', boolean>> = {}) => ({ kind: 'text' as const, value, bold: false, italic: false, underline: false, ...marks });
const p = (...inlines: Inline[]): Block => ({ kind: 'paragraph', inlines });
const link = (url: string, ...children: ReturnType<typeof t>[]): Inline => ({ kind: 'link', url, children });

describe('canonical rich text', () => {
  it('N01 drops empty runs and links and merges equal neighbours', () => {
    expect(normalizeInlines([t(''), t('a'), t('b'), t('c', { bold: true }), t('', { bold: true }), t('d', { bold: true }), t('e')])).toEqual([t('ab'), t('cd', { bold: true }), t('e')]);
    expect(normalizeInlines([link('https://a.invalid', t('')), t('x')])).toEqual([t('x')]);
    expect(normalizeInlines([link('https://a.invalid', t('a'), t('b')), link('https://a.invalid', t('c', { bold: true }))])).toEqual([link('https://a.invalid', t('ab'), t('c', { bold: true }))]);
    expect(normalizeInlines([link('https://a.invalid', t('a')), link('https://b.invalid', t('b'))])).toHaveLength(2);
    expect(normalizeInlines([t('a'), { kind: 'lineBreak' }, t('b')])).toHaveLength(3);
  });

  it('N02 merges adjacent bullet lists and keeps paragraphs, including empty ones between', () => {
    const list = (...items: Inline[][]): Block => ({ kind: 'bulletList', items });
    expect(normalizeBlocks([list([t('a')]), list([t('b')])])).toEqual([list([t('a')], [t('b')])]);
    expect(normalizeBlocks([p(t('a')), p(), p(t('b'))])).toEqual([p(t('a')), p(), p(t('b'))]);
    expect(normalizeBlocks([list([t('a')], [])])).toEqual([list([t('a')], [])]);
  });

  it('N03 is idempotent and never changes the plain text', () => {
    const messy: Block[] = [p(t('a'), t(''), t('b', { italic: true }), t('c', { italic: true })), { kind: 'bulletList', items: [[t('x'), t('y')]] }, { kind: 'bulletList', items: [[link('https://a.invalid', t('z'))]] }];
    const once = normalizeBlocks(messy);
    expect(normalizeBlocks(once)).toEqual(once);
    expect(plainText(once)).toBe(plainText(messy));
    expect(plainText(once)).toBe('abc\nxy\nz');
  });

  it('N04 counts code points', () => {
    expect(codePointLength('😀a')).toBe(2);
    expect(codePointLength('Ľ')).toBe(1);
  });

  it.each([
    ['https://example.invalid/a', 'https://example.invalid/a'],
    ['  http://example.invalid ', 'http://example.invalid'],
    ['HTTPS://Example.invalid/Path', 'https://Example.invalid/Path'],
    ['MAILTO:person@example.invalid', 'mailto:person@example.invalid'],
    ['tel:+34600', 'tel:+34600'],
    ['example.invalid', 'https://example.invalid'],
    ['www.example.invalid/x?y=1', 'https://www.example.invalid/x?y=1'],
    ['person@example.invalid', 'mailto:person@example.invalid'],
    ['+34 600 123 456', 'tel:+34600123456'],
    ['javascript:alert(1)', null],
    ['JaVaScRiPt:alert(1)', null],
    ['data:text/html,x', null],
    ['vbscript:x', null],
    ['file:///etc/passwd', null],
    ['ftp://example.invalid', null],
    ['not a url', null],
    ['https://exa mple.invalid', null],
    ['', null],
    ['https://example.invalid/\u0007', null],
    [`https://example.invalid/${'x'.repeat(2048)}`, null],
  ])('N05 normalizeUrl(%j) is %j', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
    if (expected) expect(isSafeUrl(expected)).toBe(true);
  });

  it('N06 isSafeUrl is the contract pattern: a lower-case allowed scheme and no whitespace', () => {
    expect(isSafeUrl('https://a.invalid')).toBe(true);
    expect(isSafeUrl('HTTPS://a.invalid')).toBe(false);
    expect(isSafeUrl('javascript:x')).toBe(false);
    expect(isSafeUrl('https://a b.invalid')).toBe(false);
  });
});
