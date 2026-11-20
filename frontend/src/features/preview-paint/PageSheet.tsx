import { memo, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Page } from '../../entities/layout/page-model';
import { paintPage } from './paint';
import './preview-paint.css';

/** 100% is true size (DD-P11-04). */
export const PX_PER_PT = 96 / 72;

/** Repaints only when the page's own content changed: compared by value, since every layout returns new objects. */
const PaintedPage = memo(function PaintedPage({ page, photoUrl }: { page: Page; json: string; photoUrl: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = host.current;
    if (!target) return;
    target.replaceChildren();
    paintPage(page, photoUrl, target);
  }, [page, photoUrl]);
  return <div ref={host} className="page-paint" />;
}, (before, after) => before.json === after.json && before.photoUrl === after.photoUrl);

/** One painted page at a scale. A transform, so zoom never lays out again and line breaks cannot change with it (AC-P11-06). */
export function PageSheet({ page, photoUrl, scale, children }: { page: Page; photoUrl: string | null; scale: number; children?: ReactNode }) {
  return <div className="page-frame" style={{ width: `${page.width * PX_PER_PT * scale}px`, height: `${page.height * PX_PER_PT * scale}px` }}>
    <div className="page-stage" style={{ width: `${page.width}pt`, height: `${page.height}pt`, transform: `scale(${scale})` }}>
      <PaintedPage page={page} json={JSON.stringify(page)} photoUrl={photoUrl} />
      {children}
    </div>
  </div>;
}

/** The content width of an element, followed as it changes. Null until measured and while hidden, or with no `ResizeObserver`. */
export function useWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const style = getComputedStyle(element);
      const inner = element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      if (inner > 0) setWidth(inner);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Page 1 at a fixed or measured width: decoration, so it has no IDs and nothing to focus (AC-P11-11). */
export function PageThumbnail({ page, photoUrl, templateId }: { page: Page; photoUrl: string | null; templateId: string }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const scale = (width ?? 112) / (page.width * PX_PER_PT);
  return <div ref={box} className="page-thumbnail" aria-hidden="true" data-template={templateId}><PageSheet page={page} photoUrl={photoUrl} scale={scale} /></div>;
}
