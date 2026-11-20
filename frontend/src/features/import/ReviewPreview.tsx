import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResumeDocument } from '../../entities/resume';
import { resolveDesign } from '../../entities/template';
import { PageSheet, PX_PER_PT, useWidth } from '../preview-paint/PageSheet';
import { useRuntime } from '../preview-paint/use-page-model';

/**
 * The imported document on the one layout engine (FR-PRV-02), before it is saved. There is no resume ID yet, so it
 * reports no client events; a failure shows a message and the report stays usable.
 */
export function ReviewPreview({ document, photo }: { document: ResumeDocument; photo?: Blob | null }) {
  const runtime = useRuntime(resolveDesign(document).font.id);
  // A data URL (CSP `img-src data:`): nothing to revoke, so a remount cannot leave the page with a dead link.
  const [read, setRead] = useState<{ photo: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!photo) return;
    let live = true;
    const reader = new FileReader();
    reader.onload = () => { if (live && typeof reader.result === 'string') setRead({ photo, url: reader.result }); };
    reader.readAsDataURL(photo);
    return () => { live = false; };
  }, [photo]);
  const photoUrl = photo && read?.photo === photo ? read.url : null;
  const model = useMemo(() => {
    if (!runtime) return null;
    try { return runtime.layout(document, Boolean(photo)); } catch { return 'failed' as const; }
  }, [runtime, document, photo]);
  const box = useRef<HTMLElement>(null);
  const width = useWidth(box);
  const pages = model && model !== 'failed' ? model.pages : [];
  return <section ref={box} className="min-w-0 space-y-4" aria-label="Import preview">
    {model === 'failed' && <p className="text-muted-foreground">The preview could not be drawn. You can still create the resume and check it in the editor.</p>}
    {!model && <p className="text-muted-foreground" role="status">Drawing the preview…</p>}
    {pages.map((page, index) => <div key={index} className="overflow-hidden" role="group" aria-label={`Page ${index + 1} of ${pages.length}`}>
      <PageSheet page={page} photoUrl={photoUrl} scale={Math.min(1, (width ?? 595) / (page.width * PX_PER_PT))} />
    </div>)}
  </section>;
}
