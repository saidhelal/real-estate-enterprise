---
name: ERP i18n / enum localization
description: How bilingual (AR/EN) translation works in artifacts/erp and the rules to keep it complete.
---

# ERP translation model

Two distinct localization mechanisms — know which one a string uses before editing:

1. **Plain UI chrome** (page titles, toasts, table headers, form labels, buttons, confirms,
   empty/loading cells) uses `t("key")` from `lib/language-provider.tsx`. That file holds a
   `translations: Record<"en"|"ar", Record<string,string>>` map. **Both `en` and `ar` must stay
   at exact key parity** — every key present in both, no duplicates. Add to both blocks together.

2. **Enum / select option values and status/type badges** are NOT in the provider. They are
   centralized in `lib/enums.ts`: `ENUM_LABELS` (value → {en, ar}), `enumLabel(value, lang)`
   (raw value is the fallback), and `enumOptions(values[])` → `{value, label, labelAr}[]`.
   - ResourceManager `SelectOption` carries `labelAr`; options render `labelAr` only when
     `language === "ar"`. Pages wrap displayed badges with `enumLabel(r.field, language)`.

**Why:** options/badges previously rendered English-only / raw DB codes in Arabic mode; the
fix was a central enum map rather than scattering AR strings into each page.

**How to apply (rules):**
- Any NEW enum value MUST be added to `ENUM_LABELS` in `lib/enums.ts` or it renders as the raw
  code. `enumOptions([...])` only knows values present in that map.
- Wrap only the *displayed* value with `enumLabel`. Keep comparisons against the **raw** value
  (e.g. `r.type === "out"` for badge variant) — never compare against the localized label.
- Some pages intentionally inline bilingual text as `language === "ar" ? "..." : "..."`
  (action-button titles, confirm dialogs on convert/generate flows). That is acceptable and is
  NOT a residual-English defect — exclude it from i18n sweeps.
- Residual-English sweep: rg for `<Label>`, `<TableHead>`, `placeholder="`, `<DialogTitle>`,
  `<SelectItem ...>` with literal capitalized text, filtering out `t(`, `enumLabel`, `labelAr`,
  `language ===`.
- `artifacts/erp/public/opengraph.jpg` re-encodes on build — it shows as modified but is not a
  source change; ignore its churn.
