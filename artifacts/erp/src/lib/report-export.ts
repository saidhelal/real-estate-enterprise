import * as XLSX from "xlsx";

export type ExportLang = "ar" | "en";

export interface ReportColumn {
  header: string;
  numeric?: boolean;
}

export type CellValue = string | number | null | undefined;

export interface ReportSection {
  title?: string;
  rows: CellValue[][];
  totalRow?: CellValue[];
}

export interface ReportKeyValue {
  label: string;
  value: string;
}

export interface ReportExport {
  title: string;
  companyName: string;
  language: ExportLang;
  meta: ReportKeyValue[];
  columns: ReportColumn[];
  sections: ReportSection[];
  summary?: ReportKeyValue[];
}

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

function isNumericValue(v: CellValue): boolean {
  return typeof v === "number" || (typeof v === "string" && NUMERIC_RE.test(v.trim()));
}

function toCell(v: CellValue, numeric: boolean): CellValue {
  if (numeric && isNumericValue(v)) return Number(v);
  return v ?? "";
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "report";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportReportToExcel(report: ReportExport, baseFilename: string, generatedLabel: string): void {
  const ncols = Math.max(report.columns.length, 2);
  const aoa: CellValue[][] = [];
  const merges: XLSX.Range[] = [];
  const numericCells: { r: number; c: number }[] = [];

  const pushRow = (cells: CellValue[]): number => {
    aoa.push(cells);
    return aoa.length - 1;
  };
  const pushBanner = (text: string) => {
    const r = pushRow([text]);
    merges.push({ s: { r, c: 0 }, e: { r, c: ncols - 1 } });
  };

  pushBanner(report.title);
  pushBanner(report.companyName);
  for (const m of report.meta) pushBanner(`${m.label}: ${m.value}`);
  pushBanner(`${generatedLabel}: ${todayISO()}`);
  pushRow([]);

  const headerRow = report.columns.map((c) => c.header);
  const trackNumeric = (rowIdx: number, cells: CellValue[]) => {
    report.columns.forEach((col, ci) => {
      if (col.numeric && isNumericValue(cells[ci])) numericCells.push({ r: rowIdx, c: ci });
    });
  };

  for (const section of report.sections) {
    if (section.title) pushBanner(section.title);
    pushRow(headerRow);
    for (const row of section.rows) {
      const cells = report.columns.map((col, ci) => toCell(row[ci], !!col.numeric));
      const rowIdx = pushRow(cells);
      trackNumeric(rowIdx, cells);
    }
    if (section.totalRow) {
      const cells = report.columns.map((col, ci) => toCell(section.totalRow![ci], !!col.numeric));
      const rowIdx = pushRow(cells);
      trackNumeric(rowIdx, cells);
    }
    pushRow([]);
  }

  if (report.summary?.length) {
    for (const s of report.summary) {
      const cells: CellValue[] = new Array(ncols).fill("");
      cells[0] = s.label;
      const last = ncols - 1;
      cells[last] = isNumericValue(s.value) ? Number(s.value) : s.value;
      const rowIdx = pushRow(cells);
      if (isNumericValue(s.value)) numericCells.push({ r: rowIdx, c: last });
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;

  for (const { r, c } of numericCells) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    if (cell) {
      cell.t = "n";
      cell.z = "#,##0.00";
    }
  }

  const colWidths = report.columns.map((col, ci) => {
    let max = col.header.length;
    for (const section of report.sections) {
      for (const row of section.rows) max = Math.max(max, String(row[ci] ?? "").length);
      if (section.totalRow) max = Math.max(max, String(section.totalRow[ci] ?? "").length);
    }
    return { wch: Math.min(Math.max(max + 2, 10), 50) };
  });
  ws["!cols"] = colWidths;
  ws["!views"] = [{ RTL: report.language === "ar" }];

  const wb = XLSX.utils.book_new();
  const sheetName = sanitizeFilename(report.title).slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${sanitizeFilename(baseFilename)}-${todayISO()}.xlsx`);
}

function escapeHtml(v: CellValue): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function exportReportToPdf(report: ReportExport, generatedLabel: string): void {
  const ar = report.language === "ar";
  const dir = ar ? "rtl" : "ltr";
  const start = ar ? "right" : "left";
  const end = ar ? "left" : "right";

  const headerCells = report.columns
    .map((c) => `<th class="${c.numeric ? "num" : ""}">${escapeHtml(c.header)}</th>`)
    .join("");

  const renderRow = (cells: CellValue[], cls = ""): string =>
    `<tr class="${cls}">${report.columns
      .map((col, ci) => `<td class="${col.numeric ? "num" : ""}">${escapeHtml(cells[ci])}</td>`)
      .join("")}</tr>`;

  const sectionsHtml = report.sections
    .map((section) => {
      const heading = section.title
        ? `<h3 class="section">${escapeHtml(section.title)}</h3>`
        : "";
      const body =
        section.rows.length === 0 && !section.totalRow
          ? `<tr><td colspan="${report.columns.length}" class="empty">—</td></tr>`
          : section.rows.map((r) => renderRow(r)).join("") +
            (section.totalRow ? renderRow(section.totalRow, "total") : "");
      return `${heading}<table><thead><tr>${headerCells}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join("");

  const metaHtml = report.meta
    .map((m) => `<div>${escapeHtml(m.label)}: ${escapeHtml(m.value)}</div>`)
    .join("");

  const summaryHtml = report.summary?.length
    ? `<div class="summary">${report.summary
        .map((s) => `<div><span>${escapeHtml(s.label)}</span><strong>${escapeHtml(s.value)}</strong></div>`)
        .join("")}</div>`
    : "";

  const html = `<!doctype html><html dir="${dir}" lang="${ar ? "ar" : "en"}"><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title>
    <style>
      * { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; box-sizing: border-box; }
      /* Standalone print document: this stylesheet ships inside a new window
         with none of the app CSS loaded, so design tokens would resolve to
         nothing. The literal colours below are correct and intentional. */
      body { margin: 0; padding: 40px; color: #1a1a1a; }
      .head { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:flex-start; gap:24px; }
      .company { font-size: 20px; font-weight: 700; }
      .title { font-size: 22px; font-weight: 700; text-align:${end}; }
      .meta { color:#666; font-size: 13px; margin-top:6px; }
      .meta div { margin-top:2px; }
      h3.section { font-size: 16px; font-weight: 700; margin: 22px 0 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      th, td { padding: 9px 8px; border-bottom: 1px solid #eee; font-size: 13px; text-align: ${start}; }
      th { background:#f5f5f5; font-weight:700; }
      td.num, th.num { text-align: ${end}; font-variant-numeric: tabular-nums; }
      tr.total td { font-weight: 700; border-top: 2px solid #ccc; }
      td.empty { text-align:center; color:#999; }
      .summary { margin-top: 20px; border-top: 2px solid #111; padding-top: 12px; display:flex; flex-wrap:wrap; gap:28px; }
      .summary div { display:flex; flex-direction:column; }
      .summary span { color:#666; font-size:12px; }
      .summary strong { font-size:16px; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <div class="head">
      <div><div class="company">${escapeHtml(report.companyName)}</div><div class="meta">${metaHtml}<div>${escapeHtml(generatedLabel)}: ${todayISO()}</div></div></div>
      <div class="title">${escapeHtml(report.title)}</div>
    </div>
    ${sectionsHtml}
    ${summaryHtml}
    <script>window.onload = function(){ window.print(); }</script>
    </body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
