import { describe, expect, it } from 'vitest';
import { markupToInlines } from './markup';

/** IMP-01 M-01…M-05 (DD-IMP-06): the draft's three-tag markup to contract inlines, never through the DOM. */
const text = (value: string, marks: Partial<Record<'bold' | 'italic' | 'underline', boolean>> = {}) => ({ kind: 'text', value, bold: false, italic: false, underline: false, ...marks });

describe('draft markup', () => {
  it('M-01 bold, italic, nested, and links', () => {
    expect(markupToInlines('Led <b>twelve</b> teams, <i>remote</i> and <b><i>calm</i></b>.')).toEqual([text('Led '), text('twelve', { bold: true }), text(' teams, '), text('remote', { italic: true }), text(' and '), text('calm', { bold: true, italic: true }), text('.')]);
    expect(markupToInlines('See <a href="https://example.com/">example.com</a> now')).toEqual([text('See '), { kind: 'link', url: 'https://example.com/', children: [text('example.com')] }, text(' now')]);
    expect(markupToInlines('<a href="https://example.com/"><b>bold link</b></a>')).toEqual([{ kind: 'link', url: 'https://example.com/', children: [text('bold link', { bold: true })] }]);
  });

  it('M-02 unknown, unbalanced and script tags stay literal text', () => {
    expect(markupToInlines('<script>alert(1)</script>')).toEqual([text('<script>alert(1)</script>')]);
    expect(markupToInlines('a <b>b')).toEqual([text('a <b>b')]);
    expect(markupToInlines('x <u>y</u> z')).toEqual([text('x <u>y</u> z')]);
    expect(markupToInlines('<img src=x onerror=alert(1)>')).toEqual([text('<img src=x onerror=alert(1)>')]);
  });

  it('M-03 an unsafe href keeps the text and drops the link', () => {
    expect(markupToInlines('<a href="javascript:alert(1)">click</a>')).toEqual([text('click')]);
  });

  it('M-04 the four basic entities decode; others stay literal', () => {
    expect(markupToInlines('R&amp;D &lt;3 &gt; &quot;q&quot; &copy;')).toEqual([text('R&D <3 > "q" &copy;')]);
  });

  it('M-05 plain text is one run; empty text is no run', () => {
    expect(markupToInlines('Just text.')).toEqual([text('Just text.')]);
    expect(markupToInlines('')).toEqual([]);
  });
});
