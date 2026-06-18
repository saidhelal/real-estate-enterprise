import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

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
  companyId: uuid("company_id").notNull(),
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
  ...audit,
});
export type CorrespondenceRow = typeof correspondenceTable.$inferSelect;

// Corporate meetings: management/board meetings, their schedule (scheduledAt)
// and recorded minutes (محاضر الاجتماعات).
export const meetingsTable = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
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
  companyId: uuid("company_id").notNull(),
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
  companyId: uuid("company_id").notNull(),
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
  companyId: uuid("company_id").notNull(),
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
  ...audit,
});
export type GeneralServiceRequestRow = typeof generalServiceRequestsTable.$inferSelect;

// Fleet vehicles (السيارات). Operational register, distinct from the financial
// fixed-assets register; assignedDriverId points at the drivers table.
export const vehiclesTable = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
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
  registrationExpiry: date("registration_expiry"),
  insuranceExpiry: date("insurance_expiry"),
  notes: text("notes"),
  ...audit,
});
export type VehicleRow = typeof vehiclesTable.$inferSelect;

// Drivers (السائقون). Optionally linked to an HR employee via employeeId.
export const driversTable = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
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
  companyId: uuid("company_id").notNull(),
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
  companyId: uuid("company_id").notNull(),
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
  companyId: uuid("company_id").notNull(),
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
  companyId: uuid("company_id").notNull(),
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
  ...audit,
});
export type CircularRow = typeof circularsTable.$inferSelect;

// Regulations & policies (اللوائح والسياسات).
export const policiesTable = pgTable("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
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
