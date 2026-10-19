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
    .fillColor("0B2A3C")
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("DormConnect", 40, 30);

  doc
    .fillColor("111827")
    .fontSize(22)
    .font("Helvetica-Bold")
    .text(args.title, 40, 55);

  if (args.subtitle) {
    doc
      .fillColor("475569")
      .fontSize(12)
      .font("Helvetica")
      .text(args.subtitle, 40, 85);
  }

  doc
    .fillColor("475569")
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
      .fillColor("FFFFFF")
      .rect(x, y, colWidths[i], 22)
      .fill("FFFFFF");
    doc
      .fillColor("0B2A3C")
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
      .fillColor(alt ? "F3F4F6" : "FFFFFF")
      .rect(40, rowStart, totalWidth, rowHeight).fill("FFFFFF");

    const x = 40;
    for (let i = 0; i < args.columns.length; i++) {
      const col = args.columns[i];
      const val = row[col.key];
      const text = val == null ? "" : String(val);
      const cellX = x + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc
        .fillColor(alt ? "111827" : "334155")
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
      .fillColor("94A3B8")
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
    `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

  function formatMonth(key: string): string {
    const [y, m] = key.split("-");
    if (!m) return key;
    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];
    return `${months[Number(m) - 1]} ${y}`;
  }

  const monthlyRows = data.monthlySummary.map((m) => ({
    Month: formatMonth(m.month),
    "Rent Total": formatPhp(m.total),
    "Advance": formatPhp(m.advanceTotal),
    "Deposit": formatPhp(m.depositTotal),
    "Grand Total": formatPhp(m.total + m.advanceTotal + m.depositTotal),
    "Paid Tenants": `${m.paid} / ${m.count}`,
    Tenants: m.tenants.join(", "),
  }));

  const paymentRows = data.tenantPayments.map((p) => ({
    Name: p.payerName,
    Room: p.roomNo,
    Dorm: p.dormName,
    Amount: formatPhp(p.amount),
    Method: p.method,
    Status: p.status,
    Period: p.periodLabel ?? "—",
    Date: p.date,
  }));

  const advanceRows = data.advanceSummary.map((a) => ({
    Month: formatMonth(a.month),
    Payer: a.payer,
    Property: a.property,
    Total: formatPhp(a.total),
    Count: String(a.count),
  }));

  const depositRows = data.depositSummary.map((d) => ({
    Month: formatMonth(d.month),
    Payer: d.payer,
    Property: d.property,
    Total: formatPhp(d.total),
    Count: String(d.count),
  }));

  const doc: any = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  doc.fillColor("0B2A3C").fontSize(20).font("Helvetica-Bold").text("DormConnect", 40, 30);
  doc.fillColor("111827").fontSize(22).font("Helvetica-Bold").text("Income Report", 40, 55);
  doc.fillColor("475569").fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, 40, 85);
  if (data.targetMonth) {
    doc.fillColor("475569").fontSize(10).font("Helvetica").text(`Month: ${formatMonth(data.targetMonth)}`, 40, 100);
  }

  let y = 120;

  // Monthly Summary table
  doc.fillColor("111827").fontSize(11).font("Helvetica-Bold").text("Monthly Income Summary", 40, y);
  y += 20;

  const monthlyCols = [
    { label: "Month", width: 16 },
    { label: "Rent", width: 14 },
    { label: "Advance", width: 12 },
    { label: "Deposit", width: 12 },
    { label: "Total", width: 14 },
    { label: "Tenants", width: 12 },
    { label: "Paid", width: 10 },
    { label: "Tenant List", width: 20 },
  ];
  const monthlyColWidths = monthlyCols.map((c) => Math.round((c.width / 100) * 520));

  // Header row
  let x = 40;
  doc.fillColor("0B2A3C");
  for (let i = 0; i < monthlyCols.length; i++) {
    doc.rect(x, y, monthlyColWidths[i], 18).fill("0B2A3C");
    doc.fillColor("FFFFFF").fontSize(7).font("Helvetica-Bold").text(monthlyCols[i].label, x + 4, y + 4, { width: monthlyColWidths[i] - 8 });
    doc.fillColor("0B2A3C");
    x += monthlyColWidths[i];
  }
  y += 18;

  // Data rows
  for (const row of monthlyRows) {
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
    x = 40;
    doc.fillColor("FFFFFF");
    for (let i = 0; i < monthlyCols.length; i++) {
      doc.rect(x, y, monthlyColWidths[i], 16).fill("FFFFFF");
      doc.fillColor("111827").fontSize(7).font("Helvetica").text(String((row as any)[monthlyCols[i].label]), x + 4, y + 3, { width: monthlyColWidths[i] - 8 });
      doc.fillColor("FFFFFF");
      x += monthlyColWidths[i];
    }
    y += 16;
  }
  y += 10;

  // Tenant Payments table
  doc.fillColor("111827").fontSize(11).font("Helvetica-Bold").text("Tenant Payments", 40, y);
  y += 20;

  const payCols = [
    { label: "Name", width: 18 },
    { label: "Room", width: 8 },
    { label: "Dorm", width: 18 },
    { label: "Amount", width: 10 },
    { label: "Method", width: 10 },
    { label: "Status", width: 10 },
    { label: "Period", width: 16 },
    { label: "Date", width: 10 },
  ];
  const payColWidths = payCols.map((c) => Math.round((c.width / 100) * 520));

  x = 40;
  doc.fillColor("0B2A3C");
  for (let i = 0; i < payCols.length; i++) {
    doc.rect(x, y, payColWidths[i], 18).fill("0B2A3C");
    doc.fillColor("FFFFFF").fontSize(7).font("Helvetica-Bold").text(payCols[i].label, x + 4, y + 4, { width: payColWidths[i] - 8 });
    doc.fillColor("0B2A3C");
    x += payColWidths[i];
  }
  y += 18;

  for (const row of paymentRows) {
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
    x = 40;
    doc.fillColor("FFFFFF");
    for (let i = 0; i < payCols.length; i++) {
      doc.rect(x, y, payColWidths[i], 14).fill("FFFFFF");
      doc.fillColor("111827").fontSize(6).font("Helvetica").text(String((row as any)[payCols[i].label]), x + 4, y + 2, { width: payColWidths[i] - 8 });
      doc.fillColor("FFFFFF");
      x += payColWidths[i];
    }
    y += 14;
  }
  y += 10;

  // Advance Payments table
  if (advanceRows.length > 0) {
    doc.fillColor("111827").fontSize(11).font("Helvetica-Bold").text("Advance Payments", 40, y);
    y += 20;
    const advCols = [{ label: "Month", width: 16 }, { label: "Payer", width: 20 }, { label: "Property", width: 24 }, { label: "Total", width: 14 }, { label: "Count", width: 8 }];
    const advColWidths = advCols.map((c) => Math.round((c.width / 100) * 520));
    x = 40;
    doc.fillColor("0B2A3C");
    for (let i = 0; i < advCols.length; i++) {
      doc.rect(x, y, advColWidths[i], 18).fill("0B2A3C");
      doc.fillColor("FFFFFF").fontSize(7).font("Helvetica-Bold").text(advCols[i].label, x + 4, y + 4, { width: advColWidths[i] - 8 });
      doc.fillColor("0B2A3C");
      x += advColWidths[i];
    }
    y += 18;
    for (const row of advanceRows) {
      if (y > 750) { doc.addPage(); y = 50; }
      x = 40;
      doc.fillColor("FFFFFF");
      for (let i = 0; i < advCols.length; i++) {
        doc.rect(x, y, advColWidths[i], 14).fill("FFFFFF");
        doc.fillColor("111827").fontSize(6).font("Helvetica").text(String((row as any)[advCols[i].label]), x + 4, y + 2, { width: advColWidths[i] - 8 });
        doc.fillColor("FFFFFF");
        x += advColWidths[i];
      }
      y += 14;
    }
    y += 10;
  }

  // Deposit Payments table
  if (depositRows.length > 0) {
    doc.fillColor("111827").fontSize(11).font("Helvetica-Bold").text("Security Deposits", 40, y);
    y += 20;
    const depCols = [{ label: "Month", width: 16 }, { label: "Payer", width: 20 }, { label: "Property", width: 24 }, { label: "Total", width: 14 }, { label: "Count", width: 8 }];
    const depColWidths = depCols.map((c) => Math.round((c.width / 100) * 520));
    x = 40;
    doc.fillColor("0B2A3C");
    for (let i = 0; i < depCols.length; i++) {
      doc.rect(x, y, depColWidths[i], 18).fill("0B2A3C");
      doc.fillColor("FFFFFF").fontSize(7).font("Helvetica-Bold").text(depCols[i].label, x + 4, y + 4, { width: depColWidths[i] - 8 });
      doc.fillColor("0B2A3C");
      x += depColWidths[i];
    }
    y += 18;
    for (const row of depositRows) {
      if (y > 750) { doc.addPage(); y = 50; }
      x = 40;
      doc.fillColor("FFFFFF");
      for (let i = 0; i < depCols.length; i++) {
        doc.rect(x, y, depColWidths[i], 14).fill("FFFFFF");
        doc.fillColor("111827").fontSize(6).font("Helvetica").text(String((row as any)[depCols[i].label]), x + 4, y + 2, { width: depColWidths[i] - 8 });
        doc.fillColor("FFFFFF");
        x += depColWidths[i];
      }
      y += 14;
    }
    y += 10;
  }

  doc.fillColor("94A3B8").fontSize(8).font("Helvetica-Oblique").text("— End of report —", 40, y, { align: "right" });
  doc.end();
  return new Promise<Uint8Array>((resolve, reject) => {
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);
  });
}
