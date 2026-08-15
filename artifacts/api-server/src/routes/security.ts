import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  securityPointsTable,
  securityShiftsTable,
  securityIncidentsTable,
  usersTable,
} from "@workspace/db";
import {
  ListSecurityPointsResponse,
  CreateSecurityPointBody,
  GetSecurityPointResponse,
  UpdateSecurityPointBody,
  ListSecurityShiftsResponse,
  CreateSecurityShiftBody,
  GetSecurityShiftResponse,
  UpdateSecurityShiftBody,
  HandoverSecurityShiftBody,
  ListSecurityIncidentsResponse,
  CreateSecurityIncidentBody,
  GetSecurityIncidentResponse,
  UpdateSecurityIncidentBody,
} from "@workspace/api-zod";
import { registerCrud, CrudRefused, type Row, companyScope } from "../lib/register-crud";
import { requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { assertAction, LifecycleError } from "../lib/lifecycle";
import { notify } from "../lib/notify";
import { serializeRow } from "../lib/serialize";

/**
 * Corporate security.
 *
 * Three registers on the shared CRUD engine, plus the two rules that are
 * genuinely security's own: a post cannot be retired while it is still
 * rostered, and an incident cannot be closed without saying what was done
 * about it.
 *
 * Visitors and entry passes are not here — they are `visitor_logs`, and an
 * incident that concerns one references it. A request for a guard is a
 * `general_service_requests` row. Neither is duplicated.
 */

const router: IRouter = Router();
router.use(requireAuth);

registerCrud(router, {
  base: "/security-points",
  // The code is issued by the central sequence engine, not accepted from
  // the client — see `generatedCode` in register-crud.
  generatedCode: { documentType: "securityPoint" },
  module: "securityPoints",
  entity: "securityPoint",
  table: securityPointsTable,
  searchCols: ["code", "name", "nameAr", "location"],
  filterCols: ["companyId", "pointType", "status", "branchId"],
  listResp: ListSecurityPointsResponse,
  createBody: CreateSecurityPointBody,
  getResp: GetSecurityPointResponse,
  updateBody: UpdateSecurityPointBody,
  hooks: {
    async guardMutation(row, action) {
      if (action !== "delete") return;
      // A post with a rota is still in use; removing it would orphan shifts
      // and lose the answer to "who had this post".
      const open = await db
        .select({ id: securityShiftsTable.id })
        .from(securityShiftsTable)
        .where(
          and(
            eq(securityShiftsTable.pointId, row.id as string),
            eq(securityShiftsTable.isDeleted, false),
          ),
        )
        .limit(1);
      if (open.length) {
        throw new CrudRefused(
          "This post still has shifts recorded against it. Suspend it instead of removing it.",
          409,
        );
      }
    },
  },
});

registerCrud(router, {
  base: "/security-shifts",
  // The code is issued by the central sequence engine, not accepted from
  // the client — see `generatedCode` in register-crud.
  generatedCode: { documentType: "securityShift" },
  module: "securityShifts",
  entity: "securityShift",
  table: securityShiftsTable,
  searchCols: ["code", "handoverNotes"],
  filterCols: ["companyId", "pointId", "status", "shiftType", "guardEmployeeId"],
  listResp: ListSecurityShiftsResponse,
  createBody: CreateSecurityShiftBody,
  getResp: GetSecurityShiftResponse,
  updateBody: UpdateSecurityShiftBody,
  hooks: {
    // Taking and leaving the post are stamped when the status says so, rather
    // than trusted from the payload: they are the record of what happened.
    prepareUpdate(update, existing) {
      if (update.status === "in_progress" && !existing.checkInAt) {
        update.checkInAt = new Date();
      }
      if (
        (update.status === "completed" || update.status === "handed_over") &&
        !existing.checkOutAt
      ) {
        update.checkOutAt = new Date();
      }
    },
  },
});

/**
 * Hand the post over to the next guard.
 *
 * A distinct act rather than a status edit: it names who took over and what
 * they were told, and both are required. A shift that ends without a handover
 * is `completed`; one that ends by passing the post on is `handed_over`.
 */
router.post(
  "/security-shifts/:id/handover",
  requirePermission("securityShifts.update"),
  async (req, res): Promise<void> => {
    const parsed = HandoverSecurityShiftBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const scope = req.authUser?.companyId ?? null;
    const conds = [eq(securityShiftsTable.id, String(req.params.id)), eq(securityShiftsTable.isDeleted, false)];
    // One shared rule, so no endpoint can forget the tenant filter.
    const scoped = companyScope(securityShiftsTable, req);
    if (scoped) conds.push(scoped);
    const [existing] = await db.select().from(securityShiftsTable).where(and(...conds));
    if (!existing) {
      res.status(404).json({ error: "securityShift not found" });
      return;
    }
    // The lifecycle covers a cancelled shift too, which this check did not.
    try {
      assertAction("securityShift", String(existing.status), "handed_over");
    } catch (err) {
      if (err instanceof LifecycleError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      throw err;
    }
    const [row] = await db
      .update(securityShiftsTable)
      .set({
        status: "handed_over",
        handedOverToEmployeeId: parsed.data.handedOverToEmployeeId,
        handoverNotes: parsed.data.handoverNotes,
        checkOutAt: existing.checkOutAt ?? new Date(),
      })
      .where(eq(securityShiftsTable.id, existing.id))
      .returning();
    await recordAudit(req, {
      action: "handover",
      entity: "securityShift",
      entityId: existing.id,
      oldValue: existing,
      newValue: row,
    });
    res.json(GetSecurityShiftResponse.parse(serializeRow(row as Row)));
  },
);

registerCrud(router, {
  base: "/security-incidents",
  // The code is issued by the central sequence engine, not accepted from
  // the client — see `generatedCode` in register-crud.
  generatedCode: { documentType: "securityIncident" },
  module: "securityIncidents",
  entity: "securityIncident",
  table: securityIncidentsTable,
  searchCols: ["code", "description", "location"],
  filterCols: [
    "companyId",
    "pointId",
    "status",
    "severity",
    "incidentType",
    "assignedToEmployeeId",
  ],
  listResp: ListSecurityIncidentsResponse,
  createBody: CreateSecurityIncidentBody,
  getResp: GetSecurityIncidentResponse,
  updateBody: UpdateSecurityIncidentBody,
  hooks: {
    prepareUpdate(update, existing) {
      // An incident cannot be resolved or closed without a record of what was
      // actually done — a closed incident with no action is an unanswered one
      // that has merely stopped being visible.
      const target = update.status;
      if (target === "resolved" || target === "closed") {
        const action = (update.actionTaken ?? existing.actionTaken) as string | null;
        if (!action || !String(action).trim()) {
          throw new CrudRefused("Record the action taken before resolving this incident.", 400);
        }
      }
      if (target === "resolved" && !existing.resolvedAt) update.resolvedAt = new Date();
      if (target === "closed") {
        if (!existing.resolvedAt) update.resolvedAt = new Date();
        if (!existing.closedAt) update.closedAt = new Date();
      }
    },
    // A high-severity incident is told to the people who can act on it, using
    // the existing fan-out.
    async afterCreate(req, row) {
      const severity = String(row.severity ?? "");
      if (severity !== "high" && severity !== "critical") return;
      const assignee = row.assignedToEmployeeId as string | null;
      if (!assignee) return;
      const recipients = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.employeeId, assignee), eq(usersTable.isDeleted, false)));
      if (recipients.length === 0) return;
      await notify(db, {
        recipientUserIds: recipients.map((r) => r.id),
        companyId: String(row.companyId),
        actorUserId: req.authUser?.id ?? null,
        category: "operations",
        eventType: "security_incident_raised",
        priority: "high",
        title: "بلاغ أمني / Security incident",
        body: String(row.description ?? "").slice(0, 200),
        sourceModule: "securityIncidents",
        sourceId: String(row.id),
        sourceRef: String(row.code),
        link: "/security-incidents",
      });
    },
  },
});

export default router;
