---
name: Client-side print/export XSS
description: Any client-side print/voucher/report view that builds HTML via document.write must HTML-escape stored fields.
---

Client-side "print" views (receipts voucher, penalty report) open a new window and build an HTML string interpolating record data, then `document.write()` it.

**Rule:** every interpolated dynamic value (codes, names, notes, amounts, statuses, company name) MUST be HTML-escaped before going into the template. Use a local `esc()` that replaces `& < > " '`. Static i18n labels are safe and don't need escaping.

**Why:** the printed window is same-origin; unescaped stored data (e.g. a customer name containing a `<script>`) becomes stored XSS in that window. Flagged in architect review of the reservation module.

**How to apply:** when adding any new print/export-to-HTML feature, wrap row helpers and standalone interpolations in `esc()`. Prefer escaping inside shared helpers (e.g. the `row(label, value)` builder) so individual call sites can't forget.
