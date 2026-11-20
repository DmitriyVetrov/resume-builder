// G2: per browser, screenshots against the raster of the Node reference PDF at 100 dpi (DD-P10-14).
// A pixel differs when nothing within one device pixel of it in the other image is close to it. Browsers snap a text
// baseline to a whole device pixel and poppler does not, so an exact comparison measures that rounding, not the layout.
// The negative control below proves a real shift still fails.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { CASES, FIXTURES, OUT } from './shared.mjs';

const LIMIT = 0.01;
const TOLERANCE = 76; // Per channel, of 255. Antialiasing differs between rasterisers.
const CONTROL_SHIFT = 3; // Device pixels, about 2 pt: a line moved this far is a layout difference.
// AC-P11-02 asks all three: a Chromium-only default let a WebKit miss print RESULT PASS.
const required = (process.env.G2_REQUIRED ?? 'chromium,firefox,webkit').split(',');

const close = (a, i, b, j) => Math.abs(a[i] - b[j]) <= TOLERANCE && Math.abs(a[i + 1] - b[j + 1]) <= TOLERANCE && Math.abs(a[i + 2] - b[j + 2]) <= TOLERANCE;

/** Is the pixel at (x, y) of `a` matched by a pixel of `b` within one device pixel? */
function matched(a, b, width, height, x, y) {
  const i = (y * width + x) * 4;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < width && ny < height && close(a, i, b, (ny * width + nx) * 4)) return true;
  }
  return false;
}

function diffRatio(a, b, total) {
  const { width, height } = a;
  const mask = new PNG({ width, height });
  mask.data.fill(255);
  let count = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (matched(a.data, b.data, width, height, x, y) && matched(b.data, a.data, width, height, x, y)) continue;
    count += 1;
    const i = (y * width + x) * 4;
    mask.data[i + 1] = 0;
    mask.data[i + 2] = 0;
  }
  return { ratio: count / total, mask };
}

function crop(image, width, height, shiftY = 0) {
  const out = new PNG({ width, height });
  out.data.fill(255);
  PNG.bitblt(image, out, 0, 0, width, height - shiftY, 0, shiftY);
  return out;
}

const report = {};
let failed = false;
for (const browser of ['chromium', 'firefox', 'webkit']) {
  const folder = resolve(OUT, 'screens', browser);
  if (!existsSync(folder)) { console.log(`SKIP G2 ${browser}: no screenshots`); if (required.includes(browser)) failed = true; continue; }
  let worst = 0;
  let worstPage = '';
  let control = Infinity;
  for (const { label, name } of CASES) {
    const raster = resolve(OUT, 'raster', label);
    mkdirSync(raster, { recursive: true });
    if (!readdirSync(raster).length) execFileSync('pdftoppm', ['-r', '100', '-png', resolve(OUT, `${label}.pdf`), resolve(raster, 'p')]);
    readdirSync(raster).sort().forEach((file, index) => {
      const shotPath = resolve(folder, `${label}-${index + 1}.png`);
      if (!existsSync(shotPath)) { console.log(`FAIL G2 ${browser} ${label} p${index + 1}: no screenshot`); failed = true; return; }
      const reference = PNG.sync.read(readFileSync(resolve(raster, file)));
      const shot = PNG.sync.read(readFileSync(shotPath));
      if (Math.abs(reference.width - shot.width) > 1 || Math.abs(reference.height - shot.height) > 1) { console.log(`FAIL G2 ${browser} ${label} p${index + 1}: size ${shot.width}x${shot.height} vs ${reference.width}x${reference.height}`); failed = true; }
      const width = Math.min(reference.width, shot.width);
      const height = Math.min(reference.height, shot.height);
      const left = crop(reference, width, height);
      const { ratio, mask } = diffRatio(left, crop(shot, width, height), reference.width * reference.height);
      if (ratio > worst) { worst = ratio; worstPage = `${label} p${index + 1}`; writeFileSync(resolve(OUT, `worst-${browser}.png`), PNG.sync.write(mask)); }
      // The control runs on the full pages only: an almost empty last page cannot show a shift.
      if (index === 0 && FIXTURES.includes(name)) control = Math.min(control, diffRatio(left, crop(shot, width, height, CONTROL_SHIFT), reference.width * reference.height).ratio);
    });
  }
  report[browser] = { worst, worstPage, control };
  const pass = worst <= LIMIT;
  console.log(`${pass ? 'PASS' : 'FAIL'} G2 ${browser}: worst page ${(worst * 100).toFixed(3)}%, ${worstPage} (limit 1%, tolerance ${TOLERANCE}, one device pixel)`);
  if (!pass && required.includes(browser)) failed = true;
  const caught = control > LIMIT;
  console.log(`${caught ? 'PASS' : 'FAIL'} G2 ${browser} control: a ${CONTROL_SHIFT} px shift gives at least ${(control * 100).toFixed(3)}%`);
  if (!caught) failed = true;
}
writeFileSync(resolve(OUT, 'g2.json'), JSON.stringify(report, null, 1));
console.log(failed ? 'RESULT FAIL G2' : 'RESULT PASS G2');
process.exit(failed ? 1 : 0);
