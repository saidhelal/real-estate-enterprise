import { useAuth } from "@/lib/auth-provider";
import { useTesting } from "@/lib/testing-provider";
import { OwnerModeControls } from "@/components/layout/owner-mode-controls";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-provider";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/theme-provider";
import { PageNav } from "@/components/layout/page-nav";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, Users, ShieldCheck, Building2, Building, MapPin, CalendarDays,
  Banknote, Hash, ListOrdered, History, Settings, KeyRound, LogOut, Menu, Sun, Moon,
  Layers, Rows3, Home, Boxes, BadgeCheck, ClipboardList, DollarSign, Percent,
  UserPlus, Megaphone, Activity, CalendarClock, UserCheck, ArrowRightLeft,
  Contact, FileText, StickyNote, BookMarked, Wallet, FileSignature, FilePen, FileX,
  ArrowLeftRight, CalendarRange, Receipt, AlertTriangle,
  BookOpen, Network, BookText, Scale, Library, TrendingUp, LineChart,
  PiggyBank, Link2, GanttChartSquare, Calculator,
  Compass, Ruler, HardHat, Package, PencilRuler, FileStack, ClipboardCheck,
  FileCheck, ShieldAlert, Wrench, MessageSquare, FileSearch, Microscope, Gauge,
  Hammer, FileBox, Award, GitPullRequestArrow, MinusCircle, PlusCircle,
  ShieldMinus, Coins, RotateCcw, FileSpreadsheet, CheckSquare, BarChart3,
  Truck, ShoppingCart, PackageCheck, PackageX, Store, Undo2,
  Gavel, Scroll, Landmark, UserCog, Bell, FileSignature as FileSign,
  LandPlot, Map as MapIcon, ScrollText, Trees, FolderArchive, Handshake,
  Database, ListPlus, SlidersHorizontal, Settings2, Search, ChevronDown,
  Inbox, PhoneCall, Star, Printer, FlaskConical,
  Sparkles, Brain, Bot, Lightbulb, MessagesSquare, BellRing, Target,
  Share2, GitBranch,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { href: string; icon: LucideIcon; labelKey: string };
type NavSubGroup = { titleKey: string; items: NavItem[] };
type NavGroup = { titleKey: string; items: NavItem[]; subGroups?: NavSubGroup[] };

const RAW_NAV_GROUPS: NavGroup[] = [
  { titleKey: "nav.group.general", items: [
    { href: "/", icon: Home, labelKey: "nav.home" },
    { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
    { href: "/notifications", icon: Bell, labelKey: "nav.notifications_center" },
  ]},
  { titleKey: "nav.group.edms", items: [
    { href: "/documents-dashboard", icon: LayoutDashboard, labelKey: "nav.documents_dashboard" },
    { href: "/documents", icon: FolderArchive, labelKey: "nav.documents" },
    { href: "/document-search", icon: Search, labelKey: "nav.document_search" },
    { href: "/document-approvals", icon: Inbox, labelKey: "nav.document_approvals" },
  ]},
  { titleKey: "nav.group.sales_crm", items: [
    { href: "/sales-administration", icon: SlidersHorizontal, labelKey: "nav.sales_administration" },
    { href: "/crm-dashboard", icon: LayoutDashboard, labelKey: "nav.crm_dashboard" },
    { href: "/my-work", icon: ClipboardList, labelKey: "nav.my_work" },
    { href: "/leads", icon: UserPlus, labelKey: "nav.leads" },
    { href: "/available-units", icon: Home, labelKey: "nav.available_units" },
    { href: "/crm-sales", icon: FileSign, labelKey: "nav.crm_sales" },
    { href: "/lead-follow-ups", icon: CalendarClock, labelKey: "nav.lead_follow_ups" },
    { href: "/finance-inbox", icon: Inbox, labelKey: "nav.finance_inbox" },
    { href: "/legal-approvals", icon: Gavel, labelKey: "nav.legal_approvals" },
    { href: "/crm-reports", icon: BarChart3, labelKey: "nav.crm_reports" },
    { href: "/ai-assistant", icon: Bot, labelKey: "nav.ai_sales_assistant" },
  ]},
  { titleKey: "nav.group.real_estate", items: [
    { href: "/data-entry-center", icon: SlidersHorizontal, labelKey: "nav.data_entry_center" },
    { href: "/projects", icon: Building, labelKey: "nav.projects" },
    { href: "/phases", icon: Layers, labelKey: "nav.phases" },
    { href: "/buildings", icon: Building2, labelKey: "nav.buildings" },
    { href: "/floors", icon: Rows3, labelKey: "nav.floors" },
    { href: "/units", icon: Home, labelKey: "nav.units" },
    { href: "/unit-types", icon: Boxes, labelKey: "nav.unit_types" },
    { href: "/unit-statuses", icon: BadgeCheck, labelKey: "nav.unit_statuses" },
    { href: "/unit-price-lists", icon: ClipboardList, labelKey: "nav.unit_price_lists" },
    { href: "/unit-pricing", icon: DollarSign, labelKey: "nav.unit_pricing" },
    { href: "/unit-discounts", icon: Percent, labelKey: "nav.unit_discounts" },
  ]},
  { titleKey: "nav.group.finance_parent", items: [], subGroups: [
    { titleKey: "nav.group.acct_department", items: [
      { href: "/accounting-dashboard", icon: Calculator, labelKey: "nav.accounting_dashboard" },
      { href: "/accounts", icon: BookOpen, labelKey: "nav.accounts" },
      { href: "/journal-entries", icon: BookText, labelKey: "nav.journal_entries" },
      { href: "/general-ledger", icon: Library, labelKey: "nav.general_ledger" },
      { href: "/cost-centers", icon: Network, labelKey: "nav.cost_centers" },
      { href: "/profit-centers", icon: TrendingUp, labelKey: "nav.profit_centers" },
      { href: "/fiscal-periods", icon: CalendarRange, labelKey: "nav.fiscal_periods" },
      { href: "/year-end-closing", icon: CalendarDays, labelKey: "nav.year_end_closing" },
      { href: "/financial-reports", icon: BarChart3, labelKey: "nav.financial_reports" },
      { href: "/trial-balance", icon: Scale, labelKey: "nav.trial_balance" },
      { href: "/balance-sheet", icon: GanttChartSquare, labelKey: "nav.balance_sheet" },
      { href: "/income-statement", icon: TrendingUp, labelKey: "nav.income_statement" },
      { href: "/cash-flow", icon: LineChart, labelKey: "nav.cash_flow" },
    ]},
    { titleKey: "nav.group.financial_management", items: [
      { href: "/customer-invoices", icon: FileText, labelKey: "nav.customer_invoices" },
      { href: "/ar-aging", icon: ClipboardList, labelKey: "nav.ar_aging" },
      { href: "/supplier-invoices", icon: FileBox, labelKey: "nav.supplier_invoices" },
      { href: "/ap-aging", icon: ClipboardList, labelKey: "nav.ap_aging" },
      { href: "/receipts", icon: Receipt, labelKey: "nav.receipts" },
      { href: "/payment-vouchers", icon: Wallet, labelKey: "nav.payment_vouchers" },
      { href: "/installment-plans", icon: CalendarRange, labelKey: "nav.installment_plans" },
      { href: "/installment-schedules", icon: ListOrdered, labelKey: "nav.installment_schedules" },
      { href: "/installment-collections", icon: Receipt, labelKey: "nav.installment_collections" },
      { href: "/penalties", icon: AlertTriangle, labelKey: "nav.penalties" },
      { href: "/penalty-rules", icon: AlertTriangle, labelKey: "nav.penalty_rules" },
      { href: "/cashboxes", icon: Wallet, labelKey: "nav.cashboxes" },
      { href: "/treasury-transactions", icon: ArrowLeftRight, labelKey: "nav.treasury_transactions" },
      { href: "/bank-accounts", icon: Banknote, labelKey: "nav.bank_accounts" },
      { href: "/bank-transactions", icon: ArrowRightLeft, labelKey: "nav.bank_transactions" },
    ]},
    { titleKey: "nav.group.cheques_management", items: [
      { href: "/cheques", icon: Banknote, labelKey: "nav.cheques" },
      { href: "/cheque-status-history", icon: History, labelKey: "nav.cheque_status_history" },
      { href: "/cheque-reports", icon: ClipboardList, labelKey: "nav.cheque_reports" },
    ]},
    { titleKey: "nav.group.tax_management", items: [
      { href: "/tax-codes", icon: Percent, labelKey: "nav.tax_codes" },
      { href: "/tax-report", icon: FileSpreadsheet, labelKey: "nav.tax_report" },
      { href: "/account-mappings", icon: Link2, labelKey: "nav.account_mappings" },
    ]},
    { titleKey: "nav.group.budget_management", items: [
      { href: "/budgets", icon: PiggyBank, labelKey: "nav.budgets" },
      { href: "/budget-lines", icon: ListOrdered, labelKey: "nav.budget_lines" },
      { href: "/budget-vs-actual", icon: Scale, labelKey: "nav.budget_vs_actual" },
    ]},
    { titleKey: "nav.group.fixed_assets_department", items: [
      { href: "/fixed-assets-dashboard", icon: Package, labelKey: "nav.fixed_assets_dashboard" },
      { href: "/asset-categories", icon: Boxes, labelKey: "nav.asset_categories" },
      { href: "/fixed-assets", icon: FileBox, labelKey: "nav.fixed_assets" },
      { href: "/asset-transfers", icon: Truck, labelKey: "nav.asset_transfers" },
      { href: "/asset-depreciations", icon: Coins, labelKey: "nav.asset_depreciations" },
      { href: "/asset-inventory-counts", icon: ClipboardCheck, labelKey: "nav.asset_inventory_counts" },
      { href: "/asset-disposals", icon: PackageX, labelKey: "nav.asset_disposals" },
      { href: "/fixed-assets-reports", icon: BarChart3, labelKey: "nav.fixed_assets_reports" },
    ]},
    { titleKey: "nav.group.finance_forms", items: [
      { href: "/forms-printing/finance", icon: Printer, labelKey: "nav.forms_printing" },
    ]},
  ]},
  { titleKey: "nav.group.engineering", items: [
    { href: "/engineering-dashboard", icon: Compass, labelKey: "nav.engineering_dashboard" },
    { href: "/engineering-disciplines", icon: Ruler, labelKey: "nav.engineering_disciplines" },
    { href: "/consultants", icon: HardHat, labelKey: "nav.consultants" },
    { href: "/design-packages", icon: Package, labelKey: "nav.design_packages" },
    { href: "/drawing-categories", icon: Boxes, labelKey: "nav.drawing_categories" },
    { href: "/technical-specifications", icon: FileText, labelKey: "nav.technical_specifications" },
    { href: "/drawings", icon: PencilRuler, labelKey: "nav.drawings" },
    { href: "/drawing-revisions", icon: FileStack, labelKey: "nav.drawing_revisions" },
    { href: "/boqs", icon: ClipboardList, labelKey: "nav.boqs" },
    { href: "/boq-items", icon: ListOrdered, labelKey: "nav.boq_items" },
    { href: "/boq-quantity-revisions", icon: FilePen, labelKey: "nav.boq_quantity_revisions" },
    { href: "/cost-estimates", icon: DollarSign, labelKey: "nav.cost_estimates" },
    { href: "/inspection-requests", icon: ClipboardCheck, labelKey: "nav.inspection_requests" },
    { href: "/inspection-reports", icon: FileCheck, labelKey: "nav.inspection_reports" },
    { href: "/defects", icon: ShieldAlert, labelKey: "nav.defects" },
    { href: "/corrective-actions", icon: Wrench, labelKey: "nav.corrective_actions" },
    { href: "/rfis", icon: MessageSquare, labelKey: "nav.rfis" },
    { href: "/technical-submittals", icon: FileSearch, labelKey: "nav.technical_submittals" },
    { href: "/material-submittals", icon: Microscope, labelKey: "nav.material_submittals" },
    { href: "/consultant-responses", icon: MessageSquare, labelKey: "nav.consultant_responses" },
    { href: "/engineering-progress", icon: Gauge, labelKey: "nav.engineering_progress" },
    { href: "/construction-dashboard", icon: Hammer, labelKey: "nav.construction_dashboard" },
    { href: "/contractors", icon: HardHat, labelKey: "nav.contractors" },
    { href: "/contractor-contracts", icon: FileSignature, labelKey: "nav.contractor_contracts" },
    { href: "/contract-boq-items", icon: FileBox, labelKey: "nav.contract_boq_items" },
    { href: "/work-progress-updates", icon: Gauge, labelKey: "nav.work_progress_updates" },
    { href: "/payment-certificates", icon: Award, labelKey: "nav.payment_certificates" },
    { href: "/certificate-items", icon: ListOrdered, labelKey: "nav.certificate_items" },
    { href: "/certificate-statuses", icon: ClipboardList, labelKey: "nav.certificate_statuses" },
    { href: "/certificate-approvals", icon: ClipboardCheck, labelKey: "nav.certificate_approvals" },
    { href: "/certificate-approval-logs", icon: History, labelKey: "nav.certificate_approval_logs" },
    { href: "/variation-orders", icon: GitPullRequestArrow, labelKey: "nav.variation_orders" },
    { href: "/contractor-deductions", icon: MinusCircle, labelKey: "nav.contractor_deductions" },
    { href: "/contractor-additions", icon: PlusCircle, labelKey: "nav.contractor_additions" },
    { href: "/retentions", icon: ShieldMinus, labelKey: "nav.retentions" },
    { href: "/advance-payments", icon: Coins, labelKey: "nav.advance_payments" },
    { href: "/advance-recoveries", icon: RotateCcw, labelKey: "nav.advance_recoveries" },
    { href: "/contractor-invoices", icon: FileSpreadsheet, labelKey: "nav.contractor_invoices" },
    { href: "/contract-approvals", icon: CheckSquare, labelKey: "nav.contract_approvals" },
    { href: "/construction-reports", icon: BarChart3, labelKey: "nav.construction_reports" },
  ]},
  { titleKey: "nav.group.procurement", items: [
    { href: "/procurement-dashboard", icon: Package, labelKey: "nav.procurement_dashboard" },
    { href: "/supplier-categories", icon: Layers, labelKey: "nav.supplier_categories" },
    { href: "/suppliers", icon: Store, labelKey: "nav.suppliers" },
    { href: "/supplier-contacts", icon: Contact, labelKey: "nav.supplier_contacts" },
    { href: "/supplier-evaluations", icon: BadgeCheck, labelKey: "nav.supplier_evaluations" },
    { href: "/purchase-requests", icon: ClipboardList, labelKey: "nav.purchase_requests" },
    { href: "/purchase-request-items", icon: ListOrdered, labelKey: "nav.purchase_request_items" },
    { href: "/rfqs", icon: FileSearch, labelKey: "nav.rfqs" },
    { href: "/rfq-items", icon: ListOrdered, labelKey: "nav.rfq_items" },
    { href: "/rfq-suppliers", icon: Users, labelKey: "nav.rfq_suppliers" },
    { href: "/supplier-quotations", icon: FileText, labelKey: "nav.supplier_quotations" },
    { href: "/quotation-items", icon: ListOrdered, labelKey: "nav.quotation_items" },
    { href: "/purchase-orders", icon: ShoppingCart, labelKey: "nav.purchase_orders" },
    { href: "/purchase-order-items", icon: ListOrdered, labelKey: "nav.purchase_order_items" },
    { href: "/purchase-contracts", icon: FileSignature, labelKey: "nav.purchase_contracts" },
    { href: "/purchase-contract-amendments", icon: FilePen, labelKey: "nav.purchase_contract_amendments" },
    { href: "/goods-receipt-notes", icon: PackageCheck, labelKey: "nav.goods_receipt_notes" },
    { href: "/grn-items", icon: Boxes, labelKey: "nav.grn_items" },
    { href: "/purchase-returns", icon: Undo2, labelKey: "nav.purchase_returns" },
    { href: "/purchase-return-items", icon: PackageX, labelKey: "nav.purchase_return_items" },
    { href: "/procurement-approvals", icon: CheckSquare, labelKey: "nav.procurement_approvals" },
    { href: "/procurement-reports", icon: BarChart3, labelKey: "nav.procurement_reports" },
    { href: "/inventory-dashboard", icon: Gauge, labelKey: "nav.inventory_dashboard" },
    { href: "/warehouses", icon: Store, labelKey: "nav.warehouses" },
    { href: "/warehouse-locations", icon: MapPin, labelKey: "nav.warehouse_locations" },
    { href: "/item-categories", icon: Layers, labelKey: "nav.item_categories" },
    { href: "/item-groups", icon: Library, labelKey: "nav.item_groups" },
    { href: "/units-of-measure", icon: Ruler, labelKey: "nav.units_of_measure" },
    { href: "/inventory-items", icon: Package, labelKey: "nav.inventory_items" },
    { href: "/reorder-levels", icon: AlertTriangle, labelKey: "nav.reorder_levels" },
    { href: "/stock-opening-balances", icon: FileBox, labelKey: "nav.stock_opening_balances" },
    { href: "/goods-receipts", icon: PackageCheck, labelKey: "nav.goods_receipts" },
    { href: "/goods-receipt-items", icon: ListOrdered, labelKey: "nav.goods_receipt_items" },
    { href: "/goods-issues", icon: PackageX, labelKey: "nav.goods_issues" },
    { href: "/goods-issue-items", icon: ListOrdered, labelKey: "nav.goods_issue_items" },
    { href: "/inventory-transfers", icon: ArrowLeftRight, labelKey: "nav.inventory_transfers" },
    { href: "/inventory-transfer-items", icon: ListOrdered, labelKey: "nav.inventory_transfer_items" },
    { href: "/stock-adjustments", icon: Scale, labelKey: "nav.stock_adjustments" },
    { href: "/stock-adjustment-items", icon: ListOrdered, labelKey: "nav.stock_adjustment_items" },
    { href: "/stock-counts", icon: ClipboardCheck, labelKey: "nav.stock_counts" },
    { href: "/stock-count-items", icon: ListOrdered, labelKey: "nav.stock_count_items" },
    { href: "/inventory-ledger", icon: BookOpen, labelKey: "nav.inventory_ledger" },
    { href: "/inventory-reports", icon: BarChart3, labelKey: "nav.inventory_reports" },
  ]},
  { titleKey: "nav.group.hr", items: [
    { href: "/hr-dashboard", icon: Gauge, labelKey: "nav.hr_dashboard" },
    { href: "/departments", icon: Network, labelKey: "nav.departments" },
    { href: "/sections", icon: Rows3, labelKey: "nav.sections" },
    { href: "/job-titles", icon: BadgeCheck, labelKey: "nav.job_titles" },
    { href: "/employees", icon: Users, labelKey: "nav.employees" },
    { href: "/employee-documents", icon: FileText, labelKey: "nav.employee_documents" },
    { href: "/shifts", icon: CalendarClock, labelKey: "nav.shifts" },
    { href: "/attendance", icon: UserCheck, labelKey: "nav.attendance" },
    { href: "/leave-types", icon: Layers, labelKey: "nav.leave_types" },
    { href: "/leave-balances", icon: Scale, labelKey: "nav.leave_balances" },
    { href: "/leave-requests", icon: CalendarRange, labelKey: "nav.leave_requests" },
    { href: "/salary-components", icon: Coins, labelKey: "nav.salary_components" },
    { href: "/payroll-periods", icon: CalendarDays, labelKey: "nav.payroll_periods" },
    { href: "/payroll-runs", icon: Calculator, labelKey: "nav.payroll_runs" },
    { href: "/payslips", icon: Receipt, labelKey: "nav.payslips" },
    { href: "/employee-loans", icon: PiggyBank, labelKey: "nav.employee_loans" },
    { href: "/employee-advances", icon: Wallet, labelKey: "nav.employee_advances" },
    { href: "/kpi-templates", icon: GanttChartSquare, labelKey: "nav.kpi_templates" },
    { href: "/employee-evaluations", icon: Award, labelKey: "nav.employee_evaluations" },
    { href: "/hr-reports", icon: BarChart3, labelKey: "nav.hr_reports" },
  ]},
  { titleKey: "nav.group.legal", items: [
    { href: "/legal-dashboard", icon: Gauge, labelKey: "nav.legal_dashboard" },
    { href: "/legal-contracts", icon: FileSign, labelKey: "nav.legal_contracts" },
    { href: "/contract-templates", icon: FileStack, labelKey: "nav.contract_templates" },
    { href: "/contract-versions", icon: FileText, labelKey: "nav.contract_versions" },
    { href: "/legal-contract-amendments", icon: FilePen, labelKey: "nav.legal_contract_amendments" },
    { href: "/contract-addendums", icon: FileCheck, labelKey: "nav.contract_addendums" },
    { href: "/legal-contract-attachments", icon: FileBox, labelKey: "nav.legal_contract_attachments" },
    { href: "/contract-events", icon: History, labelKey: "nav.contract_events" },
    { href: "/law-firms", icon: Landmark, labelKey: "nav.law_firms" },
    { href: "/legal-advisors", icon: UserCog, labelKey: "nav.legal_advisors" },
    { href: "/legal-cases", icon: Gavel, labelKey: "nav.legal_cases" },
    { href: "/legal-hearings", icon: CalendarClock, labelKey: "nav.legal_hearings" },
    { href: "/legal-claims", icon: Scale, labelKey: "nav.legal_claims" },
    { href: "/legal-notices", icon: Bell, labelKey: "nav.legal_notices" },
    { href: "/legal-case-links", icon: Link2, labelKey: "nav.legal_case_links" },
    { href: "/legal-reports", icon: BarChart3, labelKey: "nav.legal_reports" },
  ]},
  { titleKey: "nav.group.land_bank", items: [
    { href: "/land-bank-dashboard", icon: LandPlot, labelKey: "nav.land_bank_dashboard" },
    { href: "/land-parcels", icon: MapIcon, labelKey: "nav.land_parcels" },
    { href: "/land-ownerships", icon: Handshake, labelKey: "nav.land_ownerships" },
    { href: "/land-legal-statuses", icon: ScrollText, labelKey: "nav.land_legal_statuses" },
    { href: "/land-utilizations", icon: Trees, labelKey: "nav.land_utilizations" },
    { href: "/land-documents", icon: FolderArchive, labelKey: "nav.land_documents" },
    { href: "/land-acquisitions", icon: Landmark, labelKey: "nav.land_acquisitions" },
    { href: "/land-bank-reports", icon: BarChart3, labelKey: "nav.land_bank_reports" },
  ]},
  { titleKey: "nav.group.customer_service", items: [
    { href: "/customer-service-dashboard", icon: MessageSquare, labelKey: "nav.customer_service_dashboard" },
    { href: "/support-tickets", icon: Inbox, labelKey: "nav.support_tickets" },
    { href: "/complaints", icon: AlertTriangle, labelKey: "nav.complaints" },
    { href: "/service-escalations", icon: Bell, labelKey: "nav.service_escalations" },
    { href: "/call-logs", icon: PhoneCall, labelKey: "nav.call_logs" },
    { href: "/sla-policies", icon: ClipboardList, labelKey: "nav.sla_policies" },
    { href: "/handover-dashboard", icon: ClipboardCheck, labelKey: "nav.handover_dashboard" },
    { href: "/handover-requests", icon: FileCheck, labelKey: "nav.handover_requests" },
    { href: "/handover-schedules", icon: CalendarClock, labelKey: "nav.handover_schedules" },
    { href: "/handover-checklist-items", icon: CheckSquare, labelKey: "nav.handover_checklist_items" },
    { href: "/handover-minutes", icon: FileText, labelKey: "nav.handover_minutes" },
    { href: "/handover-snags", icon: AlertTriangle, labelKey: "nav.handover_snags" },
    { href: "/handover-approvals", icon: ShieldCheck, labelKey: "nav.handover_approvals" },
    { href: "/maintenance-requests", icon: Wrench, labelKey: "nav.maintenance_requests" },
    { href: "/work-orders", icon: Hammer, labelKey: "nav.work_orders" },
    { href: "/customer-satisfaction-surveys", icon: Star, labelKey: "nav.customer_satisfaction_surveys" },
    { href: "/handover-reports", icon: BarChart3, labelKey: "nav.handover_reports" },
    { href: "/customer-service-reports", icon: BarChart3, labelKey: "nav.customer_service_reports" },
  ]},
  { titleKey: "nav.group.marketing", items: [
    { href: "/marketing-dashboard", icon: LayoutDashboard, labelKey: "nav.marketing_dashboard" },
    { href: "/marketing-campaigns", icon: Megaphone, labelKey: "nav.marketing_campaigns" },
    { href: "/marketing-channels", icon: Share2, labelKey: "nav.marketing_channels" },
    { href: "/lead-sources", icon: Megaphone, labelKey: "nav.lead_sources" },
    { href: "/marketing-leads", icon: UserPlus, labelKey: "nav.marketing_leads" },
    { href: "/distribution-rules", icon: GitBranch, labelKey: "nav.distribution_rules" },
    { href: "/distribution-agents", icon: Users, labelKey: "nav.distribution_agents" },
    { href: "/distribution-logs", icon: ClipboardList, labelKey: "nav.distribution_logs" },
    { href: "/marketing-settings", icon: Settings, labelKey: "nav.marketing_settings" },
  ]},
  { titleKey: "nav.group.general_admin", items: [
    { href: "/general-admin-dashboard", icon: LayoutDashboard, labelKey: "nav.general_admin_dashboard" },
    { href: "/correspondence", icon: FileText, labelKey: "nav.correspondence" },
    { href: "/meetings", icon: CalendarClock, labelKey: "nav.meetings" },
    { href: "/administrative-decisions", icon: Gavel, labelKey: "nav.administrative_decisions" },
    { href: "/administrative-tasks", icon: CheckSquare, labelKey: "nav.administrative_tasks" },
    { href: "/general-services", icon: Handshake, labelKey: "nav.general_services" },
    { href: "/vehicles", icon: Truck, labelKey: "nav.vehicles" },
    { href: "/drivers", icon: UserCheck, labelKey: "nav.drivers" },
    { href: "/vehicle-missions", icon: MapPin, labelKey: "nav.vehicle_missions" },
    { href: "/vehicle-maintenance", icon: Hammer, labelKey: "nav.vehicle_maintenance" },
    { href: "/visitor-logs", icon: Contact, labelKey: "nav.visitor_logs" },
    { href: "/circulars", icon: Megaphone, labelKey: "nav.circulars" },
    { href: "/policies", icon: BookOpen, labelKey: "nav.policies" },
  ]},
  { titleKey: "nav.group.insurance", items: [
    { href: "/insurance-dashboard", icon: LayoutDashboard, labelKey: "nav.insurance_dashboard" },
    { href: "/employee-insurances", icon: ShieldCheck, labelKey: "nav.employee_insurances" },
    { href: "/insurance-forms", icon: FileText, labelKey: "nav.insurance_forms" },
    { href: "/insurance-additions", icon: PlusCircle, labelKey: "nav.insurance_additions" },
    { href: "/insurance-exclusions", icon: MinusCircle, labelKey: "nav.insurance_exclusions" },
    { href: "/insurance-data-amendments", icon: FilePen, labelKey: "nav.insurance_data_amendments" },
    { href: "/insurance-subscriptions", icon: Wallet, labelKey: "nav.insurance_subscriptions" },
    { href: "/insurance-payment-notices", icon: Bell, labelKey: "nav.insurance_payment_notices" },
    { href: "/insurance-reconciliations", icon: ArrowLeftRight, labelKey: "nav.insurance_reconciliations" },
    { href: "/insurance-arrears", icon: AlertTriangle, labelKey: "nav.insurance_arrears" },
    { href: "/insurance-penalties", icon: ShieldAlert, labelKey: "nav.insurance_penalties" },
    { href: "/service-terminations", icon: FileX, labelKey: "nav.service_terminations" },
    { href: "/insurance-settlements", icon: Receipt, labelKey: "nav.insurance_settlements" },
    { href: "/insurance-clearances", icon: FileCheck, labelKey: "nav.insurance_clearances" },
    { href: "/subcontractor-insurances", icon: HardHat, labelKey: "nav.subcontractor_insurances" },
    { href: "/project-labor-insurances", icon: Users, labelKey: "nav.project_labor_insurances" },
    { href: "/insurance-insured-report", icon: FileSpreadsheet, labelKey: "nav.insurance_insured_report" },
    { href: "/insurance-subscriptions-report", icon: FileSpreadsheet, labelKey: "nav.insurance_subscriptions_report" },
    { href: "/insurance-arrears-report", icon: FileSpreadsheet, labelKey: "nav.insurance_arrears_report" },
    { href: "/insurance-penalties-report", icon: FileSpreadsheet, labelKey: "nav.insurance_penalties_report" },
    { href: "/insurance-contractors-report", icon: FileSpreadsheet, labelKey: "nav.insurance_contractors_report" },
  ]},
  { titleKey: "nav.group.business_intelligence", items: [
    { href: "/ai-assistant", icon: Sparkles, labelKey: "nav.ai_assistant" },
    { href: "/ai-chat-erp", icon: MessagesSquare, labelKey: "nav.ai_chat_erp" },
    { href: "/ai-analytics", icon: BarChart3, labelKey: "nav.ai_analytics" },
    { href: "/ai-insights", icon: Lightbulb, labelKey: "nav.ai_insights" },
    { href: "/ai-recommendations", icon: Target, labelKey: "nav.ai_recommendations" },
    { href: "/ai-forecasting", icon: TrendingUp, labelKey: "nav.ai_forecasting" },
    { href: "/ai-alerts", icon: BellRing, labelKey: "nav.ai_alerts" },
    { href: "/ai-risk-analysis", icon: ShieldAlert, labelKey: "nav.ai_risk_analysis" },
    { href: "/ai-decision-support", icon: Compass, labelKey: "nav.ai_decision_support" },
    { href: "/ai-executive-advisor", icon: Brain, labelKey: "nav.ai_executive_advisor" },
    { href: "/executive-oversight", icon: Gauge, labelKey: "nav.executive_oversight" },
    { href: "/executive-dashboard", icon: Gauge, labelKey: "nav.executive_dashboard" },
    { href: "/sales-analytics", icon: TrendingUp, labelKey: "nav.sales_analytics" },
    { href: "/collection-analytics", icon: LineChart, labelKey: "nav.collection_analytics" },
    { href: "/construction-analytics", icon: BarChart3, labelKey: "nav.construction_analytics" },
    { href: "/procurement-analytics", icon: ShoppingCart, labelKey: "nav.procurement_analytics" },
    { href: "/inventory-analytics", icon: Package, labelKey: "nav.inventory_analytics" },
    { href: "/hr-analytics", icon: Users, labelKey: "nav.hr_analytics" },
    { href: "/financial-analytics", icon: Calculator, labelKey: "nav.financial_analytics" },
    { href: "/reports-engine", icon: FileSpreadsheet, labelKey: "nav.reports_engine" },
  ]},
  { titleKey: "nav.group.administration", items: [
    { href: "/users", icon: Users, labelKey: "nav.users" },
    { href: "/roles", icon: ShieldCheck, labelKey: "nav.roles" },
    { href: "/approvals", icon: CheckSquare, labelKey: "nav.approvals" },
    { href: "/companies", icon: Building2, labelKey: "nav.companies" },
    { href: "/branches", icon: MapPin, labelKey: "nav.branches" },
    { href: "/fiscal-years", icon: CalendarDays, labelKey: "nav.fiscal_years" },
    { href: "/currencies", icon: Banknote, labelKey: "nav.currencies" },
    { href: "/number-sequences", icon: Hash, labelKey: "nav.number_sequences" },
    { href: "/audit-logs", icon: ListOrdered, labelKey: "nav.audit_logs" },
    { href: "/login-history", icon: History, labelKey: "nav.login_history" },
    { href: "/settings", icon: Settings, labelKey: "nav.settings" },
  ]},
  { titleKey: "nav.group.system_administration", items: [
    { href: "/master-data", icon: Database, labelKey: "nav.master_data" },
    { href: "/dynamic-lists", icon: ListPlus, labelKey: "nav.dynamic_lists" },
  ]},
];

const FORMS_MODULE_BY_GROUP: Record<string, string> = {
  "nav.group.sales_crm": "sales",
  "nav.group.real_estate": "realEstate",
  "nav.group.engineering": "engineering",
  "nav.group.procurement": "procurement",
  "nav.group.hr": "hr",
  "nav.group.legal": "legal",
  "nav.group.land_bank": "landBank",
  "nav.group.customer_service": "customerService",
  "nav.group.general_admin": "general",
  "nav.group.insurance": "insurance",
  "nav.group.business_intelligence": "businessIntelligence",
  "nav.group.administration": "administration",
  "nav.group.system_administration": "systemAdministration",
};

const SALES_ADMIN_HREFS = new Set<string>(["/sales-administration"]);

const AI_NAV_HREFS = new Set<string>([
  "/ai-assistant",
  "/ai-chat-erp",
  "/ai-analytics",
  "/ai-insights",
  "/ai-recommendations",
  "/ai-forecasting",
  "/ai-alerts",
  "/ai-risk-analysis",
  "/ai-decision-support",
  "/ai-executive-advisor",
]);

const NAV_GROUPS = RAW_NAV_GROUPS.map((group) => {
  const moduleKey = FORMS_MODULE_BY_GROUP[group.titleKey];
  if (!moduleKey) return group;
  return {
    ...group,
    items: [
      ...group.items,
      { href: `/forms-printing/${moduleKey}`, icon: Printer, labelKey: "nav.forms_printing" },
    ],
  };
});

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, dir } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { testing, canTest, busy, enter, exit, reset } = useTesting();
  const { toast } = useToast();
  const [location] = useLocation();

  const handleEnterTesting = async () => {
    toast({ title: t("testing.entering") });
    try {
      await enter();
      toast({ title: t("testing.entered") });
    } catch {
      toast({ title: t("testing.error"), variant: "destructive" });
    }
  };
  const handleExitTesting = async () => {
    try {
      await exit();
      toast({ title: t("testing.exited") });
    } catch {
      toast({ title: t("testing.error"), variant: "destructive" });
    }
  };
  const handleResetTesting = async () => {
    if (!window.confirm(t("testing.reset_confirm"))) return;
    toast({ title: t("testing.resetting") });
    try {
      await reset();
      toast({ title: t("testing.reset_done") });
    } catch {
      toast({ title: t("testing.error"), variant: "destructive" });
    }
  };
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isWildcard = !!user?.permissions?.includes("*");
  const canViewAi = isWildcard || !!user?.permissions?.includes("ai.view");
  // Sales Administration is restricted to Sales Admin / Sales Manager / Executive
  // Manager / Owner roles (and super admins with the "*" wildcard).
  const rolesText = (user?.roles ?? []).join(" ").toLowerCase();
  const canViewSalesAdmin =
    isWildcard || /sales|admin|manager|owner|executive|director|مبيعات|سيلز|مدير|مالك|تنفيذي/.test(rolesText);
  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!canViewAi && AI_NAV_HREFS.has(item.href)) return false;
      if (!canViewSalesAdmin && SALES_ADMIN_HREFS.has(item.href)) return false;
      return true;
    }),
  }));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const matches = (item: NavItem) =>
      location === item.href || (item.href !== "/" && location.startsWith(item.href));
    for (const group of NAV_GROUPS) {
      let groupActive = group.items.some(matches);
      for (const sub of group.subGroups ?? []) {
        if (sub.items.some(matches)) {
          initial[sub.titleKey] = true;
          groupActive = true;
        }
      }
      if (groupActive) initial[group.titleKey] = true;
    }
    return initial;
  });
  const toggleGroup = (titleKey: string) =>
    setOpenGroups((prev) => ({ ...prev, [titleKey]: !prev[titleKey] }));

  if (!user) return <>{children}</>;

  const NavLinks = () => {
    const renderItem = (item: NavItem) => {
      const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
      return (
        <Link key={item.href} href={item.href} onClick={() => setIsMobileOpen(false)}>
          <span
            className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-muted hover:text-primary ${
              isActive ? "bg-muted text-primary font-medium" : "text-muted-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{t(item.labelKey)}</span>
          </span>
        </Link>
      );
    };
    return (
      <>
        {navGroups.map((group) => {
          const isOpen = openGroups[group.titleKey] ?? false;
          return (
            <div key={group.titleKey} className="pb-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.titleKey)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-primary"
              >
                <span className="truncate">{t(group.titleKey)}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <>
                  {group.items.map((item) => renderItem(item))}
                  {group.subGroups?.map((sub) => {
                    const subOpen = openGroups[sub.titleKey] ?? false;
                    return (
                      <div key={sub.titleKey} className="ms-2 border-s ps-1.5">
                        <button
                          type="button"
                          onClick={() => toggleGroup(sub.titleKey)}
                          aria-expanded={subOpen}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2 pb-0.5 pt-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground/70 transition-colors hover:text-primary"
                        >
                          <span className="truncate">{t(sub.titleKey)}</span>
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${subOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        {subOpen && sub.items.map((item) => renderItem(item))}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      {/* Permanent Testing Mode banner — visible on every page while the session
          is routed to the isolated demo database. */}
      {testing && (
        <div className="flex items-center justify-center gap-2 bg-destructive px-4 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-destructive-foreground sm:text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{t("testing.banner")}</span>
        </div>
      )}
      <div className="flex w-full flex-1 min-h-0">
      {/* Desktop Sidebar */}
      <aside className="hidden w-60 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-12 items-center border-b px-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-5 w-5 text-primary" />
            <span>ERP System</span>
          </Link>
        </div>
        <ScrollArea className="flex-1 overflow-auto py-1.5">
          <nav className="grid items-start px-2 font-medium space-y-0.5">
            <NavLinks />
          </nav>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex h-12 items-center gap-4 border-b bg-background px-4 lg:px-6">
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side={dir === "rtl" ? "right" : "left"} className="flex flex-col w-64 p-0">
              <div className="flex h-14 items-center border-b px-4 font-semibold">
                <Building2 className="h-6 w-6 mr-2" />
                <span>ERP System</span>
              </div>
              <ScrollArea className="flex-1 overflow-auto py-4">
                <nav className="grid items-start px-4 text-sm font-medium space-y-1">
                  <NavLinks />
                </nav>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <div className="flex flex-1 items-center justify-end gap-2">
            <OwnerModeControls />
            {canTest &&
              (testing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={handleResetTesting}
                    title={t("testing.reset")}
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span className="hidden lg:inline">{t("testing.reset")}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={handleExitTesting}
                    title={t("testing.exit")}
                    className="border-destructive/40 text-destructive hover:text-destructive"
                  >
                    <FlaskConical className="h-4 w-4" />
                    <span className="hidden lg:inline">{t("testing.exit")}</span>
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={handleEnterTesting}
                  title={t("testing.enter")}
                >
                  <FlaskConical className="h-4 w-4" />
                  <span className="hidden lg:inline">{t("testing.enter")}</span>
                </Button>
              ))}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              title={language === "en" ? "Switch to Arabic" : "Switch to English"}
            >
              <span className="font-semibold">{language === "en" ? "EN" : "AR"}</span>
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {user.fullName.substring(0, 2).toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.fullName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/change-password" className="cursor-pointer flex items-center w-full">
                    <KeyRound className="mr-2 h-4 w-4" />
                    <span>{t("nav.change_password")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("nav.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-3 md:p-4 overflow-auto">
          <PageNav navGroups={NAV_GROUPS} />
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
