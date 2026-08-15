import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, or, sql, gte, lte } from "drizzle-orm";
import {
  db,
  circularsTable,
  circularReceiptsTable,
  usersTable,
  employeesTable,
} from "@workspace/db";
import {
  PublishCircularResponse,
  MarkCircularReadResponse,
  ListCircularReceiptsResponse,
  ListMyAnnouncementsResponse,
} from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { assertAction, LifecycleError } from "../lib/lifecycle";
import { notify } from "../lib/notify";
import { serializeRow, qStr } from "../lib/serialize";

/**
 * Internal announcements.
 *
 * The circulars register is the canonical owner and keeps its own CRUD in the
 * general-admin module. What is added here is the part it never had:
 * publication to a resolved audience, and proof that each person actually
 * read it.
 *
 * Receipts are rows, not a counter. "78% have read it" is not something anyone
 * can act on; "these eleven people have not" is. A counter also could not
 * survive staff joining or leaving, because the denominator would drift.
 */

const router: IRouter = Router();
router.use(requireAuth);

/** Load a circular inside the caller's company, or null. */
async function loadCircular(id: string, scope: string | null) {
  const conds = [eq(circularsTable.id, id), eq(circularsTable.isDeleted, false)];
  // Already factored: the one loader every endpoint here goes through, taking
  // the scope its caller read from the session. `companyScope` is for the
  // endpoints that build a condition list inline and have `req` to hand.
  if (scope) conds.push(eq(circularsTable.companyId, scope));
  const [row] = await db.select().from(circularsTable).where(and(...conds));
  return row ?? null;
}

/**
 * Who this announcement is for.
 *
 * Resolved once, at publication, from the audience the author chose. Every
 * active login in the company is the base; a departmental or branch circular
 * narrows it through the employee record the login is attached to.
 *
 * A login with no employee record is included only for a company-wide notice —
 * it cannot be matched to a department, and silently dropping it would leave
 * administrators quietly unaddressed.
 */
async function resolveAudience(circular: Record<string, unknown>): Promise<
  { userId: string; employeeId: string | null }[]
> {
  const companyId = String(circular.companyId);
  const rows = await db
    .select({ id: usersTable.id, employeeId: usersTable.employeeId })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.companyId, companyId),
        eq(usersTable.isDeleted, false),
        eq(usersTable.isActive, true),
      ),
    );

  const departmentId = circular.departmentId as string | null;
  const branchId = circular.branchId as string | null;
  if (!departmentId && !branchId) {
    return rows.map((r) => ({ userId: r.id, employeeId: r.employeeId }));
  }

  const employeeIds = rows.map((r) => r.employeeId).filter((v): v is string => !!v);
  if (employeeIds.length === 0) return [];
  const conds = [inArray(employeesTable.id, employeeIds), eq(employeesTable.isDeleted, false)];
  if (departmentId) conds.push(eq(employeesTable.departmentId, departmentId));
  if (branchId) conds.push(eq(employeesTable.branchId, branchId));
  const matching = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(and(...conds));
  const allowed = new Set(matching.map((m) => m.id));
  return rows
    .filter((r) => r.employeeId && allowed.has(r.employeeId))
    .map((r) => ({ userId: r.id, employeeId: r.employeeId }));
}

router.post(
  "/circulars/:id/publish",
  requirePermission("circulars.update"),
  async (req, res): Promise<void> => {
    const scope = req.authUser?.companyId ?? null;
    const circular = await loadCircular(String(req.params.id), scope);
    if (!circular) {
      res.status(404).json({ error: "circular not found" });
      return;
    }
    try {
      assertAction("circular", String(circular.status), "published");
    } catch (err) {
      if (err instanceof LifecycleError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      throw err;
    }

    const audience = await resolveAudience(circular as unknown as Record<string, unknown>);
    if (audience.length === 0) {
      res.status(409).json({
        error: "No active recipients match this announcement's audience.",
      });
      return;
    }

    const now = new Date();
    // Publication and its receipts are one transaction: a published notice
    // with no receipts would report 0% read forever and could never be
    // answered by anyone.
    const row = await db.transaction(async (tx) => {
      await tx.insert(circularReceiptsTable).values(
        audience.map((a) => ({
          companyId: String(circular.companyId),
          circularId: circular.id,
          userId: a.userId,
          employeeId: a.employeeId,
          deliveredAt: now,
        })),
      );
      const [updated] = await tx
        .update(circularsTable)
        .set({
          status: "published",
          publishedAt: now,
          publishedByUserId: req.authUser!.id,
          targetedCount: audience.length,
        })
        .where(eq(circularsTable.id, circular.id))
        .returning();
      return updated;
    });

    await recordAudit(req, {
      action: "publish",
      entity: "circular",
      entityId: circular.id,
      oldValue: circular,
      newValue: row,
    });
    // Told through the existing fan-out; no second notification system.
    try {
      await notify(db, {
        recipientUserIds: audience.map((a) => a.userId).filter((id) => id !== req.authUser!.id),
        companyId: String(circular.companyId),
        actorUserId: req.authUser!.id,
        category: "general",
        eventType: "announcement_published",
        priority: String(circular.priority ?? "medium") === "high" ? "high" : "normal",
        title: "إعلان داخلي / Internal announcement",
        body: String(circular.title),
        sourceModule: "circulars",
        sourceId: circular.id,
        sourceRef: String(circular.code),
        link: "/circulars",
      });
    } catch (err) {
      req.log?.error({ err }, "announcement notification failed");
    }

    res.json(PublishCircularResponse.parse(serializeRow(row as Record<string, unknown>)));
  },
);

/**
 * Record that the caller has read this announcement.
 *
 * Stamps the existing receipt rather than inserting one, so opening a notice
 * twice cannot inflate the figures, and `readAt` keeps meaning "the first
 * time they saw it". Only an addressee has a row — anyone else gets a 404,
 * which is also the honest answer to "is this for me".
 */
router.post("/circulars/:id/read", async (req, res): Promise<void> => {
  const me = req.authUser!;
  const [receipt] = await db
    .select()
    .from(circularReceiptsTable)
    .where(
      and(
        eq(circularReceiptsTable.circularId, String(req.params.id)),
        eq(circularReceiptsTable.userId, me.id),
        eq(circularReceiptsTable.isDeleted, false),
      ),
    );
  if (!receipt) {
    res.status(404).json({ error: "This announcement is not addressed to you." });
    return;
  }
  if (receipt.readAt) {
    res.json(MarkCircularReadResponse.parse(serializeRow(receipt as Record<string, unknown>)));
    return;
  }
  const [row] = await db
    .update(circularReceiptsTable)
    .set({ readAt: new Date(), deliveredAt: receipt.deliveredAt ?? new Date() })
    .where(eq(circularReceiptsTable.id, receipt.id))
    .returning();
  res.json(MarkCircularReadResponse.parse(serializeRow(row as Record<string, unknown>)));
});

/**
 * Who has read it, and who has not.
 *
 * Gated on the circulars permission rather than being open to addressees:
 * knowing that a named colleague has not read a notice is management
 * information, not something every recipient should see about every other.
 */
router.get(
  "/circulars/:id/receipts",
  requirePermission("circulars.view"),
  async (req, res): Promise<void> => {
    const scope = req.authUser?.companyId ?? null;
    const circular = await loadCircular(String(req.params.id), scope);
    if (!circular) {
      res.status(404).json({ error: "circular not found" });
      return;
    }
    const rows = await db
      .select({
        receipt: circularReceiptsTable,
        userName: usersTable.fullName,
      })
      .from(circularReceiptsTable)
      .leftJoin(usersTable, eq(usersTable.id, circularReceiptsTable.userId))
      .where(
        and(
          eq(circularReceiptsTable.circularId, circular.id),
          eq(circularReceiptsTable.isDeleted, false),
        ),
      )
      .orderBy(desc(circularReceiptsTable.readAt));

    const receipts = rows.map((r) =>
      Object.assign(serializeRow(r.receipt as unknown as Record<string, unknown>), {
        userName: r.userName ?? null,
      }),
    );
    // Counted from the source rows, where `readAt` is still a typed Date,
    // rather than from the serialised copies.
    const read = rows.filter((r) => r.receipt.readAt).length;
    const targeted = rows.length;
    res.json(
      ListCircularReceiptsResponse.parse({
        targeted,
        read,
        unread: targeted - read,
        readPercent: targeted === 0 ? 0 : Math.round((read / targeted) * 100),
        receipts,
      }),
    );
  },
);

/**
 * The caller's own announcements.
 *
 * Needs no permission: these are notices addressed to this person, and the
 * receipt rows are the authorisation — a user sees exactly what was sent to
 * them, and nothing else.
 */
router.get("/my-announcements", async (req, res): Promise<void> => {
  const me = req.authUser!;
  const unreadOnly = String(qStr(req.query as Record<string, unknown>, "unreadOnly") ?? "") === "true";
  const now = new Date();

  const conds = [
    eq(circularReceiptsTable.userId, me.id),
    eq(circularReceiptsTable.isDeleted, false),
    eq(circularsTable.isDeleted, false),
    eq(circularsTable.status, "published"),
    // An expired notice stops being current, but the receipt is kept.
    or(isNull(circularsTable.expiresAt), gte(circularsTable.expiresAt, now))!,
    // A scheduled publication is not visible before its time.
    or(isNull(circularsTable.publishAt), lte(circularsTable.publishAt, now))!,
  ];
  if (unreadOnly) conds.push(isNull(circularReceiptsTable.readAt));

  const rows = await db
    .select({ circular: circularsTable, receipt: circularReceiptsTable })
    .from(circularReceiptsTable)
    .innerJoin(circularsTable, eq(circularsTable.id, circularReceiptsTable.circularId))
    .where(and(...conds))
    .orderBy(desc(circularsTable.publishedAt));

  const [{ count: unread }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(circularReceiptsTable)
    .innerJoin(circularsTable, eq(circularsTable.id, circularReceiptsTable.circularId))
    .where(
      and(
        eq(circularReceiptsTable.userId, me.id),
        eq(circularReceiptsTable.isDeleted, false),
        isNull(circularReceiptsTable.readAt),
        eq(circularsTable.status, "published"),
        eq(circularsTable.isDeleted, false),
      ),
    );

  res.json(
    ListMyAnnouncementsResponse.parse({
      data: rows.map(({ circular, receipt }) => ({
        id: circular.id,
        code: circular.code,
        title: circular.title,
        body: circular.body,
        circularType: circular.circularType,
        priority: circular.priority,
        issueDate: circular.issueDate,
        publishedAt: circular.publishedAt ? circular.publishedAt.toISOString() : null,
        expiresAt: circular.expiresAt ? circular.expiresAt.toISOString() : null,
        read: !!receipt.readAt,
        readAt: receipt.readAt ? receipt.readAt.toISOString() : null,
      })),
      unread,
      total: rows.length,
    }),
  );
});

export default router;
