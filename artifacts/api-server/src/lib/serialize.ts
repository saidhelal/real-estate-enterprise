/**
 * Convert a DB row to an API-friendly object: any Date value becomes an ISO
 * string. Extra columns not present in the response Zod schema are stripped by
 * `.parse(...)`, so passing the whole row is safe.
 */
export function serializeRow<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

export interface PageParams {
  page: number;
  pageSize: number;
  offset: number;
}

/** Parse page/pageSize query params with sane defaults and bounds. */
export function pageParams(query: Record<string, unknown>): PageParams {
  const rawPage = Number(query.page);
  const rawSize = Number(query.pageSize);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawSize) && rawSize > 0 ? Math.min(Math.floor(rawSize), 200) : 25;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Read a string query param, returning "" when absent. */
export function qStr(query: Record<string, unknown>, key: string): string {
  const v = query[key];
  return typeof v === "string" ? v.trim() : "";
}
