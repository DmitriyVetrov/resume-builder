import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';

// AC-UI-01 (ADR-053 §1): application colors come from theme tokens. The resume document's own
// colors live in entities/ and features/preview-paint/ and are out of scope (ADR-053 §7).
const SRC = join(import.meta.dirname, '..');
const sources = Object.fromEntries((readdirSync(SRC, { recursive: true }) as string[])
  .filter(name => /\.(css|tsx)$/.test(name))
  .map(name => [`../${relative(SRC, join(SRC, name))}`, readFileSync(join(SRC, name), 'utf8')])) as Record<string, string>;
const MARKER = '/* Application styles: theme tokens only below this line (ADR-053). */';
const RAW = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:bg|text|border|ring|outline|fill|stroke|from|to|via|shadow|accent|caret|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/;

it('T-04 no raw color outside the token block and document colors', () => {
  // The shadcn components in shared/ui/ are project source once added, so they are scanned too (DD-UI-10, review R1).
  const names = Object.keys(sources).filter(name => !name.startsWith('../entities/') && !name.startsWith('../features/preview-paint/') && !/\.test\.tsx?$/.test(name));
  expect(names.length).toBeGreaterThan(20);
  expect(sources['../app/shell.css']).toContain(MARKER);
  const offenders: string[] = [];
  for (const name of names) {
    let text = sources[name]!;
    if (name === '../app/shell.css') text = text.slice(text.indexOf(MARKER) + MARKER.length);
    text.split('\n').forEach((line, index) => {
      if (RAW.test(line) && !line.includes('document color')) offenders.push(`${name}:${index + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  expect(offenders).toEqual([]);
});
