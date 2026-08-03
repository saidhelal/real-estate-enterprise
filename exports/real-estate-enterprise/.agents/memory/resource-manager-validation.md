---
name: ResourceManager form validation & UX
description: How the shared ERP ResourceManager handles required/optional/placeholder/validation so per-page forms stay consistent.
---

# ResourceManager form validation & UX

`artifacts/erp/src/components/resource/resource-manager.tsx` is the shared CRUD form used by ~215 module pages. Form UX (required indicator, optional label, placeholders, validation) is centralized here — change the component or the `ResourceField` descriptor, never re-implement per page.

- Required fields render a red `*`; non-required fields render a localized `(Optional)` / `(اختياري)` suffix automatically. Set `required: true` on the field to flip this.
- Validation is **JS save-blocking, not native HTML `required`**. On submit it collects every empty required field, shows an inline localized error (`validation.required`), red border via `aria-invalid` + a destructive class, a toast (`validation.fix_errors`), and focuses the first invalid control through a `fieldRefs` map.
  - **Why:** native `required` tooltips are inconsistent for RTL and don't fire for custom Radix `Select`. The JS path covers text/textarea/number/date/select uniformly.
  - Whitespace-only text counts as empty (`raw.trim() === ""`); select "none" sentinel is `NONE`.
- Placeholders come from `placeholder` / `placeholderAr` on `ResourceField`, falling back to the localized label. Add them to the descriptor, not the page.
- i18n keys live in `artifacts/erp/src/lib/language-provider.tsx` (EN + AR): `common.optional`, `validation.required`, `validation.fix_errors`.

**How to apply:** to add/adjust a field's requiredness, placeholder, or options, edit that page's `fields: ResourceField[]` array. To change validation/label behavior globally, edit ResourceManager. Hand-rolled pages (e.g. `branches.tsx`) must replicate the `onError` toast + governance reason pattern themselves.
