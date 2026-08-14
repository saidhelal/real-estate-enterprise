import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Architecture fitness tests for the browser.
 *
 * The rule these enforce is one line: **the frontend never invents a business
 * identifier.** It asks the server for one, or shows the one the server
 * issued. A code built in a browser is not unique — two tabs can build the
 * same one, and nothing in the database is watching.
 *
 * This was not hypothetical. `genCode(prefix)` built codes from a timestamp
 * and a random suffix, and six call sites used it for reservations,
 * installment plans, cheques, receipts and customers.
 *
 * Enforced as a test rather than a lint rule because this workspace has no
 * ESLint setup, and adding one to carry a single rule would be a second
 * enforcement mechanism to keep alive. The failure mode is the same: the
 * suite goes red, with a message saying which engine to use instead.
 */

const SRC = join(import.meta.dirname, "..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** Comments removed, so a rule never fires on its own explanation. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const FILES = walk(SRC).map((path) => {
  const raw = readFileSync(path, "utf8");
  return { rel: path.slice(SRC.length + 1).replace(/\\/g, "/"), code: strip(raw) };
});

/**
 * Where randomness and timestamps are legitimate, and why.
 *
 * None of these produces a value that is stored as a business identifier:
 * they are keys for React lists, a skeleton's width, an idempotency token,
 * and clocks used to display elapsed time.
 */
const RANDOM_ALLOWLIST = new Map<string, string>([
  ["components/ui/sidebar.tsx", "skeleton widths, purely visual"],
  ["lib/data-entry.ts", "uid() — local draft row keys, prefers crypto.randomUUID()"],
  ["pages/internal-correspondence.tsx", "idempotency key, prevents double-send"],
]);

describe("the browser does not invent business identifiers", () => {
  it("has no client-side code generator", () => {
    // `genCode` was the generator. Its absence is the assertion; if a new one
    // appears under any of these names the test names it.
    const suspects = /\b(genCode|generateCode|makeCode|newCode|nextCode|genRef|generateReference)\s*\(/;
    const offenders = FILES.filter((f) => suspects.test(f.code)).map((f) => f.rel);

    expect(
      offenders,
      `A code generator in the browser. Business codes are issued by the server ` +
        `on save; a form that must show the number first calls ` +
        `GET /api/number-preview?documentType=... — see ResourceField.generatorKey. ` +
        `Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("uses randomness only where it is not an identifier", () => {
    const offenders = FILES.filter((f) => /Math\.random\s*\(/.test(f.code))
      .filter((f) => !RANDOM_ALLOWLIST.has(f.rel))
      .map((f) => f.rel);

    expect(
      offenders,
      `Math.random() outside the allowlist. If this is a UI key or an ` +
        `idempotency token, add it to RANDOM_ALLOWLIST with the reason. If it is ` +
        `a business identifier, it belongs to the server. Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("never sends a code built from a timestamp", () => {
    // `code: \`X-${Date.now()}\`` and friends — the exact shape genCode had.
    const offenders = FILES.filter((f) =>
      /\b(code|number|reference)\s*:\s*[`'"][^`'"]*\$\{?\s*Date\.now\(\)/.test(f.code),
    ).map((f) => f.rel);

    expect(
      offenders,
      `A business code built from Date.now() and sent to the API. ` +
        `Offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

describe("the rules can actually catch a violation", () => {
  // A guard nobody has seen fire is a guard nobody knows works.
  it("catches a reintroduced generator", () => {
    const suspects = /\b(genCode|generateCode|makeCode|newCode|nextCode|genRef|generateReference)\s*\(/;
    expect(suspects.test('const c = genCode("RES");')).toBe(true);
    expect(suspects.test("const c = record.code;")).toBe(false);
  });

  it("catches a timestamp-built code", () => {
    const re = /\b(code|number|reference)\s*:\s*[`'"][^`'"]*\$\{?\s*Date\.now\(\)/;
    expect(re.test("{ code: `RES-${Date.now()}` }")).toBe(true);
    expect(re.test("{ code: preview.code }")).toBe(false);
  });
});
