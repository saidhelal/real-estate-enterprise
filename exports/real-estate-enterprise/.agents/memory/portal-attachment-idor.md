---
name: Portal attachment object-storage IDOR
description: Multi-tenant object-storage uploads must authorize via an immutable owner mapping, not forgeable record references.
---

# Portal file-attachment authorization (multi-tenant object storage)

When customers/tenants upload files to object storage via a presigned-URL flow and
then attach the resulting object path to records (maintenance requests, complaints,
ticket messages, etc.), do NOT authorize file access by scanning whether the caller
has *any* record referencing that path.

**The rule:** record an immutable owner mapping at upload-mint time
(`object_path -> customerId`) in its own table (e.g. `customer_uploads`), then:
- On any write that accepts a client-supplied `attachmentUrl`, reject (400) unless
  that exact path is owned by the authenticated customer.
- On the file-serve endpoint, authorize against the owner-mapping table
  (path + customerId), not against the referencing business tables.

**Why:** if serving is authorized by "the caller has a row referencing this path",
a malicious customer can create a record pointing at *another* customer's object
path and then download it — a cross-tenant IDOR / broken-object-authorization leak.
The presigned PUT happens client-side directly to GCS, so there is no natural
server "finalize" step; the only trustworthy binding is the path the server minted
for that specific customer.

**How to apply:** any new portal/tenant feature that takes an `attachmentUrl` from
the client must call the ownership check before persisting, and file serving must
go through the owner-mapping lookup. Tighten accepted paths to the private uploads
namespace only.
