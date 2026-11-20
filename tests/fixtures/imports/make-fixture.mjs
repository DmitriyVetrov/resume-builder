// IMP-01 E2E fixtures: a synthetic two-column CV (fictional person), a PDF without a text layer, and the TXT
// is hand-written in the §9 shape. Run from the repository root: node tests/fixtures/imports/make-fixture.mjs
import { createWriteStream, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { default: PDFDocument } = await import(resolve(here, '../../../frontend/node_modules/pdfkit/js/pdfkit.js'));
const photo = readFileSync(resolve(here, '../resumes/photo.jpg'));
const fixed = { CreationDate: new Date('2026-11-15T00:00:00Z'), ModDate: new Date('2026-11-15T00:00:00Z'), Producer: 'IMP-01 fixture', Creator: 'IMP-01 fixture' };

const font = face => readFileSync(resolve(here, `../../../frontend/src/assets/fonts/roboto/${face}.ttf`));
const pending = [];
function save(name, draw) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: fixed });
  // Embedded Roboto: the standard PDF fonts cannot encode "●".
  doc.registerFont('Regular', font('regular')); doc.registerFont('Bold', font('bold')); doc.registerFont('Italic', font('italic'));
  const out = createWriteStream(resolve(here, name));
  pending.push(new Promise(done => out.on('finish', done)));
  doc.pipe(out);
  draw(doc);
  doc.end();
}
const write = (doc, value, x, y, size = 9, face = 'Regular', link) => doc.font(face).fontSize(size).fillColor('#222222').text(value, x, y, { lineBreak: false, ...(link ? { link } : {}) });

save('synthetic-cv.pdf', doc => {
  doc.rect(20, 20, 172, 802).fill('#F2F6F7');
  doc.image(photo, 66, 30, { width: 80, height: 80 });
  write(doc, 'CONTACT', 31, 125, 8.5, 'Bold');
  write(doc, '● alex.sample@example.com', 31, 141);
  write(doc, '● Springfield', 31, 153);
  write(doc, 'SKILLS', 31, 185, 8.5, 'Bold');
  write(doc, 'Kubernetes', 31, 201, 9, 'Bold');
  write(doc, 'Advanced', 31, 213);
  write(doc, 'Alex Sample', 211, 30, 22, 'Bold');
  write(doc, 'Platform Engineer', 211, 58, 13, 'Bold');
  write(doc, 'Builds platforms that product teams enjoy using.', 211, 85);
  write(doc, 'WORK EXPERIENCE', 211, 115, 11, 'Bold');
  write(doc, 'Platform Engineer | 2024 - Present', 211, 135, 9, 'Bold');
  write(doc, 'Example Systems · Springfield', 211, 147, 9, 'Italic');
  write(doc, '● Ran the platform for twelve teams.', 211, 161);
  write(doc, '● Cut build times in half.', 211, 173);
});
save('no-text.pdf', doc => { doc.image(photo, 50, 50, { width: 200, height: 200 }); });
await Promise.all(pending);
