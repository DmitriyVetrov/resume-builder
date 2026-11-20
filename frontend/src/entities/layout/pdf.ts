import PDFDocument, { type PDFStructureElement } from 'pdfkit';
import type { ResumeDocument } from '../resume/operations';
import type { FontBook } from './fonts';
import { ICON_BOX, ICON_PATHS } from './icons';
import { runIsCovered } from './missing';
import type { Page, PageModel } from './page-model';
import { planStructure, type StructureNode } from './pdf-structure';
import { q } from './quantize';

export type PdfInput = { model: PageModel; document: ResumeDocument; fonts: FontBook; photo: Uint8Array | null; updatedAt: string };

const PRODUCT = 'Resumiser';

/** FR-PDF-05, DD-P12-04, as typed: a template's uppercase is how it prints, not what the metadata says. */
const titleOf = ({ fullName, headline }: ResumeDocument['header']) => headline?.trim() ? `${fullName} — ${headline}` : fullName;

/**
 * ADR-010 §3 and §7: written from the one PageModel, with dates from `updatedAt`, so one version always gives the same bytes.
 * FR-PDF-08: tagged in document order (`pdf-structure.ts`). Decoration is an artifact.
 *
 * Each document registers the font file, not the FontBook's parsed font. Subsetting creates fontkit glyphs for composite
 * parts with no code points (Cyrillic М is built from Latin M) and fontkit caches them on the font, so a shared instance
 * would lose that letter from the ToUnicode map of every later PDF. Asking the parsed font which glyphs it has creates none.
 */
export function writePdf({ model, document, fonts, photo, updatedAt }: PdfInput): Promise<Uint8Array> {
  const when = new Date(updatedAt);
  const pdf = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    pdfVersion: '1.7',
    font: null,
    tagged: true,
    displayTitle: true,
    lang: document.language,
    info: { Title: titleOf(document.header), Author: document.header.fullName, Producer: PRODUCT, Creator: PRODUCT, CreationDate: when, ModDate: when },
  });
  const chunks: Uint8Array[] = [];
  const result = new Promise<Uint8Array>((resolve, reject) => {
    pdf.on('data', chunk => chunks.push(chunk));
    pdf.on('error', reject);
    pdf.on('end', () => {
      const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      resolve(bytes);
    });
  });

  const plan = planStructure(model, document);
  const elements = new Map<StructureNode, PDFStructureElement>();
  const build = (node: StructureNode, parent: PDFStructureElement | null) => {
    const element = pdf.struct(node.tag, node === plan.figure ? { alt: document.header.fullName } : {});
    if (parent) parent.add(element);
    else pdf.addStructure(element);
    elements.set(node, element);
    for (const item of node.children) build(item, element);
  };
  build(plan.root, null);

  const artifact = (draw: () => void) => {
    pdf.markContent('Artifact', { type: 'Layout' });
    draw();
    pdf.endMarkedContent();
  };
  const drawShapes = (page: Page) => {
    for (const shape of page.shapes) {
      (shape.radius ? pdf.roundedRect(shape.x, shape.y, shape.width, shape.height, shape.radius) : pdf.rect(shape.x, shape.y, shape.width, shape.height)).fill(shape.fill);
    }
  };
  const drawIcons = (page: Page) => {
    for (const icon of page.icons) {
      pdf.save();
      pdf.translate(icon.x, icon.y);
      pdf.scale(icon.size / ICON_BOX);
      pdf.path(ICON_PATHS[icon.kind]).lineWidth(1).stroke(icon.color);
      pdf.restore();
    }
  };

  const registered = new Set<string>();
  for (const page of model.pages) {
    pdf.addPage({ size: [page.width, page.height], margin: 0 });
    if (page.shapes.length) artifact(() => drawShapes(page));
    // After the shapes: T3's photo sits on its band.
    for (const image of page.images) {
      if (!photo || !plan.figure) continue;
      const content = pdf.markStructureContent('Figure');
      pdf.save();
      pdf.roundedRect(image.x, image.y, image.width, image.height, image.radius).clip();
      pdf.image(photo, image.x, image.y, { width: image.width, height: image.height });
      pdf.restore();
      pdf.endMarkedContent();
      elements.get(plan.figure)?.add(content);
    }
    if (page.icons.length) artifact(() => drawIcons(page));
    for (const line of page.lines) {
      const owner = plan.nodeOf.get(line) as StructureNode;
      for (const run of line.runs) {
        if (!registered.has(run.face)) { pdf.registerFont(run.face, fonts.fileOf(run.face)); registered.add(run.face); }
        const link = run.link ? pdf.struct('Link') : null;
        if (link) elements.get(owner)?.add(link);
        // DD-P12-07: the font prints a box where it has no glyph, and the typed text stays what copy and search return.
        const content = runIsCovered(fonts, run) ? pdf.markStructureContent(link ? 'Link' : owner.tag) : pdf.markStructureContent('Span', { actual: run.text });
        pdf.font(run.face).fontSize(run.size).fillColor(run.color).text(run.text, line.x + run.x, line.baseline, { lineBreak: false, baseline: 'alphabetic', underline: run.underline });
        pdf.endMarkedContent();
        (link ?? elements.get(owner))?.add(content);
        if (link) {
          // An annotation records its page when the element closes, so it closes here (DD-P12-09).
          pdf.link(q(line.x + run.x), line.y, run.width, line.height, run.link as string, { structParent: link });
          link.end();
        }
      }
    }
  }
  elements.get(plan.root)?.end();
  pdf.end();
  return result;
}
