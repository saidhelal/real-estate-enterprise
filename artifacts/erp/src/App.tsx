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

import ProjectsPage from "@/pages/projects";
import PhasesPage from "@/pages/phases";
import BuildingsPage from "@/pages/buildings";
import FloorsPage from "@/pages/floors";
import UnitsPage from "@/pages/units";
import UnitTypesPage from "@/pages/unit-types";
import UnitStatusesPage from "@/pages/unit-statuses";
import UnitPriceListsPage from "@/pages/unit-price-lists";
import UnitPricingPage from "@/pages/unit-pricing";
import UnitDiscountsPage from "@/pages/unit-discounts";
import LeadsPage from "@/pages/leads";
import LeadSourcesPage from "@/pages/lead-sources";
import LeadActivitiesPage from "@/pages/lead-activities";
import LeadFollowUpsPage from "@/pages/lead-follow-ups";
import LeadAssignmentsPage from "@/pages/lead-assignments";
import LeadConversionsPage from "@/pages/lead-conversions";
import CustomersPage from "@/pages/customers";
import CustomerContactsPage from "@/pages/customer-contacts";
import CustomerDocumentsPage from "@/pages/customer-documents";
import CustomerNotesPage from "@/pages/customer-notes";
import ReservationsPage from "@/pages/reservations";
import ReservationPaymentsPage from "@/pages/reservation-payments";
import ReservationNotesPage from "@/pages/reservation-notes";
import ReservationDocumentsPage from "@/pages/reservation-documents";
import ContractsPage from "@/pages/contracts";
import ContractAmendmentsPage from "@/pages/contract-amendments";
import ContractCancellationsPage from "@/pages/contract-cancellations";
import ContractNotesPage from "@/pages/contract-notes";
import ContractDocumentsPage from "@/pages/contract-documents";
import UnitTransfersPage from "@/pages/unit-transfers";
import InstallmentPlansPage from "@/pages/installment-plans";
import InstallmentSchedulesPage from "@/pages/installment-schedules";
import InstallmentCollectionsPage from "@/pages/installment-collections";
import PenaltyRulesPage from "@/pages/penalty-rules";
import CashboxesPage from "@/pages/cashboxes";
import TreasuryTransactionsPage from "@/pages/treasury-transactions";
import BankAccountsPage from "@/pages/bank-accounts";
import BankTransactionsPage from "@/pages/bank-transactions";
import ReceiptsPage from "@/pages/receipts";
import PenaltiesPage from "@/pages/penalties";

import AccountsPage from "@/pages/accounts";
import CostCentersPage from "@/pages/cost-centers";
import JournalEntriesPage from "@/pages/journal-entries";
import GeneralLedgerPage from "@/pages/general-ledger";
import TrialBalancePage from "@/pages/trial-balance";
import BalanceSheetPage from "@/pages/balance-sheet";
import IncomeStatementPage from "@/pages/income-statement";
import CashFlowPage from "@/pages/cash-flow";
import FiscalPeriodsPage from "@/pages/fiscal-periods";
import BudgetsPage from "@/pages/budgets";
import BudgetLinesPage from "@/pages/budget-lines";
import BudgetVsActualPage from "@/pages/budget-vs-actual";
import AccountMappingsPage from "@/pages/account-mappings";
import AccountingDashboardPage from "@/pages/accounting-dashboard";

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

            <Route path="/projects" component={ProjectsPage} />
            <Route path="/phases" component={PhasesPage} />
            <Route path="/buildings" component={BuildingsPage} />
            <Route path="/floors" component={FloorsPage} />
            <Route path="/units" component={UnitsPage} />
            <Route path="/unit-types" component={UnitTypesPage} />
            <Route path="/unit-statuses" component={UnitStatusesPage} />
            <Route path="/unit-price-lists" component={UnitPriceListsPage} />
            <Route path="/unit-pricing" component={UnitPricingPage} />
            <Route path="/unit-discounts" component={UnitDiscountsPage} />
            <Route path="/leads" component={LeadsPage} />
            <Route path="/lead-sources" component={LeadSourcesPage} />
            <Route path="/lead-activities" component={LeadActivitiesPage} />
            <Route path="/lead-follow-ups" component={LeadFollowUpsPage} />
            <Route path="/lead-assignments" component={LeadAssignmentsPage} />
            <Route path="/lead-conversions" component={LeadConversionsPage} />
            <Route path="/customers" component={CustomersPage} />
            <Route path="/customer-contacts" component={CustomerContactsPage} />
            <Route path="/customer-documents" component={CustomerDocumentsPage} />
            <Route path="/customer-notes" component={CustomerNotesPage} />
            <Route path="/reservations" component={ReservationsPage} />
            <Route path="/reservation-payments" component={ReservationPaymentsPage} />
            <Route path="/reservation-notes" component={ReservationNotesPage} />
            <Route path="/reservation-documents" component={ReservationDocumentsPage} />
            <Route path="/contracts" component={ContractsPage} />
            <Route path="/contract-amendments" component={ContractAmendmentsPage} />
            <Route path="/contract-cancellations" component={ContractCancellationsPage} />
            <Route path="/contract-notes" component={ContractNotesPage} />
            <Route path="/contract-documents" component={ContractDocumentsPage} />
            <Route path="/unit-transfers" component={UnitTransfersPage} />
            <Route path="/installment-plans" component={InstallmentPlansPage} />
            <Route path="/installment-schedules" component={InstallmentSchedulesPage} />
            <Route path="/installment-collections" component={InstallmentCollectionsPage} />
            <Route path="/penalty-rules" component={PenaltyRulesPage} />
            <Route path="/cashboxes" component={CashboxesPage} />
            <Route path="/treasury-transactions" component={TreasuryTransactionsPage} />
            <Route path="/bank-accounts" component={BankAccountsPage} />
            <Route path="/bank-transactions" component={BankTransactionsPage} />
            <Route path="/receipts" component={ReceiptsPage} />
            <Route path="/penalties" component={PenaltiesPage} />

            <Route path="/accounting-dashboard" component={AccountingDashboardPage} />
            <Route path="/accounts" component={AccountsPage} />
            <Route path="/cost-centers" component={CostCentersPage} />
            <Route path="/journal-entries" component={JournalEntriesPage} />
            <Route path="/general-ledger" component={GeneralLedgerPage} />
            <Route path="/trial-balance" component={TrialBalancePage} />
            <Route path="/balance-sheet" component={BalanceSheetPage} />
            <Route path="/income-statement" component={IncomeStatementPage} />
            <Route path="/cash-flow" component={CashFlowPage} />
            <Route path="/fiscal-periods" component={FiscalPeriodsPage} />
            <Route path="/budgets" component={BudgetsPage} />
            <Route path="/budget-lines" component={BudgetLinesPage} />
            <Route path="/budget-vs-actual" component={BudgetVsActualPage} />
            <Route path="/account-mappings" component={AccountMappingsPage} />
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
