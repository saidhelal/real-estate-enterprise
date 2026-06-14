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
    { href: "/contracts", icon: FileSignature, labelKey: "nav.contracts" },
    { href: "/contract-amendments", icon: FilePen, labelKey: "nav.contract_amendments" },
    { href: "/contract-cancellations", icon: FileX, labelKey: "nav.contract_cancellations" },
    { href: "/unit-transfers", icon: ArrowLeftRight, labelKey: "nav.unit_transfers" },
  ]},
  { titleKey: "nav.group.installments", items: [
    { href: "/installment-plans", icon: CalendarRange, labelKey: "nav.installment_plans" },
    { href: "/installment-schedules", icon: ListOrdered, labelKey: "nav.installment_schedules" },
    { href: "/installment-collections", icon: Receipt, labelKey: "nav.installment_collections" },
    { href: "/penalty-rules", icon: AlertTriangle, labelKey: "nav.penalty_rules" },
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
