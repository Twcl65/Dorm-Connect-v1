declare module "pdfkit" {
  interface PDFDocument {
    on(event: "data", listener: (chunk: Buffer) => void): this;
    on(event: "end", listener: () => void): this;
  }
  class PDFDocument {
    constructor(opts?: Record<string, unknown>);
    fillColor(color: string): this;
    fontSize(size: number): this;
    font(name: string): this;
    text(text: string, x?: number, y?: number, opts?: Record<string, unknown>): this;
    rect(x: number, y: number, width: number, height: number): this;
    fillAndRect(x: number, y: number, width: number, height: number): this;
    moveDown(n?: number): this;
    end(): void;
    on(event: "data", listener: (chunk: Buffer) => void): this;
    on(event: "end", listener: () => void): this;
  }
  export default PDFDocument;
}
declare module "pdfkit/js/pdfkit.browser.mjs" {}
declare module "pdfkit/js/pdfkit.standalone.mjs" {}
