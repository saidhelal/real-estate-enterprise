---
name: Cascade searchable dropdowns in ResourceManager
description: How the unified real-estate hierarchy cascade dropdowns work and the ghost-value pitfall
---

# Cascade dropdowns (ResourceManager)

The shared ERP CRUD form (`artifacts/erp/src/components/resource/resource-manager.tsx`) supports hierarchy cascades used by Company→Branch→Project→Phase(opt)→Building→Floor→Unit.

- `SelectOption` carries `parentValue` (the value of the parent field this option belongs to) and `disabled`.
- `ResourceField` carries `dependsOn` (parent field name), `searchable` (combobox), and `filterOnly` (UI-only narrowing field, excluded from payload + required validation).
- `visibleOptions(f)` filters a field's options to those whose `parentValue` matches the parent's current value. When the parent is empty it shows all.
- `setValue` recursively resets descendants (`childrenOf`) when a parent changes, so you can never submit a mismatched chain.

**Why the selected value must always survive the filter:** `visibleOptions` must also keep the option whose `value === formData[f.name]`. Otherwise, when a record's stored value doesn't match the active parent filter (parent changed, or inconsistent data), the option vanishes from the list and the trigger renders the placeholder even though a value is set — a "ghost value". Disabled options still render (so an edit of a now-unavailable/now-reserved unit still shows its unit).

**`hidden` vs `disabled` (display-only inventory filtering):** to show ONLY eligible options (e.g. CRM reservation picker = available + salesAvailable units, hiding reserved/sold/etc.), set `SelectOption.hidden` rather than removing the option from the page-level array. `visibleOptions` drops hidden options BUT always keeps the currently-selected value (`!o.hidden || o.value === current`), so editing a record whose unit later became ineligible never produces a ghost value. **Why not page-level `.filter()`:** removing the option from the array entirely means `visibleOptions` can't re-add it on edit (the `value === current` clause only keeps what's still in `f.options`), regressing the edit flow. `disabled` = render greyed/unselectable; `hidden` = don't render at all unless selected.

**Multi-parent narrowing:** `dependsOn` accepts `string | string[]` and `SelectOption.parentValues` is a per-parent ancestor map. `visibleOptions` keeps an option only if it matches EVERY parent that currently has a value. A `null` ancestor entry means "no such ancestor" so the option is excluded once that parent is chosen (e.g. a building with no phase disappears when a phase is selected); `undefined` imposes no constraint. This is how Building narrows by both Project and Phase (Phase optional).

**Server is authoritative, not the dropdown:** the unit hierarchy chain is re-derived server-side from the floor on every unit create AND patch (overwriting client-sent building/project/phase). The reserved-unit / available-unit rules for contracts/reservations are also enforced server-side. The cascade dropdown is UX only — never rely on it for integrity.

**How to apply:** filterOnly parent fields (project/phase/building/floor on reservations & contracts) are NOT stored — on edit they start empty, so `visibleOptions` shows all and the stored unit displays. Stored parents (project/building on units) are populated on edit, so descendants filter correctly and the selected child still shows because of the `value === current` clause.
