import { ICON_BOX, ICON_PATHS } from '../../entities/layout/icons';
import type { Page } from '../../entities/layout/page-model';

/** One family per face, so the browser never synthesises bold or italic. */
export const faceFamily = (face: string) => `doc-${face.replace('/', '-')}`;

const SVG = 'http://www.w3.org/2000/svg';
const css = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>) => { Object.assign(element.style, styles); return element; };
const box = (x: number, y: number, width: number, height: number): Partial<CSSStyleDeclaration> => ({ position: 'absolute', left: `${x}pt`, top: `${y}pt`, width: `${width}pt`, height: `${height}pt` });

/**
 * ADR-010 §2: every run goes at its computed position and the browser chooses no line break.
 * An inline-block strut sets the line box's baseline at its own bottom, so the run's baseline lands on the model's with
 * no font metric involved. Browsers round ascent differently, which would otherwise move a line by up to a pixel.
 */
export function paintPage(page: Page, photoUrl: string | null, target: HTMLElement): void {
  const sheet = css(document.createElement('div'), { position: 'relative', overflow: 'hidden', width: `${page.width}pt`, height: `${page.height}pt`, background: '#fff' });
  sheet.dataset.pageSheet = String(page.number);
  for (const shape of page.shapes) {
    const element = css(document.createElement('div'), { ...box(shape.x, shape.y, shape.width, shape.height), borderRadius: `${shape.radius}pt`, background: shape.fill });
    element.dataset.shape = shape.role;
    sheet.append(element);
  }
  // After the shapes: T3's photo sits on its band.
  for (const image of page.images) {
    if (!photoUrl) continue;
    const img = document.createElement('img');
    img.src = photoUrl;
    img.alt = '';
    css(img, { ...box(image.x, image.y, image.width, image.height), borderRadius: `${image.radius}pt`, objectFit: 'cover' });
    sheet.append(img);
  }
  for (const icon of page.icons) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${ICON_BOX} ${ICON_BOX}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.dataset.icon = icon.kind;
    Object.assign(svg.style, box(icon.x, icon.y, icon.size, icon.size), { fill: 'none', stroke: icon.color });
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', ICON_PATHS[icon.kind]);
    svg.append(path);
    sheet.append(svg);
  }
  for (const line of page.lines) {
    for (const run of line.runs) {
      const strut = run.size * 2;
      const element = css(document.createElement('span'), {
        position: 'absolute', left: `${line.x + run.x}pt`, top: `${line.baseline - strut}pt`, whiteSpace: 'pre', lineHeight: '0',
        fontFamily: `"${faceFamily(run.face)}"`, fontSize: `${run.size}pt`, color: run.color, textDecoration: run.underline ? 'underline' : 'none',
        fontKerning: 'normal', letterSpacing: '0', textRendering: 'geometricPrecision',
      });
      element.dataset.role = line.role;
      const strutOf = () => css(document.createElement('span'), { display: 'inline-block', width: '0', height: `${strut}pt` });
      if (run.parts.length) {
        // Re-anchored at model positions, because a browser that hints advances at small sizes drifts along a long run (DD-P11-17).
        for (const part of run.parts) {
          const piece = css(document.createElement('span'), { position: 'absolute', left: `${part.x}pt`, top: '0', textDecoration: run.underline ? 'underline' : 'none' });
          piece.append(strutOf(), part.text);
          element.append(piece);
        }
      } else {
        element.append(strutOf(), run.text);
      }
      sheet.append(element);
    }
  }
  target.append(sheet);
}
