import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, delegationsTable, usersTable, permissionsTable } from "@workspace/db";
import {
  ListDelegationsResponse,
  CreateDelegationBody,
  GetDelegationResponse,
  UpdateDelegationBody,
  RevokeDelegationBody,
  ListDelegatablePermissionsResponse,
} from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { companyScope } from "../lib/register-crud";
import { notify } from "../lib/notify";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { nextNumber } from "../lib/doc-number";
import { effectivePermissionsFor } from "../lib/delegation-access";

/**
 * Delegations.
 *
 * A delegation is a dated, reviewable exception to who exercises authority —
 * not a second place where authority is defined. Everything it can grant must
 * already exist in the permission registry and must already be held by the
 * person handing it over, which is what stops it becoming a way around RBAC
 * rather than a layer on top of it.
 *
 * The rules enforced here, all server-side:
 *   - you may only delegate a permission you hold yourself
 *   - the wildcard is never delegatable, by anyone, including its holders
 *   - you may not delegate to yourself
 *   - the window must be a real one (end on or after start)
 *   - only a draft may be amended; a live delegation is withdrawn, not edited
 *   - overlapping live delegations of the same code to the same person are
 *     refused, so two rows can never disagree about why access exists
 */

const router: IRouter = Router();
router.use(requireAuth);

/** Permissions the caller may hand over: exactly what they hold, less "*". */
async function delegatableFor(req: Request): Promise<{ codes: string[]; wildcard: boolean }> {
  const held = req.authUser?.permissions ?? [];
  const wildcard = held.includes("*");
  if (!wildcard) return { codes: held.filter((c) => c !== "*").sort(), wildcard };
  // A wildcard holder may delegate any *named* permission, but never the
  // wildcard itself — handing over "everything, indefinitely" is precisely
  // the thing a reviewable delegation must not be able to say.
  const rows = await db.select({ code: permissionsTable.code }).from(permissionsTable);
  return { codes: rows.map((r) => r.code).sort(), wildcard };
}

/** Names for the two parties, so the list is readable without a second call. */
async function withNames(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  const ids = [
    ...new Set(rows.flatMap((r) => [String(r.delegatorUserId), String(r.delegateUserId)])),
  ].filter(Boolean);
  if (ids.length === 0) return rows;
  const users = await db
    .select({ id: usersTable.id, fullName: usersTable.fullName })
    .from(usersTable)
    .where(inArray(usersTable.id, ids));
  const byId = new Map(users.map((u) => [u.id, u.fullName]));
  return rows.map((r) => ({
    ...r,
    delegatorName: byId.get(String(r.delegatorUserId)) ?? null,
    delegateName: byId.get(String(r.delegateUserId)) ?? null,
  }));
}

/** The company a caller is confined to, mirroring the CRUD engine's rule. */
function scopeOf(req: Request): string | null {
  return req.authUser?.companyId ?? null;
}

/** Load one delegation inside the caller's company, or null. */
async function load(id: string, req: Request): Promise<Record<string, unknown> | null> {
  const conds: SQL[] = [eq(delegationsTable.id, id), eq(delegationsTable.isDeleted, false)];
  const scope = scopeOf(req);
  // One shared rule, so no endpoint can forget the tenant filter.
  const scoped = companyScope(delegationsTable, req);
  if (scoped) conds.push(scoped);
  const [row] = await db.select().from(delegationsTable).where(and(...conds));
  return (row as Record<string, unknown>) ?? null;
}

router.get(
  "/delegations/delegatable",
  requirePermission("delegations.create"),
  async (req, res): Promise<void> => {
    res.json(ListDelegatablePermissionsResponse.parse(await delegatableFor(req)));
  },
);

router.get("/delegations", requirePermission("delegations.view"), async (req, res): Promise<void> => {
  const query = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(query);
  const conds: SQL[] = [eq(delegationsTable.isDeleted, false)];
  const scope = scopeOf(req);
  // One shared rule, so no endpoint can forget the tenant filter.
  const scoped = companyScope(delegationsTable, req);
  if (scoped) conds.push(scoped);
  else {
    const companyId = qStr(query, "companyId");
    if (companyId) conds.push(eq(delegationsTable.companyId, companyId));
  }
  for (const col of ["status", "delegatorUserId", "delegateUserId"] as const) {
    const v = qStr(query, col);
    if (v) conds.push(eq(delegationsTable[col], v));
  }
  const search = qStr(query, "search");
  if (search) {
    const like = `%${search}%`;
    const combined = or(ilike(delegationsTable.code, like), ilike(delegationsTable.reason, like));
    if (combined) conds.push(combined);
  }
  const where = and(...conds);
  const rows = (await db
    .select()
    .from(delegationsTable)
    .where(where)
    .orderBy(desc(delegationsTable.createdAt))
    .limit(pageSize)
    .offset(offset)) as Record<string, unknown>[];
  const [{ count }] = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(delegationsTable)
    .where(where)) as { count: number }[];
  res.json(
    ListDelegationsResponse.parse({
      data: await withNames(rows.map(serializeRow)),
      total: count,
      page,
      pageSize,
    }),
  );
});

router.get("/delegations/:id", requirePermission("delegations.view"), async (req, res): Promise<void> => {
  const row = await load(String(req.params.id), req);
  if (!row) {
    res.status(404).json({ error: "Delegation not found" });
    return;
  }
  const [withName] = await withNames([serializeRow(row)]);
  res.json(GetDelegationResponse.parse(withName));
});

router.post("/delegations", requirePermission("delegations.create"), async (req, res): Promise<void> => {
  const parsed = CreateDelegationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const me = req.authUser!;

  if (body.delegateUserId === me.id) {
    res.status(400).json({ error: "You cannot delegate authority to yourself." });
    return;
  }
  if (body.endDate < body.startDate) {
    res.status(400).json({ error: "The delegation must end on or after it starts." });
    return;
  }
  if (body.permissions.includes("*")) {
    res.status(403).json({ error: "Full access cannot be delegated." });
    return;
  }

  // Only what the delegator actually holds.
  const { codes } = await delegatableFor(req);
  const allowed = new Set(codes);
  const beyond = body.permissions.filter((c) => !allowed.has(c));
  if (beyond.length) {
    res.status(403).json({
      error: `You cannot delegate permissions you do not hold: ${beyond.join(", ")}`,
    });
    return;
  }

  // The delegate must exist, and be inside the caller's company.
  const scope = scopeOf(req);
  const [delegate] = await db
    .select({ id: usersTable.id, companyId: usersTable.companyId, fullName: usersTable.fullName })
    .from(usersTable)
    .where(and(eq(usersTable.id, body.delegateUserId), eq(usersTable.isDeleted, false)));
  if (!delegate || (scope && delegate.companyId !== scope)) {
    res.status(404).json({ error: "Delegate not found" });
    return;
  }

  const companyId = scope ?? body.companyId;

  // Refuse an overlap: the same code, to the same person, already live.
  const live = (await db
    .select()
    .from(delegationsTable)
    .where(
      and(
        eq(delegationsTable.isDeleted, false),
        eq(delegationsTable.delegateUserId, body.delegateUserId),
        eq(delegationsTable.status, "active"),
      ),
    )) as Record<string, unknown>[];
  const clashes = new Set<string>();
  for (const other of live) {
    const overlaps =
      String(other.startDate) <= body.endDate && String(other.endDate) >= body.startDate;
    if (!overlaps) continue;
    for (const code of (other.permissions as string[]) ?? []) {
      if (body.permissions.includes(code)) clashes.add(code);
    }
  }
  if (clashes.size) {
    res.status(409).json({
      error: `Already delegated to this user for an overlapping period: ${[...clashes].join(", ")}`,
    });
    return;
  }

  const [row] = await db
    .insert(delegationsTable)
    .values({
      companyId,
      // A delegation is a system document, not a business key someone names.
      // Its reference comes from the central sequence like every other one.
      code: (await nextNumber("delegation", me.companyId ?? null)).value,
      delegatorUserId: me.id,
      delegateUserId: body.delegateUserId,
      permissions: body.permissions,
      reason: body.reason,
      startDate: body.startDate,
      endDate: body.endDate,
      status: "draft",
      notes: body.notes ?? null,
    })
    .returning();

  await recordAudit(req, {
    action: "create",
    entity: "delegation",
    entityId: row.id,
    newValue: row,
  });
  const [withName] = await withNames([serializeRow(row as Record<string, unknown>)]);
  res.status(201).json(GetDelegationResponse.parse(withName));
});

router.patch("/delegations/:id", requirePermission("delegations.update"), async (req, res): Promise<void> => {
  const parsed = UpdateDelegationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await load(String(req.params.id), req);
  if (!existing) {
    res.status(404).json({ error: "Delegation not found" });
    return;
  }
  // A live delegation is withdrawn and reissued, never quietly rewritten:
  // editing what someone was allowed to do while they were doing it destroys
  // the audit trail's meaning.
  if (existing.status !== "draft") {
    res.status(409).json({ error: `A ${existing.status} delegation cannot be amended.` });
    return;
  }
  if (String(existing.delegatorUserId) !== req.authUser!.id) {
    res.status(403).json({ error: "Only the delegator may amend this delegation." });
    return;
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.permissions !== undefined) {
    if (parsed.data.permissions.includes("*")) {
      res.status(403).json({ error: "Full access cannot be delegated." });
      return;
    }
    const { codes } = await delegatableFor(req);
    const allowed = new Set(codes);
    const beyond = parsed.data.permissions.filter((c) => !allowed.has(c));
    if (beyond.length) {
      res.status(403).json({
        error: `You cannot delegate permissions you do not hold: ${beyond.join(", ")}`,
      });
      return;
    }
    update.permissions = parsed.data.permissions;
  }
  for (const key of ["reason", "startDate", "endDate", "notes"] as const) {
    if (parsed.data[key] !== undefined) update[key] = parsed.data[key];
  }
  const start = String(update.startDate ?? existing.startDate);
  const end = String(update.endDate ?? existing.endDate);
  if (end < start) {
    res.status(400).json({ error: "The delegation must end on or after it starts." });
    return;
  }

  const [row] = Object.keys(update).length
    ? await db
        .update(delegationsTable)
        .set(update)
        .where(eq(delegationsTable.id, String(existing.id)))
        .returning()
    : [existing as never];

  await recordAudit(req, {
    action: "update",
    entity: "delegation",
    entityId: String(existing.id),
    oldValue: existing,
    newValue: row,
  });
  const [withName] = await withNames([serializeRow(row as Record<string, unknown>)]);
  res.json(GetDelegationResponse.parse(withName));
});

router.post(
  "/delegations/:id/activate",
  // Putting authority into someone else's hands is an approval, not an edit.
  requirePermission("delegations.approve"),
  async (req, res): Promise<void> => {
    const existing = await load(String(req.params.id), req);
    if (!existing) {
      res.status(404).json({ error: "Delegation not found" });
      return;
    }
    if (existing.status !== "draft") {
      res.status(409).json({ error: `A ${existing.status} delegation cannot be activated.` });
      return;
    }
    // Re-check against the delegator's authority at the moment of activation:
    // the roles that justified the draft may have changed since.
    const [delegator] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(eq(usersTable.id, String(existing.delegatorUserId)), eq(usersTable.isDeleted, false)),
      );
    if (!delegator) {
      res.status(409).json({ error: "The delegator's account no longer exists." });
      return;
    }
    const delegatorNow = await effectivePermissionsFor(String(existing.delegatorUserId));
    const stillAllowed =
      delegatorNow.wildcard ||
      ((existing.permissions as string[]) ?? []).every((c) => delegatorNow.codes.has(c));
    if (!stillAllowed) {
      res.status(409).json({
        error: "The delegator no longer holds every permission in this delegation.",
      });
      return;
    }

    const [row] = await db
      .update(delegationsTable)
      .set({
        status: "active",
        activatedByUserId: req.authUser!.id,
        activatedAt: new Date(),
      })
      .where(eq(delegationsTable.id, String(existing.id)))
      .returning();

    await recordAudit(req, {
      action: "activate",
      entity: "delegation",
      entityId: String(existing.id),
      oldValue: existing,
      newValue: row,
    });
    // The delegate learns they now hold it, through the existing fan-out.
    try {
      await notify(db, {
        recipientUserIds: [String(existing.delegateUserId)],
        companyId: String(existing.companyId),
        actorUserId: req.authUser!.id,
        category: "approvals",
        eventType: "delegation_activated",
        priority: "high",
        title: "تفويض صلاحيات / Delegated authority",
        body: String(existing.reason),
        sourceModule: "delegations",
        sourceId: String(existing.id),
        sourceRef: String(existing.code),
        link: "/delegations",
      });
    } catch (err) {
      req.log?.error({ err }, "delegation activation notification failed");
    }
    const [withName] = await withNames([serializeRow(row as Record<string, unknown>)]);
    res.json(GetDelegationResponse.parse(withName));
  },
);

router.post(
  "/delegations/:id/revoke",
  requirePermission("delegations.approve"),
  async (req, res): Promise<void> => {
    const parsed = RevokeDelegationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existing = await load(String(req.params.id), req);
    if (!existing) {
      res.status(404).json({ error: "Delegation not found" });
      return;
    }
    if (existing.status !== "active") {
      res.status(409).json({ error: `A ${existing.status} delegation cannot be revoked.` });
      return;
    }
    const [row] = await db
      .update(delegationsTable)
      .set({
        status: "revoked",
        revokedByUserId: req.authUser!.id,
        revokedAt: new Date(),
        revokeReason: parsed.data.revokeReason,
      })
      .where(eq(delegationsTable.id, String(existing.id)))
      .returning();

    await recordAudit(req, {
      action: "revoke",
      entity: "delegation",
      entityId: String(existing.id),
      oldValue: existing,
      newValue: row,
    });
    try {
      await notify(db, {
        recipientUserIds: [String(existing.delegateUserId)],
        companyId: String(existing.companyId),
        actorUserId: req.authUser!.id,
        category: "approvals",
        eventType: "delegation_revoked",
        priority: "high",
        title: "إلغاء تفويض / Delegation withdrawn",
        body: parsed.data.revokeReason,
        sourceModule: "delegations",
        sourceId: String(existing.id),
        sourceRef: String(existing.code),
        link: "/delegations",
      });
    } catch (err) {
      req.log?.error({ err }, "delegation revocation notification failed");
    }
    const [withName] = await withNames([serializeRow(row as Record<string, unknown>)]);
    res.json(GetDelegationResponse.parse(withName));
  },
);

/**
 * Withdraw a delegation from the register.
 *
 * Soft-delete only, and never a substitute for revoking: a delegation that was
 * ever live is a record of authority someone actually held, and the row stays
 * so the audit trail keeps its meaning. This exists because the module's
 * permission set already includes `delegations.delete` — without a route, that
 * permission could be granted and would do nothing.
 */
router.delete(
  "/delegations/:id",
  requirePermission("delegations.delete"),
  async (req, res): Promise<void> => {
    const existing = await load(String(req.params.id), req);
    if (!existing) {
      res.status(404).json({ error: "Delegation not found" });
      return;
    }
    if (existing.status === "active") {
      res.status(409).json({ error: "Revoke this delegation before removing it." });
      return;
    }
    await db
      .update(delegationsTable)
      .set({ isDeleted: true, isActive: false })
      .where(eq(delegationsTable.id, String(existing.id)));
    await recordAudit(req, {
      action: "delete",
      entity: "delegation",
      entityId: String(existing.id),
      oldValue: existing,
    });
    res.json({ success: true });
  },
);

export default router;
