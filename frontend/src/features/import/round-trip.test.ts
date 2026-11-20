// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { writePdf } from '../../entities/layout/pdf';
import { fixture, run_, testFonts } from '../../entities/layout/test-kit';
import { switchTemplate } from '../../entities/resume/design-operations';
import type { ResumeDocument, Section } from '../../entities/resume/operations';
import { plainText } from '../../entities/resume/rich-text';
import { definitionOf, placementFor } from '../../entities/template';
import { buildDocument } from './build';
import { fallbackDraft } from './fallback';
import { analyze } from './layout';
import { extractPdf } from './pdf';
import { serialize } from './serialize';

/** IMP-01 R-01 (AC-IMP-02): our own export on each template comes back through extraction and the fallback parser. */
const fonts = testFonts();
const normal = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
// The intermediate text carries the contract's inline markup (DD-IMP-06); a paragraph's text is compared without it.
const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' };
const withoutMarkup = (value: string) => value.replace(/<\/?[bi]>|<a href="[^"]*">|<\/a>/g, '').replace(/&(?:amp|lt|gt|quot);/g, entity => ENTITIES[entity]!);

async function roundTrip(document: ResumeDocument) {
  const model = run_(document, fonts);
  const bytes = await writePdf({ model, document, fonts, photo: null, updatedAt: '2026-11-15T10:00:00Z' });
  const analysis = analyze(await extractPdf(bytes));
  const draft = fallbackDraft(analysis);
  return { analysis, draft, text: serialize(analysis).text, built: buildDocument(draft, { columns: analysis.columns, sidebarSide: analysis.sidebarSide, warnings: [], droppedImages: analysis.droppedImages, photo: false, basic: true, sourceCapped: false }) };
}

describe('round trip: export → extraction → fallback → document', () => {
  for (const [templateId, columns, side] of [['T1', 1, null], ['T2', 1, null], ['T3', 2, 'right'], ['T4', 2, 'left']] as const) {
    it(`R-01 ${templateId}: name, headline, section titles in reading order and paragraph texts are recovered`, async () => {
      const document = switchTemplate(fixture('panel-mirror'), templateId);
      const { analysis, draft, text, built } = await roundTrip(document);
      expect({ columns: analysis.columns, sidebarSide: analysis.sidebarSide }).toEqual({ columns, sidebarSide: side });
      expect(draft.fullName).toBe(document.header.fullName);
      expect(draft.headline).toBe(document.header.headline);
      expect(built.document.header.fullName).toBe(document.header.fullName);
      expect(built.document.templateId).toBe(templateId === 'T2' ? 'T1' : templateId);

      // Reading order: one column follows the document; two columns read main, then sidebar (ADR-054 §5).
      const visible = (document.sections as Section[]).filter(section => !section.hidden && section.title);
      const definition = definitionOf(templateId);
      const expected = columns === 1 ? visible : [...visible.filter(section => placementFor(section, definition) !== 'sidebar'), ...visible.filter(section => placementFor(section, definition) === 'sidebar')];
      const wanted = expected.map(section => normal(section.title));
      const found = draft.sections.map(section => normal(section.title)).filter(title => wanted.includes(title));
      expect(found).toEqual(wanted);

      const recovered = normal(withoutMarkup(text));
      // External review R1: each paragraph also survives the fallback parser and the builder.
      const drafted = normal(withoutMarkup(draft.sections.flatMap(section => [...section.blocks.map(block => block.text), ...section.items]).join('\n')));
      const builtText = normal((built.document.sections as Section[]).map(section => section.type === 'text' || section.type === 'inline' ? plainText(section.content.body)
        : section.type === 'list' ? plainText(section.content.items.map(item => ({ kind: 'paragraph' as const, inlines: item.text })))
        : section.content.entries.map(entry => plainText(entry.description)).join('\n')).join('\n'));
      for (const section of document.sections as Section[]) {
        if (section.type !== 'text') continue;
        for (const block of section.content.body) {
          const paragraph = normal(plainText([block]));
          expect(recovered).toContain(paragraph);
          expect(drafted, 'fallback draft').toContain(paragraph);
          expect(builtText, 'built document').toContain(paragraph);
        }
      }
    });
  }

  it('R-02 the extraction layer is deterministic', async () => {
    const document = fixture('panel-mirror');
    expect((await roundTrip(document)).text).toBe((await roundTrip(document)).text);
  });
});
