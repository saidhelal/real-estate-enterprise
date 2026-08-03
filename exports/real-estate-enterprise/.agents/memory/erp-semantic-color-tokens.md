---
name: ERP semantic color tokens
description: How to add non-shadcn semantic action colors (green/orange/blue/purple/gray) to the ERP web app.
---

The ERP web (`artifacts/erp`) ships only the standard shadcn token set (primary/secondary/muted/accent/destructive/ring). There are NO success/warning/info/report/neutral tokens out of the box.

**Rule:** never hardcode colors in components. To add a semantic action color you must touch THREE spots in `index.css` (Tailwind v4 pattern) plus the Button cva:
1. `@theme inline` block — map `--color-<name>` / `-foreground` / `-border` → `hsl(var(--<name>))`.
2. `:root` — light HSL triplet values for `--<name>`, `--<name>-foreground`, `--<name>-border`.
3. `.dark` — dark HSL triplet values (keep parity; bump lightness, often dark foreground on bright dark-mode fills).
Then add a `cva` variant in `components/ui/button.tsx` using `bg-<name> text-<name>-foreground border border-<name>-border`.

**Why:** Tailwind v4 generates `bg-*`/`text-*` utilities from the `@theme inline` `--color-*` mappings; a token defined only in `:root` won't produce a utility class. Missing the `.dark` value silently breaks dark mode.

**Existing semantic set (added for Sales Admin operational buttons):** success (green), warning (orange), info (blue), report (purple), neutral (gray). Reuse `destructive` for red. Add new ones the same way rather than inventing per-page colors.
