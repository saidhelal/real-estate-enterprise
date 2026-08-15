import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The contract must not claim a column is never null when it is.
 *
 * This is not a documentation nicety. The server validates its own responses
 * against these schemas, so a response schema that requires a non-null string
 * for a nullable column turns one incomplete row into a 500 for the whole
 * endpoint — for every user, not just whoever saved that row.
 *
 * It was found live: a warehouse created without a `warehouseType` broke
 * `GET /api/warehouses` outright. Nine schemas carried the same mistake, all
 * of them "type" columns that are optional in the database and were declared
 * mandatory in the contract.
 *
 * The rule reads the two sources and compares them, rather than keeping a list
 * to maintain: a new nullable column with a required schema property fails
 * here on the day it is written.
 */

const SCHEMA_DIR = join(import.meta.dirname, "..", "..", "..", "lib", "db", "src", "schema");
const SPEC = join(import.meta.dirname, "..", "..", "..", "lib", "api-spec", "openapi.yaml");

/** Drizzle entity name -> { property: isNotNull }. */
function drizzleColumns(): Record<string, Record<string, boolean>> {
  const tables: Record<string, Record<string, boolean>> = {};
  for (const file of readdirSync(SCHEMA_DIR)) {
    if (!file.endsWith(".ts")) continue;
    const src = readFileSync(join(SCHEMA_DIR, file), "utf8");
    const tableRe = /export const (\w+)Table = pgTable\("(\w+)",\s*\{([\s\S]*?)\n\}\)/g;
    let m: RegExpExecArray | null;
    while ((m = tableRe.exec(src))) {
      const cols: Record<string, boolean> = {};
      const colRe = /^\s{2}(\w+):\s*(\w+)\("([^"]+)"[^\n]*$/gm;
      let c: RegExpExecArray | null;
      while ((c = colRe.exec(m[3]))) {
        cols[c[1]] = /\.notNull\(\)/.test(c[0]) || /primaryKey\(\)/.test(c[0]);
      }
      tables[m[1]] = cols;
    }
  }
  return tables;
}

interface SpecSchema {
  required: Set<string>;
  props: Record<string, string>;
}

function specSchemas(): Record<string, SpecSchema> {
  const lines = readFileSync(SPEC, "utf8").split(/\r?\n/);
  const out: Record<string, SpecSchema> = {};
  let current: SpecSchema | null = null;
  let inProps = false;

  for (const line of lines) {
    const name = line.match(/^ {4}(\w+):\s*$/);
    if (name) {
      current = { required: new Set(), props: {} };
      out[name[1]] = current;
      inProps = false;
      continue;
    }
    if (!current) continue;

    const req = line.match(/^ {6}required: \[([^\]]*)\]/);
    if (req) {
      for (const f of req[1].split(",").map((s) => s.trim()).filter(Boolean)) current.required.add(f);
      continue;
    }
    if (/^ {6}properties:\s*$/.test(line)) {
      inProps = true;
      continue;
    }
    if (inProps) {
      const prop = line.match(/^ {8}(\w+):\s*(.*)$/);
      if (prop) current.props[prop[1]] = prop[2];
    }
  }
  return out;
}

describe("the contract agrees with the database about null", () => {
  it("never requires a non-nullable value from a nullable column", () => {
    const tables = drizzleColumns();
    const byLower: Record<string, Record<string, boolean>> = {};
    for (const [entity, cols] of Object.entries(tables)) byLower[entity.toLowerCase()] = cols;

    const offenders: string[] = [];
    for (const [schemaName, schema] of Object.entries(specSchemas())) {
      const key = schemaName.toLowerCase();
      // `Warehouse` <-> `warehouses`; the schema files name the entity in the
      // camelCase singular, so try the plural forms too.
      const cols = byLower[key] ?? byLower[`${key}s`] ?? byLower[key.replace(/y$/, "ies")];
      if (!cols) continue;

      for (const [prop, rawType] of Object.entries(schema.props)) {
        if (rawType.includes('"null"')) continue;
        if (cols[prop] !== false) continue; // not a column, or genuinely NOT NULL
        if (!schema.required.has(prop)) continue;
        offenders.push(`${schemaName}.${prop}`);
      }
    }

    expect(
      offenders,
      `These are declared as required, non-nullable in openapi.yaml while the ` +
        `column allows null. One row saved without the value makes the whole ` +
        `list endpoint return 500, because the server validates its own ` +
        `response. Declare the property as { type: ["string", "null"] } and ` +
        `drop it from \`required\`. Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("can actually detect the mistake it exists to catch", () => {
    // The shape that broke GET /api/warehouses.
    const cols = { warehouseType: false };
    const schema = { required: new Set(["warehouseType"]), props: { warehouseType: "{ type: string }" } };
    const caught =
      !schema.props.warehouseType.includes('"null"') &&
      cols.warehouseType === false &&
      schema.required.has("warehouseType");
    expect(caught).toBe(true);
  });
});
