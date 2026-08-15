import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  date,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

const audit = {
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// Corporate correspondence register: incoming (الوارد), outgoing (الصادر),
// internal memos (المراسلات). Archived items (الأرشيف) use status = "archived".
export const correspondenceTable = pgTable("correspondence", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  direction: text("direction").notNull().default("incoming"),
  correspondenceType: text("correspondence_type").notNull().default("letter"),
  subject: text("subject").notNull(),
  senderName: text("sender_name"),
  recipientName: text("recipient_name"),
  refNumber: text("ref_number"),
  correspondenceDate: date("correspondence_date").notNull().defaultNow(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("received"),
  departmentId: uuid("department_id"),
  assignedToEmployeeId: uuid("assigned_to_employee_id"),
  attachmentUrl: text("attachment_url"),
  notes: text("notes"),

  /* ---- Internal correspondence ------------------------------------------
   * The register above already models a letter: a code, a subject, a
   * direction, a priority, a status and a department. Internal mail between
   * staff is the same object with a known sender and known recipients instead
   * of typed-in names, so it extends this table rather than starting a second
   * one — one register, one numbering sequence, one audit history.
   *
   * Every column here is nullable: the existing incoming/outgoing rows predate
   * them and stay valid exactly as they are.
   */

  /** `true` for staff-to-staff mail; the pre-existing register rows stay false. */
  isInternal: boolean("is_internal").notNull().default(false),
  /** Who wrote it, as an employee — not a free-text name. */
  senderEmployeeId: uuid("sender_employee_id"),
  /**
   * Root of the conversation. A first message points at itself, so a thread is
   * one indexed lookup rather than a recursive walk.
   */
  threadId: uuid("thread_id"),
  /** The message this one answers, for rendering the reply chain in order. */
  parentId: uuid("parent_id"),
  /** informational | action_required | approval | follow_up */
  correspondenceKind: text("correspondence_kind"),
  /** normal | internal | confidential — drives who may open the thread. */
  confidentiality: text("confidentiality").notNull().default("internal"),
  body: text("body"),
  /** Set when a reply is expected; surfaces the "needs reply" queue. */
  replyDueDate: date("reply_due_date"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...audit,
});

/**
 * Who a piece of internal correspondence went to.
 *
 * A row per recipient rather than a list on the message: read state is
 * per-person, and an inbox query is then a plain indexed join instead of a
 * scan through an array. `kind` separates the addressee from those merely
 * copied, which is what lets "needs my reply" mean something.
 */
export const correspondenceRecipientsTable = pgTable("correspondence_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  correspondenceId: uuid("correspondence_id").notNull(),
  employeeId: uuid("employee_id").notNull(),
  /** to | cc */
  kind: text("kind").notNull().default("to"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...audit,
});

export type CorrespondenceRecipientRow = typeof correspondenceRecipientsTable.$inferSelect;
export type CorrespondenceRow = typeof correspondenceTable.$inferSelect;

// Corporate meetings: management/board meetings, their schedule (scheduledAt)
// and recorded minutes (محاضر الاجتماعات).
export const meetingsTable = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  meetingType: text("meeting_type").notNull().default("management"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  location: text("location"),
  status: text("status").notNull().default("scheduled"),
  chairpersonEmployeeId: uuid("chairperson_employee_id"),
  attendees: text("attendees"),
  agenda: text("agenda"),
  minutes: text("minutes"),
  notes: text("notes"),
  ...audit,
});
export type MeetingRow = typeof meetingsTable.$inferSelect;

// Administrative decisions and their execution follow-up (متابعة تنفيذ القرارات).
// Optionally linked to the meeting that issued them.
export const administrativeDecisionsTable = pgTable("administrative_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  decisionType: text("decision_type").notNull().default("management"),
  decisionDate: date("decision_date").notNull().defaultNow(),
  meetingId: uuid("meeting_id"),
  issuedByEmployeeId: uuid("issued_by_employee_id"),
  assignedToEmployeeId: uuid("assigned_to_employee_id"),
  description: text("description"),
  status: text("status").notNull().default("open"),
  dueDate: date("due_date"),
  notes: text("notes"),
  ...audit,
});
export type AdministrativeDecisionRow = typeof administrativeDecisionsTable.$inferSelect;

// Administrative tasks: assignment (توزيع المهام), completion follow-up
// (متابعة الإنجاز via status/progressPercent). Overdue rows drive alerts.
export const administrativeTasksTable = pgTable("administrative_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  assignedToEmployeeId: uuid("assigned_to_employee_id"),
  assignedByUserId: uuid("assigned_by_user_id"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  progressPercent: numeric("progress_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  completedDate: date("completed_date"),
  notes: text("notes"),
  ...audit,
});
export type AdministrativeTaskRow = typeof administrativeTasksTable.$inferSelect;

// Internal general services: buffet (البوفيه), cleaning (النظافة),
// security (الأمن), internal maintenance (الصيانة الداخلية).
export const generalServiceRequestsTable = pgTable("general_service_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  serviceType: text("service_type").notNull().default("cleaning"),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  requestedByEmployeeId: uuid("requested_by_employee_id"),
  assignedToEmployeeId: uuid("assigned_to_employee_id"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("requested"),
  serviceDate: date("service_date"),
  cost: numeric("cost", { precision: 18, scale: 2 }),
  notes: text("notes"),

  /* ---- Hospitality and scheduled service ---------------------------------
   * The register already modelled "someone asked for a service": a type, a
   * place, a requester, an owner, a priority and a status. What it could not
   * express is *when* and *for how many* — which is the whole substance of a
   * hospitality request, and the reason the buffet screen could only ever be
   * a generic list.
   *
   * These extend the one register rather than starting a hospitality table:
   * a request for catering and a request for cleaning are the same object
   * with different values, and splitting them would mean two codes, two
   * queues and two audit histories for one desk.
   *
   * All nullable — every existing row predates them and stays valid.
   */
  /** Time of day the service is needed; `serviceDate` carries the day. */
  serviceTime: text("service_time"),
  /** Which department asked. Free-standing from the requester, who may act
   *  on behalf of another department. */
  departmentId: uuid("department_id"),
  /** Head-count, for catering quantities and room set-up. */
  attendeesCount: integer("attendees_count"),
  /** What was asked for, in the requester's words. Consumables are drawn
   *  from Inventory when they are stock items; this is the request, not a
   *  second stock ledger. */
  requiredItems: text("required_items"),
  /** The meeting this service is for — a reference into `meetings`, never a
   *  copy of it. */
  meetingId: uuid("meeting_id"),
  /** Set when the request is closed, so "how long did this take" is answerable. */
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...audit,
});
export type GeneralServiceRequestRow = typeof generalServiceRequestsTable.$inferSelect;

// Fleet vehicles (السيارات). Operational register, distinct from the financial
// fixed-assets register; assignedDriverId points at the drivers table.
export const vehiclesTable = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  plateNumber: text("plate_number").notNull(),
  make: text("make"),
  model: text("model"),
  modelYear: numeric("model_year", { precision: 4, scale: 0 }),
  color: text("color"),
  vehicleType: text("vehicle_type").notNull().default("sedan"),
  ownershipType: text("ownership_type").notNull().default("owned"),
  status: text("status").notNull().default("available"),
  assignedDriverId: uuid("assigned_driver_id"),
  currentOdometer: numeric("current_odometer", { precision: 12, scale: 2 }),
  currentOperatingHours: numeric("current_operating_hours", { precision: 12, scale: 2 }),
  /**
   * When this vehicle is next due, by use rather than by time.
   *
   * Both are per vehicle and both are nullable, on purpose: a service
   * interval in kilometres belongs to the machine, not to the company, and a
   * sedan and a generator do not share one. A null means this vehicle has no
   * distance (or hours) rule, and the six-month rule alone governs it —
   * which is the honest position when nobody has specified one.
   */
  serviceIntervalKm: numeric("service_interval_km", { precision: 12, scale: 2 }),
  serviceIntervalHours: numeric("service_interval_hours", { precision: 12, scale: 2 }),
  registrationExpiry: date("registration_expiry"),
  insuranceExpiry: date("insurance_expiry"),
  notes: text("notes"),
  ...audit,
});
export type VehicleRow = typeof vehiclesTable.$inferSelect;

// Drivers (السائقون). Optionally linked to an HR employee via employeeId.
export const driversTable = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  employeeId: uuid("employee_id"),
  fullName: text("full_name").notNull(),
  licenseNumber: text("license_number"),
  licenseType: text("license_type"),
  licenseExpiry: date("license_expiry"),
  phone: text("phone"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  ...audit,
});
export type DriverRow = typeof driversTable.$inferSelect;

// Vehicle missions / dispatch trips (المأموريات).
export const vehicleMissionsTable = pgTable("vehicle_missions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  vehicleId: uuid("vehicle_id"),
  driverId: uuid("driver_id"),
  purpose: text("purpose").notNull(),
  destination: text("destination"),
  requestedByEmployeeId: uuid("requested_by_employee_id"),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
  startOdometer: numeric("start_odometer", { precision: 12, scale: 2 }),
  endOdometer: numeric("end_odometer", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("planned"),
  notes: text("notes"),
  ...audit,
});
export type VehicleMissionRow = typeof vehicleMissionsTable.$inferSelect;

// Vehicle fuel & maintenance logs (الوقود والصيانة).
export const vehicleMaintenanceLogsTable = pgTable("vehicle_maintenance_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  vehicleId: uuid("vehicle_id"),
  logType: text("log_type").notNull().default("fuel"),
  serviceDate: date("service_date").notNull().defaultNow(),
  odometer: numeric("odometer", { precision: 12, scale: 2 }),
  description: text("description"),
  vendorName: text("vendor_name"),
  fuelLiters: numeric("fuel_liters", { precision: 12, scale: 2 }),
  cost: numeric("cost", { precision: 18, scale: 2 }),
  nextServiceDate: date("next_service_date"),
  status: text("status").notNull().default("completed"),
  notes: text("notes"),
  ...audit,
});
export type VehicleMaintenanceLogRow = typeof vehicleMaintenanceLogsTable.$inferSelect;

// Visitor management (إدارة الزوار): registration, entry permits
// (permitNumber/permitStatus) and the visit log (checkIn/checkOut).
export const visitorLogsTable = pgTable("visitor_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  visitorName: text("visitor_name").notNull(),
  idNumber: text("id_number"),
  visitorCompany: text("visitor_company"),
  phone: text("phone"),
  hostEmployeeId: uuid("host_employee_id"),
  purpose: text("purpose"),
  permitNumber: text("permit_number"),
  permitStatus: text("permit_status").notNull().default("pending"),
  badgeNumber: text("badge_number"),
  checkInAt: timestamp("check_in_at", { withTimezone: true }),
  checkOutAt: timestamp("check_out_at", { withTimezone: true }),
  status: text("status").notNull().default("registered"),
  notes: text("notes"),
  ...audit,
});
export type VisitorLogRow = typeof visitorLogsTable.$inferSelect;

// Internal circulars (التعاميم الداخلية).
export const circularsTable = pgTable("circulars", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  circularNumber: text("circular_number"),
  issueDate: date("issue_date").notNull().defaultNow(),
  effectiveDate: date("effective_date"),
  issuedByEmployeeId: uuid("issued_by_employee_id"),
  audience: text("audience").notNull().default("all"),
  departmentId: uuid("department_id"),
  body: text("body"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),

  /* ---- Internal announcements --------------------------------------------
   * A circular IS an internal announcement — a titled notice, issued on a
   * date, aimed at an audience. What was missing was publication and proof
   * of receipt, so it could be written but not answered for.
   */
  /** announcement | policy_update | alert | event | memo */
  circularType: text("circular_type").notNull().default("announcement"),
  priority: text("priority").notNull().default("medium"),
  /** Narrower targeting than `audience`, when the notice is site-specific. */
  branchId: uuid("branch_id"),
  /** When it becomes visible. Null with status=published means immediately;
   *  a future value is a scheduled publication the scheduler picks up. */
  publishAt: timestamp("publish_at", { withTimezone: true }),
  /** After this, it stops appearing as current. */
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedByUserId: uuid("published_by_user_id"),
  /** Recipients resolved at publication, so the denominator of "how many
   *  have read it" is fixed and cannot drift as staff join or leave. */
  targetedCount: integer("targeted_count"),
  ...audit,
});
export type CircularRow = typeof circularsTable.$inferSelect;

/**
 * Who a circular went to, and whether they have read it.
 *
 * A row per recipient rather than a counter on the circular: "78% have read
 * it" is not an answer anyone can act on — the useful question is *which*
 * people have not, and only a per-person row can answer that. Read state is
 * also inherently per-person, so a counter would be the wrong shape even if
 * nobody ever asked who.
 *
 * Rows are created once, when the circular is published. Reading is recorded
 * by stamping `readAt` on the existing row, never by inserting a new one, so
 * opening a notice twice cannot inflate the figures.
 */
export const circularReceiptsTable = pgTable(
  "circular_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
    circularId: uuid("circular_id").notNull(),
    /** The login that must read it. */
    userId: uuid("user_id").notNull(),
    /** Their employee record where they have one, for departmental reporting. */
    employeeId: uuid("employee_id"),
    /** Set when the notice was put in front of them (list or notification). */
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    /** Set the first time they open it. Never overwritten. */
    readAt: timestamp("read_at", { withTimezone: true }),
    /** Optional explicit acknowledgement, separate from merely having read. */
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    ...audit,
  },
  (t) => [
    index("circular_receipts_circular_idx").on(t.circularId, t.readAt),
    index("circular_receipts_user_idx").on(t.userId, t.readAt),
  ],
);
export type CircularReceiptRow = typeof circularReceiptsTable.$inferSelect;

// Regulations & policies (اللوائح والسياسات).
export const policiesTable = pgTable("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  policyType: text("policy_type").notNull().default("policy"),
  version: text("version"),
  effectiveDate: date("effective_date"),
  reviewDate: date("review_date"),
  ownerEmployeeId: uuid("owner_employee_id"),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  documentUrl: text("document_url"),
  notes: text("notes"),
  ...audit,
});
export type PolicyRow = typeof policiesTable.$inferSelect;
