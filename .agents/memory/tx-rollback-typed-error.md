---
name: Transaction rollback via typed error
description: Rolling back a Drizzle tx on a conditional failure — throw a typed error, don't capture a flag
---

To abort + roll back a Drizzle `db.transaction` on a conditional failure and
then respond with a specific HTTP status, throw a small typed Error subclass
inside the tx and catch it around the transaction:

```ts
class ObjectClaimError extends Error { status: number; ... }
let result;
try {
  result = await db.transaction(async (tx) => { ...; if (bad) throw new ObjectClaimError(reason); ... });
} catch (e) {
  if (e instanceof ObjectClaimError) { res.status(e.status).json({ error: e.message }); return; }
  throw e;
}
```

**Why:** The tempting alternative — `let fail = null` captured and assigned
only *inside* the tx closure, then `.catch(() => fail ? null : throw)` and
`if (fail)` after — does not typecheck. TS control-flow narrows `fail` to its
initializer type because assignments inside a nested closure are invisible to
the outer flow, so the post-tx `if (fail)` branch becomes `never` and property
access on it errors.

**How to apply:** Any conditional-rollback-then-respond handler. Also: capture
nullable `body.*` paths into a `const` before the awaits — TS drops property
narrowing (`body.x` checked truthy) across any `await`, but a captured const
keeps it.
