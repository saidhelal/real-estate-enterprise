---
name: Inline file-preview XSS (uploaded files)
description: Serving/previewing user-uploaded files inline in the app origin can execute attacker HTML/SVG/JS — neutralize on both server and client.
---

When a module lets users upload arbitrary files and then previews/serves them from the app's own origin (same-origin `<iframe src>` or an inline-disposition route), an uploaded `text/html` / `image/svg+xml` / script file becomes stored XSS: it runs in the app origin with the victim's session.

**Rule (defense in depth, both layers):**
- **Server file route:** never trust the stored `mimeType` for inline rendering. For active content (`text/html`, `application/xhtml+xml`, `image/svg+xml`, anything containing `javascript`/`ecmascript`, `application/xml`, `text/xml`) force `Content-Type: application/octet-stream` + `Content-Disposition: attachment`, and always set `X-Content-Type-Options: nosniff`.
- **Client preview classifier:** treat those same active types/extensions as non-previewable (return "none"); never put them in a same-origin iframe. SVG via `<img src>` is script-safe (kept as image). For plain-text preview, sandbox the iframe (`sandbox=""`).

**Why:** flagged in architect review of the EDMS module — `previewKind()` classified any `text/*` (incl. `text/html`) as previewable and rendered it in an unsandboxed same-origin iframe, and the serve route honored the client mimeType inline.

**How to apply:** any time you add upload + inline preview/serve, verify with curl that an uploaded `.html` returns octet-stream + attachment + nosniff, and that a benign `text/plain` still serves inline.
