// The Node reference (ADR-010 §6): writes PDF, TXT and model for every fixture, then checks G1, G5 and G6 with poppler.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CASES, ENGINE_VERSION, FIXTURES, fixture, fontBytes, OUT, photoBytes, sha, UPDATED_AT } from './shared.mjs';

const engine = await import(resolve(import.meta.dirname, 'build/engine.mjs'));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const fonts = engine.createFontBook(fontBytes());
const photo = photoBytes();
const failures = [];
const check = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures.push(id); };
const hashes = {};

function pdfWords(path) {
  const xml = execFileSync('pdftotext', ['-bbox', path, '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const decode = text => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  return xml.split('<page ').slice(1).map(chunk => [...chunk.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map(match => ({ x0: +match[1], y0: +match[2], x1: +match[3], y1: +match[4], text: decode(match[5]) })));
}

for (const { name, size, preset, template, label } of CASES) {
  const document = fixture(name, size, preset, template);
  const model = engine.layout(document, fonts, { photo: true, engineVersion: ENGINE_VERSION });
  const write = () => engine.writePdf({ model, document, fonts, photo, updatedAt: UPDATED_AT });
  const pdf = await write();
  const txt = engine.serializeTxt(document);
  const path = resolve(OUT, `${label}.pdf`);
  writeFileSync(path, pdf);
  writeFileSync(resolve(OUT, `${label}.txt`), txt);
  writeFileSync(resolve(OUT, `${label}.model.json`), engine.canonicalJson(model));
  hashes[label] = { model: engine.canonicalHash(model), pdf: sha(pdf), txt: sha(txt), pages: model.pages.length };

  // G6: two runs, byte-identical.
  const again = await write();
  check(`G6 ${label}`, sha(again) === sha(pdf) && pdf.length > 0, `pdf ${pdf.length} bytes`);

  // G1: every PageModel line is found, word for word, inside its own rectangle on the same page.
  let extracted = [];
  let parsed = true;
  try { extracted = pdfWords(path); } catch { parsed = false; }
  check(`G1 ${label} pages`, parsed && extracted.length === model.pages.length, `model ${model.pages.length}, pdf ${extracted.length}`);
  let lines = 0;
  let wrong = [];
  if (parsed && extracted.length === model.pages.length) model.pages.forEach((page, index) => {
    const words = [...extracted[index]];
    const taken = new Set();
    for (const line of page.lines) {
      lines += 1;
      // Runs that touch are one piece of text (a link followed by its comma, DD-TPL-16); a gap between runs is a word break (T1's contact separators).
      const expected = line.runs.map((run, index) => index && run.x > line.runs[index - 1].x + line.runs[index - 1].width + 0.5 ? ` ${run.text}` : run.text).join('').split(/\s+/).filter(Boolean);
      const found = words.map((word, wordIndex) => ({ word, wordIndex })).filter(({ word, wordIndex }) => !taken.has(wordIndex) && (word.y0 + word.y1) / 2 >= line.y - 1 && (word.y0 + word.y1) / 2 <= line.y + line.height + 1 && word.x0 >= line.x - 1 && word.x1 <= line.x + line.width + 1).sort((a, b) => a.word.x0 - b.word.x0);
      for (const { wordIndex } of found) taken.add(wordIndex);
      const got = found.map(({ word }) => word.text).join(' ').split(/\s+/).filter(Boolean);
      if (got.join(' ') !== expected.join(' ')) wrong.push(`p${page.number}: expected "${expected.join(' ')}" got "${got.join(' ')}"`);
    }
    if (taken.size !== words.length) wrong.push(`p${page.number}: ${words.length - taken.size} PDF words are on no model line`);
  });
  check(`G1 ${label} lines`, parsed && lines > 0 && wrong.length === 0, `${lines} lines${wrong.length ? `; first: ${wrong[0]}` : ''}`);

  // The fixtures mean what G1 says they mean (ADR-010 §6): 1 page; 2 pages with an entry across the boundary; 4 pages.
  if (preset === 'M' && template === 'T1' && FIXTURES.includes(name)) {
    check(`G1 ${label} fixture size`, model.pages.length === { 'one-page': 1, 'two-pages': 2, 'four-pages': 4 }[name], `${model.pages.length} pages`);
    const entriesOn = page => new Set(page.lines.map(line => line.anchor?.entryId).filter(Boolean));
    if (name === 'two-pages') check(`G1 ${label} entry crosses`, [...entriesOn(model.pages[0])].some(id => entriesOn(model.pages[1]).has(id)), '');
  }

  // G5: embedded subsets, typed Cyrillic and diacritics back from extraction, links listed.
  if (name === 'four-pages') {
    let table = '';
    try { table = execFileSync('pdffonts', [path], { encoding: 'utf8' }); } catch { /* reported below */ }
    const rows = table.split('\n').slice(2).filter(Boolean);
    check(`G5 ${label} fonts`, rows.length > 0 && rows.every(row => /\+/.test(row.split(/\s+/)[0]) && / yes\s+yes\s+yes\s+\d+/.test(row)), `${rows.length} fonts`);
    let text = '';
    try { text = execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' }); } catch { /* reported below */ }
    for (const needle of ['Lucía', 'Ñáñez', 'Šťastná', 'Інженерка', 'València', 'Відмовостійкість', 'Žilina']) check(`G5 ${label} extract "${needle}"`, text.toUpperCase().includes(needle.toUpperCase()), '');
    let urls = '';
    try { urls = execFileSync('pdfinfo', ['-url', path], { encoding: 'utf8' }); } catch { /* reported below */ }
    for (const url of ['mailto:lucia@example.invalid', 'https://example.invalid/in/lucia', 'https://example.invalid/runbook']) check(`G5 ${label} link ${url}`, urls.includes(url), '');
  }
}
writeFileSync(resolve(OUT, 'reference-hashes.json'), JSON.stringify(hashes, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(hashes).map(([key, value]) => [key, value.pages]))));
if (failures.length) { console.log(`RESULT FAIL ${failures.length} check(s)`); process.exit(1); }
console.log('RESULT PASS reference');
