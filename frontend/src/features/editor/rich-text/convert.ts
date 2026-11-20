import type { Mark, Node as PmNode, Schema } from 'prosemirror-model';
import { normalizeBlocks, normalizeInlines, type Block, type Inline, type TextRun } from '../../../entities/resume/rich-text';
import { schemaFor, type RichTextVariant } from './schema';

function runMarks(schema: Schema, run: TextRun, url: string | null): Mark[] {
  const marks: Mark[] = [];
  if (run.bold) marks.push(schema.marks.bold!.create());
  if (run.italic) marks.push(schema.marks.italic!.create());
  if (run.underline) marks.push(schema.marks.underline!.create());
  if (url) marks.push(schema.marks.link!.create({ href: url }));
  return marks;
}

function inlineNodes(schema: Schema, inlines: readonly Inline[]): PmNode[] {
  return normalizeInlines(inlines).flatMap(inline => {
    if (inline.kind === 'lineBreak') return [schema.nodes.hard_break!.create()];
    if (inline.kind === 'text') return [schema.text(inline.value, runMarks(schema, inline, null))];
    return inline.children.map(child => schema.text(child.value, runMarks(schema, child, inline.url)));
  });
}

const SPACE: TextRun = { kind: 'text', value: ' ', bold: false, italic: false, underline: false };

/** A single-line field holds one paragraph; a richer AST is flattened into it with spaces between lines. */
export function flattenToLine(blocks: readonly Block[]): Inline[] {
  const lines = blocks.flatMap(block => block.kind === 'paragraph' ? [block.inlines] : block.items).filter(line => line.length > 0);
  return normalizeInlines(lines.flatMap((line, index) => index === 0 ? line : [SPACE, ...line]));
}

export function astToDoc(blocks: readonly Block[], variant: RichTextVariant): PmNode {
  const schema = schemaFor(variant);
  if (variant !== 'block') return schema.nodes.doc!.create(null, schema.nodes.paragraph!.create(null, inlineNodes(schema, flattenToLine(blocks))));
  const children = normalizeBlocks(blocks).map(block => block.kind === 'paragraph'
    ? schema.nodes.paragraph!.create(null, inlineNodes(schema, block.inlines))
    : schema.nodes.bullet_list!.create(null, block.items.map(item => schema.nodes.list_item!.create(null, inlineNodes(schema, item)))));
  return schema.nodes.doc!.create(null, children.length ? children : schema.nodes.paragraph!.create());
}

function textblockInlines(node: PmNode): Inline[] {
  const result: Inline[] = [];
  node.forEach(child => {
    if (child.type.name === 'hard_break') { result.push({ kind: 'lineBreak' }); return; }
    const has = (name: string) => child.marks.some(mark => mark.type.name === name);
    const run: TextRun = { kind: 'text', value: child.text ?? '', bold: has('bold'), italic: has('italic'), underline: has('underline') };
    const link = child.marks.find(mark => mark.type.name === 'link');
    result.push(link ? { kind: 'link', url: String(link.attrs.href), children: [run] } : run);
  });
  return normalizeInlines(result);
}

export function docToAst(doc: PmNode, variant: RichTextVariant): Block[] {
  const blocks: Block[] = [];
  doc.forEach(node => {
    if (node.type.name === 'paragraph') blocks.push({ kind: 'paragraph', inlines: textblockInlines(node) });
    else {
      const items: Inline[][] = [];
      node.forEach(item => { items.push(textblockInlines(item)); });
      blocks.push({ kind: 'bulletList', items });
    }
  });
  const only = blocks[0];
  // In a block field a lone empty paragraph is the engine's way of saying "nothing here".
  if (variant === 'block' && blocks.length === 1 && only?.kind === 'paragraph' && only.inlines.length === 0) return [];
  return blocks;
}
