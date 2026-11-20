// @vitest-environment node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ResumeDocument } from '../resume/operations';
import { canonicalJson, serializeTxt, type FontBook } from './index';
import { writePdf } from './pdf';
import { fixture, run_, testFonts } from './test-kit';

/**
 * TPL-01 AC-TPL-02, DD-TPL-11: T1, T2 and T3 stay byte-identical. The golden was written on `main` before the first
 * T4 engine edit (`WRITE_LAYOUT_GOLDEN=1 npx vitest run src/entities/layout/templates-golden.test.ts`) and is never
 * rewritten to make this pass: a difference is a regression in a shared engine path.
 */
const GOLDEN = resolve(import.meta.dirname, '../../../../tests/fixtures/layout/t1-t3-hashes.json');
const FIXTURES = ['one-page', 'two-pages', 'four-pages', 'minimal', 'title-at-bottom', 'long-paragraph', 'long-bullet', 'many-rows', 'manual-break', 'oversized', 'rich-marks', 'contacts-heavy', 'reference-cv'];
const VARIANTS = [{ pageSize: 'A4', fontPreset: 'M' }, { pageSize: 'Letter', fontPreset: 'L' }] as const;
const UPDATED_AT = '2026-11-05T10:00:00.000Z';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');

let fonts: FontBook;
beforeAll(() => { fonts = testFonts(); });

async function hashes() {
  const photo = new Uint8Array(readFileSync(resolve(import.meta.dirname, '../../../../tests/fixtures/resumes/photo.jpg')));
  const result: Record<string, { model: string; pdf: string; txt: string; pages: number }> = {};
  for (const name of FIXTURES) for (const templateId of ['T1', 'T2', 'T3'] as const) for (const variant of VARIANTS) {
    const base = fixture(name);
    const document = { ...base, templateId, layout: { ...base.layout, ...variant } } as ResumeDocument;
    const model = run_(document, fonts, true);
    const pdf = await writePdf({ model, document, fonts, photo, updatedAt: UPDATED_AT });
    result[`${name}/${templateId}/${variant.pageSize}-${variant.fontPreset}`] = { model: sha(canonicalJson(model)), pdf: sha(pdf), txt: sha(serializeTxt(document)), pages: model.pages.length };
  }
  return result;
}

describe('TPL-01 T1–T3 identity (AC-TPL-02)', () => {
  it('G-01 model, PDF and TXT of every fixture on T1, T2 and T3 equal the golden taken on main', async () => {
    const actual = await hashes();
    if (process.env.WRITE_LAYOUT_GOLDEN === '1') writeFileSync(GOLDEN, `${JSON.stringify(actual, null, 1)}\n`);
    expect(existsSync(GOLDEN)).toBe(true);
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    expect(Object.keys(actual).length).toBe(FIXTURES.length * 3 * VARIANTS.length);
    for (const key of Object.keys(golden)) expect(actual[key], key).toEqual(golden[key]);
    expect(Object.keys(actual).sort()).toEqual(Object.keys(golden).sort());
  }, 300_000);
});
