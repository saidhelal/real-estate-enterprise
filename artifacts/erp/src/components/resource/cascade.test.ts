import { describe, it, expect } from "vitest";
import { NONE, resetDescendants, visibleOptions } from "./cascade";
import type { ResourceField, SelectOption } from "./resource-manager";

/**
 * Models the real hierarchy cascade used across the ERP forms:
 *   Project -> Building -> Floor -> Unit
 * Each child's options carry `parentValue` pointing at its direct parent's id,
 * and each child field `dependsOn` its parent field. This mirrors how the unit
 * create/edit form wires the dropdowns.
 */
function opt(value: string, parentValue?: string): SelectOption {
  return { value, label: value, parentValue };
}

const projectOptions: SelectOption[] = [opt("p1"), opt("p2")];
const buildingOptions: SelectOption[] = [
  opt("b1", "p1"),
  opt("b2", "p1"),
  opt("b3", "p2"),
];
const floorOptions: SelectOption[] = [
  opt("f1", "b1"),
  opt("f2", "b2"),
  opt("f3", "b3"),
];
const unitOptions: SelectOption[] = [
  opt("u1", "f1"),
  opt("u2", "f2"),
  opt("u3", "f3"),
];

const fields: ResourceField[] = [
  { name: "projectId", label: "Project", type: "select", options: projectOptions },
  { name: "buildingId", label: "Building", type: "select", options: buildingOptions, dependsOn: "projectId" },
  { name: "floorId", label: "Floor", type: "select", options: floorOptions, dependsOn: "buildingId" },
  { name: "unitId", label: "Unit", type: "select", options: unitOptions, dependsOn: "floorId" },
];

const byName = (name: string): ResourceField => fields.find((f) => f.name === name)!;

describe("visibleOptions — cascade filtering by parent value", () => {
  it("shows all options when no parent is selected", () => {
    const fd: Record<string, string> = {};
    expect(visibleOptions(fields, fd, byName("buildingId")).map((o) => o.value)).toEqual([
      "b1",
      "b2",
      "b3",
    ]);
  });

  it("filters children to the selected parent", () => {
    const fd: Record<string, string> = { projectId: "p1" };
    expect(visibleOptions(fields, fd, byName("buildingId")).map((o) => o.value)).toEqual([
      "b1",
      "b2",
    ]);
  });

  it("filters deep down the chain (floor -> selected building)", () => {
    const fd: Record<string, string> = { projectId: "p1", buildingId: "b2" };
    expect(visibleOptions(fields, fd, byName("floorId")).map((o) => o.value)).toEqual(["f2"]);
  });

  it("treats the NONE sentinel as 'no constraint'", () => {
    const fd: Record<string, string> = { projectId: NONE };
    expect(visibleOptions(fields, fd, byName("buildingId")).map((o) => o.value)).toEqual([
      "b1",
      "b2",
      "b3",
    ]);
  });

  it("supports multi-parent narrowing via parentValues", () => {
    const multi: ResourceField = {
      name: "buildingId",
      label: "Building",
      type: "select",
      dependsOn: ["projectId", "phaseId"],
      options: [
        { value: "b1", label: "b1", parentValues: { projectId: "p1", phaseId: "ph1" } },
        { value: "b2", label: "b2", parentValues: { projectId: "p1", phaseId: "ph2" } },
        { value: "b3", label: "b3", parentValues: { projectId: "p1", phaseId: null } },
      ],
    };
    const f = [multi];
    const fd: Record<string, string> = { projectId: "p1", phaseId: "ph1" };
    expect(visibleOptions(f, fd, multi).map((o) => o.value)).toEqual(["b1"]);
  });

  it("excludes an option whose parentValues entry is null once that parent is set", () => {
    const multi: ResourceField = {
      name: "buildingId",
      label: "Building",
      type: "select",
      dependsOn: ["projectId", "phaseId"],
      options: [
        { value: "b1", label: "b1", parentValues: { projectId: "p1", phaseId: "ph1" } },
        { value: "b3", label: "b3", parentValues: { projectId: "p1", phaseId: null } },
      ],
    };
    const fd: Record<string, string> = { projectId: "p1", phaseId: "ph1" };
    expect(visibleOptions([multi], fd, multi).map((o) => o.value)).toEqual(["b1"]);
  });
});

describe("visibleOptions — no ghost value when editing", () => {
  it("keeps the currently-selected value even if it no longer matches the parent filter", () => {
    // Editing a record whose stored unit (u3) belongs to floor f3, but the form's
    // floor filter currently points at f1. The stored value must remain visible
    // so the trigger renders it instead of falling back to the placeholder.
    const fd: Record<string, string> = { floorId: "f1", unitId: "u3" };
    const visible = visibleOptions(fields, fd, byName("unitId")).map((o) => o.value);
    expect(visible).toContain("u3");
    // It still filters the rest: u1 matches f1, u2/u3 do not (but u3 kept as current).
    expect(visible).toContain("u1");
    expect(visible).not.toContain("u2");
  });

  it("keeps a stored value that is unavailable/inconsistent with no matching parent", () => {
    const fd: Record<string, string> = { floorId: "f2", unitId: "unavailable-stored" };
    const extra: ResourceField = {
      ...byName("unitId"),
      options: [...unitOptions, opt("unavailable-stored", "deleted-floor")],
    };
    const f = fields.map((x) => (x.name === "unitId" ? extra : x));
    const visible = visibleOptions(f, fd, extra).map((o) => o.value);
    expect(visible).toContain("unavailable-stored");
  });
});

describe("resetDescendants — stale child selections are cleared on parent change", () => {
  it("clears the whole descendant chain when the root parent changes", () => {
    const prev: Record<string, string> = {
      projectId: "p1",
      buildingId: "b1",
      floorId: "f1",
      unitId: "u1",
    };
    // Simulate selecting a new project: setValue merges the new value first.
    const next = resetDescendants(fields, { ...prev, projectId: "p2" }, "projectId");
    expect(next.projectId).toBe("p2");
    expect(next.buildingId).toBe("");
    expect(next.floorId).toBe("");
    expect(next.unitId).toBe("");
  });

  it("only clears descendants below the changed field, not its siblings/ancestors", () => {
    const prev: Record<string, string> = {
      projectId: "p1",
      buildingId: "b1",
      floorId: "f1",
      unitId: "u1",
    };
    const next = resetDescendants(fields, { ...prev, buildingId: "b2" }, "buildingId");
    expect(next.projectId).toBe("p1"); // ancestor untouched
    expect(next.buildingId).toBe("b2"); // changed field kept
    expect(next.floorId).toBe(""); // descendant cleared
    expect(next.unitId).toBe(""); // deeper descendant cleared
  });

  it("is a no-op for a leaf field with no descendants", () => {
    const prev: Record<string, string> = { floorId: "f1", unitId: "u1" };
    const next = resetDescendants(fields, { ...prev, unitId: "u2" }, "unitId");
    expect(next.unitId).toBe("u2");
    expect(next.floorId).toBe("f1");
  });
});
