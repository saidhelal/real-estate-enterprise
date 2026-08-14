import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, nonconformitiesTable, risksTable, correctiveActionsTable } from "@workspace/db";
import {
  ListNonconformitysResponse,
  CreateNonconformityBody,
  GetNonconformityResponse,
  UpdateNonconformityBody,
  ListRisksResponse,
  CreateRiskBody,
  GetRiskResponse,
  UpdateRiskBody,
  ReviewRiskBody,
} from "@workspace/api-zod";
import { registerCrud, CrudRefused, type Row, companyScope } from "../lib/register-crud";
import { requireAuth, requirePermission } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { serializeRow } from "../lib/serialize";

/**
 * Quality and governance.
 *
 * Two registers here: findings, and risks. Corrective actions are NOT here —
 * they live in the one `corrective_actions` register the engineering module
 * already owns, extended with a `nonconformityId`. A quality action and a
 * defect action are the same object with different parents, and two tables
 * would have meant two answers to "what are we doing about this".
 *
 * The rules that are genuinely this domain's: a finding cannot be closed while
 * work on it is outstanding, and a risk level is computed, never typed.
 */

const router: IRouter = Router();
router.use(requireAuth);

/**
 * Risk level from likelihood and impact.
 *
 * Banded from the product on a 5×5 matrix, so two people assessing the same
 * exposure reach the same level and the register stays comparable across
 * departments. A caller-supplied level would make the whole register a
 * collection of opinions.
 */
function bandFor(score: number): string {
  if (score >= 15) return "critical";
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

/** Clamp an assessment input to the 1–5 the matrix is defined on. */
function axis(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, Math.round(n)));
}

/** Recompute the derived fields from whatever the row will hold after a write. */
function deriveRisk(target: Row, existing?: Row): void {
  const likelihood = axis(target.likelihood ?? existing?.likelihood, 1);
  const impact = axis(target.impact ?? existing?.impact, 1);
  target.likelihood = likelihood;
  target.impact = impact;
  target.riskScore = likelihood * impact;
  target.riskLevel = bandFor(likelihood * impact);
  // The residual level follows the residual score by the same rule, so the
  // two bands cannot disagree about what a number means.
  const residual = target.residualScore ?? existing?.residualScore;
  if (residual !== undefined && residual !== null && residual !== "") {
    const score = Math.min(25, Math.max(1, Math.round(Number(residual))));
    target.residualScore = score;
    target.residualLevel = bandFor(score);
  }
}

registerCrud(router, {
  base: "/nonconformities",
  // The code is issued by the central sequence engine, not accepted from
  // the client — see `generatedCode` in register-crud.
  generatedCode: { documentType: "nonconformity" },
  module: "nonconformities",
  entity: "nonconformity",
  table: nonconformitiesTable,
  searchCols: ["code", "title", "description"],
  filterCols: ["companyId", "status", "severity", "category", "source", "ownerEmployeeId"],
  listResp: ListNonconformitysResponse,
  createBody: CreateNonconformityBody,
  getResp: GetNonconformityResponse,
  updateBody: UpdateNonconformityBody,
  hooks: {
    async inUpdateTx(_tx, updated, existing) {
      void updated;
      void existing;
    },
    async guardMutation(row, action, req) {
      if (action === "delete") return;
      const target = (req.body as Row | undefined)?.status;
      if (target !== "closed") return;
      // Closing a finding while its corrective actions are still open would
      // record a problem as solved on the strength of work nobody has done.
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(correctiveActionsTable)
        .where(
          and(
            eq(correctiveActionsTable.nonconformityId, row.id as string),
            eq(correctiveActionsTable.isDeleted, false),
            sql`${correctiveActionsTable.status} not in ('verified', 'rejected')`,
          ),
        );
      if (count > 0) {
        throw new CrudRefused(
          `${count} corrective action(s) are still open. Verify or reject them before closing.`,
          409,
        );
      }
    },
    prepareUpdate(update, existing) {
      if (update.status === "closed" && !existing.closedAt) update.closedAt = new Date();
    },
  },
});

registerCrud(router, {
  base: "/risks",
  // The code is issued by the central sequence engine, not accepted from
  // the client — see `generatedCode` in register-crud.
  generatedCode: { documentType: "risk" },
  module: "risks",
  entity: "risk",
  table: risksTable,
  searchCols: ["code", "title", "description"],
  filterCols: ["companyId", "status", "riskLevel", "category", "ownerEmployeeId"],
  listResp: ListRisksResponse,
  createBody: CreateRiskBody,
  getResp: GetRiskResponse,
  updateBody: UpdateRiskBody,
  hooks: {
    // Score and level are computed on every write. The contract does not even
    // accept them, but deriving here means no future caller can slip one in.
    derive(row) {
      delete row.riskScore;
      delete row.riskLevel;
      delete row.residualLevel;
      deriveRisk(row);
    },
    prepareUpdate(update, existing) {
      deriveRisk(update, existing);
      if ((update.status === "closed" || update.status === "accepted") && !existing.closedAt) {
        update.closedAt = new Date();
      }
    },
  },
});

/**
 * Record a periodic review.
 *
 * Separate from a plain edit because a review is an event with a date, not a
 * change of the risk's description — "when was this last looked at" is the
 * question the register exists to keep answerable.
 */
router.post("/risks/:id/review", requirePermission("risks.update"), async (req, res): Promise<void> => {
  const parsed = ReviewRiskBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const scope = req.authUser?.companyId ?? null;
  const conds = [eq(risksTable.id, String(req.params.id)), eq(risksTable.isDeleted, false)];
  // One shared rule, so no endpoint can forget the tenant filter.
  const scoped = companyScope(risksTable, req);
  if (scoped) conds.push(scoped);
  const [existing] = await db.select().from(risksTable).where(and(...conds));
  if (!existing) {
    res.status(404).json({ error: "risk not found" });
    return;
  }
  const update: Row = {
    lastReviewedAt: new Date(),
    status: existing.status === "identified" ? "monitoring" : existing.status,
  };
  if (parsed.data.nextReviewDate) update.nextReviewDate = parsed.data.nextReviewDate;
  if (parsed.data.notes) update.notes = parsed.data.notes;
  if (parsed.data.residualScore !== undefined) update.residualScore = parsed.data.residualScore;
  deriveRisk(update, existing as unknown as Row);

  const [row] = await db
    .update(risksTable)
    .set(update)
    .where(eq(risksTable.id, existing.id))
    .returning();
  await recordAudit(req, {
    action: "review",
    entity: "risk",
    entityId: existing.id,
    oldValue: existing,
    newValue: row,
  });
  res.json(GetRiskResponse.parse(serializeRow(row as Row)));
});

export default router;
