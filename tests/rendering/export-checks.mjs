// P12: what the export files must be, read back with poppler and from the raw bytes. Run after reference.mjs (rule 04).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { PNG } from 'pngjs';
import { fixture, fontBytes, OUT, photoBytes, ROOT, UPDATED_AT } from './shared.mjs';

const engine = await import(resolve(import.meta.dirname, 'build/engine.mjs'));
const dir = resolve(OUT, 'export');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const fonts = engine.createFontBook(fontBytes());
const smallPhoto = photoBytes();
const bigPhoto = new Uint8Array(readFileSync(resolve(ROOT, 'tests/fixtures/resumes/photo-600.jpg')));
const failures = [];
const check = (id, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures.push(id); };
const near = (value, expected) => Math.abs(value - expected) <= 0.5;
const tool = (name, ...args) => execFileSync(name, args, { encoding: 'utf8', maxBuffer: 1 << 26 });

const streams = raw => [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(match => { try { return inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'); } catch { return ''; } }).filter(text => /\b(BT|re)\b/.test(text));
let counter = 0;
async function write(document, { photo = null } = {}) {
  const model = engine.layout(document, fonts, { photo: photo !== null, engineVersion: 'gate' });
  const bytes = await engine.writePdf({ model, document, fonts, photo, updatedAt: UPDATED_AT });
  const path = resolve(dir, `case-${++counter}.pdf`);
  writeFileSync(path, bytes);
  return { path, bytes, model, raw: Buffer.from(bytes).toString('latin1') };
}
const info = path => Object.fromEntries(tool('pdfinfo', path).split('\n').filter(Boolean).map(line => { const at = line.indexOf(':'); return [line.slice(0, at), line.slice(at + 1).trim()]; }));
function words(path) {
  const decode = text => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  return tool('pdftotext', '-bbox', path, '-').split('<page ').slice(1).map(chunk => [...chunk.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map(match => ({ x0: +match[1], y0: +match[2], x1: +match[3], y1: +match[4], text: decode(match[5]) })));
}
const plain = value => ({ kind: 'text', value, bold: false, italic: false, underline: false });
const para = value => ({ kind: 'paragraph', inlines: [plain(value)] });
const shell = { hidden: false, listColumns: null, placement: null };
const base = (sections, header = {}, layout = {}, rest = {}) => {
  const document = fixture('minimal', 'A4');
  return { ...document, sections, header: { ...document.header, headline: '', contacts: [], showPhoto: true, ...header }, layout: { ...document.layout, ...layout }, ...rest };
};

// R01, R02. FR-PDF-05: DD-P12-04.
{
  const cv = info((await write(fixture('reference-cv', 'A4'))).path);
  check('R01 Title is full name + headline', cv.Title === 'Dmytro Vietrov | Software Engineer — C# • .NET • SQL • Azure • Kubernetes • AI', cv.Title);
  check('R01 Author is the full name', cv.Author === 'Dmytro Vietrov | Software Engineer', cv.Author);
  check('R01 Creator is the product', cv.Creator === 'Resumiser', cv.Creator);
  const cyrillic = info((await write(base([], { fullName: 'Лукія Ґалій', headline: 'Інженерка' }))).path);
  check('R01 non-Latin metadata', cyrillic.Title === 'Лукія Ґалій — Інженерка' && cyrillic.Author === 'Лукія Ґалій', cyrillic.Title);
  const alone = info((await write(base([], { fullName: 'Only Name' }))).path);
  check('R01 no headline: the name alone', alone.Title === 'Only Name', alone.Title);
  for (const language of ['en', 'es', 'uk']) {
    const { raw } = await write(base([], {}, {}, { language }));
    check(`R02 /Lang ${language}`, raw.includes(`/Lang (${language})`));
  }
}

// R03. FR-PDF-04: page size and margins from the settings. Margins are measured on printed ink: a word box reaches the font's ascent, which T2's tight name line exceeds without printing there.
{
  for (const [size, expected] of [['A4', '595 x 842'], ['Letter', '612 x 792']]) {
    const page = info((await write(fixture('two-pages', size))).path)['Page size'];
    check(`R03 size ${size}`, page.startsWith(expected), page);
  }
  const SCALE = 2; // Pixels per point: one pixel is the ±0.5 pt tolerance.
  const inkBox = path => tool('pdftoppm', '-r', String(72 * SCALE), '-png', path, path.replace(/\.pdf$/, '')).length === 0 && readdirSync(dir).filter(name => name.startsWith(`${basename(path, '.pdf')}-`)).sort().map(name => {
    const { width, height, data } = PNG.sync.read(readFileSync(resolve(dir, name)));
    const box = { left: width, right: 0, top: height, bottom: 0 };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      if (data[at] > 200 && data[at + 1] > 200 && data[at + 2] > 200) continue;
      box.left = Math.min(box.left, x); box.right = Math.max(box.right, x + 1); box.top = Math.min(box.top, y); box.bottom = Math.max(box.bottom, y + 1);
    }
    return { box, width, height };
  });
  for (const templateId of ['T1', 'T2']) for (const margin of [23, 40, 72]) {
    const document = { ...fixture('two-pages', 'A4'), templateId };
    document.layout = { ...document.layout, margins: { top: margin, right: margin, bottom: margin, left: margin } };
    const { path } = await write(document);
    const limit = margin * SCALE - 1;
    const outside = inkBox(path).filter(({ box, width, height }) => box.left < limit || box.top < limit || width - box.right < limit || height - box.bottom < limit);
    check(`R03 margins ${margin} on ${templateId}`, outside.length === 0, outside.length ? JSON.stringify(outside[0].box) : '');
  }
}

// R04, R05. FR-LAY-02, FR-LAY-03, closing AC-P10-08: measured in the file. A word box reaches the font's ascent and descent; the rest of the line box is half-leading, read from the same font.
{
  const boxOf = (model, needle) => model.pages[0].lines.find(line => line.runs.map(run => run.text).join('') === needle);
  const leading = line => {
    const run = line.runs[0];
    const { ascent, descent } = fonts.vertical(run.face, run.size);
    return (line.height - (ascent + descent)) / 2;
  };
  const word = (page, text) => page.find(item => item.text === text);
  const gapBetween = (model, page, above, below) => {
    const [a, b] = [word(page, above), word(page, below)];
    return (b.y0 - leading(boxOf(model, below))) - (a.y1 + leading(boxOf(model, above)));
  };
  const titled = title => ({ ...shell, id: title, type: 'text', title, content: { body: [para(`b${title}`)] } });
  const measured = {};
  for (const v of [0, 7, 10, 20]) {
    const { path, model } = await write(base([titled('AAAA'), titled('BBBB'), titled('CCCC')], { fullName: 'Name' }, { sectionSpacing: v }));
    const [page] = words(path);
    measured[v] = { a: word(page, 'AAAA').y0, b: word(page, 'BBBB').y0, c: word(page, 'CCCC').y0 };
    check(`R04 above a section title at v=${v} is 10 + v`, near(gapBetween(model, page, 'bAAAA', 'BBBB'), 10 + v) && near(gapBetween(model, page, 'bBBBB', 'CCCC'), 10 + v), `${gapBetween(model, page, 'bAAAA', 'BBBB').toFixed(2)} pt`);
  }
  for (const v of [7, 10, 20]) check(`R04 slider to ${v} moves each title by its index`, near(measured[v].a - measured[0].a, v) && near(measured[v].b - measured[0].b, 2 * v) && near(measured[v].c - measured[0].c, 3 * v));
  const entry = (id, title, location) => ({ id, title, organization: '', location, start: null, end: null, dateText: '', description: [], pageBreakBefore: false });
  for (const v of [0, 7, 10, 20]) {
    const { path, model } = await write(base([{ ...shell, id: 's', type: 'entries', title: 'Work', content: { labels: null, entries: [entry('e1', 'ALPHA', 'placeone'), entry('e2', 'BETA', 'placetwo'), entry('e3', 'GAMMA', 'placethree')] } }], { fullName: 'Name' }, { entrySpacing: v }));
    const [page] = words(path);
    const first = gapBetween(model, page, 'placeone', 'BETA');
    const second = gapBetween(model, page, 'placetwo', 'GAMMA');
    check(`R05 between entries at v=${v} is v`, near(first, v) && near(second, v), `${first.toFixed(2)}, ${second.toFixed(2)} pt`);
  }
}

// R06, R07. FR-PDF-02, NFR-07, on each family: subsets, Unicode maps, typed characters back.
{
  const TYPED = ['Ñáñez ¿qué tal? Núñez', 'Ґанна Їжак Єва щастя', 'Šťastná Ľudmila Ďurčo Žilina ôäŕĺ', 'office fi ffl affluent flow'];
  for (const bodyFont of ['roboto', 'ibm-plex-sans', 'pt-serif']) {
    const { path } = await write(base([{ ...shell, id: 's', type: 'text', title: 'Unicode', content: { body: [...TYPED.map(para), { kind: 'paragraph', inlines: [{ ...plain('Bold Ñ Ї Š'), bold: true }, plain(' '), { ...plain('Italic Ñ Ї Š'), italic: true }, plain(' '), { ...plain('Both Ñ Ї Š'), bold: true, italic: true }] }] } }], {}, { bodyFont }));
    const rows = tool('pdffonts', path).split('\n').slice(2).filter(Boolean);
    check(`R06 fonts ${bodyFont}`, rows.length >= 4 && rows.every(row => /\+/.test(row.split(/\s+/)[0]) && / yes\s+yes\s+yes\s+\d+/.test(row)), `${rows.length} fonts`);
    const text = tool('pdftotext', path, '-');
    for (const typed of TYPED) check(`R07 ${bodyFont} extract "${typed}"`, text.includes(typed));
  }
}

// R08. FR-PDF-03: URL per FR-HDR-04 and FR-RTE-03, each rectangle over its text, nothing unsafe.
{
  const contact = (id, text, url = null) => ({ id, text, url, kind: 'other' });
  const link = (url, value) => ({ kind: 'link', url, children: [plain(value)] });
  const { path, raw } = await write(base([{ ...shell, id: 's', type: 'text', title: 'Links', content: { body: [{ kind: 'paragraph', inlines: [plain('see '), link('https://example.invalid/rich', 'richlink'), plain(' and '), link('javascript:alert(1)', 'badscript'), plain(' and '), link('data:text/html,x', 'baddata')] }] } }], { contacts: [contact('a', 'a@example.invalid'), contact('b', '+34600000000'), contact('c', 'example.invalid/me'), contact('d', '@handle'), contact('e', 'Portfolio', 'https://example.invalid/p'), contact('f', 'Evil', 'javascript:alert(2)')] }));
  const urls = tool('pdfinfo', '-url', path);
  for (const url of ['mailto:a@example.invalid', 'tel:+34600000000', 'https://example.invalid/me', 'https://example.invalid/rich', 'https://example.invalid/p']) check(`R08 lists ${url}`, urls.includes(url));
  for (const text of ['javascript:', 'data:text', '@handle']) check(`R08 no annotation for ${text}`, !urls.includes(text) && !raw.includes(`/URI (${text}`));
  const height = 842;
  const rects = [...raw.matchAll(/\/Rect \[([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)\]/g)].map(match => ({ x0: +match[1], y0: height - +match[4], x1: +match[3], y1: height - +match[2] }));
  check('R08 one rectangle per link', rects.length === 5, `${rects.length}`);
  const [page] = words(path);
  const covered = word => rects.some(rect => word.x0 >= rect.x0 - 1 && word.x1 <= rect.x1 + 1 && word.y0 >= rect.y0 - 1 && word.y1 <= rect.y1 + 1);
  for (const text of ['a@example.invalid', '+34600000000', 'example.invalid/me', 'Portfolio', 'richlink']) check(`R08 rectangle covers ${text}`, covered(page.find(word => word.text === text)));
  for (const text of ['@handle', 'Evil', 'badscript', 'baddata', 'see']) check(`R08 no rectangle over ${text}`, !covered(page.find(word => word.text === text)));
}

// R09, R10. FR-PDF-08, FR-TXT-02: tags on each template, and the TXT in the same order.
{
  const tree = path => tool('pdfinfo', '-struct-text', path);
  const has = (text, tag) => new RegExp(`^\\s*${tag}\\b`, 'm').test(text);
  const printed = text => text.split('\n').filter(line => /^\s*"/.test(line)).map(line => line.trim().slice(1, -1)).join('').replace(/[\s|—]/g, '').toUpperCase();
  const typed = text => text.replace(/\((?:https?|mailto|tel):[^)\s]*\)/g, '').replace(/^- /gm, '').replace(/[\s|—]/g, '').toUpperCase();
  for (const templateId of ['T1', 'T2', 'T3']) {
    const document = { ...fixture('four-pages', 'A4'), templateId };
    const { path, raw } = await write(document, { photo: smallPhoto });
    check(`R09 ${templateId} tagged`, info(path).Tagged === 'yes');
    const text = tree(path);
    for (const tag of ['Document', 'H1', 'H2', 'H3', 'Sect', 'P', 'L', 'LI', 'LBody', 'Link', ...(templateId === 'T2' ? [] : ['Figure'])]) check(`R09 ${templateId} has ${tag}`, has(text, tag));
    if (templateId !== 'T2') check(`R09 ${templateId} the photo has alternative text`, /\/S \/Figure[\s\S]{0,200}\/Alt/.test(raw));
    const pages = streams(raw);
    check(`R09 ${templateId} decoration is an artifact, and marks balance`, pages.some(page => page.includes('/Artifact')) && pages.every(page => (page.match(/\b(BMC|BDC)\b/g) ?? []).length === (page.match(/\bEMC\b/g) ?? []).length), `${pages.length} streams`);
    const titles = text.split('\n').flatMap((line, index, all) => /^\s*H2\b/.test(line) ? [all[index + 1].trim().slice(1, -1)] : []);
    check(`R10 ${templateId} section order equals the TXT's`, JSON.stringify(titles) === JSON.stringify(document.sections.map(section => section.title.toUpperCase())), titles.join(', ').slice(0, 80));
    check(`R10 ${templateId} PDF tags and TXT hold the same text in the same order`, printed(text) === typed(engine.serializeTxt(document)));
  }
  const { path, raw } = await write({ ...fixture('long-bullet', 'A4'), templateId: 'T1' });
  check('R09 an element continues across a page', raw.includes('/Type /MCR'), `${info(path).Pages} pages`);
}

// R11, R12. FR-PDF-07, FR-PDF-09: the rendition as it came, at enough resolution, and the size limit.
{
  for (const templateId of ['T1', 'T3']) {
    const { path, bytes } = await write({ ...fixture('one-page', 'A4'), templateId }, { photo: bigPhoto });
    const rows = tool('pdfimages', '-list', path).split('\n').slice(2).filter(Boolean).map(row => row.trim().split(/\s+/));
    check(`R11 ${templateId} one JPEG`, rows.length === 1 && rows[0][8] === 'jpeg', rows[0]?.[8] ?? 'none');
    check(`R11 ${templateId} at least 200 dpi`, rows.length === 1 && +rows[0][12] >= 200 && +rows[0][13] >= 200, `${rows[0]?.[12]} x ${rows[0]?.[13]} ppi`);
    check(`R11 ${templateId} bytes unchanged`, Buffer.from(bytes).indexOf(Buffer.from(bigPhoto)) >= 0);
  }
  for (const templateId of ['T1', 'T2', 'T3']) {
    const { bytes, model } = await write({ ...fixture('four-pages', 'A4'), templateId }, { photo: bigPhoto });
    check(`R12 ${templateId} four pages with the worst-case photo within 1 MB`, bytes.length <= 1_000_000, `${bytes.length} bytes, ${model.pages.length} pages`);
  }
}

// R13. DD-P12-07: outside the font, the typed text still comes back, and different characters stay different.
{
  const { path } = await write(base([{ ...shell, id: 's', type: 'text', title: 'Gaps', content: { body: [para('Before 😀 and 漢 after'), para('Next 🎉 then 語 end')] } }]));
  const text = tool('pdftotext', path, '-');
  for (const needle of ['😀', '漢', '🎉', '語', 'Before', 'after']) check(`R13 extract ${needle}`, text.includes(needle));
}

// R14. NFR-07, DD-P12-22: PT Serif's gap letters print, from the fallback, and come back as typed.
{
  const typed = 'Ŵales Ĳsselmeer Ċaħaq Ѐлена Ѝово Ŧest';
  const document = base([{ ...shell, id: 's', type: 'text', title: 'Gaps', content: { body: [para(typed)] } }], { fullName: 'Plain Name' }, { bodyFont: 'pt-serif' });
  const { path, model } = await write(document);
  const faces = new Set(model.pages.flatMap(page => page.lines.flatMap(line => line.runs.map(run => run.face))));
  check('R14 the fallback is in the model', faces.has('roboto/regular') && faces.has('pt-serif/regular'), [...faces].join(', '));
  const rows = tool('pdffonts', path).split('\n').slice(2).filter(Boolean);
  check('R14 both fonts embedded', rows.some(row => /Roboto/.test(row)) && rows.some(row => /PTSerif|PT-Serif/i.test(row)) && rows.every(row => / yes\s+yes\s+yes\s+\d+/.test(row)), rows.map(row => row.split(/\s+/)[0]).join(', '));
  check('R14 extract the typed text', tool('pdftotext', path, '-').includes(typed));
  check('R14 nothing reported', engine.missingCharacters(model, fonts).characters.length === 0);
  check('R14 no ActualText needed', !/ActualText/.test(streams(Buffer.from((await write(document)).bytes).toString('latin1')).join('')));
}

if (failures.length) { console.log(`RESULT FAIL ${failures.length} check(s)`); process.exit(1); }
console.log('RESULT PASS export checks');
