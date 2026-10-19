import { PDFDocument, PageSizes, rgb } from "pdf-lib";
import jsPDF from "jspdf";
import mammoth from "mammoth";

export type InspectionPdfDocument = {
  name: string;
  url: string;
};

function makeTextPdf(title: string, text: string): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(doc.splitTextToSize(title, pageWidth - margin * 2), margin, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  for (const paragraph of text.split(/\r?\n/)) {
    const lines = doc.splitTextToSize(paragraph || " ", pageWidth - margin * 2);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 5;
    }
    y += 2;
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

async function addPdfBytes(target: PDFDocument, bytes: Uint8Array): Promise<void> {
  const source = await PDFDocument.load(bytes);
  const pages = await target.copyPages(source, source.getPageIndices());
  pages.forEach((page) => target.addPage(page));
}

async function imageBytesAsJpeg(blob: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read submitted image.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Could not convert submitted image."))),
      "image/jpeg",
      0.92
    );
  });
  return new Uint8Array(await jpeg.arrayBuffer());
}

async function addImagePage(target: PDFDocument, blob: Blob): Promise<void> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = blob.type.toLowerCase();
  const image =
    mime === "image/png"
      ? await target.embedPng(bytes)
      : mime === "image/jpeg" || mime === "image/jpg"
        ? await target.embedJpg(bytes)
        : await target.embedJpg(await imageBytesAsJpeg(blob));
  const page = target.addPage(PageSizes.A4);
  const margin = 28;
  const maxWidth = page.getWidth() - margin * 2;
  const maxHeight = page.getHeight() - margin * 2;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: (page.getWidth() - width) / 2,
    y: (page.getHeight() - height) / 2,
    width,
    height,
  });
}

async function addReferencePage(
  target: PDFDocument,
  document: InspectionPdfDocument,
  reason: string
): Promise<void> {
  const reference = makeTextPdf(
    `Submitted document: ${document.name}`,
    `${reason}\n\nOriginal file: ${document.url}`
  );
  await addPdfBytes(target, reference);
}

export async function appendDocumentsAndPreparedBy(
  reportBytes: Uint8Array,
  documents: InspectionPdfDocument[],
  preparedBy: string,
  preparedByRole: string
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(reportBytes);

  for (const submittedDocument of documents) {
    try {
      const response = await fetch(new URL(submittedDocument.url, window.location.origin));
      if (!response.ok) throw new Error(`Unable to fetch file (${response.status}).`);
      const blob = await response.blob();
      const path = submittedDocument.url.split("?")[0]?.toLowerCase() ?? "";

      if (blob.type === "application/pdf" || path.endsWith(".pdf")) {
        await addPdfBytes(pdf, new Uint8Array(await blob.arrayBuffer()));
      } else if (blob.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(path)) {
        await addImagePage(pdf, blob);
      } else if (path.endsWith(".docx")) {
        const arrayBuffer = await blob.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer });
        await addPdfBytes(
          pdf,
          makeTextPdf(submittedDocument.name, value || "This document contains no extractable text.")
        );
      } else {
        await addReferencePage(
          pdf,
          submittedDocument,
          "This file format cannot be merged into a PDF in the browser. The original document is referenced below."
        );
      }
    } catch (error) {
      await addReferencePage(
        pdf,
        submittedDocument,
        error instanceof Error
          ? `The original file could not be embedded: ${error.message}`
          : "The original file could not be embedded."
      );
    }
  }

  const signature = pdf.addPage(PageSizes.A4);
  const { width, height } = signature.getSize();
  const x = 48;
  const lineY = height - 145;
  signature.drawLine({ start: { x, y: lineY }, end: { x: width - x, y: lineY }, thickness: 0.7 });
  signature.drawText(`Prepared by: ${preparedBy || "Not recorded"}`, {
    x,
    y: lineY - 24,
    size: 13,
  });
  signature.drawText(preparedByRole || "Staff", {
    x,
    y: lineY - 42,
    size: 10,
  });

  const pageCount = pdf.getPageCount();
  const font = await pdf.embedFont("Helvetica");
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.getPage(index);
    const pageNumber = `Page ${index + 1} of ${pageCount}`;
    page.drawLine({
      start: { x: 48, y: 28 },
      end: { x: page.getWidth() - 48, y: 28 },
      thickness: 0.5,
      color: rgb(0.82, 0.86, 0.89),
    });
    page.drawText(pageNumber, {
      x: page.getWidth() - 48 - font.widthOfTextAtSize(pageNumber, 8),
      y: 16,
      size: 8,
      font,
    });
  }

  return pdf.save();
}