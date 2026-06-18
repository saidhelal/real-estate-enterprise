import { useAuth } from "@/lib/auth-provider";
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

const NAV_GROUPS = [
  { titleKey: "nav.group.general", items: [
    { href: "/", icon: Home, labelKey: "nav.home" },
    { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  ]},
  { titleKey: "nav.group.sales_crm", items: [
    { href: "/global-search", icon: Search, labelKey: "nav.global_search" },
    { href: "/customers", icon: Users, labelKey: "nav.customers" },
    { href: "/customer-contacts", icon: Contact, labelKey: "nav.customer_contacts" },
    { href: "/leads", icon: UserPlus, labelKey: "nav.leads" },
    { href: "/reservations", icon: BookMarked, labelKey: "nav.reservations" },
    { href: "/contracts", icon: FileSignature, labelKey: "nav.contracts" },
    { href: "/contract-amendments", icon: FilePen, labelKey: "nav.contract_amendments" },
    { href: "/contract-cancellations", icon: FileX, labelKey: "nav.contract_cancellations" },
    { href: "/unit-transfers", icon: ArrowLeftRight, labelKey: "nav.unit_transfers" },
    { href: "/customer-documents", icon: FileText, labelKey: "nav.customer_documents" },
    { href: "/customer-notes", icon: StickyNote, labelKey: "nav.customer_notes" },
    { href: "/lead-sources", icon: Megaphone, labelKey: "nav.lead_sources" },
    { href: "/lead-activities", icon: Activity, labelKey: "nav.lead_activities" },
    { href: "/lead-follow-ups", icon: CalendarClock, labelKey: "nav.lead_follow_ups" },
    { href: "/lead-assignments", icon: UserCheck, labelKey: "nav.lead_assignments" },
    { href: "/lead-conversions", icon: ArrowRightLeft, labelKey: "nav.lead_conversions" },
    { href: "/reservation-payments", icon: Wallet, labelKey: "nav.reservation_payments" },
    { href: "/reservation-notes", icon: StickyNote, labelKey: "nav.reservation_notes" },
    { href: "/reservation-documents", icon: FileText, labelKey: "nav.reservation_documents" },
    { href: "/contract-notes", icon: StickyNote, labelKey: "nav.contract_notes" },
    { href: "/contract-documents", icon: FileText, labelKey: "nav.contract_documents" },
  ]},
  { titleKey: "nav.group.real_estate", items: [
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
  { titleKey: "nav.group.financial_management", items: [
    { href: "/accounting-dashboard", icon: Calculator, labelKey: "nav.accounting_dashboard" },
    { href: "/cashboxes", icon: Wallet, labelKey: "nav.cashboxes" },
    { href: "/treasury-transactions", icon: ArrowLeftRight, labelKey: "nav.treasury_transactions" },
    { href: "/bank-accounts", icon: Banknote, labelKey: "nav.bank_accounts" },
    { href: "/bank-transactions", icon: ArrowRightLeft, labelKey: "nav.bank_transactions" },
    { href: "/accounts", icon: BookOpen, labelKey: "nav.accounts" },
    { href: "/cost-centers", icon: Network, labelKey: "nav.cost_centers" },
    { href: "/profit-centers", icon: TrendingUp, labelKey: "nav.profit_centers" },
    { href: "/journal-entries", icon: BookText, labelKey: "nav.journal_entries" },
    { href: "/general-ledger", icon: Library, labelKey: "nav.general_ledger" },
    { href: "/trial-balance", icon: Scale, labelKey: "nav.trial_balance" },
    { href: "/balance-sheet", icon: GanttChartSquare, labelKey: "nav.balance_sheet" },
    { href: "/income-statement", icon: TrendingUp, labelKey: "nav.income_statement" },
    { href: "/cash-flow", icon: LineChart, labelKey: "nav.cash_flow" },
    { href: "/financial-reports", icon: BarChart3, labelKey: "nav.financial_reports" },
    { href: "/fiscal-periods", icon: CalendarRange, labelKey: "nav.fiscal_periods" },
    { href: "/year-end-closing", icon: CalendarDays, labelKey: "nav.year_end_closing" },
    { href: "/budgets", icon: PiggyBank, labelKey: "nav.budgets" },
    { href: "/budget-lines", icon: ListOrdered, labelKey: "nav.budget_lines" },
    { href: "/budget-vs-actual", icon: Scale, labelKey: "nav.budget_vs_actual" },
    { href: "/account-mappings", icon: Link2, labelKey: "nav.account_mappings" },
    { href: "/tax-codes", icon: Percent, labelKey: "nav.tax_codes" },
    { href: "/customer-invoices", icon: FileText, labelKey: "nav.customer_invoices" },
    { href: "/supplier-invoices", icon: FileBox, labelKey: "nav.supplier_invoices" },
    { href: "/payment-vouchers", icon: Wallet, labelKey: "nav.payment_vouchers" },
    { href: "/ar-aging", icon: ClipboardList, labelKey: "nav.ar_aging" },
    { href: "/ap-aging", icon: ClipboardList, labelKey: "nav.ap_aging" },
    { href: "/tax-report", icon: FileSpreadsheet, labelKey: "nav.tax_report" },
    { href: "/receipts", icon: Receipt, labelKey: "nav.receipts" },
    { href: "/installment-plans", icon: CalendarRange, labelKey: "nav.installment_plans" },
    { href: "/installment-schedules", icon: ListOrdered, labelKey: "nav.installment_schedules" },
    { href: "/installment-collections", icon: Receipt, labelKey: "nav.installment_collections" },
    { href: "/penalties", icon: AlertTriangle, labelKey: "nav.penalties" },
    { href: "/penalty-rules", icon: AlertTriangle, labelKey: "nav.penalty_rules" },
    { href: "/cheques", icon: Banknote, labelKey: "nav.cheques" },
    { href: "/cheque-status-history", icon: History, labelKey: "nav.cheque_status_history" },
    { href: "/cheque-reports", icon: ClipboardList, labelKey: "nav.cheque_reports" },
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
  ]},
  { titleKey: "nav.group.construction", items: [
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
  ]},
  { titleKey: "nav.group.inventory", items: [
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
    { href: "/sla-policies", icon: ClipboardList, labelKey: "nav.sla_policies" },
    { href: "/service-escalations", icon: Bell, labelKey: "nav.service_escalations" },
    { href: "/handover-dashboard", icon: ClipboardCheck, labelKey: "nav.handover_dashboard" },
    { href: "/handover-requests", icon: FileCheck, labelKey: "nav.handover_requests" },
    { href: "/handover-schedules", icon: CalendarClock, labelKey: "nav.handover_schedules" },
    { href: "/handover-checklist-items", icon: CheckSquare, labelKey: "nav.handover_checklist_items" },
    { href: "/handover-minutes", icon: FileText, labelKey: "nav.handover_minutes" },
    { href: "/handover-snags", icon: AlertTriangle, labelKey: "nav.handover_snags" },
    { href: "/handover-approvals", icon: ShieldCheck, labelKey: "nav.handover_approvals" },
    { href: "/handover-reports", icon: BarChart3, labelKey: "nav.handover_reports" },
    { href: "/customer-service-reports", icon: BarChart3, labelKey: "nav.customer_service_reports" },
  ]},
  { titleKey: "nav.group.fixed_assets", items: [
    { href: "/fixed-assets-dashboard", icon: Package, labelKey: "nav.fixed_assets_dashboard" },
    { href: "/asset-categories", icon: Boxes, labelKey: "nav.asset_categories" },
    { href: "/fixed-assets", icon: FileBox, labelKey: "nav.fixed_assets" },
    { href: "/asset-transfers", icon: Truck, labelKey: "nav.asset_transfers" },
    { href: "/asset-depreciations", icon: Coins, labelKey: "nav.asset_depreciations" },
    { href: "/asset-inventory-counts", icon: ClipboardCheck, labelKey: "nav.asset_inventory_counts" },
    { href: "/asset-disposals", icon: PackageX, labelKey: "nav.asset_disposals" },
    { href: "/fixed-assets-reports", icon: BarChart3, labelKey: "nav.fixed_assets_reports" },
  ]},
  { titleKey: "nav.group.business_intelligence", items: [
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, dir } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) {
      const hasActive = group.items.some(
        (item) => location === item.href || (item.href !== "/" && location.startsWith(item.href)),
      );
      if (hasActive) initial[group.titleKey] = true;
    }
    return initial;
  });
  const toggleGroup = (titleKey: string) =>
    setOpenGroups((prev) => ({ ...prev, [titleKey]: !prev[titleKey] }));

  if (!user) return <>{children}</>;

  const NavLinks = () => {
    return (
      <>
        {NAV_GROUPS.map((group) => {
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
              {isOpen &&
                group.items.map((item) => {
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
                })}
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
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
  );
}
