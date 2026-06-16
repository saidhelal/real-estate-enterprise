import { useAuth } from "@/lib/auth-provider";
import { useLanguage } from "@/lib/language-provider";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Home,
  FileText,
  CreditCard,
  History,
  FolderOpen,
  Wrench,
  MessageSquareWarning,
  HelpCircle,
  Bell,
  Menu,
  Moon,
  Sun,
  LogOut,
  User,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetPortalNotifications } from "@workspace/api-client-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, dir } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [location] = useLocation();

  const { data: notifications } = useGetPortalNotifications();
  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  const navigation = [
    { name: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { name: t("nav.units"), href: "/units", icon: Home },
    { name: t("nav.contracts"), href: "/contracts", icon: FileText },
    { name: t("nav.installments"), href: "/installments", icon: CreditCard },
    { name: t("nav.collections"), href: "/collections", icon: History },
    { name: t("nav.documents"), href: "/documents", icon: FolderOpen },
    { name: t("nav.maintenance"), href: "/maintenance", icon: Wrench },
    { name: t("nav.complaints"), href: "/complaints", icon: MessageSquareWarning },
    { name: t("nav.support"), href: "/support", icon: HelpCircle },
  ];

  const NavLinks = () => (
    <div className="flex flex-col gap-1 w-full">
      {navigation.map((item) => {
        const isActive = location === item.href || location.startsWith(`${item.href}/`);
        return (
          <Link key={item.name} href={item.href} className="w-full">
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full justify-start ${isActive ? "font-semibold" : "font-normal"} ${dir === "rtl" ? "text-right" : "text-left"}`}
            >
              <item.icon className={`h-4 w-4 ${dir === "rtl" ? "ml-2" : "mr-2"} ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              {item.name}
            </Button>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] w-full bg-background" dir={dir}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r bg-card h-screen sticky top-0 shrink-0 border-border z-20">
        <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
          <div className="font-semibold text-lg tracking-tight text-primary flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
              P
            </div>
            Customer Portal
          </div>
        </div>
        <ScrollArea className="flex-1 py-4 px-3">
          <NavLinks />
        </ScrollArea>
        <div className="p-4 border-t border-border shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary">
                {user?.customerName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">{user?.customerName}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.username}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-72 p-0 flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
                  <div className="font-semibold text-lg tracking-tight text-primary flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
                      P
                    </div>
                    Customer Portal
                  </div>
                </div>
                <ScrollArea className="flex-1 py-4 px-3">
                  <NavLinks />
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Link href="/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
                )}
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm font-medium">Settings</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLanguage(language === "en" ? "ar" : "en")}
                  className="cursor-pointer"
                >
                  {language === "en" ? "العربية" : "English"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="cursor-pointer"
                >
                  {theme === "dark" ? (
                    <><Sun className="mr-2 h-4 w-4" /> Light Mode</>
                  ) : (
                    <><Moon className="mr-2 h-4 w-4" /> Dark Mode</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
