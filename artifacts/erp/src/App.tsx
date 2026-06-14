import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/language-provider";
import { AuthProvider } from "@/lib/auth-provider";
import { AppShell } from "@/components/layout/app-shell";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import UsersPage from "@/pages/users";
import RolesPage from "@/pages/roles";
import CompaniesPage from "@/pages/companies";
import BranchesPage from "@/pages/branches";
import FiscalYearsPage from "@/pages/fiscal-years";
import CurrenciesPage from "@/pages/currencies";
import NumberSequencesPage from "@/pages/number-sequences";
import AuditLogsPage from "@/pages/audit-logs";
import LoginHistoryPage from "@/pages/login-history";
import SettingsPage from "@/pages/settings";
import ChangePasswordPage from "@/pages/change-password";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <AppShell>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/users" component={UsersPage} />
            <Route path="/roles" component={RolesPage} />
            <Route path="/companies" component={CompaniesPage} />
            <Route path="/branches" component={BranchesPage} />
            <Route path="/fiscal-years" component={FiscalYearsPage} />
            <Route path="/currencies" component={CurrenciesPage} />
            <Route path="/number-sequences" component={NumberSequencesPage} />
            <Route path="/audit-logs" component={AuditLogsPage} />
            <Route path="/login-history" component={LoginHistoryPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/change-password" component={ChangePasswordPage} />
            <Route>
              <div className="flex h-[50vh] items-center justify-center font-semibold text-lg text-muted-foreground">404 Not Found</div>
            </Route>
          </Switch>
        </AppShell>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="erp-theme">
        <LanguageProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthProvider>
                <Router />
              </AuthProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
