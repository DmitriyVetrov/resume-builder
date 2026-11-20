import type { Extraction, PdfImage, PdfMarker, PdfRun } from './types';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 5;
export type ImportErrorCode = 'no_text_layer' | 'too_many_pages' | 'too_large' | 'unreadable';
export class ImportError extends Error {
  constructor(readonly code: ImportErrorCode) { super(code); }
}

/**
 * ADR-055 §3, DD-IMP-17. pdf.js 6 has no eval path (X-09 scans the bundles); wasm stays off so the CSP needs no
 * `wasm-unsafe-eval`, XFA and font faces are not used, and no system font is consulted. The PDF is untrusted input.
 * `fontExtraProperties` passes an embedded font's name (`…+Roboto-Bold`): the only weight and style signal.
 */
export const PDF_OPTIONS = { useWasm: false, enableXfa: false, disableFontFace: true, useSystemFonts: false, fontExtraProperties: true, stopAtErrors: false, verbosity: 0 } as const;

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
type PdfPage = Awaited<ReturnType<Awaited<ReturnType<PdfJs['getDocument']>['promise']>['getPage']>>;
type Matrix = [number, number, number, number, number, number];

/** DD-IMP-21: the legacy build everywhere — the one Node can run, so the tests exercise the code the browser runs. */
async function loadPdfJs(): Promise<PdfJs> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // In the browser a same-origin module worker (CSP `script-src 'self'`); in Node pdf.js runs in-thread.
  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href;
  }
  return pdfjs;
}

/** The document and its loading task: in pdf.js 6 only the task can be destroyed, which also ends the worker. */
async function open(pdfjs: PdfJs, bytes: Uint8Array) {
  const task = pdfjs.getDocument({ data: bytes.slice(), ...PDF_OPTIONS });
  try { return { task, document: await task.promise }; }
  catch { await task.destroy(); throw new ImportError('unreadable'); }
}

const multiply = (a: Matrix, b: number[]): Matrix => [
  a[0] * b[0]! + a[2] * b[1]!, a[1] * b[0]! + a[3] * b[1]!,
  a[0] * b[2]! + a[2] * b[3]!, a[1] * b[2]! + a[3] * b[3]!,
  a[0] * b[4]! + a[2] * b[5]! + a[4], a[1] * b[4]! + a[3] * b[5]! + a[5],
];
const apply = (m: Matrix, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] as const;
function box(m: Matrix, x0: number, y0: number, x1: number, y1: number) {
  const points = [apply(m, x0, y0), apply(m, x1, y0), apply(m, x0, y1), apply(m, x1, y1)];
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return { left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) };
}

/** Images and small filled shapes (list markers), placed by following the transform stack. */
async function graphics(pdfjs: PdfJs, page: PdfPage, index: number, height: number) {
  const { OPS } = pdfjs;
  const fills = new Set<number>([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke]);
  const list = await page.getOperatorList();
  const markers: PdfMarker[] = [];
  const images: PdfImage[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  list.fnArray.forEach((fn, at) => {
    const args = list.argsArray[at] as unknown[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = multiply(ctm, args as number[]);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const placed = box(ctm, 0, 0, 1, 1);
      images.push({ page: index, x: placed.left, top: height - placed.top, width: placed.right - placed.left, height: placed.top - placed.bottom, id: typeof args[0] === 'string' ? args[0] : '' });
    } else if (fn === OPS.constructPath && fills.has(args[0] as number)) {
      const bounds = args[2] as ArrayLike<number> | null;
      if (!bounds) return;
      const placed = box(ctm, bounds[0]!, bounds[1]!, bounds[2]!, bounds[3]!);
      const width = placed.right - placed.left;
      const tall = placed.top - placed.bottom;
      if (width >= 1 && width <= 8 && tall >= 1 && tall <= 8 && Math.abs(width - tall) <= 1.5) markers.push({ page: index, x: (placed.left + placed.right) / 2, y: height - (placed.top + placed.bottom) / 2, size: width });
    }
  });
  return { markers, images };
}

/** Marked-content IDs inside an LI element of the structure tree (a tagged PDF's list items), with the item's number. */
async function listContent(page: PdfPage): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  type Node = { role?: string; type?: string; id?: string; children?: Node[] };
  let items = 0;
  const walk = (node: Node, item: number | null) => {
    const own = node.role === 'LI' ? items++ : item;
    if (node.type === 'content' && node.id && own !== null) ids.set(node.id, own);
    for (const child of node.children ?? []) walk(child, own);
  };
  const tree = await page.getStructTree().catch(() => null) as Node | null;
  if (tree) walk(tree, null);
  return ids;
}

type Link = { rect: number[]; url: string };
type Piece = Pick<PdfRun, 'x' | 'width' | 'text' | 'href'>;

/**
 * pdf.js joins neighbouring text in one font into one item, so a link may cover part of an item. The covered part is
 * found from the link's box, assuming even glyph widths, and moved to the nearest word edge.
 */
function splitAtLinks(text: string, x: number, width: number, links: Link[]): Piece[] {
  const length = text.length;
  const at = (position: number) => Math.min(length, Math.max(0, Math.round((position - x) / width * length)));
  const snap = (index: number, edge: (i: number) => boolean) => {
    for (let distance = 0; distance <= length; distance++) {
      if (index - distance >= 0 && edge(index - distance)) return index - distance;
      if (index + distance <= length && edge(index + distance)) return index + distance;
    }
    return index;
  };
  const wordStart = (i: number) => i === 0 || (i < length && /\s/.test(text[i - 1]!) && !/\s/.test(text[i]!));
  const wordEnd = (i: number) => i === length || (i > 0 && !/\s/.test(text[i - 1]!) && /\s/.test(text[i]!));
  // A link box that only grazes a piece (a closing parenthesis next to the link) does not take it.
  const covered = (start: number, end: number, rect: number[]) => {
    const from = x + start / length * width;
    const to = x + end / length * width;
    return (Math.min(to, rect[2]!) - Math.max(from, rect[0]!)) / Math.max(to - from, 0.01) >= 0.5;
  };
  const spans = links.map(link => ({ start: snap(at(link.rect[0]!), wordStart), end: snap(at(link.rect[2]!), wordEnd), url: link.url, rect: link.rect }))
    .filter(span => span.end > span.start && covered(span.start, span.end, span.rect)).sort((a, b) => a.start - b.start);
  const pieces: Piece[] = [];
  const push = (start: number, end: number, href: string | null) => {
    if (end > start && text.slice(start, end).trim()) pieces.push({ x: x + start / length * width, width: (end - start) / length * width, text: text.slice(start, end), href });
  };
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    push(cursor, span.start, null);
    push(span.start, span.end, span.url);
    cursor = span.end;
  }
  push(cursor, length, null);
  return pieces;
}

export async function extractPdf(bytes: Uint8Array): Promise<Extraction> {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new ImportError('too_large');
  const pdfjs = await loadPdfJs();
  const { task, document } = await open(pdfjs, bytes);
  try {
    if (document.numPages > MAX_PAGES) throw new ImportError('too_many_pages');
    const { info } = await document.getMetadata().catch(() => ({ info: {} }));
    const labels = ['Author', 'Title'].map(key => (info as Record<string, unknown>)[key]).filter((value): value is string => typeof value === 'string' && value.trim() !== '');
    const result: Extraction = { pages: [], runs: [], markers: [], images: [], labels };
    for (let number = 1; number <= document.numPages; number++) {
      const index = number - 1;
      const page = await document.getPage(number);
      const { width, height } = page.getViewport({ scale: 1 });
      result.pages.push({ width, height });
      // The operator list first: it loads the fonts whose names give the weight and style.
      const { markers, images } = await graphics(pdfjs, page, index, height);
      result.images.push(...images);
      const items = await listContent(page);
      // A tagged page names its list items in the structure tree; drawn shapes there are decoration (a timeline dot).
      if (!items.size) result.markers.push(...markers);
      const links = (await page.getAnnotations()).filter(annotation => annotation.subtype === 'Link' && typeof annotation.url === 'string')
        .map((annotation): Link => ({ rect: annotation.rect as number[], url: annotation.url as string }));
      const content = await page.getTextContent({ includeMarkedContent: true });
      const marks: (string | null)[] = [];
      for (const item of content.items) {
        if (!('str' in item)) {
          if (item.type === 'beginMarkedContentProps' || item.type === 'beginMarkedContent') marks.push(item.id ?? null);
          else if (item.type === 'endMarkedContent') marks.pop();
          continue;
        }
        if (!item.str.trim()) continue;
        const [a, b, , d, x, y] = item.transform as number[];
        const size = Math.round(Math.max(Math.hypot(a!, b!), Math.abs(d!)) * 100) / 100;
        const font = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) as { name?: string; bold?: boolean; italic?: boolean; black?: boolean } : null;
        const name = font?.name ?? '';
        const base = {
          page: index, baseline: height - y!, size,
          bold: Boolean(font?.bold || font?.black) || /bold|black|heavy|semibold|demi/i.test(name),
          italic: Boolean(font?.italic) || /italic|oblique/i.test(name),
          item: [...marks].reverse().map(id => id === null ? undefined : items.get(id)).find(value => value !== undefined) ?? null,
        };
        const tagged = { ...base, listItem: base.item !== null };
        const middle = y! + size / 3;
        const onLine = links.filter(({ rect }) => middle >= rect[1]! && middle <= rect[3]! && rect[2]! > x! && rect[0]! < x! + item.width);
        for (const piece of splitAtLinks(item.str, x!, item.width, onLine)) result.runs.push({ ...tagged, ...piece });
      }
    }
    if (!result.runs.length) throw new ImportError('no_text_layer');
    return result;
  } finally {
    await task.destroy();
  }
}

/** The photo's pixels as PNG, drawn in the browser; null when the image cannot be read (DD-IMP-15). */
export async function extractPhoto(bytes: Uint8Array, image: PdfImage): Promise<Blob | null> {
  if (typeof document === 'undefined' || !image.id) return null;
  const pdfjs = await loadPdfJs();
  const { task, document: pdf } = await open(pdfjs, bytes);
  try {
    const page = await pdf.getPage(image.page + 1);
    await page.getOperatorList();
    const data = page.objs.get(image.id) as { bitmap?: ImageBitmap; data?: Uint8ClampedArray; width: number; height: number } | null;
    if (!data) return null;
    const canvas = window.document.createElement('canvas');
    canvas.width = data.width;
    canvas.height = data.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    if (data.bitmap) context.drawImage(data.bitmap, 0, 0);
    else if (data.data) {
      const rgba = data.data.length === data.width * data.height * 4 ? data.data : expand(data.data, data.width * data.height);
      context.putImageData(new ImageData(new Uint8ClampedArray(rgba), data.width, data.height), 0, 0);
    } else return null;
    return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  } finally {
    await task.destroy();
  }
}

function expand(rgb: Uint8ClampedArray, pixels: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(pixels * 4);
  for (let index = 0; index < pixels; index++) {
    rgba[index * 4] = rgb[index * 3]!;
    rgba[index * 4 + 1] = rgb[index * 3 + 1]!;
    rgba[index * 4 + 2] = rgb[index * 3 + 2]!;
    rgba[index * 4 + 3] = 255;
  }
  return rgba;
}
