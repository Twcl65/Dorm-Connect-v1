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
  PageOrientation,
  ImageRun,
} from "docx";
import * as fs from "fs";
import * as path from "path";

function cell(
  text: string,
  widthPercent: number,
  opts?: { header?: boolean; fontSize?: number; altRow?: boolean }
) {
  const isHeader = opts?.header === true;
  const isAltRow = opts?.altRow === true;
  const fontSize = opts?.fontSize ?? 20;

  const lines = text.split(/\r?\n/);
  const children: TextRun[] = [];
  for (let i = 0; i < lines.length; i++) {
    children.push(
      new TextRun({
        text: lines[i],
        bold: isHeader,
        color: isHeader ? "FFFFFF" : "111827",
        size: fontSize,
      })
    );
    if (i < lines.length - 1) {
      children.push(new TextRun({ break: 1 }));
    }
  }

  let shading: { fill: string } | undefined;
  if (isHeader) {
    shading = { fill: "0B2A3C" }; // navy header
  } else if (isAltRow) {
    shading = { fill: "F3F4F6" }; // light gray for odd rows
  }

  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading,
    margins: { top: 120, bottom: 120, left: 150, right: 150 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D9DDE3" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D9DDE3" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D9DDE3" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D9DDE3" },
    },
    children: [
      new Paragraph({
        alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children,
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
}): Promise<Uint8Array> {
  const generatedAt = args.generatedAt ?? new Date();
  const columns = args.columns;
  const colCount = columns.length;

  // 1. Calculate column weights based on content length
  const colMaxLengths = columns.map((col) => {
    let maxLen = col.label.length;
    for (const row of args.rows) {
      const val = row[col.key];
      const textVal = val == null ? "" : String(val);
      if (textVal.length > maxLen) {
        maxLen = textVal.length;
      }
    }
    return maxLen;
  });

  const colWeights = colMaxLengths.map((len) => {
    return 8 + Math.sqrt(Math.max(0, len - 8)) * 3;
  });
  const totalWeight = colWeights.reduce((a, b) => a + b, 0);
  const colPercentages = colWeights.map((w) => (w / totalWeight) * 100);

  // 2. Select font size dynamically based on column count
  // 6 or less columns: 10pt (20); 7-9 columns: 9pt (18); 10+ columns: 8pt (16)
  const fontSize = colCount <= 6 ? 20 : colCount <= 9 ? 18 : 16;

  // 3. Construct header and body rows
  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map((c, i) =>
      cell(c.label, colPercentages[i], { header: true, fontSize })
    ),
  });

  const bodyRows = args.rows.map(
    (r, rowIndex) =>
      new TableRow({
        children: columns.map((c, i) => {
          const v = r[c.key];
          const txt = v == null ? "" : String(v);
          const altRow = rowIndex % 2 === 1; // odd rows get gray
          return cell(txt, colPercentages[i], { fontSize, altRow });
        }),
      })
  );

  // 4. Load DormConnect logo
  const logoPath = path.join(process.cwd(), "components", "assets", "logodorm.jpg");
  let logoImageRun: ImageRun | null = null;
  try {
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoImageRun = new ImageRun({
        data: logoBuffer,
        transformation: {
          width: 70,
          height: 70,
        },
        type: "jpg",
      });
    }
  } catch (e) {
    console.error("Error reading logo image:", e);
  }

  // 5. Construct the borderless header layout table
  const headerLayoutTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 80, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0 },
              bottom: { style: BorderStyle.NONE, size: 0 },
              left: { style: BorderStyle.NONE, size: 0 },
              right: { style: BorderStyle.NONE, size: 0 },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "DormConnect",
                    bold: true,
                    size: 24, // 12pt
                    color: "0B2A3C",
                  }),
                ],
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: args.title,
                    bold: true,
                    size: 36, // 18pt
                    color: "111827",
                  }),
                ],
                spacing: { after: 60 },
              }),
              ...(args.subtitle
                ? [
                  new Paragraph({
                    children: [
                      new TextRun({ text: args.subtitle, color: "475569", size: 20 }),
                    ],
                    spacing: { after: 60 },
                  }),
                ]
                : []),
              new Paragraph({
                children: [
                  new TextRun({ text: "Generated: ", bold: true, color: "475569", size: 18 }),
                  new TextRun({
                    text: generatedAt.toLocaleString(),
                    color: "475569",
                    size: 18,
                  }),
                ],
                spacing: { after: 120 },
              }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0 },
              bottom: { style: BorderStyle.NONE, size: 0 },
              left: { style: BorderStyle.NONE, size: 0 },
              right: { style: BorderStyle.NONE, size: 0 },
            },
            children: logoImageRun
              ? [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [logoImageRun],
                }),
              ]
              : [],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 Portrait width
              height: 16838, // A4 Portrait height
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: 1080, // 0.75 in
              bottom: 1080,
              left: 1080,
              right: 1080,
            },
          },
        },
        children: [
          headerLayoutTable,
          new Paragraph({ spacing: { after: 200 } }), // add space between header and table
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
  return new Uint8Array(ab);
}

