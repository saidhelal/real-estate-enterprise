---
name: Inline file-preview XSS (uploaded files)
description: Serving/previewing user-uploaded files inline in the app origin can execute attacker HTML/SVG/JS — neutralize on both server and client.
---

When a module lets users upload arbitrary files and then previews/serves them from the app's own origin (same-origin `<iframe src>` or an inline-disposition route), an uploaded `text/html` / `image/svg+xml` / script file becomes stored XSS: it runs in the app origin with the victim's session.

**Rule (defense in depth, both layers):**
- **Server file route:** decide inline-vs-download with an ALLOWLIST, never a blocklist. `mimeType` is optional metadata — a blocklist of active types fails open when the client omits it (empty mime → "not dangerous" → inline). Resolve the type from a trusted fallback chain (stored mime → object-store reported content-type → file extension) and only serve `Content-Disposition: inline` for an explicit set of inert types (pdf, png/jpeg/gif/webp/bmp, text/plain). Everything else — active content AND unknown/missing types — gets `Content-Type: application/octet-stream` + `attachment`. Always set `X-Content-Type-Options: nosniff`. Also strip the object store's own `content-type`/`content-disposition`/CSP headers before piping — set them yourself so a forged upload header can't force inline.
- **Client preview classifier:** treat active types/extensions as non-previewable (return "none"); never put them in a same-origin iframe. SVG via `<img src>` is script-safe (kept as image). For plain-text preview, sandbox the iframe (`sandbox=""`).

**Why:** flagged in architect review of the EDMS module — `previewKind()` classified any `text/*` (incl. `text/html`) as previewable and rendered it in an unsandboxed same-origin iframe, and the serve route honored the client mimeType inline.

**How to apply:** any time you add upload + inline preview/serve, verify with curl that an uploaded `.html` returns octet-stream + attachment + nosniff, and that a benign `text/plain` still serves inline.
