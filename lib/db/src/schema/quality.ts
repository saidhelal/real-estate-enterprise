import {
  pgTable,
  uuid,
  text,
  boolean,
  date,
  timestamp,
  integer,
  numeric,
  index,
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

/**
 * Quality and governance.
 *
 * Three registers the audit proved absent. What governance already had is
 * reused, not restated: the rules themselves are `policies`, changes to
 * controlled records go through `change_requests`, and the evidence trail is
 * `audit_logs`. None of those is reimplemented here.
 *
 * What was missing is the loop between them — a finding that a rule was not
 * followed, the action taken about it, and the risks the organisation is
 * carrying. Those are the three tables below.
 */

/**
 * A finding that something did not conform.
 *
 * `policyId` points at the rule that was breached where there is one, so a
 * finding is anchored to the policy it is a finding against rather than to a
 * retyped description of it.
 */
export const nonconformitiesTable = pgTable(
  "nonconformities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    code: text("code").notNull(),
    /** internal_audit | external_audit | inspection | complaint | incident | review */
    source: text("source").notNull().default("internal_audit"),
    raisedDate: date("raised_date").notNull().defaultNow(),
    /** The department the finding is against. */
    departmentId: uuid("department_id"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    /** process | product | documentation | safety | compliance | service */
    category: text("category").notNull().default("process"),
    /** minor | major | critical */
    severity: text("severity").notNull().default("minor"),
    /** The rule that was not met, in the register that owns rules. */
    policyId: uuid("policy_id"),
    /** Filled during investigation, not at the point of raising. */
    rootCause: text("root_cause"),
    /** Who owns closing it out. */
    ownerEmployeeId: uuid("owner_employee_id"),
    /** open | investigating | action_pending | verifying | closed | rejected */
    status: text("status").notNull().default("open"),
    dueDate: date("due_date"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closureNotes: text("closure_notes"),
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("nonconformities_status_idx").on(t.status, t.severity)],
);
export type NonconformityRow = typeof nonconformitiesTable.$inferSelect;

/*
 * Corrective actions are NOT defined here.
 *
 * `corrective_actions` already exists, in `engineering`, where it records the
 * action taken about a construction defect. A quality corrective action is the
 * same object with a different parent — an action, an owner, a due date, a
 * status — so a second table would have been two registers for one concept,
 * two permission sets, and two places to look for "what are we doing about
 * this". It is extended there instead, with a nullable `nonconformityId`
 * beside the existing `defectId`.
 *
 * See `engineering.correctiveActionsTable`.
 */

/**
 * A risk the organisation is carrying.
 *
 * `likelihood` and `impact` are the inputs; `riskScore` and `riskLevel` are
 * derived from them on the write path and are never accepted from a caller.
 * A risk level someone can type is not an assessment — two people would grade
 * the same exposure differently and the register would stop being comparable.
 */
export const risksTable = pgTable(
  "risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    departmentId: uuid("department_id"),
    /** operational | financial | compliance | strategic | reputational | safety | it */
    category: text("category").notNull().default("operational"),
    /** audit | incident | assessment | review | external */
    source: text("source").notNull().default("assessment"),

    /** 1–5, rare to almost certain. */
    likelihood: integer("likelihood").notNull().default(1),
    /** 1–5, negligible to severe. */
    impact: integer("impact").notNull().default(1),
    /** likelihood × impact. Derived — never written by a caller. */
    riskScore: integer("risk_score").notNull().default(1),
    /** low | medium | high | critical, banded from the score. Derived. */
    riskLevel: text("risk_level").notNull().default("low"),

    ownerEmployeeId: uuid("owner_employee_id"),
    /** avoid | reduce | transfer | accept */
    treatmentStrategy: text("treatment_strategy").notNull().default("reduce"),
    treatmentPlan: text("treatment_plan"),
    treatmentDueDate: date("treatment_due_date"),

    /** identified | assessed | treating | monitoring | closed | accepted */
    status: text("status").notNull().default("identified"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    nextReviewDate: date("next_review_date"),
    /** Where the exposure stood after treatment, kept alongside the current
     *  score so the effect of the treatment is visible rather than erased. */
    residualScore: integer("residual_score"),
    residualLevel: text("residual_level"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    /** Financial exposure, where it has been quantified. */
    exposureAmount: numeric("exposure_amount", { precision: 18, scale: 2 }),
    notes: text("notes"),
    ...audit,
  },
  (t) => [index("risks_level_idx").on(t.riskLevel, t.status)],
);
export type RiskRow = typeof risksTable.$inferSelect;
