import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/language-provider";
import { AuthProvider } from "@/lib/auth-provider";
import { AppShell } from "@/components/layout/app-shell";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import Dashboard from "@/pages/dashboard";
import Units from "@/pages/units";
import Contracts from "@/pages/contracts";
import Installments from "@/pages/installments";
import Collections from "@/pages/collections";
import Documents from "@/pages/documents";
import Maintenance from "@/pages/maintenance";
import Complaints from "@/pages/complaints";
import SupportTickets from "@/pages/support";
import SupportTicketDetail from "@/pages/support-detail";
import Notifications from "@/pages/notifications";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      
      <Route>
        <AppShell>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/units" component={Units} />
            <Route path="/contracts" component={Contracts} />
            <Route path="/installments" component={Installments} />
            <Route path="/collections" component={Collections} />
            <Route path="/documents" component={Documents} />
            <Route path="/maintenance" component={Maintenance} />
            <Route path="/complaints" component={Complaints} />
            <Route path="/support" component={SupportTickets} />
            <Route path="/support/:id" component={SupportTicketDetail} />
            <Route path="/notifications" component={Notifications} />
            <Route component={NotFound} />
          </Switch>
        </AppShell>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="portal-ui-theme">
        <LanguageProvider defaultLanguage="en" storageKey="portal-language">
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
