---
name: Central Print Engine (Forms & Printing)
description: How the per-module Forms & Printing print engine is surfaced, its codegen quirks, and the client-side template-HTML sanitization rule.
---

# Central Print Engine ("النماذج والطباعة" / Forms & Printing)

One engine (shared tables `form_templates`/`form_template_versions`/`print_jobs`, shared
routes, one React page) surfaced as a sub-section inside EVERY module — not a standalone
module, sidebar group, or home tile.

## Per-module surfacing (nav)
- `app-shell.tsx` keeps the literal nav as `RAW_NAV_GROUPS`, then derives `NAV_GROUPS` by
  mapping each group and appending a `Forms & Printing` item whose href is
  `/forms-printing/${moduleKey}`. The titleKey→moduleKey map is `FORMS_MODULE_BY_GROUP`
  (the "general" chrome group is intentionally excluded).
- Single param'd route `/forms-printing/:moduleKey`; the page reads `moduleKey` via wouter.
- `moduleKey` is a **free string** end-to-end. The server binding catalog returns generic
  base tokens for unknown modules, so adding a new module group "just works" — only add a
  richer per-module token set server-side if desired.

## Codegen quirks (this feature's hooks)
- `createFormUploadUrl` mutation variables type is **`void`** — call `mutateAsync()` with no
  args (passing `{}` is a type error). Flow: createFormUploadUrl → PUT file to the signed
  URL (plain external fetch) → importFormTemplate.
- Version-lifecycle mutations (submit/endorse/approve/reject/activate, update version) take
  `{ id, versionId, data? }`; the action body is `FormVersionAction { reason? }`.

## Template-HTML XSS rule (important)
- The server render only HTML-escapes **bound token values**, NOT the author-supplied
  template markup itself. Templates are user-authored HTML, so the **client** must
  `DOMPurify.sanitize` the rendered HTML before writing it to the print window
  (`document.write`) or an iframe, AND the preview iframe must be `sandbox=""`.
  **Why:** a lower-trust author (Employee role) could embed `<script>`; higher-trust users
  print it. Defense lives client-side because that's where the HTML is injected into a DOM.

## Merged modules → one shared section per parent
- When a module is folded into a parent (e.g. inventory→procurement, fixedAssets→finance),
  there must be exactly ONE Forms & Printing nav item per parent: keep only the auto-derived
  `FORMS_MODULE_BY_GROUP` link; do NOT add a second explicit `/forms-printing/<child>` link.
- To keep the child's templates reachable, add the child key to `MODULE_GROUPS` in
  `forms-printing.tsx` (`parent: [parent, child]`). The page runs a second `useListFormTemplates`
  (always declared; `enabled: !!secondaryKey`; sentinel `"__none__"` queryKey to avoid cache
  collision) and merges the lists. New templates are still created under the parent moduleKey;
  existing child templates keep their own moduleKey + bindings. No data migration.

## Workflow gating
- Approval cycle is strict Submit → Endorse → Approve. The UI must show **Approve only for
  `endorsed`** versions (Endorse only for `submitted`); do not show Approve for `submitted`.
  Backend enforces too, but the UI sequence is a locked requirement, not just backend.
- No hard delete: templates are disabled or superseded by a new version. Printing always
  uses the latest **approved** version; `print_jobs` pin `templateVersionId` so edits only
  affect new documents. Reprint requires a reason (backend 400s without it).
