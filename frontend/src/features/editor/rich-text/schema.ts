import { Schema, type DOMOutputSpec, type MarkSpec, type NodeSpec } from 'prosemirror-model';
import { isSafeUrl, normalizeUrl } from '../../../entities/resume/safe-url';

export type RichTextVariant = 'block' | 'inline' | 'line';

const mark = (tag: string, also: MarkSpec['parseDOM'] = []): MarkSpec => ({
  parseDOM: [{ tag }, ...also],
  toDOM: (): DOMOutputSpec => [tag, 0],
});

/** Closed and equal to the contract AST (ADR-052): what is not here cannot enter the document. */
const marks: Record<string, MarkSpec> = {
  bold: mark('strong', [{ tag: 'b' }]),
  italic: mark('em', [{ tag: 'i' }]),
  underline: mark('u'),
  link: {
    attrs: { href: {} },
    inclusive: false,
    parseDOM: [{
      tag: 'a[href]',
      getAttrs: node => {
        const href = normalizeUrl((node as HTMLElement).getAttribute('href') ?? '');
        return href ? { href } : false;
      },
    }],
    toDOM: node => {
      const href = String(node.attrs.href);
      return ['a', isSafeUrl(href) ? { href, rel: 'noopener noreferrer nofollow' } : {}, 0];
    },
  },
};

function nodes(docContent: string): Record<string, NodeSpec> {
  return {
    doc: { content: docContent },
    paragraph: { content: 'inline*', group: 'block', parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
    bullet_list: { content: 'list_item+', group: 'block', parseDOM: [{ tag: 'ul' }, { tag: 'ol' }], toDOM: () => ['ul', 0] },
    list_item: { content: 'inline*', defining: true, parseDOM: [{ tag: 'li' }], toDOM: () => ['li', 0] },
    text: { group: 'inline' },
    hard_break: { inline: true, group: 'inline', selectable: false, marks: '', parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
  };
}

const blockSchema = new Schema({ nodes: nodes('block+'), marks });
const lineSchema = new Schema({ nodes: nodes('paragraph'), marks });

export const schemaFor = (variant: RichTextVariant) => variant === 'block' ? blockSchema : lineSchema;
