import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');
export const OUT = resolve(import.meta.dirname, 'out');
/** The ADR-010 §6 fixtures: their page counts mean something on T1 Medium, which `reference.mjs` checks. */
export const FIXTURES = ['one-page', 'two-pages', 'four-pages'];
/** P11: twelve fixtures for each template (NFR-04). */
export const ALL_FIXTURES = [...FIXTURES, 'minimal', 'title-at-bottom', 'long-paragraph', 'long-bullet', 'many-rows', 'manual-break', 'oversized', 'rich-marks', 'contacts-heavy'];
export const TEMPLATES = ['T1', 'T2', 'T3', 'T4'];
/** TPL-01: the synthetic mirror of the reference CV's structure, on T4 only (ADR-054). */
export const MIRRORS = ['panel-mirror', 'panel-mirror-long'];
export const SIZES = ['A4', 'Letter'];
export const FONTS = ['roboto', 'ibm-plex-sans', 'pt-serif'];
export const FACES = ['regular', 'italic', 'bold', 'bold-italic'];
/** ADR-010 §6 scope on T1 keeps its labels; every fixture on every template on A4; `four-pages` on Letter for T2 and T3. */
export const CASES = [
  ...FIXTURES.flatMap(name => SIZES.map(size => ({ name, size, preset: 'M', template: 'T1', label: `${name}-${size}` }))),
  ...SIZES.map(size => ({ name: 'two-pages', size, preset: 'L', template: 'T1', label: `two-pages-${size}-large` })),
  ...TEMPLATES.flatMap(template => ALL_FIXTURES.filter(name => template !== 'T1' || !FIXTURES.includes(name)).map(name => ({ name, size: 'A4', preset: 'M', template, label: `${name}-${template}` }))),
  ...['T2', 'T3', 'T4'].map(template => ({ name: 'four-pages', size: 'Letter', preset: 'M', template, label: `four-pages-${template}-Letter` })),
  ...MIRRORS.map(name => ({ name, size: 'A4', preset: 'M', template: 'T4', label: `${name}-T4` })),
];
export const UPDATED_AT = '2026-11-05T10:00:00.000Z';
export const ENGINE_VERSION = 'gate';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const fixture = (name, size, preset = 'M', template = 'T1') => {
  const document = JSON.parse(readFileSync(resolve(ROOT, `tests/fixtures/resumes/${name}.json`), 'utf8'));
  return { ...document, templateId: template, layout: { ...document.layout, pageSize: size, fontPreset: preset } };
};
export const fontBytes = () => Object.fromEntries(FONTS.map(id => [id, Object.fromEntries(FACES.map(face => [face, new Uint8Array(readFileSync(resolve(ROOT, `frontend/src/assets/fonts/${id}/${face}.ttf`)))]))]));
export const photoBytes = () => new Uint8Array(readFileSync(resolve(ROOT, 'tests/fixtures/resumes/photo.jpg')));
