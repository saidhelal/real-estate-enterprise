import { describe, it, expect } from "vitest";
import type { ResourceField } from "./resource-manager";

/**
 * The two halves of the field contract that carry behaviour rather than text.
 *
 * `default` and `permission` were added because the contract could describe a
 * field but not say what it starts as or who may touch it, so screens answered
 * both questions their own way. These assert the rules the component applies,
 * against the same field shapes a screen declares.
 */

/** How the create/edit form seeds a field. Mirrors ResourceManager's `initial`. */
function seed(f: ResourceField, stored: unknown, isEdit: boolean): string {
  if (stored !== null && stored !== undefined) return String(stored);
  return !isEdit && f.default !== undefined
    ? typeof f.default === "function"
      ? f.default()
      : f.default
    : "";
}

/** Mirrors ResourceManager's holds/canView/canEdit. */
const holds = (perms: string[], code?: string) =>
  !code || perms.includes("*") || perms.includes(code);
const canView = (perms: string[], f: ResourceField) => holds(perms, f.permission?.view);
const canEdit = (perms: string[], f: ResourceField) =>
  holds(perms, f.permission?.view) && holds(perms, f.permission?.edit);

describe("field contract: default", () => {
  const withDefault: ResourceField = { name: "status", label: "Status", default: "active" };

  it("fills an empty create form", () => {
    expect(seed(withDefault, undefined, false)).toBe("active");
  });

  it("never overwrites a stored value", () => {
    expect(seed(withDefault, "inactive", true)).toBe("inactive");
  });

  it("does not fill on edit, so a cleared value stays cleared", () => {
    // The record exists and the field is empty because someone emptied it.
    // Re-seeding here would rewrite the record on the next save.
    expect(seed(withDefault, undefined, true)).toBe("");
  });

  it("accepts a function for values only knowable at render time", () => {
    const today: ResourceField = { name: "date", label: "Date", default: () => "2026-08-14" };
    expect(seed(today, undefined, false)).toBe("2026-08-14");
  });

  it("leaves a field with no default empty", () => {
    expect(seed({ name: "note", label: "Note" }, undefined, false)).toBe("");
  });
});

describe("field contract: permission", () => {
  const gated: ResourceField = {
    name: "salary",
    label: "Salary",
    permission: { view: "payroll.view", edit: "payroll.update" },
  };
  const plain: ResourceField = { name: "name", label: "Name" };

  it("shows an ungated field to everyone", () => {
    expect(canView([], plain)).toBe(true);
    expect(canEdit([], plain)).toBe(true);
  });

  it("hides a field from someone without the view permission", () => {
    expect(canView([], gated)).toBe(false);
  });

  it("shows it read-only to someone who may view but not edit", () => {
    expect(canView(["payroll.view"], gated)).toBe(true);
    expect(canEdit(["payroll.view"], gated)).toBe(false);
  });

  it("allows both to someone holding both", () => {
    expect(canEdit(["payroll.view", "payroll.update"], gated)).toBe(true);
  });

  it("gives a wildcard holder everything", () => {
    expect(canView(["*"], gated)).toBe(true);
    expect(canEdit(["*"], gated)).toBe(true);
  });

  it("treats a missing edit permission as governed by view alone", () => {
    const viewOnly: ResourceField = { name: "x", label: "X", permission: { view: "a.view" } };
    expect(canEdit(["a.view"], viewOnly)).toBe(true);
    expect(canEdit([], viewOnly)).toBe(false);
  });
});
