import { pgTable, uuid, text, boolean, date, timestamp, index } from "drizzle-orm/pg-core";

const audit = {
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Corporate security.
 *
 * Three registers the audit proved absent: the posts that must be manned, the
 * rota that mans them, and what went wrong. Everything security *already* had
 * stays where it is — visitors and entry passes are `visitor_logs`, and a
 * request for a guard is a `general_service_requests` row with
 * `serviceType = "security"`. Neither is duplicated here.
 *
 * Guards are employees. There is no personnel record in this file and no
 * attendance table: a shift references `hr.employees`, and clocking in and
 * out remains HR's. What a shift adds is the security fact HR has no place
 * for — which post, and who took over from whom.
 */

/** A post that has to be manned: a gate, a lobby, a site perimeter. */
export const securityPointsTable = pgTable("security_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  /** gate | lobby | perimeter | parking | floor | site */
  pointType: text("point_type").notNull().default("gate"),
  location: text("location"),
  /** The branch this post belongs to, where the company has several sites. */
  branchId: uuid("branch_id"),
  /** The employee accountable for the post — not the guard on duty. */
  supervisorEmployeeId: uuid("supervisor_employee_id"),
  /** Standing orders for whoever is posted here. */
  instructions: text("instructions"),
  /** active | suspended | closed */
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  ...audit,
});
export type SecurityPointRow = typeof securityPointsTable.$inferSelect;

/**
 * One guard, on one post, for one period.
 *
 * `handoverNotes` and `handedOverToEmployeeId` are the point of the record:
 * a rota that only says who was rostered cannot answer "who had the post when
 * this happened", which is the question asked after every incident.
 */
export const securityShiftsTable = pgTable(
  "security_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    code: text("code").notNull(),
    pointId: uuid("point_id").notNull(),
    /** The guard. An HR employee — this is not a second staff register. */
    guardEmployeeId: uuid("guard_employee_id"),
    shiftDate: date("shift_date").notNull(),
    /** morning | evening | night */
    shiftType: text("shift_type").notNull().default("morning"),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    /** scheduled | in_progress | handed_over | completed | missed */
    status: text("status").notNull().default("scheduled"),
    /** Stamped when the guard actually takes and leaves the post, which is
     *  not the same as the hours they were rostered for. */
    checkInAt: timestamp("check_in_at", { withTimezone: true }),
    checkOutAt: timestamp("check_out_at", { withTimezone: true }),
    handedOverToEmployeeId: uuid("handed_over_to_employee_id"),
    handoverNotes: text("handover_notes"),
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("security_shifts_point_date_idx").on(t.pointId, t.shiftDate)],
);
export type SecurityShiftRow = typeof securityShiftsTable.$inferSelect;

/**
 * Something that happened and had to be dealt with.
 *
 * References rather than copies: the post it happened at, the shift that was
 * on duty, the visitor involved if there was one, and the administrative task
 * raised to follow it up. None of those are restated here.
 */
export const securityIncidentsTable = pgTable(
  "security_incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    code: text("code").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
    pointId: uuid("point_id"),
    shiftId: uuid("shift_id"),
    location: text("location"),
    /** intrusion | theft | fire | injury | vandalism | dispute | breach | other */
    incidentType: text("incident_type").notNull().default("other"),
    /** low | medium | high | critical */
    severity: text("severity").notNull().default("medium"),
    description: text("description").notNull(),
    /** Who raised it — an employee where known, and a free-text fallback for
     *  a report from someone with no record (a visitor, a contractor). */
    reportedByEmployeeId: uuid("reported_by_employee_id"),
    reportedByName: text("reported_by_name"),
    /** The visitor involved, when the incident concerns one. */
    visitorLogId: uuid("visitor_log_id"),
    assignedToEmployeeId: uuid("assigned_to_employee_id"),
    /** open | investigating | resolved | closed */
    status: text("status").notNull().default("open"),
    /** What was actually done. Required before the incident may be closed. */
    actionTaken: text("action_taken"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    /** The follow-up assignment, in the register that owns assignments. */
    taskId: uuid("task_id"),
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("security_incidents_status_idx").on(t.status, t.severity)],
);
export type SecurityIncidentRow = typeof securityIncidentsTable.$inferSelect;
