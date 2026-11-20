import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import type { Extraction, PdfRun } from '../types';

/** Synthetic PDFs for the import tests (IMP-01 test plan, "Fixtures"). Fictional people only. */
type Doc = InstanceType<typeof PDFDocument>;
const root = resolve(import.meta.dirname, '../../../../..');
export const PHOTO = readFileSync(resolve(root, 'tests/fixtures/resumes/photo.jpg'));
// Embedded Roboto: the standard PDF fonts cannot encode "●" (WinAnsi).
const FACES = { Regular: 'regular', Bold: 'bold', Italic: 'italic' } as const;
type Face = keyof typeof FACES;
const fontFile = (face: Face) => readFileSync(resolve(root, `frontend/src/assets/fonts/roboto/${FACES[face]}.ttf`));

export function pdfOf(draw: (doc: Doc) => void, options: { tagged?: boolean; pages?: number } = {}): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'A4', margin: 0, tagged: options.tagged ?? false, autoFirstPage: true });
  for (const face of Object.keys(FACES) as Face[]) doc.registerFont(face, fontFile(face));
  const chunks: Uint8Array[] = [];
  doc.on('data', chunk => { chunks.push(chunk); });
  const done = new Promise<Uint8Array>(ok => doc.on('end', () => ok(new Uint8Array(Buffer.concat(chunks)))));
  draw(doc);
  for (let index = 1; index < (options.pages ?? 1); index++) { doc.addPage({}); doc.font('Regular').fontSize(9).text(`Page ${index + 1}`, 50, 50, { lineBreak: false }); }
  doc.end();
  return done;
}

export const write = (doc: Doc, value: string, x: number, y: number, size = 9, face: Face = 'Regular', link?: string) =>
  doc.font(face).fontSize(size).fillColor('#222222').text(value, x, y, { lineBreak: false, ...(link ? { link } : {}) });

/** One column: name, headline, a heading, a paragraph wrapped over two lines, a second paragraph. */
export const oneColumn = () => pdfOf(doc => {
  write(doc, 'Alex Sample', 50, 50, 22, 'Bold');
  write(doc, 'Platform Engineer', 50, 80, 13, 'Bold');
  write(doc, 'EXPERIENCE', 50, 120, 11, 'Bold');
  write(doc, 'Built and ran the build system for', 50, 140);
  write(doc, 'four product teams.', 50, 152);
  write(doc, 'Example Systems', 50, 180, 9, 'Italic');
});

/** Two columns; the sidebar on `side`, with a glyph-bulleted contact list, a photo in the sidebar and a wide banner in main. */
export const twoColumn = (side: 'left' | 'right', options: { images?: boolean } = {}) => pdfOf(doc => {
  const [sx, mx] = side === 'left' ? [30, 210] : [420, 40];
  if (options.images) doc.image(PHOTO, sx + 30, 40, { width: 80, height: 80 });
  write(doc, 'Alex Sample', mx, 40, 22, 'Bold');
  write(doc, 'Platform Engineer', mx, 70, 13, 'Bold');
  write(doc, 'CONTACT', sx, 140, 8.5, 'Bold');
  write(doc, '● alex.sample@example.com', sx, 156);
  write(doc, '● Springfield', sx, 168);
  write(doc, 'LANGUAGES', sx, 200, 8.5, 'Bold');
  write(doc, 'English', sx, 216, 9, 'Bold');
  write(doc, 'Native', sx, 228);
  write(doc, 'WORK EXPERIENCE', mx, 110, 11, 'Bold');
  write(doc, 'Platform Engineer | 2024 - Present', mx, 130, 9, 'Bold');
  write(doc, 'Example Systems · Springfield', mx, 142, 9, 'Italic');
  write(doc, 'Ran the platform for twelve teams.', mx, 156);
  write(doc, 'EDUCATION', mx, 300, 11, 'Bold');
  write(doc, 'B.Sc. Computer Science', mx, 320, 9, 'Bold');
  if (options.images) doc.image(PHOTO, mx, 400, { width: 300, height: 80 });
});

/** Description bullets drawn as small filled circles with the text indented: no glyph in the text layer. */
export const drawnMarkers = () => pdfOf(doc => {
  write(doc, 'Alex Sample', 50, 50, 22, 'Bold');
  write(doc, 'Built the release pipeline.', 62, 100);
  doc.roundedRect(53, 101.5, 4, 4, 2).fill('#157A95');
  write(doc, 'Cut build times in half.', 62, 114);
  doc.roundedRect(53, 115.5, 4, 4, 2).fill('#157A95');
  write(doc, 'Closing paragraph without a marker.', 50, 140);
});

/** A tagged list: L/LI in the structure tree, no glyph and no drawn marker. */
export const taggedList = () => pdfOf(doc => {
  const document = doc.struct('Document');
  doc.addStructure(document);
  const tagged = (parent: ReturnType<Doc['struct']>, tag: string, draw: () => void) => {
    const element = doc.struct(tag);
    parent.add(element);
    const content = doc.markStructureContent(tag);
    draw();
    doc.endMarkedContent();
    element.add(content);
    element.end();
  };
  tagged(document, 'H1', () => write(doc, 'Alex Sample', 50, 50, 22, 'Bold'));
  const list = doc.struct('L');
  document.add(list);
  for (const [index, value] of ['Kept the lights on.', 'Paged less often.'].entries()) {
    const item = doc.struct('LI');
    list.add(item);
    tagged(item, 'LBody', () => write(doc, value, 62, 100 + index * 14));
    item.end();
  }
  list.end();
  tagged(document, 'P', () => write(doc, 'A plain paragraph.', 50, 140));
  document.end();
}, { tagged: true });

export const withLink = () => pdfOf(doc => {
  write(doc, 'Alex Sample', 50, 50, 22, 'Bold');
  write(doc, 'Founded ', 50, 100);
  write(doc, 'example.com', 86, 100, 9, 'Regular', 'https://example.com/');
});

export const noText = () => pdfOf(doc => { doc.image(PHOTO, 50, 50, { width: 200, height: 200 }); });
export const manyPages = () => pdfOf(doc => write(doc, 'Alex Sample', 50, 50, 22, 'Bold'), { pages: 6 });

/** For the pure layout tests: a run with defaults. */
export function textRun(text: string, x: number, baseline: number, options: Partial<PdfRun> = {}): PdfRun {
  const size = options.size ?? 9;
  return { page: 0, x, baseline, width: text.length * size * 0.5, size, bold: false, italic: false, href: null, listItem: false, text, ...options };
}
export const extraction = (runs: PdfRun[], partial: Partial<Extraction> = {}): Extraction => ({ pages: [{ width: 595.28, height: 841.89 }], runs, markers: [], images: [], ...partial });
