---
name: Enterprise AI Assistant (action-capable)
description: How the system-wide ERP Business Assistant proposes and safely executes actions
---

# Enterprise AI Assistant — action-proposal pattern

The global assistant (FAB + drawer, mounted in AppShell, gated by `canViewAi`) is
both grounded-Q&A AND action-capable. It must never become a blind write proxy.

## Action model (the durable decision)
- The model proposes actions by emitting fenced ` ```erp-action ` blocks holding a
  single JSON object: `{kind, label, path, note?}`, `kind ∈ open|report|search|create|workflow`.
- The client parses those blocks out of the streamed text and renders them as cards.
- **Read-only** kinds (open/report/search) navigate immediately.
- **Data-changing** kinds (create/workflow) require an explicit second-click Confirm,
  then **navigate to the existing permission-gated form** — the assistant itself
  performs NO server writes.

**Why:** "perform authorized actions after confirmation" is satisfied without a
giant, dangerous generic write surface. Permissions stay enforced by the same
server routes/forms the rest of the app uses; the human always reviews+saves the
actual mutation. Grounding domains are each `has(user,"<x>.view")`-gated and
company-scoped from server filters (never request body), so the assistant cannot
surface data the user can't already see.

**How to apply:** when extending capabilities, add new `kind`s or new catalog
screens — do NOT add an endpoint that lets the assistant mutate records directly.

## Same-origin path guard (security-critical)
Any model-generated navigation target (inline `[label](/path)` links AND
`erp-action.path`) must pass a strict guard before becoming a wouter `<Link>`:
single leading slash, reject `//` (protocol-relative open-redirect), reject `\`,
and an allowlist charset excluding `:` (blocks `javascript:` etc.). Unsafe inline
links fall back to plain text; unsafe action blocks are dropped.

**Why:** the broad path regex originally allowed `//evil.com`, which wouter/the
browser treat as protocol-relative → off-origin redirect. Caught in code review.

**How to apply:** keep ONE shared `isSafePath` helper; never widen its charset to
add `:` or a second leading slash. Rendering is React text nodes + `Link href`
(no `dangerouslySetInnerHTML`), so there is no HTML-injection sink — keep it that way.
