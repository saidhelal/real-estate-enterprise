---
name: Attachments centralization
description: How the per-record Attachments (paperclip) action is wired across all ERP screens via ResourceManager, and the preview safety ordering rule.
---

# Attachments centralization

The per-record "Attachments" (المرفقات, paperclip) action is rendered by the shared
`ResourceManager` for **every** list page by default (`attachments` prop defaults true).
It does NOT use a new table — it reuses the existing Document Management repository
(`/api/documents*`), linking by `(moduleKey, sourceId=row.id)`.

**moduleKey derivation:** `ResourceManager` derives `moduleKey` from
`getListQueryKey()[0]` by stripping a leading `/api/`. A non-string key → no action.
Pass `attachmentsModuleKey` to override when the derived key would diverge from the
historically-used key.

**Why:** A page's query key path usually equals its module key, so derivation gives
"attachments on every screen" with zero per-page wiring. The override exists because
some paths normalize differently (e.g. legal-contracts path → `legal-contracts` but
the historical document key is `legal_contracts`).

**How to apply:**
- New screens get the paperclip automatically — only set `attachmentsModuleKey` if the
  derived key (path with `/api/` stripped) differs from the key existing docs were
  stored under, or set `attachments={false}` to suppress on log-only screens.
- The handful of pages that pre-dated centralization (contracts/projects/customers/
  units) derive their original keys; legal-contracts uses the explicit override. Keep
  those keys stable or existing linked docs stop showing.

## Inline preview safety ordering

`previewKind()` in `lib/document-files.ts` MUST evaluate the dangerous-content set
(html/xhtml/**image/svg+xml**/xml/js + matching extensions) and return `none`
**before** the generic `image/*` branch. Otherwise an SVG is classified as a
previewable image and rendered inline.

**Why:** SVG is active content; inline same-origin rendering is an XSS vector. The
server already forces such types to octet-stream+attachment+nosniff, but the client
classifier must not advertise a preview affordance for them (defense-in-depth).
