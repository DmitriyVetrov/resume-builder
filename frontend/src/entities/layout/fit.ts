import type { ResumeDocument } from '../resume/operations';
import { layout } from './engine';
import type { FontBook } from './fonts';

export type FitResult = { outcome: 'already' | 'fitted' | 'impossible'; document: ResumeDocument; pages: number };
type Options = { photo: boolean; engineVersion: string };
type Spacing = 'lineSpacing' | 'entrySpacing' | 'sectionSpacing';

const STAGES: readonly Spacing[] = ['lineSpacing', 'entrySpacing', 'sectionSpacing'];
const SMALLER: Record<ResumeDocument['layout']['fontPreset'], ResumeDocument['layout']['fontPreset'] | null> = { L: 'M', M: 'S', S: null };
const withLayout = (document: ResumeDocument, change: Partial<ResumeDocument['layout']>): ResumeDocument => ({ ...document, layout: { ...document.layout, ...change } });

/** FR-PRV-05, DD-P11-08: the spec's order, the least change at each stage, and at most five layouts per stage. Only `layout` ever changes. */
export function fitToPages(document: ResumeDocument, target: number, fonts: FontBook, options: Options): FitResult {
  const count = (candidate: ResumeDocument) => layout(candidate, fonts, options).pages.length;
  const initial = count(document);
  if (initial <= target) return { outcome: 'already', document, pages: initial };
  let current = document;
  for (const key of STAGES) {
    const from = current.layout[key];
    const atZero = withLayout(current, { [key]: 0 });
    if (from > 0 && count(atZero) <= target) {
      let fits = 0;
      let misses = from;
      while (misses - fits > 1) {
        const middle = Math.floor((fits + misses) / 2);
        if (count(withLayout(current, { [key]: middle })) <= target) fits = middle;
        else misses = middle;
      }
      const fitted = withLayout(current, { [key]: fits });
      return { outcome: 'fitted', document: fitted, pages: count(fitted) };
    }
    current = atZero;
  }
  for (let preset = SMALLER[current.layout.fontPreset]; preset; preset = SMALLER[preset]) {
    current = withLayout(current, { fontPreset: preset });
    const pages = count(current);
    if (pages <= target) return { outcome: 'fitted', document: current, pages };
  }
  return { outcome: 'impossible', document, pages: count(current) };
}
