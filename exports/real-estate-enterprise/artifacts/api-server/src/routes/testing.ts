import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { setTestingCookie, clearTestingCookie } from "../lib/auth";
import { ensureDemoReady, resetDemo } from "../lib/demo";
import { recordAudit } from "../lib/audit";

/**
 * Testing Mode control plane. These are deliberately plain JSON endpoints (not
 * part of the OpenAPI contract) since they are session/infrastructure actions,
 * consumed by the web client via same-origin fetch. The actual tenant routing
 * happens in the auth middleware based on the cookie set here.
 */
const router: IRouter = Router();
router.use(requireAuth);

/**
 * Testing Mode is a super-admin-only capability; this guard enforces it on the
 * server for every control-plane action (enter/exit/reset). Because requireAuth
 * only ever elevates a session to "*" when the real production user is already a
 * super admin (Testing Mode is gated on the production permission set), checking
 * for "*" here cannot be satisfied by Testing Mode's own elevation — a
 * non-super-admin can never pass, whether or not they hold a testing cookie.
 */
function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.authUser?.permissions.includes("*")) {
    res.status(403).json({ error: "Super administrator access is required for Testing Mode." });
    return;
  }
  next();
}

// Current Testing Mode state for this session. Any authenticated user may read
// it so the client can decide what to render, but canTest is true only for
// super admins — matching the server-side guard on the actions below — so
// non-super-admins never see or reach the Testing Mode controls. testingMode is
// resolved by the auth middleware.
router.get("/testing/status", (req, res): void => {
  res.json({
    testing: req.testingMode === true,
    canTest: req.authUser?.permissions.includes("*") === true,
  });
});

// Enter Testing Mode: ensure the demo sandbox is provisioned + seeded, then set
// the session cookie so every subsequent request routes to the isolated demo
// schema. Super-admin only; never affects production data.
router.post("/testing/enter", requireSuperAdmin, async (req, res): Promise<void> => {
  await ensureDemoReady();
  setTestingCookie(res);
  await recordAudit(req, { action: "enter", entity: "testing_mode" });
  res.json({ testing: true });
});

// Exit Testing Mode: clear the cookie so requests route back to production.
router.post("/testing/exit", requireSuperAdmin, async (req, res): Promise<void> => {
  clearTestingCookie(res);
  res.json({ testing: false });
});

// Reset the demo sandbox back to freshly seeded sample data. Never touches
// production. May take a few seconds while the full seed runs.
router.post("/testing/reset", requireSuperAdmin, async (req, res): Promise<void> => {
  await resetDemo();
  await recordAudit(req, { action: "reset", entity: "testing_mode" });
  res.json({ ok: true });
});

export default router;
