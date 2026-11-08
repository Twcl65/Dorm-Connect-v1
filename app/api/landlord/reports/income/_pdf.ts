import PDFDocument from "pdfkit";
import * as fs from "fs";

function cell(
  text: string,
  width: number,
  opts?: { header?: boolean; fontSize?: number }
) {
  const isHeader = opts?.header === true;
  const fontSize = opts?.fontSize ?? 9;

  const lines = text.split(/\r?\n/);
  const children: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    children.push({
      text: lines[i],
      bold: isHeader,
      color: isHeader ? "FFFFFF" : "111827",
      size: fontSize,
    });
    if (i < lines.length - 1) {
      children.push({ text: "", break: 1 });
    }
  }

  let shading: Record<string, string> | undefined;
  if (isHeader) {
    shading = { fill: "0B2A3C" };
  }

  return {
    width: { size: width, type: "PERCENTAGE" },
    shading,
    margins: { top: 20, bottom: 20, left: 30, right: 30 },
    borders: {
      top: { style: "SINGLE" as const, size: 1, color: "D9DDE3" },
      bottom: { style: "SINGLE" as const, size: 1, color: "D9DDE3" },
      left: { style: "SINGLE" as const, size: 1, color: "D9DDE3" },
      right: { style: "SINGLE" as const, size: 1, color: "D9DDE3" },
    },
    children: [
      {
        type: "table" as const,
        children: [
          {
            type: "tableRow" as const,
            children,
            tableHeader: isHeader,
          },
        ],
      },
    ],
  };
}

export async function buildPdfReport(args: {
  title: string;
  subtitle?: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}): Promise<Uint8Array> {
  const doc: any = new PDFDocument({ margin: 40 });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  doc
    .fillColor("#0B2A3C")
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("DormConnect", 40, 30);

  doc
    .fillColor("#111827")
    .fontSize(22)
    .font("Helvetica-Bold")
    .text(args.title, 40, 55);

  if (args.subtitle) {
    doc
      .fillColor("#475569")
      .fontSize(12)
      .font("Helvetica")
      .text(args.subtitle, 40, 85);
  }

  doc
    .fillColor("#475569")
    .fontSize(10)
    .font("Helvetica")
    .text(`Generated: ${new Date().toLocaleString()}`, 40, 110);

  const colCount = args.columns.length;
  const totalWidth = 520;
  const weights = args.columns.map((c) =>
    Math.max(c.label.length, 6) * 2.5
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colWidths = weights.map((w) => Math.round((w / totalWeight) * totalWidth));

  let y = 140;
  for (let i = 0; i < args.columns.length; i++) {
    const col = args.columns[i];
    const x = 40 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc
      .fillColor("#FFFFFF")
      .rect(x, y, colWidths[i], 22)
      .fill("#FFFFFF");
    doc
      .fillColor("#0B2A3C")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(col.label, x + 8, y + 5, { width: colWidths[i] - 16, align: "left" });
  }

  y += 28;

  for (let r = 0; r < args.rows.length; r++) {
    const row = args.rows[r];
    const alt = r % 2 === 1;
    const rowHeight = 20;
    const rowStart = y;

    doc
      .fillColor(alt ? "#F3F4F6" : "#FFFFFF")
      .rect(40, rowStart, totalWidth, rowHeight).fill("#FFFFFF");

    const x = 40;
    for (let i = 0; i < args.columns.length; i++) {
      const col = args.columns[i];
      const val = row[col.key];
      const text = val == null ? "" : String(val);
      const cellX = x + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc
        .fillColor(alt ? "#111827" : "#334155")
        .fontSize(8)
        .font("Helvetica")
        .text(text, cellX + 8, rowStart + 3, {
          width: colWidths[i] - 16,
          align: "left",
        });
    }

    y += rowHeight;
    if (y > 750) break;
  }

  if (y < 760) {
    doc
      .fillColor("#94A3B8")
      .fontSize(10)
      .font("Helvetica-Oblique")
      .text("— End of report —", 40, y + 10, { align: "right" });
  }

  doc.end();

  return new Promise<Uint8Array>((resolve, reject) => {
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);
  });
}

export type IncomeReportData = {
  monthlySummary: Array<{
    month: string;
    total: number;
    paid: number;
    count: number;
    tenants: string[];
    advanceTotal: number;
    depositTotal: number;
  }>;
  tenantPayments: Array<{
    id: string;
    source: string;
    dormName: string;
    roomNo: string;
    payerName: string;
    amount: number;
    method: string;
    status: string;
    date: string;
    periodLabel?: string;
  }>;
  advanceSummary: Array<{
    month: string;
    total: number;
    count: number;
    payer: string;
    property: string;
  }>;
  depositSummary: Array<{
    month: string;
    total: number;
    count: number;
    payer: string;
    property: string;
  }>;
  targetMonth: string;
};

export async function buildIncomePdfReport(
  data: IncomeReportData
): Promise<Uint8Array> {
  const formatPhp = (n: number) =>
    n.toLocaleString("en-PH", { maximumFractionDigits: 0 });

  function formatMonth(key: string): string {
    const [y, m] = key.split("-");
    if (!m) return key;
    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];
    return `${months[Number(m) - 1]} ${y}`;
  }

  const monthlyRows = data.monthlySummary
    .filter((row) => !data.targetMonth || row.month === data.targetMonth)
    .map((row) => ({
      month: formatMonth(row.month),
      rent: formatPhp(row.total),
      advance: formatPhp(row.advanceTotal),
      deposit: formatPhp(row.depositTotal),
      total: formatPhp(row.total + row.advanceTotal + row.depositTotal),
      paid: `${row.paid} / ${row.count}`,
      tenants: row.tenants.join(", "),
    }));

  const paymentRows = data.tenantPayments.map((payment) => ({
    name: payment.payerName,
    room: payment.roomNo,
    dorm: payment.dormName,
    amount: formatPhp(payment.amount),
    method: payment.method,
    status: payment.status,
    period: payment.periodLabel ?? "—",
    date: payment.date,
  }));

  const advanceRows = data.advanceSummary
    .filter((row) => !data.targetMonth || row.month === data.targetMonth)
    .map((row) => ({
      month: formatMonth(row.month),
      payer: row.payer,
      property: row.property,
      total: formatPhp(row.total),
      count: String(row.count),
    }));

  const depositRows = data.depositSummary
    .filter((row) => !data.targetMonth || row.month === data.targetMonth)
    .map((row) => ({
      month: formatMonth(row.month),
      payer: row.payer,
      property: row.property,
      total: formatPhp(row.total),
      count: String(row.count),
    }));

  const pageMargin = 36;
  const doc: any = new PDFDocument({
    size: "LETTER",
    layout: "landscape",
    margins: { top: pageMargin, bottom: pageMargin, left: pageMargin, right: pageMargin },
    bufferPages: true,
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pageWidth = 720;
  const pageBottom = 576;
  let y = 0;

  const fitText = (value: string, width: number, font: string, size: number) => {
    doc.font(font).fontSize(size);
    if (doc.widthOfString(value) <= width) return value;
    const suffix = "...";
    let low = 0;
    let high = value.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (doc.widthOfString(`${value.slice(0, middle)}${suffix}`) <= width) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return `${value.slice(0, low)}${suffix}`;
  };

  const drawPageHeading = () => {
    doc.fillColor("#0B2A3C").font("Helvetica-Bold").fontSize(19)
      .text("DormConnect", pageMargin, pageMargin, { lineBreak: false });
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(20)
      .text("Income Report", pageMargin, pageMargin + 24, { lineBreak: false });
    const monthText = data.targetMonth ? `Month: ${formatMonth(data.targetMonth)}` : "All months";
    doc.fillColor("#475569").font("Helvetica").fontSize(9)
      .text(`${monthText}  |  Generated: ${new Date().toLocaleString()}`, pageMargin, pageMargin + 50, { lineBreak: false });
    y = pageMargin + 78;
  };

  const drawTableHeader = (
    columns: Array<{ key: string; label: string; width: number; align?: "left" | "right" }>
  ) => {
    let x = pageMargin;
    for (const column of columns) {
      const width = (pageWidth * column.width) / 100;
      doc.save();
      doc.rect(x, y, width, 24).fill("#0B2A3C");
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8)
        .text(column.label, x + 5, y + 7, {
          width: width - 10,
          lineBreak: false,
          ellipsis: true,
          align: column.align ?? "left",
        });
      doc.restore();
      x += width;
    }
    y += 24;
  };

  const drawTable = (
    title: string,
    columns: Array<{ key: string; label: string; width: number; align?: "left" | "right" }>,
    rows: Array<Record<string, string>>
  ) => {
    const rowHeight = 24;
    if (y + 48 > pageBottom) {
      doc.addPage();
      drawPageHeading();
    }
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(11)
      .text(title, pageMargin, y, { lineBreak: false });
    y += 19;
    drawTableHeader(columns);

    const tableRows = rows.length > 0 ? rows : [{ [columns[0].key]: "No records for this month." }];
    for (let rowIndex = 0; rowIndex < tableRows.length; rowIndex++) {
      if (y + rowHeight > pageBottom) {
        doc.addPage();
        drawPageHeading();
        drawTableHeader(columns);
      }

      let x = pageMargin;
      for (const column of columns) {
        const width = (pageWidth * column.width) / 100;
        const background = rowIndex % 2 === 0 ? "#FFFFFF" : "#F1F5F9";
        const value = tableRows[rowIndex][column.key] ?? "";
        const visibleValue = fitText(value, width - 12, "Helvetica", 8);
        const textWidth = doc.widthOfString(visibleValue);
        const textStartX = column.align === "right"
          ? x + width - 6 - textWidth
          : x + 6;
        const textY = y + 8;
        doc.save();
        doc.rect(x, y, width, rowHeight).fill(background);
        doc.strokeColor("#CBD5E1").lineWidth(0.5).rect(x, y, width, rowHeight).stroke();
        doc.fillColor("#111827").font("Helvetica").fontSize(8)
          .text(visibleValue, x + 6, textY, {
            width: width - 12,
            lineBreak: false,
            align: column.align ?? "left",
          });
        doc.restore();
        x += width;
      }
      y += rowHeight;
    }
    y += 16;
  };

  drawPageHeading();
  drawTable("Monthly Income Summary", [
    { key: "month", label: "Month", width: 13 },
    { key: "rent", label: "Monthly Rent", width: 15, align: "right" },
    { key: "advance", label: "Advance", width: 13, align: "right" },
    { key: "deposit", label: "Deposit", width: 13, align: "right" },
    { key: "total", label: "Total", width: 15, align: "right" },
    { key: "paid", label: "Paid / Total", width: 12, align: "right" },
    { key: "tenants", label: "Tenants", width: 19 },
  ], monthlyRows);

  drawTable("Tenant Payments", [
    { key: "name", label: "Name", width: 17 },
    { key: "room", label: "Room", width: 8 },
    { key: "dorm", label: "Dorm", width: 17 },
    { key: "amount", label: "Amount", width: 12, align: "right" },
    { key: "method", label: "Method", width: 10 },
    { key: "status", label: "Status", width: 9 },
    { key: "period", label: "Period", width: 15 },
    { key: "date", label: "Date", width: 12 },
  ], paymentRows);

  if (advanceRows.length > 0) {
    drawTable("Advance Payments", [
      { key: "month", label: "Month", width: 16 },
      { key: "payer", label: "Payer", width: 23 },
      { key: "property", label: "Property", width: 27 },
      { key: "total", label: "Total", width: 20, align: "right" },
      { key: "count", label: "Count", width: 14, align: "right" },
    ], advanceRows);
  }

  if (depositRows.length > 0) {
    drawTable("Security Deposits", [
      { key: "month", label: "Month", width: 16 },
      { key: "payer", label: "Payer", width: 23 },
      { key: "property", label: "Property", width: 27 },
      { key: "total", label: "Total", width: 20, align: "right" },
      { key: "count", label: "Count", width: 14, align: "right" },
    ], depositRows);
  }

  const pageCount = doc.bufferedPageRange().count;
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    doc.switchToPage(pageIndex);
    doc.fillColor("#64748B").font("Helvetica").fontSize(8)
      .text(`Page ${pageIndex + 1} of ${pageCount}`, pageMargin, 590, {
        width: pageWidth,
        align: "right",
        lineBreak: false,
      });
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);
    doc.end();
  });
}
