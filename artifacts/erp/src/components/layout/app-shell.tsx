import { useAuth } from "@/lib/auth-provider";
import { useLanguage } from "@/lib/language-provider";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/theme-provider";
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
    { href: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  ]},
  { titleKey: "nav.group.real_estate", items: [
    { href: "/projects", icon: Building, labelKey: "nav.projects" },
    { href: "/phases", icon: Layers, labelKey: "nav.phases" },
    { href: "/buildings", icon: Building2, labelKey: "nav.buildings" },
    { href: "/floors", icon: Rows3, labelKey: "nav.floors" },
    { href: "/units", icon: Home, labelKey: "nav.units" },
    { href: "/unit-types", icon: Boxes, labelKey: "nav.unit_types" },
    { href: "/unit-statuses", icon: BadgeCheck, labelKey: "nav.unit_statuses" },
  ]},
  { titleKey: "nav.group.unit_management", items: [
    { href: "/unit-price-lists", icon: ClipboardList, labelKey: "nav.unit_price_lists" },
    { href: "/unit-pricing", icon: DollarSign, labelKey: "nav.unit_pricing" },
    { href: "/unit-discounts", icon: Percent, labelKey: "nav.unit_discounts" },
  ]},
  { titleKey: "nav.group.crm", items: [
    { href: "/leads", icon: UserPlus, labelKey: "nav.leads" },
    { href: "/lead-sources", icon: Megaphone, labelKey: "nav.lead_sources" },
    { href: "/lead-activities", icon: Activity, labelKey: "nav.lead_activities" },
    { href: "/lead-follow-ups", icon: CalendarClock, labelKey: "nav.lead_follow_ups" },
    { href: "/lead-assignments", icon: UserCheck, labelKey: "nav.lead_assignments" },
    { href: "/lead-conversions", icon: ArrowRightLeft, labelKey: "nav.lead_conversions" },
  ]},
  { titleKey: "nav.group.customers", items: [
    { href: "/customers", icon: Users, labelKey: "nav.customers" },
    { href: "/customer-contacts", icon: Contact, labelKey: "nav.customer_contacts" },
    { href: "/customer-documents", icon: FileText, labelKey: "nav.customer_documents" },
    { href: "/customer-notes", icon: StickyNote, labelKey: "nav.customer_notes" },
  ]},
  { titleKey: "nav.group.sales", items: [
    { href: "/reservations", icon: BookMarked, labelKey: "nav.reservations" },
    { href: "/reservation-payments", icon: Wallet, labelKey: "nav.reservation_payments" },
    { href: "/reservation-notes", icon: StickyNote, labelKey: "nav.reservation_notes" },
    { href: "/reservation-documents", icon: FileText, labelKey: "nav.reservation_documents" },
    { href: "/contracts", icon: FileSignature, labelKey: "nav.contracts" },
    { href: "/contract-amendments", icon: FilePen, labelKey: "nav.contract_amendments" },
    { href: "/contract-cancellations", icon: FileX, labelKey: "nav.contract_cancellations" },
    { href: "/contract-notes", icon: StickyNote, labelKey: "nav.contract_notes" },
    { href: "/contract-documents", icon: FileText, labelKey: "nav.contract_documents" },
    { href: "/unit-transfers", icon: ArrowLeftRight, labelKey: "nav.unit_transfers" },
  ]},
  { titleKey: "nav.group.financial_management", items: [
    { href: "/accounting-dashboard", icon: Calculator, labelKey: "nav.accounting_dashboard" },
    { href: "/cashboxes", icon: Wallet, labelKey: "nav.cashboxes" },
    { href: "/treasury-transactions", icon: ArrowLeftRight, labelKey: "nav.treasury_transactions" },
    { href: "/bank-accounts", icon: Banknote, labelKey: "nav.bank_accounts" },
    { href: "/bank-transactions", icon: ArrowRightLeft, labelKey: "nav.bank_transactions" },
    { href: "/receipts", icon: Receipt, labelKey: "nav.receipts" },
    { href: "/penalties", icon: AlertTriangle, labelKey: "nav.penalties" },
    { href: "/installment-plans", icon: CalendarRange, labelKey: "nav.installment_plans" },
    { href: "/installment-schedules", icon: ListOrdered, labelKey: "nav.installment_schedules" },
    { href: "/installment-collections", icon: Receipt, labelKey: "nav.installment_collections" },
    { href: "/penalty-rules", icon: AlertTriangle, labelKey: "nav.penalty_rules" },
    { href: "/cheques", icon: Banknote, labelKey: "nav.cheques" },
    { href: "/cheque-status-history", icon: History, labelKey: "nav.cheque_status_history" },
    { href: "/cheque-reports", icon: ClipboardList, labelKey: "nav.cheque_reports" },
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
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, dir } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (!user) return <>{children}</>;

  const NavLinks = () => (
    <>
      {NAV_GROUPS.map((group) => (
        <div key={group.titleKey} className="pb-2">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t(group.titleKey)}
          </p>
          {group.items.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setIsMobileOpen(false)}>
                <span
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${
                    isActive ? "bg-muted text-primary font-medium" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Building2 className="h-6 w-6" />
            <span>ERP System</span>
          </Link>
        </div>
        <ScrollArea className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
            <NavLinks />
          </nav>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
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
              <span className="font-semibold">{language === "en" ? "AR" : "EN"}</span>
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

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
