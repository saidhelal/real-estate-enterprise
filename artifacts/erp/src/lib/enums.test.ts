import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LABELS } from "@workspace/master-data";

/**
 * Every value the interface shows must be showable in both languages.
 *
 * `enumLabel(value, lang)` falls back to the raw value when the registry has
 * no entry for it. That fallback is silent and it does not look like a missing
 * translation — it looks like a broken screen: `partially_received` in Latin
 * script, sitting in the middle of an Arabic table row. Fifty-six values were
 * reaching users that way.
 *
 * Documenting the rule would not have caught them, because nothing reads the
 * documentation when a new status is added. This does: a status introduced
 * without an Arabic label fails the suite on the day it is written, and the
 * failure names the value and the screen that shows it.
 */

const ERP = join(import.meta.dirname, "..");

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

/** Every value the screens hand to `enumOptions([...])`, and where from. */
function renderedValues(): Map<string, Set<string>> {
  const used = new Map<string, Set<string>>();
  for (const file of walk(ERP)) {
    const rel = file.slice(ERP.length + 1).replace(/\\/g, "/");
    const src = readFileSync(file, "utf8");
    for (const call of src.matchAll(/enumOptions\(\[([^\]]*)\]/g)) {
      for (const v of call[1].matchAll(/"([a-z][a-z_0-9]*)"/g)) {
        if (!used.has(v[1])) used.set(v[1], new Set());
        used.get(v[1])!.add(rel);
      }
    }
  }
  return used;
}

describe("nothing reaches an Arabic screen in English", () => {
  it("every value the screens offer has a label in both languages", () => {
    const used = renderedValues();
    const missing = [...used.entries()]
      .filter(([value]) => !LABELS[value])
      .map(([value, files]) => `${value} (${[...files].slice(0, 2).join(", ")})`);

    expect(
      missing,
      `These values are offered in a dropdown and rendered in a table, but the ` +
        `central registry has no entry for them — so enumLabel() returns the raw ` +
        `value and an Arabic screen shows Latin text. Add them to LABELS in ` +
        `lib/master-data/src/index.ts, which the seed and the web layer share. ` +
        `Missing: ${missing.join("; ")}`,
    ).toEqual([]);
  });

  it("every registered label actually carries both languages", () => {
    // An entry with an empty or English-only `ar` is worse than a missing one:
    // it passes the check above while still showing English.
    const broken = Object.entries(LABELS)
      .filter(([, pair]) => !pair.ar?.trim() || !pair.en?.trim())
      .map(([value]) => value);

    expect(broken, `Registry entries missing one side: ${broken.join(", ")}`).toEqual([]);
  });

  it("no Arabic label was left as a copy of the English one", () => {
    // The shape a hurried addition takes: `{ en: "Posted", ar: "Posted" }`.
    // Acronyms and codes that read identically in both are the exception, so
    // only entries containing Latin letters in `ar` are flagged.
    const untranslated = Object.entries(LABELS)
      .filter(([, pair]) => pair.ar === pair.en && /[A-Za-z]{3,}/.test(pair.ar))
      .map(([value, pair]) => `${value}="${pair.ar}"`);

    expect(
      untranslated,
      `These carry the English text as their Arabic label: ${untranslated.join(", ")}`,
    ).toEqual([]);
  });

  it("can actually catch an untranslated value", () => {
    // A guard nobody has seen fire is a guard nobody knows works.
    const pretend = { partially_received: undefined } as Record<string, unknown>;
    expect(!pretend.partially_received).toBe(true);
    expect(!!LABELS.partially_received).toBe(true);
    expect(LABELS.partially_received.ar).toBe("مستلم جزئيًا");
  });
});
