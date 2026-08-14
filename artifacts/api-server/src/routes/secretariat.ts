import { Router, type IRouter, type Request } from "express";
import { and, eq, inArray, isNull, isNotNull, lt, ne, sql, type SQL } from "drizzle-orm";
import {
  db,
  correspondenceTable,
  correspondenceRecipientsTable,
  meetingsTable,
  administrativeDecisionsTable,
  administrativeTasksTable,
  documentLinksTable,
} from "@workspace/db";
import {
  GetSecretariatOverviewResponse,
  ListSecretariatFollowUpsResponse,
} from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";
import { qStr } from "../lib/serialize";

/**
 * The secretariat desk.
 *
 * Deliberately read-only. Everything a secretary works on already has an
 * owner: the correspondence register owns letters, `meetings` owns meetings,
 * `administrative_decisions` owns decisions, `administrative_tasks` owns
 * assignments, CDMS owns documents. What was missing was not another place to
 * put those things — it was one place to *see across* them, because "what is
 * outstanding this week" is a question no single register can answer.
 *
 * So this module owns no table and registers no writes. Creating a task from
 * here still goes to the tasks endpoint under `administrativeTasks.create`,
 * which is what keeps one document with one number and one audit trail.
 */

const router: IRouter = Router();
router.use(requireAuth);

/** Modules whose documents count as the secretariat's paperwork. */
const SECRETARIAT_MODULES = [
  "generalAdmin",
  "correspondence",
  "meetings",
  "administrativeDecisions",
  "administrativeTasks",
];

/** Statuses that mean "still on someone's desk". */
const OPEN_DECISION_STATUSES = ["open", "in_progress", "pending"];
const OPEN_TASK_STATUSES = ["open", "in_progress", "pending", "on_hold"];

/**
 * The company this desk reports on.
 *
 * A user pinned to a company always reports on that company, whatever the
 * query string asked for — the same rule the CRUD engine applies, restated
 * here because these are hand-written aggregate queries rather than engine
 * routes. An unpinned caller (platform administrator, service account) may
 * still narrow by parameter.
 */
function scopeFor(req: Request): string | undefined {
  const pinned = req.authUser?.companyId;
  if (pinned) return pinned;
  return qStr(req.query as Record<string, unknown>, "companyId");
}

/** `today` as a date string, for comparing against `date` columns. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

router.get(
  "/secretariat/overview",
  requirePermission("secretariat.view"),
  async (req, res): Promise<void> => {
    const companyId = scopeFor(req);
    const today = todayIso();

    /** count(*) over a table with the company scope and extra predicates. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const countOf = async (table: any, ...extra: (SQL | undefined)[]): Promise<number> => {
      const conds: SQL[] = [eq(table.isDeleted, false)];
      if (companyId) conds.push(eq(table.companyId, companyId));
      for (const e of extra) if (e) conds.push(e);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(table)
        .where(and(...conds));
      return count;
    };

    const [
      incomingCount,
      outgoingCount,
      internalCount,
      unreadInternalCount,
      meetingsScheduled,
      openDecisions,
      openTasks,
      overdueTasks,
      overdueDecisions,
      correspondenceAwaitingReply,
      documentsLinked,
    ] = await Promise.all([
      countOf(
        correspondenceTable,
        eq(correspondenceTable.direction, "incoming"),
        eq(correspondenceTable.isInternal, false),
      ),
      countOf(
        correspondenceTable,
        eq(correspondenceTable.direction, "outgoing"),
        eq(correspondenceTable.isInternal, false),
      ),
      countOf(correspondenceTable, eq(correspondenceTable.isInternal, true)),
      // Internal mail that has been sent and not yet opened by its addressee.
      countOf(
        correspondenceRecipientsTable,
        isNull(correspondenceRecipientsTable.readAt),
        isNull(correspondenceRecipientsTable.archivedAt),
      ),
      countOf(meetingsTable, eq(meetingsTable.status, "scheduled")),
      countOf(
        administrativeDecisionsTable,
        inArray(administrativeDecisionsTable.status, OPEN_DECISION_STATUSES),
      ),
      countOf(administrativeTasksTable, inArray(administrativeTasksTable.status, OPEN_TASK_STATUSES)),
      countOf(
        administrativeTasksTable,
        inArray(administrativeTasksTable.status, OPEN_TASK_STATUSES),
        isNotNull(administrativeTasksTable.dueDate),
        lt(administrativeTasksTable.dueDate, today),
      ),
      countOf(
        administrativeDecisionsTable,
        inArray(administrativeDecisionsTable.status, OPEN_DECISION_STATUSES),
        isNotNull(administrativeDecisionsTable.dueDate),
        lt(administrativeDecisionsTable.dueDate, today),
      ),
      countOf(
        correspondenceTable,
        isNotNull(correspondenceTable.replyDueDate),
        ne(correspondenceTable.status, "replied"),
        ne(correspondenceTable.status, "closed"),
      ),
      countOf(documentLinksTable, inArray(documentLinksTable.moduleKey, SECRETARIAT_MODULES)),
    ]);

    res.json(
      GetSecretariatOverviewResponse.parse({
        incomingCount,
        outgoingCount,
        internalCount,
        unreadInternalCount,
        meetingsScheduled,
        openDecisions,
        openTasks,
        overdueTasks,
        overdueDecisions,
        correspondenceAwaitingReply,
        documentsLinked,
      }),
    );
  },
);

/**
 * One dated queue across the four registers.
 *
 * The rows are shaped alike — kind, code, title, due date, whether it is late,
 * and where to go to act on it — so the desk can sort the whole workload by
 * date. `href` is built from the same paths the navigation uses; sending it
 * from the server keeps the client from having to hold a second map of which
 * entity type lives at which route.
 */
router.get(
  "/secretariat/follow-ups",
  requirePermission("secretariat.view"),
  async (req, res): Promise<void> => {
    const query = req.query as Record<string, unknown>;
    const companyId = scopeFor(req);
    const kind = qStr(query, "kind");
    const overdueOnly = String(query.overdueOnly ?? "") === "true";
    const limitRaw = Number(query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 300) : 100;
    const today = todayIso();

    const wanted = (k: string): boolean => !kind || kind === k;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scoped = (table: any, ...extra: SQL[]): SQL => {
      const conds: SQL[] = [eq(table.isDeleted, false)];
      if (companyId) conds.push(eq(table.companyId, companyId));
      conds.push(...extra);
      return and(...conds)!;
    };

    type Item = {
      id: string;
      kind: string;
      code: string;
      title: string;
      status: string;
      priority: string | null;
      dueDate: string | null;
      assignedToEmployeeId: string | null;
      overdue: boolean;
      href: string;
    };
    const items: Item[] = [];

    if (wanted("task")) {
      const rows = await db
        .select()
        .from(administrativeTasksTable)
        .where(
          scoped(
            administrativeTasksTable,
            inArray(administrativeTasksTable.status, OPEN_TASK_STATUSES),
          ),
        )
        .limit(limit);
      for (const r of rows) {
        items.push({
          id: r.id,
          kind: "task",
          code: r.code,
          title: r.title,
          status: r.status,
          priority: r.priority,
          dueDate: r.dueDate,
          assignedToEmployeeId: r.assignedToEmployeeId,
          overdue: !!r.dueDate && r.dueDate < today,
          href: "/administrative-tasks",
        });
      }
    }

    if (wanted("decision")) {
      const rows = await db
        .select()
        .from(administrativeDecisionsTable)
        .where(
          scoped(
            administrativeDecisionsTable,
            inArray(administrativeDecisionsTable.status, OPEN_DECISION_STATUSES),
          ),
        )
        .limit(limit);
      for (const r of rows) {
        items.push({
          id: r.id,
          kind: "decision",
          code: r.code,
          title: r.title,
          status: r.status,
          priority: null,
          dueDate: r.dueDate,
          assignedToEmployeeId: r.assignedToEmployeeId,
          overdue: !!r.dueDate && r.dueDate < today,
          href: "/administrative-decisions",
        });
      }
    }

    if (wanted("meeting")) {
      const rows = await db
        .select()
        .from(meetingsTable)
        .where(scoped(meetingsTable, eq(meetingsTable.status, "scheduled")))
        .limit(limit);
      for (const r of rows) {
        const due = r.scheduledAt ? r.scheduledAt.toISOString().slice(0, 10) : null;
        items.push({
          id: r.id,
          kind: "meeting",
          code: r.code,
          title: r.title,
          status: r.status,
          priority: null,
          dueDate: due,
          assignedToEmployeeId: r.chairpersonEmployeeId,
          overdue: !!due && due < today,
          href: "/meetings",
        });
      }
    }

    if (wanted("correspondence")) {
      const rows = await db
        .select()
        .from(correspondenceTable)
        .where(
          scoped(
            correspondenceTable,
            isNotNull(correspondenceTable.replyDueDate),
            ne(correspondenceTable.status, "replied"),
            ne(correspondenceTable.status, "closed"),
          ),
        )
        .limit(limit);
      for (const r of rows) {
        items.push({
          id: r.id,
          kind: "correspondence",
          code: r.code,
          title: r.subject,
          status: r.status,
          priority: r.priority,
          dueDate: r.replyDueDate,
          assignedToEmployeeId: r.assignedToEmployeeId,
          overdue: !!r.replyDueDate && r.replyDueDate < today,
          // Internal mail and the incoming/outgoing register are two views of
          // one table and live at different screens.
          href: r.isInternal ? "/internal-correspondence" : "/correspondence",
        });
      }
    }

    const filtered = overdueOnly ? items.filter((i) => i.overdue) : items;
    // Overdue first, then by due date; undated items sink to the bottom rather
    // than sorting as "1970" and crowding the top of the queue.
    filtered.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    res.json(ListSecretariatFollowUpsResponse.parse(filtered.slice(0, limit)));
  },
);

export default router;
