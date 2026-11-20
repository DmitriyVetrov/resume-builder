declare module 'pdfkit' {
  export class PDFStructureElement {
    add(child: PDFStructureElement | PDFStructureContent): this;
    end(): void;
  }
  export class PDFStructureContent {}
  export default class PDFDocument {
    constructor(options: Record<string, unknown>);
    addPage(options: Record<string, unknown>): this;
    registerFont(name: string, src: unknown): this;
    font(name: string): this;
    fontSize(size: number): this;
    fillColor(color: string): this;
    text(text: string, x: number, y: number, options: Record<string, unknown>): this;
    rect(x: number, y: number, width: number, height: number): this;
    roundedRect(x: number, y: number, width: number, height: number, radius: number): this;
    fill(color: string): this;
    translate(x: number, y: number): this;
    scale(factor: number): this;
    path(data: string): this;
    lineWidth(width: number): this;
    stroke(color: string): this;
    clip(): this;
    save(): this;
    restore(): this;
    image(src: unknown, x: number, y: number, options: Record<string, unknown>): this;
    link(x: number, y: number, width: number, height: number, url: string, options?: { structParent?: PDFStructureElement }): this;
    struct(tag: string, options?: { alt?: string }): PDFStructureElement;
    addStructure(element: PDFStructureElement): this;
    markContent(tag: string, options?: Record<string, unknown>): this;
    markStructureContent(tag: string, options?: { actual?: string }): PDFStructureContent;
    endMarkedContent(): this;
    on(event: 'data', listener: (chunk: Uint8Array) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    end(): void;
  }
}
