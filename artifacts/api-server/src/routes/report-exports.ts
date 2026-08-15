import { Router, type IRouter } from "express";
import { RecordReportExportBody } from "@workspace/api-zod";
import { recordAudit } from "../lib/audit";
import { requireAuth, hasPermission } from "../middleware/auth";

/**
 * A record of data leaving the system.
 *
 * This lived inside accounting and accepted eight report names, because when
 * it was written only the accounting reports could export. Every register
 * screen can now export the same figures, so an endpoint that only recognises
 * trial balances records a fraction of what actually leaves — and the fraction
 * it misses is the larger one.
 *
 * It sits on its own because it belongs to no module: accounting, sales and
 * HR all export, and none of them owns the log of it.
 */

const router: IRouter = Router();
router.use(requireAuth);

/**
 * Which permission authorises an export depends on what is being exported,
 * and that is in the body — so this cannot be `requirePermission` middleware,
 * which runs before the body means anything. `hasPermission` is the same check
 * the middleware makes, asked at the point where the answer is knowable.
 *
 * A module export is authorised by that module's own `.view`: someone who can
 * read a register on screen can take the same rows to a spreadsheet, and
 * someone who cannot read it has nothing to export. Absent a module, this is
 * an accounting report and keeps the permission it always had.
 */
router.post("/reports/export-audit", async (req, res): Promise<void> => {
  const parsed = RecordReportExportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { reportType, format, module, recordCount, ...filters } = parsed.data;

  const required = module ? `${module}.view` : "accountingReports.export";
  if (!hasPermission(req.authUser, required)) {
    res.status(403).json({ error: "You do not have permission to export this data." });
    return;
  }

  await recordAudit(req, {
    action: "export",
    // `module` names the register; without one this is an accounting report,
    // which is what every existing row in the log is.
    entity: module ? `${module}Export` : "accountingReport",
    entityId: reportType,
    newValue: { format, recordCount: recordCount ?? null, filters },
  });
  res.json({ success: true });
});

export default router;
