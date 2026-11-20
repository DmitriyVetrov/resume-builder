import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Hint, Page, Region } from '../../entities/layout/page-model';
import { anchorAt } from '../../entities/layout/regions';
import type { ResumeDocument, Section } from '../../entities/resume/operations';
import { Button } from '../../shared/ui';
import { PageSheet, PX_PER_PT, useWidth } from '../preview-paint/PageSheet';
import type { PageModelState } from '../preview-paint/use-page-model';
import { renditionUrl, type PhotoInfo } from './api';
import { Segmented } from './design/controls';
import { sectionName } from './SectionPanel';
import { HEADER, type EditorSession, type Selection } from './session';

const ZOOMS = [{ value: 'fit', label: 'Fit width' }, { value: '0.75', label: '75%' }, { value: '1', label: '100%' }, { value: '1.25', label: '125%' }] as const;
type Zoom = typeof ZOOMS[number]['value'];
export const pageCountText = (count: number) => count === 1 ? '1 page' : `${count} pages`;

function hintText(hints: Hint[]) {
  const parts: string[] = [];
  if (hints.some(hint => hint.kind === 'oversized')) parts.push('An item is longer than a page, so it was split by lines.');
  if (hints.some(hint => hint.kind === 'lone-title')) parts.push('A section title sits alone at the bottom of a page.');
  return parts.join(' ');
}

const pts = (box: { x: number; y: number; width: number; height: number }) => ({ left: `${box.x}pt`, top: `${box.y}pt`, width: `${box.width}pt`, height: `${box.height}pt` });

/**
 * A section's hit box on one page (DD-P11-05). The first is the section's one tab stop; a later one is for the mouse only.
 * A click resolves to the entry or item under it through the page's line anchors (DD-P11-06).
 */
function RegionBox({ page, region, first, name, selected, onSelect }: { page: Page; region: Region; first: boolean; name: string; selected: boolean; onSelect: (entryId: string | null, itemId: string | null) => void }) {
  const click = (event: MouseEvent<HTMLDivElement>) => {
    const sheet = event.currentTarget.parentElement?.querySelector('[data-page-sheet]')?.getBoundingClientRect();
    const scale = sheet && sheet.width ? sheet.width / page.width : 0;
    const anchor = scale ? anchorAt(page, (event.clientX - (sheet as DOMRect).left) / scale, (event.clientY - (sheet as DOMRect).top) / scale) : null;
    onSelect(anchor?.entryId ?? null, anchor?.itemId ?? null);
  };
  const className = `page-region ${selected ? 'selected' : ''}`;
  const style = pts(region);
  if (!first) return <div className={className} style={style} aria-hidden="true" onClick={click} {...(region.sectionId ? { 'data-section-continued': region.sectionId } : {})} />;
  const keys = (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(null, null); } };
  const identity = region.sectionId ? { 'data-section-id': region.sectionId } : { 'data-preview-header': true };
  return <div className={className} style={style} role="button" tabIndex={0} aria-label={`Edit ${name}`} onClick={click} onKeyDown={keys} {...identity} />;
}

/** FR-PRV-01…08. Paints the one layout result, and never chooses a line break (ADR-010 §2). */
export function PreviewPanel({ session, document, photo, selection, pageModel, onActivate }: { session: EditorSession; document: ResumeDocument; photo: PhotoInfo | null; selection: Selection; pageModel: PageModelState; onActivate: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const width = useWidth(scroller);
  const { model, status, retry } = pageModel;
  const painted = model !== null;
  useEffect(() => {
    const box = scroller.current;
    if (!box || !painted) return;
    if (selection === HEADER) { box.scrollTop = 0; return; }
    const target = box.querySelector<HTMLElement>(`[data-section-id="${selection}"]`);
    if (target) box.scrollTop += target.getBoundingClientRect().top - box.getBoundingClientRect().top;
  }, [selection, painted]);
  const select = (id: string | null, entryId: string | null, itemId: string | null) => {
    session.select(id ?? HEADER, { entryId, itemId });
    onActivate();
  };
  const photoUrl = photo ? renditionUrl(session.resumeId, photo) : null;
  const pages = model?.pages ?? [];
  const pageWidth = pages[0]?.width ?? 0;
  const scale = zoom === 'fit' ? (width && pageWidth ? width / (pageWidth * PX_PER_PT) : 1) : Number(zoom);
  const hints = model?.hints ?? [];
  const seen = new Set<string | null>();
  const nameOf = (id: string | null) => id === null ? 'Header' : sectionName((document.sections as Section[]).find(section => section.id === id) ?? { title: '' });
  return <div className="preview-panel">
    <div className="preview-toolbar">
      <p className="preview-count" data-testid="preview-page-count">{painted ? pageCountText(pages.length) : ''}</p>
      <Segmented legend="Zoom" value={zoom} options={ZOOMS} onChange={setZoom} />
    </div>
    {status === 'failed' && <div className="preview-failed" role="alert">
      <span>The preview could not load. Your edits are safe.</span>
      <Button variant="secondary" onClick={retry}>Retry</Button>
    </div>}
    {hints.length > 0 && <p className="preview-hints" role="status" aria-label="Layout hints">{hintText(hints)}</p>}
    <div className="preview-scroller" data-preview-scroller ref={scroller} tabIndex={0} role="group" aria-label="Preview scroll area">
      {status === 'loading' && <div className="preview-loading" role="status">Preparing preview…</div>}
      {painted && <div className="preview-pages" data-template={pageModel.document?.templateId}>
        {pages.map(page => <div key={page.number} className="preview-page" role="group" aria-label={`Page ${page.number} of ${pages.length}`}>
          <PageSheet page={page} photoUrl={photoUrl} scale={scale}>
            {page.regions.map(region => {
              const first = !seen.has(region.sectionId);
              seen.add(region.sectionId);
              return <RegionBox key={region.sectionId ?? HEADER} page={page} region={region} first={first} name={nameOf(region.sectionId)} selected={(region.sectionId ?? HEADER) === selection} onSelect={(entryId, itemId) => select(region.sectionId, entryId, itemId)} />;
            })}
            {hints.filter(hint => hint.page === page.number).map(hint => <div key={`${hint.kind}-${hint.sectionId}`} className="page-hint" style={pts(hint)} data-hint={hint.kind} aria-hidden="true" />)}
          </PageSheet>
          <p className="page-number">{page.number} / {pages.length}</p>
        </div>)}
      </div>}
    </div>
  </div>;
}
