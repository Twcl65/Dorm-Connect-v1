import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

function cell(text: string, opts?: { header?: boolean }) {
  const isHeader = opts?.header === true;
  return new TableCell({
    width: { size: 100 / 6, type: WidthType.PERCENTAGE },
    shading: isHeader ? { fill: "0B2A3C" } : undefined,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D9DDE3" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D9DDE3" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D9DDE3" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D9DDE3" },
    },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text,
            bold: isHeader,
            color: isHeader ? "FFFFFF" : "111827",
            size: 20, // 10pt
          }),
        ],
      }),
    ],
  });
}

export async function buildDocxReport(args: {
  title: string;
  subtitle?: string;
  generatedAt?: Date;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}): Promise<Buffer> {
  const generatedAt = args.generatedAt ?? new Date();
  const columns = args.columns;
  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map((c) => cell(c.label, { header: true })),
  });

  const bodyRows = args.rows.map(
    (r) =>
      new TableRow({
        children: columns.map((c) => {
          const v = r[c.key];
          const txt = v == null ? "" : String(v);
          return cell(txt);
        }),
      })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "DormConnect",
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 80 },
          }),
          new Paragraph({
            text: args.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 80 },
          }),
          ...(args.subtitle
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: args.subtitle, color: "475569", size: 22 }),
                  ],
                  spacing: { after: 120 },
                }),
              ]
            : []),
          new Paragraph({
            children: [
              new TextRun({ text: "Generated: ", bold: true, color: "334155" }),
              new TextRun({
                text: generatedAt.toLocaleString(),
                color: "334155",
              }),
            ],
            spacing: { after: 220 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...bodyRows],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 200, after: 0 },
            children: [
              new TextRun({
                text: "— End of report —",
                color: "94A3B8",
                italics: true,
                size: 18,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const ab = await Packer.toBuffer(doc);
  return ab as unknown as Buffer;
}

