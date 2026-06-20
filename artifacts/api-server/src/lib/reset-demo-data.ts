import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Owner-only "Reset Demo Database".
 *
 * Clears all transactional / operational ("demo") data while leaving every
 * piece of system configuration intact, so the ERP ends up behaving like a
 * brand-new but fully-configured installation.
 *
 * Design — explicit CLEAR allowlist (not a KEEP allowlist):
 *   The product's hard constraint is "never destroy configuration". We therefore
 *   enumerate exactly the tables that hold operational data and truncate only
 *   those; ANY table not named here is left untouched by default. The worst-case
 *   failure mode of this design (a transactional table we forgot to list keeps
 *   its rows) is non-destructive, whereas the inverse design (clear everything
 *   except a KEEP list) would silently wipe a newly-added config table.
 *
 * What is KEPT (never listed below): users/roles/permissions/user_scopes,
 * sessions (so the owner stays logged in), settings, companies/branches,
 * number_sequences, the full chart of accounts (accounts, account_mappings,
 * cost/profit centers, tax_codes, currencies, exchange_rates, fiscal_years/
 * periods, bank_accounts, cashboxes, budgets), all lookups/categories/types/
 * statuses, the project & unit structure (projects/phases/buildings/floors/
 * units + unit pricing/discount config), HR org structure (departments/sections/
 * job_titles/shifts/salary_components/leave_types), the item catalog & warehouse
 * master, templates/rules (form/contract/kpi templates, sla_policies,
 * penalty_rules, marketing_channels/distribution_rules, lead_sources), and the
 * company policy register.
 *
 * Runs against whatever tenant the request is routed to (the proxied `db`
 * respects the AsyncLocalStorage tenant), so it resets the demo schema when the
 * caller is in Testing Mode and production otherwise. Only 3 enforced FK
 * constraints exist (all logical references are unenforced) and none point from
 * a kept table into a cleared one, so a single TRUNCATE ... CASCADE is safe and
 * order-independent.
 */

/** Transactional / operational tables to truncate, grouped by module. */
export const CLEAR_TABLES: readonly string[] = [
  // --- Audit & system activity ---
  "audit_logs",
  "login_history",
  "change_requests",
  "notifications",
  "print_jobs",

  // --- Messaging ---
  "conversations",
  "messages",

  // --- Documents / uploads ---
  "documents",
  "document_versions",
  "document_links",
  "document_object_owners",

  // --- CRM (leads) ---
  "leads",
  "lead_activities",
  "lead_assignments",
  "lead_conversions",
  "lead_follow_ups",
  "call_logs",
  "marketing_campaigns",
  "marketing_distribution_agents",
  "marketing_distribution_logs",

  // --- Customers (business partners) ---
  "customers",
  "customer_contacts",
  "customer_notes",
  "customer_documents",
  "customer_uploads",
  "customer_users",
  "customer_sessions",
  "customer_otps",
  "customer_device_tokens",
  "customer_notifications",
  "customer_invoices",
  "customer_invoice_lines",
  "customer_satisfaction_surveys",

  // --- Customer service ---
  "support_tickets",
  "support_ticket_messages",
  "complaints",
  "service_escalations",
  "service_terminations",
  "general_service_requests",
  "maintenance_requests",
  "corrective_actions",

  // --- Sales: reservations & contracts ---
  "reservations",
  "reservation_payments",
  "reservation_notes",
  "reservation_documents",
  "contracts",
  "contract_addendums",
  "contract_amendments",
  "contract_approvals",
  "contract_boq_items",
  "contract_cancellations",
  "contract_documents",
  "contract_events",
  "contract_notes",
  "contract_versions",
  "unit_transfers",
  "installment_plans",
  "installment_schedules",
  "installment_collections",

  // --- Finance: receipts, payments, treasury, cheques ---
  "receipts",
  "receipt_allocations",
  "payment_vouchers",
  "payment_allocations",
  "payment_certificates",
  "treasury_transactions",
  "bank_transactions",
  "cheques",
  "cheque_status_history",
  "advance_payments",
  "advance_recoveries",

  // --- Accounting (general ledger) ---
  "journal_entries",
  "journal_entry_lines",

  // --- Fixed assets ---
  "fixed_assets",
  "asset_depreciations",
  "asset_disposals",
  "asset_transfers",
  "asset_inventory_counts",

  // --- Procurement ---
  "suppliers",
  "supplier_contacts",
  "supplier_evaluations",
  "supplier_invoices",
  "supplier_invoice_lines",
  "supplier_quotations",
  "purchase_requests",
  "purchase_request_items",
  "purchase_orders",
  "purchase_order_items",
  "purchase_contracts",
  "purchase_contract_amendments",
  "purchase_returns",
  "purchase_return_items",
  "procurement_approvals",
  "rfqs",
  "rfq_items",
  "rfq_suppliers",
  "quotation_items",

  // --- Inventory / warehouse movements ---
  "inventory_ledger",
  "inventory_transfers",
  "inventory_transfer_items",
  "goods_receipts",
  "goods_receipt_notes",
  "goods_receipt_items",
  "grn_items",
  "goods_issues",
  "goods_issue_items",
  "stock_counts",
  "stock_count_items",
  "stock_adjustments",
  "stock_adjustment_items",
  "stock_opening_balances",

  // --- Construction / contractors ---
  "contractors",
  "contractor_contracts",
  "contractor_invoices",
  "contractor_additions",
  "contractor_deductions",
  "certificate_approvals",
  "certificate_approval_logs",
  "certificate_items",
  "payment_certificates",
  "variation_orders",
  "retentions",
  "work_orders",
  "work_progress_updates",
  "assessed_penalties",

  // --- Engineering ---
  "consultants",
  "consultant_responses",
  "boqs",
  "boq_items",
  "boq_quantity_revisions",
  "cost_estimates",
  "design_packages",
  "drawings",
  "drawing_revisions",
  "rfis",
  "material_submittals",
  "technical_submittals",
  "technical_specifications",
  "inspection_requests",
  "inspection_reports",
  "engineering_progress",
  "defects",

  // --- Handover ---
  "handover_requests",
  "handover_schedules",
  "handover_approvals",
  "handover_minutes",
  "handover_checklist_items",
  "handover_snags",

  // --- Legal ---
  "law_firms",
  "legal_advisors",
  "legal_contracts",
  "legal_contract_amendments",
  "legal_contract_attachments",
  "legal_cases",
  "legal_case_links",
  "legal_claims",
  "legal_hearings",
  "legal_notices",

  // --- HR (people & operations) ---
  "employees",
  "employee_documents",
  "employee_emergency_contacts",
  "employee_evaluations",
  "employee_evaluation_lines",
  "employee_advances",
  "employee_loans",
  "loan_installments",
  "employee_insurances",
  "attendance_records",
  "leave_requests",
  "leave_balances",
  "payroll_periods",
  "payroll_runs",
  "payslips",
  "payslip_lines",

  // --- Insurance (social insurance) ---
  "insurance_subscriptions",
  "insurance_forms",
  "insurance_additions",
  "insurance_exclusions",
  "insurance_arrears",
  "insurance_clearances",
  "insurance_penalties",
  "insurance_settlements",
  "insurance_reconciliations",
  "insurance_payment_notices",
  "insurance_data_amendments",
  "project_labor_insurances",
  "subcontractor_insurances",

  // --- Land bank ---
  "land_parcels",
  "land_acquisitions",
  "land_ownerships",
  "land_documents",
  "land_legal_statuses",
  "land_utilizations",

  // --- General administration ---
  "administrative_decisions",
  "administrative_tasks",
  "circulars",
  "correspondence",
  "meetings",
  "visitor_logs",
  "vehicles",
  "drivers",
  "vehicle_maintenance_logs",
  "vehicle_missions",
];

export interface ResetDemoDataResult {
  /** Tables that existed in the current schema and were truncated. */
  cleared: string[];
}

/**
 * Truncate every transactional table from {@link CLEAR_TABLES} that exists in
 * the current tenant schema. Configuration tables are never touched. Returns the
 * list of tables that were actually cleared.
 */
export async function resetDemoData(): Promise<ResetDemoDataResult> {
  // Resolve which of the allowlisted tables actually exist in the active schema
  // (to_regclass resolves against the connection's search_path, i.e. the current
  // tenant). This keeps the reset robust to schema drift and to demo vs prod.
  const existing = await db.execute(
    sql`SELECT t::text AS name
        FROM unnest(${sql.param(CLEAR_TABLES as string[])}::text[]) AS t
        WHERE to_regclass(quote_ident(t)) IS NOT NULL`,
  );
  const rows = ((existing as { rows?: Array<{ name: string }> }).rows ??
    (existing as unknown as Array<{ name: string }>)) as Array<{ name: string }>;
  const cleared = rows.map((r) => r.name);

  if (cleared.length > 0) {
    // Names come exclusively from our own constant allowlist, filtered to tables
    // that exist; building the statement by interpolation is safe. A single
    // TRUNCATE is atomic; CASCADE covers the only relevant FK (messages →
    // conversations, both in the list) and cannot reach a kept table because no
    // kept table has an FK into a cleared one.
    const list = cleared.map((n) => `"${n}"`).join(", ");
    await db.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`));
  }

  return { cleared };
}
