import { and, eq, inArray } from "drizzle-orm";
import { db, employeesTable, jobTitlesTable, usersTable } from "@workspace/db";

/**
 * Who may write to whom, answered from the organisation chart.
 *
 * Internal correspondence is not open email. The rule the business asked for
 * is the reporting line: a member of staff writes upward to their manager, a
 * manager writes across to peers and upward to their own chain. This module is
 * the only place that rule lives, so the screen that offers a recipient list
 * and the endpoint that accepts one can never disagree — the picker is a
 * convenience, the server check is the control.
 *
 * Everything is derived from columns that already existed on `employees`
 * (`managerEmployeeId`, `departmentId`); nothing here invents a hierarchy.
 */

export interface DirectoryEmployee {
  id: string;
  code: string;
  name: string;
  departmentId: string | null;
  managerEmployeeId: string | null;
  jobTitleId: string | null;
}

const displayName = (r: {
  firstName: string | null;
  lastName: string | null;
  firstNameAr: string | null;
  lastNameAr: string | null;
}): string =>
  [r.firstName, r.lastName].filter(Boolean).join(" ").trim() ||
  [r.firstNameAr, r.lastNameAr].filter(Boolean).join(" ").trim();

type EmployeeRow = typeof employeesTable.$inferSelect;

/** Row -> directory entry. One conversion, so the shape cannot drift per call site. */
const toDirectory = (r: EmployeeRow): DirectoryEmployee => ({
  id: String(r.id),
  code: String(r.code),
  name: displayName(r),
  departmentId: r.departmentId ? String(r.departmentId) : null,
  managerEmployeeId: r.managerEmployeeId ? String(r.managerEmployeeId) : null,
  jobTitleId: r.jobTitleId ? String(r.jobTitleId) : null,
});

/** The employee behind a login, or null for accounts with no staff record. */
export async function employeeForUser(userId: string): Promise<DirectoryEmployee | null> {
  const [user] = await db
    .select({ employeeId: usersTable.employeeId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user?.employeeId) return null;
  return loadEmployee(user.employeeId);
}

export async function loadEmployee(employeeId: string): Promise<DirectoryEmployee | null> {
  const [row] = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.id, employeeId), eq(employeesTable.isDeleted, false)))
    .limit(1);
  return row ? toDirectory(row) : null;
}

/** Walk up the reporting line. Bounded, because a bad chart can contain a cycle. */
async function chainUpward(start: DirectoryEmployee, maxDepth = 12): Promise<DirectoryEmployee[]> {
  const chain: DirectoryEmployee[] = [];
  const seen = new Set<string>([start.id]);
  let cursor = start;
  for (let i = 0; i < maxDepth; i++) {
    if (!cursor.managerEmployeeId || seen.has(cursor.managerEmployeeId)) break;
    const next = await loadEmployee(cursor.managerEmployeeId);
    if (!next) break;
    seen.add(next.id);
    chain.push(next);
    cursor = next;
  }
  return chain;
}

/** Everyone who reports directly to `employeeId`. */
async function directReports(companyId: string, employeeId: string): Promise<DirectoryEmployee[]> {
  const rows = await db
    .select()
    .from(employeesTable)
    .where(
      and(
        eq(employeesTable.companyId, companyId),
        eq(employeesTable.managerEmployeeId, employeeId),
        eq(employeesTable.isDeleted, false),
      ),
    );
  return rows.map(toDirectory);
}

/**
 * The addressable set for one sender.
 *
 * A manager — anyone with at least one direct report — may also write across
 * to their peers, which is what makes department-to-department correspondence
 * possible without opening the whole company to everyone.
 */
export async function addressableFor(
  companyId: string,
  sender: DirectoryEmployee,
): Promise<DirectoryEmployee[]> {
  const out = new Map<string, DirectoryEmployee>();
  const add = (e: DirectoryEmployee) => {
    if (e.id !== sender.id) out.set(e.id, e);
  };

  const all = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.companyId, companyId), eq(employeesTable.isDeleted, false)));

  const reports = all.filter((r) => String(r.managerEmployeeId ?? "") === sender.id);
  const isManager = reports.length > 0;

  const { chairman, executiveDirector } = await leadership(companyId);
  const holds = (list: DirectoryEmployee[]) => list.some((e) => e.id === sender.id);
  const isChairman = holds(chairman);
  const isExecutive = holds(executiveDirector);

  // Upward is ONE step, always. Walking the whole chain would quietly hand
  // every junior member of staff a direct line to the chairman, which is the
  // opposite of a reporting line — escalation is meant to pass through the
  // people in between.
  if (sender.managerEmployeeId) {
    const manager = await loadEmployee(sender.managerEmployeeId);
    if (manager) add(manager);
  }

  if (isManager) {
    // Downward: a manager answers their own people.
    reports.forEach((r) => add(toDirectory(r)));

    // Sideways: peers are those who report to the same manager. Defining a peer
    // as "anyone who manages someone" would exclude a newly-appointed head with
    // no reports yet, and include people from unrelated parts of the chart.
    if (sender.managerEmployeeId) {
      for (const r of all) {
        if (String(r.managerEmployeeId ?? "") === sender.managerEmployeeId) add(toDirectory(r));
      }
    }

    // A department head may always reach the executive director, even where the
    // chain above them is incomplete — escalation must not depend on the chart
    // being fully filled in.
    executiveDirector.forEach(add);
  }

  // The executive director speaks to the chairman, and both speak downward to
  // the managers. That is what makes a directive a piece of correspondence
  // rather than a broadcast, and it is resolved through the post, so it stays
  // correct after a succession.
  if (isExecutive) chairman.forEach(add);

  if (isChairman || isExecutive) {
    const managedIds = new Set(
      all.map((r) => (r.managerEmployeeId ? String(r.managerEmployeeId) : "")).filter(Boolean),
    );
    for (const r of all) {
      if (managedIds.has(String(r.id))) add(toDirectory(r));
    }
    chairman.forEach(add);
    executiveDirector.forEach(add);
  }

  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Server-side gate. The picker suggests; this decides. */
export async function assertAddressable(
  companyId: string,
  sender: DirectoryEmployee,
  recipientIds: string[],
): Promise<{ ok: true } | { ok: false; rejected: string[] }> {
  const allowed = new Set((await addressableFor(companyId, sender)).map((e) => e.id));
  const rejected = recipientIds.filter((id) => !allowed.has(id));
  return rejected.length === 0 ? { ok: true } : { ok: false, rejected };
}

/* -------------------------------------------------------------------------- */
/* Institutional leadership                                                   */
/* -------------------------------------------------------------------------- */

/** The two institutional posts. Stored on the job title, never on a person. */
export type LeadershipRole = "chairman" | "executive_director";

/**
 * Whoever currently holds a leadership post.
 *
 * Resolved through the job title carrying the flag, so the answer changes by
 * itself when the post changes hands. There is deliberately no table of
 * "current chairman" to fall out of date, and no user id written into code.
 *
 * Returns every holder rather than one: a company may legitimately have the
 * post vacant (none) and a badly-maintained chart may have two, and silently
 * picking the first would hide that from whoever needs to fix it.
 */
export async function leadershipHolders(
  companyId: string,
  role: LeadershipRole,
): Promise<DirectoryEmployee[]> {
  const titles = await db
    .select({ id: jobTitlesTable.id })
    .from(jobTitlesTable)
    .where(
      and(
        eq(jobTitlesTable.companyId, companyId),
        eq(jobTitlesTable.leadershipRole, role),
        eq(jobTitlesTable.isDeleted, false),
      ),
    );
  if (titles.length === 0) return [];

  const rows = await db
    .select()
    .from(employeesTable)
    .where(
      and(
        eq(employeesTable.companyId, companyId),
        inArray(
          employeesTable.jobTitleId,
          titles.map((t) => String(t.id)),
        ),
        eq(employeesTable.isDeleted, false),
      ),
    );
  return rows.map(toDirectory);
}

/** Both posts at once, for the leadership workspaces and the directory. */
export async function leadership(companyId: string): Promise<{
  chairman: DirectoryEmployee[];
  executiveDirector: DirectoryEmployee[];
}> {
  const [chairman, executiveDirector] = await Promise.all([
    leadershipHolders(companyId, "chairman"),
    leadershipHolders(companyId, "executive_director"),
  ]);
  return { chairman, executiveDirector };
}

/** Login accounts for a set of employees, for notification fan-out. */
export async function userIdsForEmployees(employeeIds: string[]): Promise<string[]> {
  if (employeeIds.length === 0) return [];
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      and(
        inArray(usersTable.employeeId, employeeIds),
        eq(usersTable.isDeleted, false),
        eq(usersTable.isActive, true),
      ),
    );
  return rows.map((r) => String(r.id));
}

