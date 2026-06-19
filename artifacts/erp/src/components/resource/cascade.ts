import type { ResourceField, SelectOption } from "./resource-manager";

/**
 * Sentinel used by the form to represent "no value chosen" for an optional
 * select (Radix Select cannot use an empty string as an item value).
 */
export const NONE = "__none__";

/** Normalize a field's `dependsOn` into a list of parent field names. */
export function dependsList(f: ResourceField): string[] {
  return f.dependsOn === undefined
    ? []
    : Array.isArray(f.dependsOn)
      ? f.dependsOn
      : [f.dependsOn];
}

/** Fields that cascade off a given parent field name (its direct children). */
export function childrenOf(fields: ResourceField[], parent: string): string[] {
  return fields.filter((f) => dependsList(f).includes(parent)).map((f) => f.name);
}

/**
 * Return a new form-data object with every descendant of `changed` cleared, so a
 * stale child selection can't survive a parent change (e.g. changing Project
 * clears Building -> Floor -> Unit). The changed field itself is left untouched.
 */
export function resetDescendants(
  fields: ResourceField[],
  formData: Record<string, string>,
  changed: string,
): Record<string, string> {
  const next = { ...formData };
  const queue = childrenOf(fields, changed);
  while (queue.length) {
    const child = queue.shift() as string;
    next[child] = "";
    queue.push(...childrenOf(fields, child));
  }
  return next;
}

/**
 * Options visible for a field, applying cascade filtering by the parent value(s).
 * The currently-selected value is always kept so editing a record never hides
 * its own stored value (e.g. a unit whose parent floor differs from the current
 * filter, or stale/inconsistent data) — without it the trigger would show the
 * placeholder despite a value being set ("ghost value").
 */
export function visibleOptions(
  fields: ResourceField[],
  formData: Record<string, string>,
  f: ResourceField,
): SelectOption[] {
  const opts = f.options ?? [];
  const parents = dependsList(f);
  if (parents.length === 0) return opts;
  const current = formData[f.name];
  // Active constraints: parent fields that currently hold a real value.
  const active = parents
    .map((p) => [p, formData[p]] as const)
    .filter(([, v]) => v && v !== NONE);
  if (active.length === 0) return opts;
  return opts.filter((o) => {
    if (o.value === current) return true;
    return active.every(([p, v]) => {
      // Prefer the per-parent map; fall back to parentValue for single-parent.
      const ancestor =
        o.parentValues && p in o.parentValues ? o.parentValues[p] : o.parentValue;
      // Undefined means the option declares no value for this parent → no
      // constraint. A null value means "no such ancestor" → excluded.
      if (ancestor === undefined) return true;
      return ancestor === v;
    });
  });
}
