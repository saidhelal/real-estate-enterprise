import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, changeRequestsTable } from "@workspace/db";
import {
  ListChangeRequestsResponse,
  GetChangeRequestResponse,
  ApproveChangeRequestBody,
} from "@workspace/api-zod";
import { toChangeRequest } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";
import { internalExecuteHeaders } from "../middleware/governance";
import { notify } from "../lib/notify";

const router: IRouter = Router();
router.use(requireAuth);

const VALID_STATUSES = ["pending", "approved", "rejected", "executed", "failed"] as const;
type ReqStatus = (typeof VALID_STATUSES)[number];

// Listing/viewing the approval queue and acting on it both require approver
// rights: only an Owner / Super Admin (approvals.approve or "*") governs.
router.get(
  "/change-requests",
  requirePermission("approvals.approve"),
  async (req, res): Promise<void> => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const filters = [eq(changeRequestsTable.isDeleted, false)];
    if ((VALID_STATUSES as readonly string[]).includes(status)) {
      filters.push(eq(changeRequestsTable.status, status as ReqStatus));
    }
    const rows = await db
      .select()
      .from(changeRequestsTable)
      .where(and(...filters))
      .orderBy(desc(changeRequestsTable.createdAt));
    res.json(ListChangeRequestsResponse.parse(rows.map(toChangeRequest)));
  },
);

router.get(
  "/change-requests/:id",
  requirePermission("approvals.approve"),
  async (req, res): Promise<void> => {
    const [row] = await db
      .select()
      .from(changeRequestsTable)
      .where(eq(changeRequestsTable.id, String(req.params.id)))
      .limit(1);
    if (!row || row.isDeleted) {
      res.status(404).json({ error: "Change request not found" });
      return;
    }
    res.json(GetChangeRequestResponse.parse(toChangeRequest(row)));
  },
);

router.post(
  "/change-requests/:id/approve",
  requirePermission("approvals.approve"),
  async (req, res): Promise<void> => {
    const parsed = ApproveChangeRequestBody.safeParse(req.body ?? {});
    const reviewNotes = parsed.success ? (parsed.data.reviewNotes ?? null) : null;
    const approver = req.authUser!;

    const [row] = await db
      .select()
      .from(changeRequestsTable)
      .where(eq(changeRequestsTable.id, String(req.params.id)))
      .limit(1);
    if (!row || row.isDeleted) {
      res.status(404).json({ error: "Change request not found" });
      return;
    }
    if (row.status !== "pending") {
      res.status(409).json({ error: `Change request already ${row.status}` });
      return;
    }

    // Mark approved before executing so the audit reflects the decision even if
    // the internal re-dispatch fails.
    await db
      .update(changeRequestsTable)
      .set({
        status: "approved",
        reviewedBy: approver.id,
        reviewedByName: approver.fullName,
        reviewNotes,
        reviewedAt: new Date(),
      })
      .where(eq(changeRequestsTable.id, row.id));

    // Re-dispatch the original call internally. The execute header bypasses the
    // governance middleware; the approver's cookies authenticate it so the real
    // handler runs with full permissions and side-effects.
    const port = process.env.PORT;
    const url = `http://127.0.0.1:${port}${row.path}`;
    let ok = false;
    let executionError: string | null = null;
    try {
      const headers: Record<string, string> = {
        ...internalExecuteHeaders(),
        "content-type": "application/json",
      };
      if (typeof req.headers.cookie === "string") headers.cookie = req.headers.cookie;
      const resp = await fetch(url, {
        method: row.method,
        headers,
        body: row.method === "DELETE" ? undefined : JSON.stringify(row.payload ?? {}),
      });
      ok = resp.ok;
      if (!ok) {
        const text = await resp.text();
        try {
          const json = JSON.parse(text) as { error?: string };
          executionError = json.error ?? text;
        } catch {
          executionError = text;
        }
        executionError = `${resp.status}: ${executionError}`.slice(0, 1000);
      }
    } catch (err) {
      executionError = err instanceof Error ? err.message : String(err);
    }

    const [updated] = await db
      .update(changeRequestsTable)
      .set(
        ok
          ? { status: "executed", executedAt: new Date(), executionError: null }
          : { status: "failed", executionError },
      )
      .where(eq(changeRequestsTable.id, row.id))
      .returning();

    await recordAudit(req, {
      action: ok ? "approve-change-request" : "approve-change-request-failed",
      entity: row.entity,
      entityId: row.entityId,
      newValue: {
        requestId: row.id,
        requestType: row.requestType,
        method: row.method,
        path: row.path,
        executionError,
      },
    });

    if (!ok) {
      res.status(400).json({ error: executionError ?? "Execution failed" });
      return;
    }

    // Tell the original requester their request was approved and executed.
    // Best-effort; idempotent per (approvals, requestId, change_request_approved).
    try {
      await notify(db, {
        recipientUserIds: [row.requestedBy],
        companyId: row.companyId,
        actorUserId: approver.id,
        category: "approvals",
        eventType: "change_request_approved",
        priority: "medium",
        title: "تمت الموافقة على طلبك / Your request was approved",
        body: `${row.requestType} · ${row.entityLabel ?? row.entity}`,
        sourceModule: "approvals",
        sourceId: row.id,
        sourceRef: row.entityLabel ?? row.entity,
        link: "/approvals",
      });
    } catch (err) {
      req.log.error({ err }, "Failed to emit change-request-approved notification");
    }

    res.json(toChangeRequest(updated));
  },
);

router.post(
  "/change-requests/:id/reject",
  requirePermission("approvals.approve"),
  async (req, res): Promise<void> => {
    const parsed = ApproveChangeRequestBody.safeParse(req.body ?? {});
    const reviewNotes = parsed.success ? (parsed.data.reviewNotes ?? null) : null;
    const approver = req.authUser!;

    const [row] = await db
      .select()
      .from(changeRequestsTable)
      .where(eq(changeRequestsTable.id, String(req.params.id)))
      .limit(1);
    if (!row || row.isDeleted) {
      res.status(404).json({ error: "Change request not found" });
      return;
    }
    if (row.status !== "pending") {
      res.status(409).json({ error: `Change request already ${row.status}` });
      return;
    }

    const [updated] = await db
      .update(changeRequestsTable)
      .set({
        status: "rejected",
        reviewedBy: approver.id,
        reviewedByName: approver.fullName,
        reviewNotes,
        reviewedAt: new Date(),
      })
      .where(eq(changeRequestsTable.id, row.id))
      .returning();

    await recordAudit(req, {
      action: "reject-change-request",
      entity: row.entity,
      entityId: row.entityId,
      newValue: { requestId: row.id, requestType: row.requestType, reviewNotes },
    });

    res.json(toChangeRequest(updated));
  },
);

export default router;
