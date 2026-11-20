import { useEffect, useRef, useState } from 'react';
import { PageThumbnail } from '../preview-paint/PageSheet';
import type { ResumeSummary } from './api';
import { loadThumbnail, type ThumbnailPage } from './thumbnails';

/** FR-LIB-01: page 1 of the real layout, for a card in view. The placeholder stays until then, and on any failure. */
export function LibraryThumbnail({ item, userId }: { item: ResumeSummary; userId: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  const [shown, setShown] = useState<ThumbnailPage | null>(null);
  useEffect(() => {
    const element = box.current;
    if (visible || !element) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setVisible(true); }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!visible || !userId) return;
    let current = true;
    void loadThumbnail(userId, item).then(result => { if (current && result) setShown(result); });
    return () => { current = false; };
  }, [visible, userId, item]);
  return <div ref={box} className={`page-thumb ${shown ? 'is-painted' : ''}`} aria-hidden="true">
    {shown ? <PageThumbnail page={shown.page} photoUrl={shown.photoUrl} templateId={item.templateId} /> : <><span /><span /><span /><small>{item.templateId}</small></>}
  </div>;
}
