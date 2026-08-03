---
name: Global delete/edit governance middleware
description: A mounted middleware parks every direct DELETE (and protected PATCH) as an approval change request — per-handler delete gating breaks the approved re-dispatch.
---

A server-wide governance middleware is mounted under `/api` ahead of the routers.
It intercepts **every** direct `DELETE /<resource>/:id` (exactly two path segments)
and protected-resource `PATCH`, and instead of running the route it inserts a
pending `change_requests` row and responds `202 {pendingApproval}`. A justification
header (`x-change-reason`) is mandatory or it returns `400`. Approval (`approvals.approve`
= Owner/Super Admin) re-dispatches the original call internally with a boot-secret
execute header so the real handler runs, authenticated by the **approver's** cookies.

**Why:** When adding scoped/owner delete governance directly in a route handler
(e.g. requiring the document's own `deleteRequestedAt` flag, or actor==owner), the
handler is only ever reached via the approved re-dispatch — at which point the actor
is the approver (not the record owner) and any module-native "request" flag is not
part of the change-request flow. Such checks reject every legitimately approved
deletion (the smoke test showed a perpetual 409/403), even though they typecheck and
look correct.

**How to apply:**
- Do NOT add owner-only or "must be requested first" gates inside a `DELETE /:id`
  handler. Delete approval is already enforced globally; the handler should just
  soft-delete (+ audit). A `canSeeDocument`-style scope check is OK only because the
  seeded approver holds `*`.
- Multi-segment deletes (e.g. `/documents/:id/links/:linkId`) and `POST` mutations are
  NOT intercepted (the regex matches only `/<seg>/<id>`), so those DO need their own
  per-handler authorization.
- Resources needing governed edits must be added to `PROTECTED_EDIT`; plain resources'
  `PATCH` passes through directly.
- To smoke-test a real delete: `DELETE` with `x-change-reason` → expect `202` → POST
  `/change-requests/:id/approve` → expect status `executed` → GET the record → `404`.

**Owner-in-Owner-Mode DELETE bypass (the one sanctioned exception).** The
governance middleware skips parking and calls `next()` (real handler runs in-line)
ONLY when the resolved requester holds `*` AND presents a valid `OWNER_COOKIE`
(`verifyOwnerToken`) whose subject equals their own user id — the exact triple
`requireOwnerMode` enforces. It is DELETE-only; protected PATCH stays governed.
A super admin NOT currently in Owner Mode, and every non-owner, still go through
approval. Client `ResourceManager` drops the mandatory-reason prompt when
`useOwnerMode().active` (server ignores the reason anyway on bypass). Note: the
real DELETE handler's integrity guards (child-row checks) still apply, so an owner
can't orphan records this way — that is correct, not a bug.

**Operational fields must NOT be set via a protected-resource PATCH.** A field a
workflow needs to take effect *immediately* (e.g. a contract's `paymentMethod`
chosen during Start Sale) cannot be written by `PATCH /contracts/:id` — that PATCH
is parked as a pending approval and never applies in-line. Persist such fields at
their create/convert moment instead (the create-flow endpoint isn't governed), or
via a dedicated workflow endpoint that already accepts them (e.g.
`submit-to-finance` takes `paymentMethod`). To wire a new field through an existing
create/convert endpoint: add it to that endpoint's OpenAPI input schema, set it on
the insert, regenerate codegen — then pass it from the client at create time.
