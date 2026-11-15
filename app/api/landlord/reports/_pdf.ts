import PDFDocument from "pdfkit";

type Report = {
  title: string;
  subtitle?: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
};

export async function buildPdfReport(report: Report): Promise<Uint8Array> {
  const margin = 36;
  const doc: any = new PDFDocument({
    size: "LETTER",
    layout: "landscape",
    margins: { top: margin, bottom: margin, left: margin, right: margin },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const tableWidth = pageWidth - margin * 2;
  const headerHeight = 24;
  const rowHeight = 24;
  const fontSize = report.columns.length > 9 ? 6 : 8;
  const columnWeights = report.columns.map((column) =>
    Math.max(8, Math.min(32, column.label.length))
  );
  const totalWeight = columnWeights.reduce((sum, weight) => sum + weight, 0);
  const columnWidths = columnWeights.map(
    (weight) => (weight / totalWeight) * tableWidth
  );

  const drawHeading = () => {
    doc
      .fillColor("#0B2A3C")
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("DormConnect", margin, margin, { lineBreak: false });
    doc
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(report.title, margin, margin + 24, { lineBreak: false });
    if (report.subtitle) {
      doc
        .fillColor("#475569")
        .font("Helvetica")
        .fontSize(9)
        .text(report.subtitle, margin, margin + 50, {
          width: tableWidth,
          lineBreak: false,
          ellipsis: true,
        });
    }
    doc
      .fillColor("#475569")
      .font("Helvetica")
      .fontSize(8)
      .text(`Generated: ${new Date().toLocaleString()}`, margin, margin + 64, {
        lineBreak: false,
      });
  };

  let y = margin + 88;
  const drawColumnHeaders = () => {
    let x = margin;
    for (let index = 0; index < report.columns.length; index += 1) {
      const column = report.columns[index];
      const width =
        index === report.columns.length - 1
          ? margin + tableWidth - x
          : columnWidths[index];
      doc.save();
      doc.rect(x, y, width, headerHeight).fill("#0B2A3C");
      doc
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(fontSize)
        .text(column.label, x + 4, y + 7, {
          width: Math.max(1, width - 8),
          lineBreak: false,
          ellipsis: true,
        });
      doc.restore();
      x += width;
    }
    y += headerHeight;
  };

  const drawPageHeader = () => {
    drawHeading();
    y = margin + 88;
    drawColumnHeaders();
  };

  drawPageHeader();
  const rows =
    report.rows.length > 0
      ? report.rows
      : [{ [report.columns[0]?.key ?? ""]: "No records available." }];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    if (y + rowHeight + 20 > pageHeight - margin) {
      doc.addPage();
      drawPageHeader();
    }

    let x = margin;
    for (let columnIndex = 0; columnIndex < report.columns.length; columnIndex += 1) {
      const column = report.columns[columnIndex];
      const width =
        columnIndex === report.columns.length - 1
          ? margin + tableWidth - x
          : columnWidths[columnIndex];
      const value = rows[rowIndex][column.key];
      const text = value == null ? "" : String(value);

      doc.save();
      doc
        .rect(x, y, width, rowHeight)
        .fill(rowIndex % 2 === 0 ? "#FFFFFF" : "#F1F5F9");
      doc
        .strokeColor("#CBD5E1")
        .lineWidth(0.5)
        .rect(x, y, width, rowHeight)
        .stroke();
      doc
        .fillColor("#111827")
        .font("Helvetica")
        .fontSize(fontSize)
        .text(text, x + 4, y + 7, {
          width: Math.max(1, width - 8),
          lineBreak: false,
          ellipsis: true,
        });
      doc.restore();
      x += width;
    }
    y += rowHeight;
  }

  doc
    .fillColor("#64748B")
    .font("Helvetica-Oblique")
    .fontSize(8)
    .text("End of report", margin, y + 8, {
      width: tableWidth,
      align: "right",
      lineBreak: false,
    });

  return new Promise<Uint8Array>((resolve, reject) => {
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);
    doc.end();
  });
}
