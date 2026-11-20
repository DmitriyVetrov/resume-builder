import type { ResumeDocument } from '../resume/operations';
import type { Line, PageModel } from './page-model';

export type StructureTag = 'Document' | 'H1' | 'H2' | 'H3' | 'P' | 'Sect' | 'L' | 'LI' | 'LBody' | 'Figure';
export type StructureNode = { tag: StructureTag; children: StructureNode[]; lines: Line[] };
export type StructurePlan = { root: StructureNode; nodeOf: Map<Line, StructureNode>; figure: StructureNode | null };

type Keyed = StructureNode & { byKey: Map<string, Keyed> };
const node = (tag: StructureTag): Keyed => ({ tag, children: [], lines: [], byKey: new Map() });

function child(parent: Keyed, key: string, tag: StructureTag): Keyed {
  let found = parent.byKey.get(key);
  if (!found) {
    found = node(tag);
    parent.byKey.set(key, found);
    parent.children.push(found);
  }
  return found;
}

/** What a line of a section or an entry belongs to. Keys are first-come, so the page order of a flow is the order of its elements. */
function placeInFlow(flow: Keyed, line: Line): Keyed {
  switch (line.role) {
    case 'sectionTitle': return child(flow, 'title', 'H2');
    case 'entryTitle': return child(flow, 'title', 'H3');
    case 'entryOrganization': return child(flow, 'organization', 'P');
    case 'entryLocation': case 'entryDates': return child(flow, 'meta', 'P');
    default: break;
  }
  const block = line.block ?? line.role;
  const slash = block.indexOf('/');
  if (slash < 0) return child(flow, block, 'P');
  return child(child(child(flow, block.slice(0, slash), 'L'), block, 'LI'), 'body', 'LBody');
}

function headerNode(header: Keyed, line: Line): Keyed {
  if (line.role === 'name') return child(header, 'name', 'H1');
  return child(header, line.role, 'P');
}

/**
 * FR-PDF-08, DD-P12-09, DD-P12-10: the tag tree in document order. The content stream keeps painting order, so T3's columns
 * and a section across pages are still one reading order for a screen reader or an ATS.
 */
export function planStructure(model: PageModel, document: ResumeDocument): StructurePlan {
  const header = node('Document');
  const sections = node('Document');
  const nodeOf = new Map<Line, StructureNode>();
  for (const page of model.pages) for (const line of page.lines) {
    const { sectionId = null, entryId = null } = line.anchor ?? {};
    let target: Keyed;
    if (sectionId === null) target = headerNode(header, line);
    else {
      const section = child(sections, sectionId, 'Sect');
      target = placeInFlow(entryId === null ? section : child(section, entryId, 'Sect'), line);
    }
    target.lines.push(line);
    nodeOf.set(line, target);
  }
  const figure = model.pages.some(page => page.images.length) ? node('Figure') : null;
  const ordered = document.sections.flatMap(section => sections.byKey.get(section.id) ?? []);
  return { root: { tag: 'Document', lines: [], children: [...header.children, ...(figure ? [figure] : []), ...ordered] }, nodeOf, figure };
}
