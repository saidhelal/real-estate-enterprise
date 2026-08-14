import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool, db, operationsTable } from "@workspace/db";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { getModuleSummary } from "../lib/module-registry";
import { getMetrics } from "../lib/metrics";
import { getSchedulerStatus, getSchedulerTaskRuns } from "../lib/scheduler";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();

// Basic health (OpenAPI contract). Kept stable for existing consumers.
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Liveness: the process is up and able to serve. No external dependencies are
// checked, so an orchestrator only restarts on a truly dead process.
router.get("/livez", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});

// Readiness: safe to receive traffic. Verifies DB connectivity and that every
// module mounted successfully. Returns 503 when a dependency is unhealthy.
router.get("/readyz", async (_req, res) => {
  const modules = getModuleSummary();
  const start = Date.now();
  let dbOk = false;
  let dbError: string | undefined;
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      dbOk = true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  // Scheduler state is reported but deliberately does NOT gate readiness. A
  // failing sweep is an operational problem to investigate, not a reason to
  // pull the API out of rotation and stop serving users — the request path does
  // not depend on it. Only "the scheduler never started" would be structural,
  // and that surfaces here as started:false for an operator to see.
  const scheduler = getSchedulerStatus();

  const ready = dbOk && modules.failed === 0;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "unavailable",
    checks: {
      database: {
        ok: dbOk,
        latencyMs: Date.now() - start,
        ...(dbError ? { error: dbError } : {}),
      },
      modules,
      scheduler: {
        started: scheduler.started,
        registryLoaded: scheduler.registryLoaded,
        tasks: scheduler.taskCount,
        enabled: scheduler.enabledCount,
        running: scheduler.runningCount,
      },
    },
  });
});

// Scheduler task detail for operationsTable. Read-only, and permission-gated behind
// the existing system-administration resource rather than a new one — the
// scheduler is platform infrastructure, not a business module with its own
// permission namespace.
router.get(
  "/scheduler/tasks",
  requireAuth,
  requirePermission("settings.view"),
  async (_req, res): Promise<void> => {
    const [status, runs] = await Promise.all([
      Promise.resolve(getSchedulerStatus()),
      getSchedulerTaskRuns(),
    ]);
    res.json({ scheduler: status, tasks: runs });
  },
);

/**
 * Operation history — the read side of the Operation Contract.
 *
 * The contract has been persisting every non-CRUD operation (actor, target,
 * idempotency key, outcome, duration) since it was introduced, but nothing
 * could read the table back. That made the record write-only: an operator
 * could not answer "did that sweep run, and what did it decide" without
 * opening psql, which is the opposite of what an audit trail is for.
 *
 * Read-only and gated on the same `settings.view` permission as the scheduler
 * view above: operations are platform infrastructure, so they belong to the
 * existing system-administration namespace rather than a new permission.
 * Company scope is honoured when the caller asks for it; `result` and `error`
 * payloads are returned as stored because they are already redacted on write.
 */
router.get(
  "/operations",
  requireAuth,
  requirePermission("settings.view"),
  async (req, res): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const str = (k: string): string | undefined => {
      const v = q[k];
      return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
    };
    const page = Math.max(1, Number(str("page") ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(str("pageSize") ?? 20) || 20));

    const filters: SQL[] = [];
    const companyId = str("companyId");
    if (companyId) filters.push(eq(operationsTable.companyId, companyId));
    const status = str("status");
    if (status) filters.push(eq(operationsTable.status, status));
    const operationKey = str("operationKey");
    if (operationKey) filters.push(eq(operationsTable.operationKey, operationKey));
    const sourceModule = str("sourceModule");
    if (sourceModule) filters.push(eq(operationsTable.sourceModule, sourceModule));
    const where = filters.length ? and(...filters) : undefined;

    const [counted] = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(operationsTable)
      .where(where)) as { count: number }[];

    const rows = await db
      .select()
      .from(operationsTable)
      .where(where)
      .orderBy(desc(operationsTable.requestedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    res.json({ data: rows, total: counted?.count ?? 0, page, pageSize });
  },
);

// Operational performance metrics snapshot (in-memory, bounded).
router.get("/metrics", (_req, res) => {
  res.json(getMetrics());
});

export default router;
