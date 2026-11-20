import type { FontBook } from './fonts';
import type { PageModel, Run } from './page-model';

/** Is every character of the run in its face? Font data only, so the PDF writer can ask it and stay the same in every runtime (ADR-010 §7). */
export const runIsCovered = (fonts: FontBook, run: Run) => {
  const font = fonts.font(run.face);
  return Array.from(run.text).every(character => font.hasGlyphForCodePoint(character.codePointAt(0) as number));
};

const NOTHING_TO_SEE = /^[\p{Default_Ignorable_Code_Point}\p{Z}\p{Cc}]$/u;

/** DD-P12-07: what prints as an empty box, for the user. Runtime Unicode data is fine here: this is a message, not the file's bytes. */
export function missingCharacters(model: PageModel, fonts: FontBook, limit = 10): { characters: string[]; more: number } {
  const seen = new Set<string>();
  for (const page of model.pages) for (const line of page.lines) for (const run of line.runs) {
    if (runIsCovered(fonts, run)) continue;
    const font = fonts.font(run.face);
    for (const character of run.text) {
      if (!font.hasGlyphForCodePoint(character.codePointAt(0) as number) && !NOTHING_TO_SEE.test(character)) seen.add(character);
    }
  }
  const characters = [...seen];
  return { characters: characters.slice(0, limit), more: Math.max(characters.length - limit, 0) };
}
