import * as XLSX from "xlsx";

export interface ReportColumn {
  header: string;
  align?: "left" | "right";
  numeric?: boolean;
}

export interface ReportSection {
  title?: string;
  columns: ReportColumn[];
  rows: string[][];
  footer?: string[];
}

export interface ReportMeta {
  label: string;
  value: string;
}

export interface ReportDoc {
  title: string;
  companyName: string;
  meta: ReportMeta[];
  sections: ReportSection[];
  rtl: boolean;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toCell(value: string, numeric?: boolean): string | number {
  if (!numeric) return value;
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) ? n : value;
}

export function exportReportToExcel(doc: ReportDoc, filename: string): void {
  const aoa: (string | number)[][] = [];
  aoa.push([doc.title]);
  if (doc.companyName) aoa.push([doc.companyName]);
  for (const m of doc.meta) aoa.push([m.label, m.value]);
  aoa.push([]);

  for (const section of doc.sections) {
    if (section.title) aoa.push([section.title]);
    aoa.push(section.columns.map((c) => c.header));
    for (const row of section.rows) {
      aoa.push(row.map((cell, i) => toCell(cell, section.columns[i]?.numeric)));
    }
    if (section.footer) {
      aoa.push(section.footer.map((cell, i) => toCell(cell, section.columns[i]?.numeric)));
    }
    aoa.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function printReportToPdf(doc: ReportDoc): void {
  const dir = doc.rtl ? "rtl" : "ltr";
  const lang = doc.rtl ? "ar" : "en";
  const valueAlign = doc.rtl ? "left" : "right";

  const metaHtml = doc.meta
    .map((m) => `<span class="meta-item"><b>${escapeHtml(m.label)}:</b> ${escapeHtml(m.value)}</span>`)
    .join("");

  const sectionsHtml = doc.sections
    .map((section) => {
      const headHtml = section.columns
        .map((c) => `<th class="${c.align === "right" ? "right" : ""}">${escapeHtml(c.header)}</th>`)
        .join("");
      const bodyHtml = section.rows.length
        ? section.rows
            .map(
              (row) =>
                `<tr>${row
                  .map(
                    (cell, i) =>
                      `<td class="${section.columns[i]?.align === "right" ? "right" : ""}">${escapeHtml(cell)}</td>`,
                  )
                  .join("")}</tr>`,
            )
            .join("")
        : `<tr><td colspan="${section.columns.length}" class="empty">—</td></tr>`;
      const footHtml = section.footer
        ? `<tfoot><tr>${section.footer
            .map(
              (cell, i) =>
                `<td class="${section.columns[i]?.align === "right" ? "right" : ""}">${escapeHtml(cell)}</td>`,
            )
            .join("")}</tr></tfoot>`
        : "";
      const titleHtml = section.title ? `<h3>${escapeHtml(section.title)}</h3>` : "";
      return `${titleHtml}<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody>${footHtml}</table>`;
    })
    .join("");

  const html = `<!doctype html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8"><title>${escapeHtml(
    doc.title,
  )}</title>
    <style>
      * { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; box-sizing: border-box; }
      body { margin: 0; padding: 32px; color: #1a1a1a; }
      .head { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
      .company { font-size: 18px; font-weight: 700; }
      .title { font-size: 22px; font-weight: 700; margin-top: 4px; }
      .meta { margin-top: 8px; color: #555; font-size: 13px; display: flex; flex-wrap: wrap; gap: 16px; }
      h3 { font-size: 15px; margin: 20px 0 6px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      th, td { padding: 7px 10px; border-bottom: 1px solid #e5e5e5; font-size: 13px; text-align: ${
        doc.rtl ? "right" : "left"
      }; }
      th { background: #f3f3f3; font-weight: 600; }
      td.right, th.right { text-align: ${valueAlign}; }
      td.empty { text-align: center; color: #999; }
      tfoot td { font-weight: 700; border-top: 2px solid #111; }
      @media print { body { padding: 0; } th { background: #f3f3f3 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>
    <div class="head">
      ${doc.companyName ? `<div class="company">${escapeHtml(doc.companyName)}</div>` : ""}
      <div class="title">${escapeHtml(doc.title)}</div>
      ${metaHtml ? `<div class="meta">${metaHtml}</div>` : ""}
    </div>
    ${sectionsHtml}
    <script>window.onload = function(){ window.print(); }</script>
    </body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
