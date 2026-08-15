import { isValidElement, type ReactNode } from "react";
import { customFetch } from "@workspace/api-client-react";

/**
 * Turning a register into a report.
 *
 * A register screen already knows how to display itself: its columns render
 * React — a badge for a status, a formatted amount, a joined name. Asking each
 * of the 224 screens to describe those same columns a second time, as plain
 * text for a spreadsheet, would be the same information written twice, and the
 * copy would drift the first time a column changed.
 *
 * So the export reads what the screen renders. `cellText` walks the rendered
 * node and keeps the words; anything purely visual contributes nothing.
 */

/**
 * The text a reader sees in a rendered cell.
 *
 * Elements are walked through their children, which is where a badge or a
 * span keeps its label. `false`, `null` and `undefined` are React's way of
 * rendering nothing and become nothing here too — not the strings "false" or
 * "null", which is what a naive `String(node)` would put in the spreadsheet.
 */
export function cellText(node: ReactNode): string {
  if (node === null || node === undefined || node === false || node === true) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(cellText).join(" ").replace(/\s+/g, " ").trim();
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode } | null;
    return cellText(props?.children);
  }
  return "";
}

/**
 * How many rows an export will pull down.
 *
 * A register can hold more rows than a browser should turn into a spreadsheet
 * in one go, and an export that quietly stops at some internal page size is
 * worse than one that says it stopped. `fetchExportRows` reports whether it
 * reached the end, so the caller can tell the user rather than hand them a
 * truncated file that looks complete.
 */
export const EXPORT_ROW_LIMIT = 5000;

export interface ExportRowsResult<T> {
  rows: T[];
  /** Total the server says exists, which may exceed what was fetched. */
  total: number;
  /** False when the register holds more rows than the limit allows. */
  complete: boolean;
}

/**
 * Fetch the rows an export should contain: everything the current search and
 * filters select, not just the page on screen.
 *
 * It goes through `customFetch` — the same transport the generated hooks use,
 * so it carries the session, the base URL and the token refresh — rather than
 * a second HTTP client of its own. A generated hook would be better still,
 * but there is one hook per resource and this component serves all of them;
 * the path it is already given is what makes that possible.
 */
export async function fetchExportRows<T>(
  path: string,
  params: Record<string, unknown>,
): Promise<ExportRowsResult<T>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // `page` and `pageSize` are the screen's, not the export's.
    if (key === "page" || key === "pageSize") continue;
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  query.set("page", "1");
  query.set("pageSize", String(EXPORT_ROW_LIMIT));

  const result = await customFetch<{ data?: T[]; total?: number }>(
    `${path}?${query.toString()}`,
    { method: "GET" },
  );
  const rows = result?.data ?? [];
  const total = result?.total ?? rows.length;
  return { rows, total, complete: rows.length >= total };
}
