import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/language-provider";
import { AuthProvider } from "@/lib/auth-provider";
import { TestingProvider } from "@/lib/testing-provider";
import { OwnerModeProvider } from "@/lib/owner-mode-provider";
import { LookupLabelProvider } from "@/lib/lookups";
import { AppShell } from "@/components/layout/app-shell";

import Login from "@/pages/login";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
const DocumentsPage = lazy(() => import("@/pages/documents"));
const DocumentDetailPage = lazy(() => import("@/pages/document-detail"));
const DocumentsDashboardPage = lazy(() => import("@/pages/documents-dashboard"));
const DocumentApprovalsPage = lazy(() => import("@/pages/document-approvals"));
const DocumentSearchPage = lazy(() => import("@/pages/document-search"));
const UsersPage = lazy(() => import("@/pages/users"));
const RolesPage = lazy(() => import("@/pages/roles"));
const MasterDataPage = lazy(() => import("@/pages/master-data"));
const DynamicListsPage = lazy(() => import("@/pages/dynamic-lists"));
const CompaniesPage = lazy(() => import("@/pages/companies"));
const BranchesPage = lazy(() => import("@/pages/branches"));
const FiscalYearsPage = lazy(() => import("@/pages/fiscal-years"));
const CurrenciesPage = lazy(() => import("@/pages/currencies"));
const NumberSequencesPage = lazy(() => import("@/pages/number-sequences"));
const AuditLogsPage = lazy(() => import("@/pages/audit-logs"));
const LoginHistoryPage = lazy(() => import("@/pages/login-history"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const ChangePasswordPage = lazy(() => import("@/pages/change-password"));
const ApprovalsPage = lazy(() => import("@/pages/approvals"));

const DataEntryCenterPage = lazy(() => import("@/pages/data-entry-center"));
const ProjectsPage = lazy(() => import("@/pages/projects"));
const PhasesPage = lazy(() => import("@/pages/phases"));
const BuildingsPage = lazy(() => import("@/pages/buildings"));
const FloorsPage = lazy(() => import("@/pages/floors"));
const UnitsPage = lazy(() => import("@/pages/units"));
const UnitTypesPage = lazy(() => import("@/pages/unit-types"));
const UnitStatusesPage = lazy(() => import("@/pages/unit-statuses"));
const UnitPriceListsPage = lazy(() => import("@/pages/unit-price-lists"));
const UnitPricingPage = lazy(() => import("@/pages/unit-pricing"));
const UnitDiscountsPage = lazy(() => import("@/pages/unit-discounts"));
const LeadsPage = lazy(() => import("@/pages/leads"));
const GlobalSearchPage = lazy(() => import("@/pages/global-search"));
const LeadSourcesPage = lazy(() => import("@/pages/lead-sources"));
const LeadActivitiesPage = lazy(() => import("@/pages/lead-activities"));
const LeadFollowUpsPage = lazy(() => import("@/pages/lead-follow-ups"));
const LeadAssignmentsPage = lazy(() => import("@/pages/lead-assignments"));
const LeadConversionsPage = lazy(() => import("@/pages/lead-conversions"));
const CustomersPage = lazy(() => import("@/pages/customers"));
const CustomerContactsPage = lazy(() => import("@/pages/customer-contacts"));
const CrmDashboardPage = lazy(() => import("@/pages/crm-dashboard"));
const MyWorkPage = lazy(() => import("@/pages/crm-my-work"));
const CrmAvailableUnitsPage = lazy(() => import("@/pages/crm-available-units"));
const CrmSalesPage = lazy(() => import("@/pages/crm-sales"));
const CrmReportsPage = lazy(() => import("@/pages/crm-reports"));
const SalesAdministrationPage = lazy(() => import("@/pages/crm-sales-administration"));
const CustomerDocumentsPage = lazy(() => import("@/pages/customer-documents"));
const CustomerNotesPage = lazy(() => import("@/pages/customer-notes"));
const ReservationsPage = lazy(() => import("@/pages/reservations"));
const ReservationPaymentsPage = lazy(() => import("@/pages/reservation-payments"));
const ReservationNotesPage = lazy(() => import("@/pages/reservation-notes"));
const ReservationDocumentsPage = lazy(() => import("@/pages/reservation-documents"));
const ContractsPage = lazy(() => import("@/pages/contracts"));
const ContractDocumentPage = lazy(() => import("@/pages/contract-document"));
const FinanceInboxPage = lazy(() => import("@/pages/finance-inbox"));
const LegalApprovalsPage = lazy(() => import("@/pages/legal-approvals"));
const ContractAmendmentsPage = lazy(() => import("@/pages/contract-amendments"));
const ContractCancellationsPage = lazy(() => import("@/pages/contract-cancellations"));
const ContractNotesPage = lazy(() => import("@/pages/contract-notes"));
const ContractDocumentsPage = lazy(() => import("@/pages/contract-documents"));
const UnitTransfersPage = lazy(() => import("@/pages/unit-transfers"));
const InstallmentPlansPage = lazy(() => import("@/pages/installment-plans"));
const InstallmentSchedulesPage = lazy(() => import("@/pages/installment-schedules"));
const InstallmentCollectionsPage = lazy(() => import("@/pages/installment-collections"));
const PenaltyRulesPage = lazy(() => import("@/pages/penalty-rules"));
const CashboxesPage = lazy(() => import("@/pages/cashboxes"));
const TreasuryTransactionsPage = lazy(() => import("@/pages/treasury-transactions"));
const BankAccountsPage = lazy(() => import("@/pages/bank-accounts"));
const BankTransactionsPage = lazy(() => import("@/pages/bank-transactions"));
const ReceiptsPage = lazy(() => import("@/pages/receipts"));
const PenaltiesPage = lazy(() => import("@/pages/penalties"));

const AccountsPage = lazy(() => import("@/pages/accounts"));
const CostCentersPage = lazy(() => import("@/pages/cost-centers"));
const JournalEntriesPage = lazy(() => import("@/pages/journal-entries"));
const GeneralLedgerPage = lazy(() => import("@/pages/general-ledger"));
const TrialBalancePage = lazy(() => import("@/pages/trial-balance"));
const BalanceSheetPage = lazy(() => import("@/pages/balance-sheet"));
const IncomeStatementPage = lazy(() => import("@/pages/income-statement"));
const CashFlowPage = lazy(() => import("@/pages/cash-flow"));
const FiscalPeriodsPage = lazy(() => import("@/pages/fiscal-periods"));
const BudgetsPage = lazy(() => import("@/pages/budgets"));
const BudgetLinesPage = lazy(() => import("@/pages/budget-lines"));
const BudgetVsActualPage = lazy(() => import("@/pages/budget-vs-actual"));
const AccountMappingsPage = lazy(() => import("@/pages/account-mappings"));
const AccountingDashboardPage = lazy(() => import("@/pages/accounting-dashboard"));
const TaxCodesPage = lazy(() => import("@/pages/tax-codes"));
const CustomerInvoicesPage = lazy(() => import("@/pages/customer-invoices"));
const SupplierInvoicesPage = lazy(() => import("@/pages/supplier-invoices"));
const PaymentVouchersPage = lazy(() => import("@/pages/payment-vouchers"));
const ArAgingPage = lazy(() => import("@/pages/ar-aging"));
const ApAgingPage = lazy(() => import("@/pages/ap-aging"));
const TaxReportPage = lazy(() => import("@/pages/tax-report"));
const ChequesPage = lazy(() => import("@/pages/cheques"));
const ChequeStatusHistorysPage = lazy(() => import("@/pages/cheque-status-history"));
const ChequeReportsPage = lazy(() => import("@/pages/cheque-reports"));
const ProfitCentersPage = lazy(() => import("@/pages/profit-centers"));
const YearEndClosingPage = lazy(() => import("@/pages/year-end-closing"));
const FinancialReportsPage = lazy(() => import("@/pages/financial-reports"));

const ExecutiveDashboardPage = lazy(() => import("@/pages/executive-dashboard"));
const ExecutiveOversightPage = lazy(() => import("@/pages/executive-oversight"));
const SalesAnalyticsPage = lazy(() => import("@/pages/sales-analytics"));
const CollectionAnalyticsPage = lazy(() => import("@/pages/collection-analytics"));
const ConstructionAnalyticsPage = lazy(() => import("@/pages/construction-analytics"));
const ProcurementAnalyticsPage = lazy(() => import("@/pages/procurement-analytics"));
const InventoryAnalyticsPage = lazy(() => import("@/pages/inventory-analytics"));
const HrAnalyticsPage = lazy(() => import("@/pages/hr-analytics"));
const FinancialAnalyticsPage = lazy(() => import("@/pages/financial-analytics"));
const ReportsEnginePage = lazy(() => import("@/pages/reports-engine"));

const AiChatPage = lazy(() => import("@/pages/ai-chat-page").then((m) => ({ default: m.AiChatPage })));
const AiAnalysisPage = lazy(() => import("@/pages/ai-analysis-page").then((m) => ({ default: m.AiAnalysisPage })));
import {
  useGenerateAiAnalytics,
  useGenerateAiInsights,
  useGenerateAiRecommendations,
  useGenerateAiForecasting,
  useGenerateAiAlerts,
  useGenerateAiRiskAnalysis,
  useGenerateAiDecisionSupport,
  useGenerateAiExecutiveAdvisor,
} from "@workspace/api-client-react";

const EngineeringDashboardPage = lazy(() => import("@/pages/engineering-dashboard"));
const EngineeringDisciplinesPage = lazy(() => import("@/pages/engineering-disciplines"));
const ConsultantsPage = lazy(() => import("@/pages/consultants"));
const DesignPackagesPage = lazy(() => import("@/pages/design-packages"));
const DrawingCategoriesPage = lazy(() => import("@/pages/drawing-categories"));
const TechnicalSpecificationsPage = lazy(() => import("@/pages/technical-specifications"));
const DrawingsPage = lazy(() => import("@/pages/drawings"));
const DrawingRevisionsPage = lazy(() => import("@/pages/drawing-revisions"));
const BoqsPage = lazy(() => import("@/pages/boqs"));
const BoqItemsPage = lazy(() => import("@/pages/boq-items"));
const BoqQuantityRevisionsPage = lazy(() => import("@/pages/boq-quantity-revisions"));
const CostEstimatesPage = lazy(() => import("@/pages/cost-estimates"));
const InspectionRequestsPage = lazy(() => import("@/pages/inspection-requests"));
const InspectionReportsPage = lazy(() => import("@/pages/inspection-reports"));
const DefectsPage = lazy(() => import("@/pages/defects"));
const CorrectiveActionsPage = lazy(() => import("@/pages/corrective-actions"));
const RfisPage = lazy(() => import("@/pages/rfis"));
const TechnicalSubmittalsPage = lazy(() => import("@/pages/technical-submittals"));
const MaterialSubmittalsPage = lazy(() => import("@/pages/material-submittals"));
const ConsultantResponsesPage = lazy(() => import("@/pages/consultant-responses"));
const EngineeringProgressPage = lazy(() => import("@/pages/engineering-progress"));
const ConstructionDashboardPage = lazy(() => import("@/pages/construction-dashboard"));
const ConstructionReportsPage = lazy(() => import("@/pages/construction-reports"));
const LandBankDashboardPage = lazy(() => import("@/pages/land-bank-dashboard"));
const LandBankReportsPage = lazy(() => import("@/pages/land-bank-reports"));
const LandParcelsPage = lazy(() => import("@/pages/land-parcels"));
const LandOwnershipsPage = lazy(() => import("@/pages/land-ownerships"));
const LandLegalStatusesPage = lazy(() => import("@/pages/land-legal-statuses"));
const LandUtilizationsPage = lazy(() => import("@/pages/land-utilizations"));
const LandDocumentsPage = lazy(() => import("@/pages/land-documents"));
const LandAcquisitionsPage = lazy(() => import("@/pages/land-acquisitions"));
const HandoverDashboardPage = lazy(() => import("@/pages/handover-dashboard"));
const HandoverReportsPage = lazy(() => import("@/pages/handover-reports"));
const HandoverRequestsPage = lazy(() => import("@/pages/handover-requests"));
const HandoverSchedulesPage = lazy(() => import("@/pages/handover-schedules"));
const HandoverChecklistItemsPage = lazy(() => import("@/pages/handover-checklist-items"));
const HandoverMinutesPage = lazy(() => import("@/pages/handover-minutes"));
const HandoverSnagsPage = lazy(() => import("@/pages/handover-snags"));
const HandoverApprovalsPage = lazy(() => import("@/pages/handover-approvals"));
const GeneralAdminDashboardPage = lazy(() => import("@/pages/general-admin-dashboard"));
const MarketingDashboardPage = lazy(() => import("@/pages/marketing-dashboard"));
const MarketingCampaignsPage = lazy(() => import("@/pages/marketing-campaigns"));
const MarketingChannelsPage = lazy(() => import("@/pages/marketing-channels"));
const MarketingSettingsPage = lazy(() => import("@/pages/marketing-settings"));
const MarketingLeadsPage = lazy(() => import("@/pages/marketing-leads"));
const DistributionRulesPage = lazy(() => import("@/pages/distribution-rules"));
const DistributionAgentsPage = lazy(() => import("@/pages/distribution-agents"));
const DistributionLogsPage = lazy(() => import("@/pages/distribution-logs"));
const CorrespondencePage = lazy(() => import("@/pages/correspondence"));
const MeetingsPage = lazy(() => import("@/pages/meetings"));
const AdministrativeDecisionsPage = lazy(() => import("@/pages/administrative-decisions"));
const AdministrativeTasksPage = lazy(() => import("@/pages/administrative-tasks"));
const GeneralServicesPage = lazy(() => import("@/pages/general-services"));
const VehiclesPage = lazy(() => import("@/pages/vehicles"));
const DriversPage = lazy(() => import("@/pages/drivers"));
const VehicleMissionsPage = lazy(() => import("@/pages/vehicle-missions"));
const VehicleMaintenancePage = lazy(() => import("@/pages/vehicle-maintenance"));
const VisitorLogsPage = lazy(() => import("@/pages/visitor-logs"));
const CircularsPage = lazy(() => import("@/pages/circulars"));
const PoliciesPage = lazy(() => import("@/pages/policies"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const CustomerServiceDashboardPage = lazy(() => import("@/pages/customer-service-dashboard"));
const CustomerServiceReportsPage = lazy(() => import("@/pages/customer-service-reports"));
const SlaPoliciesPage = lazy(() => import("@/pages/sla-policies"));
const ServiceEscalationsPage = lazy(() => import("@/pages/service-escalations"));
const ComplaintsPage = lazy(() => import("@/pages/complaints"));
const MaintenanceRequestsPage = lazy(() => import("@/pages/maintenance-requests"));
const SupportTicketsPage = lazy(() => import("@/pages/support-tickets"));
const CallLogsPage = lazy(() => import("@/pages/call-logs"));
const WorkOrdersPage = lazy(() => import("@/pages/work-orders"));
const CustomerSatisfactionSurveysPage = lazy(() => import("@/pages/customer-satisfaction-surveys"));
const FixedAssetsDashboardPage = lazy(() => import("@/pages/fixed-assets-dashboard"));
const FixedAssetsReportsPage = lazy(() => import("@/pages/fixed-assets-reports"));
const AssetCategoriesPage = lazy(() => import("@/pages/asset-categories"));
const FixedAssetsPage = lazy(() => import("@/pages/fixed-assets"));
const AssetTransfersPage = lazy(() => import("@/pages/asset-transfers"));
const AssetDepreciationsPage = lazy(() => import("@/pages/asset-depreciations"));
const AssetInventoryCountsPage = lazy(() => import("@/pages/asset-inventory-counts"));
const AssetDisposalsPage = lazy(() => import("@/pages/asset-disposals"));
const ContractorsPage = lazy(() => import("@/pages/contractors"));
const ContractorContractsPage = lazy(() => import("@/pages/contractor-contracts"));
const ContractBoqItemsPage = lazy(() => import("@/pages/contract-boq-items"));
const WorkProgressUpdatesPage = lazy(() => import("@/pages/work-progress-updates"));
const PaymentCertificatesPage = lazy(() => import("@/pages/payment-certificates"));
const CertificateItemsPage = lazy(() => import("@/pages/certificate-items"));
const CertificateStatusesPage = lazy(() => import("@/pages/certificate-statuses"));
const CertificateApprovalsPage = lazy(() => import("@/pages/certificate-approvals"));
const CertificateApprovalLogsPage = lazy(() => import("@/pages/certificate-approval-logs"));
const VariationOrdersPage = lazy(() => import("@/pages/variation-orders"));
const ContractorDeductionsPage = lazy(() => import("@/pages/contractor-deductions"));
const ContractorAdditionsPage = lazy(() => import("@/pages/contractor-additions"));
const RetentionsPage = lazy(() => import("@/pages/retentions"));
const AdvancePaymentsPage = lazy(() => import("@/pages/advance-payments"));
const AdvanceRecoveriesPage = lazy(() => import("@/pages/advance-recoveries"));
const ContractorInvoicesPage = lazy(() => import("@/pages/contractor-invoices"));
const ContractApprovalsPage = lazy(() => import("@/pages/contract-approvals"));
const ProcurementDashboardPage = lazy(() => import("@/pages/procurement-dashboard"));
const ProcurementReportsPage = lazy(() => import("@/pages/procurement-reports"));
const SupplierCategorysPage = lazy(() => import("@/pages/supplier-categories"));
const SuppliersPage = lazy(() => import("@/pages/suppliers"));
const SupplierContactsPage = lazy(() => import("@/pages/supplier-contacts"));
const SupplierEvaluationsPage = lazy(() => import("@/pages/supplier-evaluations"));
const PurchaseRequestsPage = lazy(() => import("@/pages/purchase-requests"));
const PurchaseRequestItemsPage = lazy(() => import("@/pages/purchase-request-items"));
const RfqsPage = lazy(() => import("@/pages/rfqs"));
const RfqItemsPage = lazy(() => import("@/pages/rfq-items"));
const RfqSuppliersPage = lazy(() => import("@/pages/rfq-suppliers"));
const SupplierQuotationsPage = lazy(() => import("@/pages/supplier-quotations"));
const QuotationItemsPage = lazy(() => import("@/pages/quotation-items"));
const PurchaseOrdersPage = lazy(() => import("@/pages/purchase-orders"));
const PurchaseOrderItemsPage = lazy(() => import("@/pages/purchase-order-items"));
const PurchaseContractsPage = lazy(() => import("@/pages/purchase-contracts"));
const PurchaseContractAmendmentsPage = lazy(() => import("@/pages/purchase-contract-amendments"));
const GoodsReceiptNotesPage = lazy(() => import("@/pages/goods-receipt-notes"));
const GrnItemsPage = lazy(() => import("@/pages/grn-items"));
const PurchaseReturnsPage = lazy(() => import("@/pages/purchase-returns"));
const PurchaseReturnItemsPage = lazy(() => import("@/pages/purchase-return-items"));
const ProcurementApprovalsPage = lazy(() => import("@/pages/procurement-approvals"));
const InventoryDashboardPage = lazy(() => import("@/pages/inventory-dashboard"));
const InventoryReportsPage = lazy(() => import("@/pages/inventory-reports"));
const WarehousesPage = lazy(() => import("@/pages/warehouses"));
const WarehouseLocationsPage = lazy(() => import("@/pages/warehouse-locations"));
const ItemCategorysPage = lazy(() => import("@/pages/item-categories"));
const ItemGroupsPage = lazy(() => import("@/pages/item-groups"));
const UnitOfMeasuresPage = lazy(() => import("@/pages/units-of-measure"));
const InventoryItemsPage = lazy(() => import("@/pages/inventory-items"));
const ReorderLevelsPage = lazy(() => import("@/pages/reorder-levels"));
const StockOpeningBalancesPage = lazy(() => import("@/pages/stock-opening-balances"));
const GoodsReceiptsPage = lazy(() => import("@/pages/goods-receipts"));
const GoodsReceiptItemsPage = lazy(() => import("@/pages/goods-receipt-items"));
const GoodsIssuesPage = lazy(() => import("@/pages/goods-issues"));
const GoodsIssueItemsPage = lazy(() => import("@/pages/goods-issue-items"));
const InventoryTransfersPage = lazy(() => import("@/pages/inventory-transfers"));
const InventoryTransferItemsPage = lazy(() => import("@/pages/inventory-transfer-items"));
const StockAdjustmentsPage = lazy(() => import("@/pages/stock-adjustments"));
const StockAdjustmentItemsPage = lazy(() => import("@/pages/stock-adjustment-items"));
const StockCountsPage = lazy(() => import("@/pages/stock-counts"));
const StockCountItemsPage = lazy(() => import("@/pages/stock-count-items"));
const InventoryLedgersPage = lazy(() => import("@/pages/inventory-ledger"));
const HrDashboardPage = lazy(() => import("@/pages/hr-dashboard"));
const HrReportsPage = lazy(() => import("@/pages/hr-reports"));
const DepartmentsPage = lazy(() => import("@/pages/departments"));
const SectionsPage = lazy(() => import("@/pages/sections"));
const JobTitlesPage = lazy(() => import("@/pages/job-titles"));
const EmployeesPage = lazy(() => import("@/pages/employees"));
const EmployeeDocumentsPage = lazy(() => import("@/pages/employee-documents"));
const ShiftsPage = lazy(() => import("@/pages/shifts"));
const AttendancePage = lazy(() => import("@/pages/attendance"));
const LeaveTypesPage = lazy(() => import("@/pages/leave-types"));
const LeaveBalancesPage = lazy(() => import("@/pages/leave-balances"));
const LeaveRequestsPage = lazy(() => import("@/pages/leave-requests"));
const FormsPrintingPage = lazy(() => import("@/pages/forms-printing"));
const SalaryComponentsPage = lazy(() => import("@/pages/salary-components"));
const PayrollPeriodsPage = lazy(() => import("@/pages/payroll-periods"));
const PayrollRunsPage = lazy(() => import("@/pages/payroll-runs"));
const PayslipsPage = lazy(() => import("@/pages/payslips"));
const EmployeeLoansPage = lazy(() => import("@/pages/employee-loans"));
const EmployeeAdvancesPage = lazy(() => import("@/pages/employee-advances"));
const KpiTemplatesPage = lazy(() => import("@/pages/kpi-templates"));
const EmployeeEvaluationsPage = lazy(() => import("@/pages/employee-evaluations"));
const LegalDashboardPage = lazy(() => import("@/pages/legal-dashboard"));
const LegalContractsPage = lazy(() => import("@/pages/legal-contracts"));
const ContractTemplatesPage = lazy(() => import("@/pages/contract-templates"));
const ContractVersionsPage = lazy(() => import("@/pages/contract-versions"));
const LegalContractAmendmentsPage = lazy(() => import("@/pages/legal-contract-amendments"));
const ContractAddendumsPage = lazy(() => import("@/pages/contract-addendums"));
const LegalContractAttachmentsPage = lazy(() => import("@/pages/legal-contract-attachments"));
const ContractEventsPage = lazy(() => import("@/pages/contract-events"));
const LawFirmsPage = lazy(() => import("@/pages/law-firms"));
const LegalAdvisorsPage = lazy(() => import("@/pages/legal-advisors"));
const LegalCasesPage = lazy(() => import("@/pages/legal-cases"));
const LegalHearingsPage = lazy(() => import("@/pages/legal-hearings"));
const LegalClaimsPage = lazy(() => import("@/pages/legal-claims"));
const LegalNoticesPage = lazy(() => import("@/pages/legal-notices"));
const LegalCaseLinksPage = lazy(() => import("@/pages/legal-case-links"));
const LegalReportsPage = lazy(() => import("@/pages/legal-reports"));
const InsuranceDashboardPage = lazy(() => import("@/pages/insurance-dashboard"));
const EmployeeInsurancesPage = lazy(() => import("@/pages/employee-insurances"));
const InsuranceFormsPage = lazy(() => import("@/pages/insurance-forms"));
const InsuranceAdditionsPage = lazy(() => import("@/pages/insurance-additions"));
const InsuranceExclusionsPage = lazy(() => import("@/pages/insurance-exclusions"));
const InsuranceDataAmendmentsPage = lazy(() => import("@/pages/insurance-data-amendments"));
const InsuranceSubscriptionsPage = lazy(() => import("@/pages/insurance-subscriptions"));
const InsurancePaymentNoticesPage = lazy(() => import("@/pages/insurance-payment-notices"));
const InsuranceReconciliationsPage = lazy(() => import("@/pages/insurance-reconciliations"));
const InsuranceArrearsPage = lazy(() => import("@/pages/insurance-arrears"));
const InsurancePenaltiesPage = lazy(() => import("@/pages/insurance-penalties"));
const ServiceTerminationsPage = lazy(() => import("@/pages/service-terminations"));
const InsuranceSettlementsPage = lazy(() => import("@/pages/insurance-settlements"));
const InsuranceClearancesPage = lazy(() => import("@/pages/insurance-clearances"));
const SubcontractorInsurancesPage = lazy(() => import("@/pages/subcontractor-insurances"));
const ProjectLaborInsurancesPage = lazy(() => import("@/pages/project-labor-insurances"));
const InsuranceInsuredReportPage = lazy(() => import("@/pages/insurance-insured-report"));
const InsuranceSubscriptionsReportPage = lazy(() => import("@/pages/insurance-subscriptions-report"));
const InsuranceArrearsReportPage = lazy(() => import("@/pages/insurance-arrears-report"));
const InsurancePenaltiesReportPage = lazy(() => import("@/pages/insurance-penalties-report"));
const InsuranceContractorsReportPage = lazy(() => import("@/pages/insurance-contractors-report"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  },
});

function RouteFallback() {
  return (
    <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <AppShell>
          <Suspense fallback={<RouteFallback />}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/dashboard" component={Dashboard} />
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
            <Route path="/master-data" component={MasterDataPage} />
            <Route path="/dynamic-lists" component={DynamicListsPage} />
            <Route path="/change-password" component={ChangePasswordPage} />
            <Route path="/approvals" component={ApprovalsPage} />
            <Route path="/documents-dashboard" component={DocumentsDashboardPage} />
            <Route path="/document-approvals" component={DocumentApprovalsPage} />
            <Route path="/document-search" component={DocumentSearchPage} />
            <Route path="/documents/:id" component={DocumentDetailPage} />
            <Route path="/documents" component={DocumentsPage} />

            <Route path="/data-entry-center" component={DataEntryCenterPage} />
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
            <Route path="/global-search" component={GlobalSearchPage} />
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
            <Route path="/contracts/:id/document" component={ContractDocumentPage} />
            <Route path="/finance-inbox" component={FinanceInboxPage} />
            <Route path="/legal-approvals" component={LegalApprovalsPage} />
            <Route path="/crm-dashboard" component={CrmDashboardPage} />
            <Route path="/my-work" component={MyWorkPage} />
            <Route path="/available-units" component={CrmAvailableUnitsPage} />
            <Route path="/crm-sales" component={CrmSalesPage} />
            <Route path="/crm-reports" component={CrmReportsPage} />
            <Route path="/sales-administration" component={SalesAdministrationPage} />
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
            <Route path="/tax-codes" component={TaxCodesPage} />
            <Route path="/customer-invoices" component={CustomerInvoicesPage} />
            <Route path="/supplier-invoices" component={SupplierInvoicesPage} />
            <Route path="/payment-vouchers" component={PaymentVouchersPage} />
            <Route path="/ar-aging" component={ArAgingPage} />
            <Route path="/ap-aging" component={ApAgingPage} />
            <Route path="/tax-report" component={TaxReportPage} />
            <Route path="/cheques" component={ChequesPage} />
            <Route path="/cheque-status-history" component={ChequeStatusHistorysPage} />
            <Route path="/cheque-reports" component={ChequeReportsPage} />
            <Route path="/profit-centers" component={ProfitCentersPage} />
            <Route path="/year-end-closing" component={YearEndClosingPage} />
            <Route path="/financial-reports" component={FinancialReportsPage} />
            <Route path="/engineering-dashboard" component={EngineeringDashboardPage} />
            <Route path="/engineering-disciplines" component={EngineeringDisciplinesPage} />
            <Route path="/consultants" component={ConsultantsPage} />
            <Route path="/design-packages" component={DesignPackagesPage} />
            <Route path="/drawing-categories" component={DrawingCategoriesPage} />
            <Route path="/technical-specifications" component={TechnicalSpecificationsPage} />
            <Route path="/drawings" component={DrawingsPage} />
            <Route path="/drawing-revisions" component={DrawingRevisionsPage} />
            <Route path="/boqs" component={BoqsPage} />
            <Route path="/boq-items" component={BoqItemsPage} />
            <Route path="/boq-quantity-revisions" component={BoqQuantityRevisionsPage} />
            <Route path="/cost-estimates" component={CostEstimatesPage} />
            <Route path="/inspection-requests" component={InspectionRequestsPage} />
            <Route path="/inspection-reports" component={InspectionReportsPage} />
            <Route path="/defects" component={DefectsPage} />
            <Route path="/corrective-actions" component={CorrectiveActionsPage} />
            <Route path="/rfis" component={RfisPage} />
            <Route path="/technical-submittals" component={TechnicalSubmittalsPage} />
            <Route path="/material-submittals" component={MaterialSubmittalsPage} />
            <Route path="/consultant-responses" component={ConsultantResponsesPage} />
            <Route path="/engineering-progress" component={EngineeringProgressPage} />
            <Route path="/construction-dashboard" component={ConstructionDashboardPage} />
            <Route path="/construction-reports" component={ConstructionReportsPage} />
            <Route path="/land-bank-dashboard" component={LandBankDashboardPage} />
            <Route path="/land-parcels" component={LandParcelsPage} />
            <Route path="/land-ownerships" component={LandOwnershipsPage} />
            <Route path="/land-legal-statuses" component={LandLegalStatusesPage} />
            <Route path="/land-utilizations" component={LandUtilizationsPage} />
            <Route path="/land-documents" component={LandDocumentsPage} />
            <Route path="/land-acquisitions" component={LandAcquisitionsPage} />
            <Route path="/land-bank-reports" component={LandBankReportsPage} />
            <Route path="/handover-dashboard" component={HandoverDashboardPage} />
            <Route path="/handover-requests" component={HandoverRequestsPage} />
            <Route path="/handover-schedules" component={HandoverSchedulesPage} />
            <Route path="/handover-checklist-items" component={HandoverChecklistItemsPage} />
            <Route path="/handover-minutes" component={HandoverMinutesPage} />
            <Route path="/handover-snags" component={HandoverSnagsPage} />
            <Route path="/handover-approvals" component={HandoverApprovalsPage} />
            <Route path="/handover-reports" component={HandoverReportsPage} />
            <Route path="/general-admin-dashboard" component={GeneralAdminDashboardPage} />
            <Route path="/marketing-dashboard" component={MarketingDashboardPage} />
            <Route path="/marketing-campaigns" component={MarketingCampaignsPage} />
            <Route path="/marketing-channels" component={MarketingChannelsPage} />
            <Route path="/marketing-leads" component={MarketingLeadsPage} />
            <Route path="/distribution-rules" component={DistributionRulesPage} />
            <Route path="/distribution-agents" component={DistributionAgentsPage} />
            <Route path="/distribution-logs" component={DistributionLogsPage} />
            <Route path="/marketing-settings" component={MarketingSettingsPage} />
            <Route path="/correspondence" component={CorrespondencePage} />
            <Route path="/meetings" component={MeetingsPage} />
            <Route path="/administrative-decisions" component={AdministrativeDecisionsPage} />
            <Route path="/administrative-tasks" component={AdministrativeTasksPage} />
            <Route path="/general-services" component={GeneralServicesPage} />
            <Route path="/vehicles" component={VehiclesPage} />
            <Route path="/drivers" component={DriversPage} />
            <Route path="/vehicle-missions" component={VehicleMissionsPage} />
            <Route path="/vehicle-maintenance" component={VehicleMaintenancePage} />
            <Route path="/visitor-logs" component={VisitorLogsPage} />
            <Route path="/circulars" component={CircularsPage} />
            <Route path="/policies" component={PoliciesPage} />
            <Route path="/notifications" component={NotificationsPage} />
            <Route path="/customer-service-dashboard" component={CustomerServiceDashboardPage} />
            <Route path="/sla-policies" component={SlaPoliciesPage} />
            <Route path="/service-escalations" component={ServiceEscalationsPage} />
            <Route path="/complaints" component={ComplaintsPage} />
            <Route path="/maintenance-requests" component={MaintenanceRequestsPage} />
            <Route path="/support-tickets" component={SupportTicketsPage} />
            <Route path="/call-logs" component={CallLogsPage} />
            <Route path="/work-orders" component={WorkOrdersPage} />
            <Route path="/customer-satisfaction-surveys" component={CustomerSatisfactionSurveysPage} />
            <Route path="/customer-service-reports" component={CustomerServiceReportsPage} />
            <Route path="/fixed-assets-dashboard" component={FixedAssetsDashboardPage} />
            <Route path="/asset-categories" component={AssetCategoriesPage} />
            <Route path="/fixed-assets" component={FixedAssetsPage} />
            <Route path="/asset-transfers" component={AssetTransfersPage} />
            <Route path="/asset-depreciations" component={AssetDepreciationsPage} />
            <Route path="/asset-inventory-counts" component={AssetInventoryCountsPage} />
            <Route path="/asset-disposals" component={AssetDisposalsPage} />
            <Route path="/fixed-assets-reports" component={FixedAssetsReportsPage} />
            <Route path="/contractors" component={ContractorsPage} />
            <Route path="/contractor-contracts" component={ContractorContractsPage} />
            <Route path="/contract-boq-items" component={ContractBoqItemsPage} />
            <Route path="/work-progress-updates" component={WorkProgressUpdatesPage} />
            <Route path="/payment-certificates" component={PaymentCertificatesPage} />
            <Route path="/certificate-items" component={CertificateItemsPage} />
            <Route path="/certificate-statuses" component={CertificateStatusesPage} />
            <Route path="/certificate-approvals" component={CertificateApprovalsPage} />
            <Route path="/certificate-approval-logs" component={CertificateApprovalLogsPage} />
            <Route path="/variation-orders" component={VariationOrdersPage} />
            <Route path="/contractor-deductions" component={ContractorDeductionsPage} />
            <Route path="/contractor-additions" component={ContractorAdditionsPage} />
            <Route path="/retentions" component={RetentionsPage} />
            <Route path="/advance-payments" component={AdvancePaymentsPage} />
            <Route path="/advance-recoveries" component={AdvanceRecoveriesPage} />
            <Route path="/contractor-invoices" component={ContractorInvoicesPage} />
            <Route path="/contract-approvals" component={ContractApprovalsPage} />
            <Route path="/procurement-dashboard" component={ProcurementDashboardPage} />
            <Route path="/procurement-reports" component={ProcurementReportsPage} />
            <Route path="/supplier-categories" component={SupplierCategorysPage} />
            <Route path="/suppliers" component={SuppliersPage} />
            <Route path="/supplier-contacts" component={SupplierContactsPage} />
            <Route path="/supplier-evaluations" component={SupplierEvaluationsPage} />
            <Route path="/purchase-requests" component={PurchaseRequestsPage} />
            <Route path="/purchase-request-items" component={PurchaseRequestItemsPage} />
            <Route path="/rfqs" component={RfqsPage} />
            <Route path="/rfq-items" component={RfqItemsPage} />
            <Route path="/rfq-suppliers" component={RfqSuppliersPage} />
            <Route path="/supplier-quotations" component={SupplierQuotationsPage} />
            <Route path="/quotation-items" component={QuotationItemsPage} />
            <Route path="/purchase-orders" component={PurchaseOrdersPage} />
            <Route path="/purchase-order-items" component={PurchaseOrderItemsPage} />
            <Route path="/purchase-contracts" component={PurchaseContractsPage} />
            <Route path="/purchase-contract-amendments" component={PurchaseContractAmendmentsPage} />
            <Route path="/goods-receipt-notes" component={GoodsReceiptNotesPage} />
            <Route path="/grn-items" component={GrnItemsPage} />
            <Route path="/purchase-returns" component={PurchaseReturnsPage} />
            <Route path="/purchase-return-items" component={PurchaseReturnItemsPage} />
            <Route path="/procurement-approvals" component={ProcurementApprovalsPage} />
            <Route path="/inventory-dashboard" component={InventoryDashboardPage} />
            <Route path="/inventory-reports" component={InventoryReportsPage} />
            <Route path="/warehouses" component={WarehousesPage} />
            <Route path="/warehouse-locations" component={WarehouseLocationsPage} />
            <Route path="/item-categories" component={ItemCategorysPage} />
            <Route path="/item-groups" component={ItemGroupsPage} />
            <Route path="/units-of-measure" component={UnitOfMeasuresPage} />
            <Route path="/inventory-items" component={InventoryItemsPage} />
            <Route path="/reorder-levels" component={ReorderLevelsPage} />
            <Route path="/stock-opening-balances" component={StockOpeningBalancesPage} />
            <Route path="/goods-receipts" component={GoodsReceiptsPage} />
            <Route path="/goods-receipt-items" component={GoodsReceiptItemsPage} />
            <Route path="/goods-issues" component={GoodsIssuesPage} />
            <Route path="/goods-issue-items" component={GoodsIssueItemsPage} />
            <Route path="/inventory-transfers" component={InventoryTransfersPage} />
            <Route path="/inventory-transfer-items" component={InventoryTransferItemsPage} />
            <Route path="/stock-adjustments" component={StockAdjustmentsPage} />
            <Route path="/stock-adjustment-items" component={StockAdjustmentItemsPage} />
            <Route path="/stock-counts" component={StockCountsPage} />
            <Route path="/stock-count-items" component={StockCountItemsPage} />
            <Route path="/inventory-ledger" component={InventoryLedgersPage} />
            <Route path="/hr-dashboard" component={HrDashboardPage} />
            <Route path="/departments" component={DepartmentsPage} />
            <Route path="/sections" component={SectionsPage} />
            <Route path="/job-titles" component={JobTitlesPage} />
            <Route path="/employees" component={EmployeesPage} />
            <Route path="/employee-documents" component={EmployeeDocumentsPage} />
            <Route path="/shifts" component={ShiftsPage} />
            <Route path="/attendance" component={AttendancePage} />
            <Route path="/leave-types" component={LeaveTypesPage} />
            <Route path="/leave-balances" component={LeaveBalancesPage} />
            <Route path="/leave-requests" component={LeaveRequestsPage} />
            <Route path="/forms-printing/:moduleKey" component={FormsPrintingPage} />
            <Route path="/salary-components" component={SalaryComponentsPage} />
            <Route path="/payroll-periods" component={PayrollPeriodsPage} />
            <Route path="/payroll-runs" component={PayrollRunsPage} />
            <Route path="/payslips" component={PayslipsPage} />
            <Route path="/employee-loans" component={EmployeeLoansPage} />
            <Route path="/employee-advances" component={EmployeeAdvancesPage} />
            <Route path="/kpi-templates" component={KpiTemplatesPage} />
            <Route path="/employee-evaluations" component={EmployeeEvaluationsPage} />
            <Route path="/hr-reports" component={HrReportsPage} />
            <Route path="/legal-dashboard" component={LegalDashboardPage} />
            <Route path="/legal-contracts" component={LegalContractsPage} />
            <Route path="/contract-templates" component={ContractTemplatesPage} />
            <Route path="/contract-versions" component={ContractVersionsPage} />
            <Route path="/legal-contract-amendments" component={LegalContractAmendmentsPage} />
            <Route path="/contract-addendums" component={ContractAddendumsPage} />
            <Route path="/legal-contract-attachments" component={LegalContractAttachmentsPage} />
            <Route path="/contract-events" component={ContractEventsPage} />
            <Route path="/law-firms" component={LawFirmsPage} />
            <Route path="/legal-advisors" component={LegalAdvisorsPage} />
            <Route path="/legal-cases" component={LegalCasesPage} />
            <Route path="/legal-hearings" component={LegalHearingsPage} />
            <Route path="/legal-claims" component={LegalClaimsPage} />
            <Route path="/legal-notices" component={LegalNoticesPage} />
            <Route path="/legal-case-links" component={LegalCaseLinksPage} />
            <Route path="/legal-reports" component={LegalReportsPage} />
            <Route path="/executive-dashboard" component={ExecutiveDashboardPage} />
            <Route path="/executive-oversight" component={ExecutiveOversightPage} />
            <Route path="/sales-analytics" component={SalesAnalyticsPage} />
            <Route path="/collection-analytics" component={CollectionAnalyticsPage} />
            <Route path="/construction-analytics" component={ConstructionAnalyticsPage} />
            <Route path="/procurement-analytics" component={ProcurementAnalyticsPage} />
            <Route path="/inventory-analytics" component={InventoryAnalyticsPage} />
            <Route path="/hr-analytics" component={HrAnalyticsPage} />
            <Route path="/financial-analytics" component={FinancialAnalyticsPage} />
            <Route path="/reports-engine" component={ReportsEnginePage} />
            <Route path="/ai-assistant">
              <AiChatPage feature="assistant" titleKey="ai.assistant.title" subtitleKey="ai.assistant.subtitle" />
            </Route>
            <Route path="/ai-chat-erp">
              <AiChatPage feature="chat-erp" titleKey="ai.chat_erp.title" subtitleKey="ai.chat_erp.subtitle" />
            </Route>
            <Route path="/ai-analytics">
              <AiAnalysisPage titleKey="ai.analytics.title" subtitleKey="ai.analytics.subtitle" useMutationHook={useGenerateAiAnalytics} />
            </Route>
            <Route path="/ai-insights">
              <AiAnalysisPage titleKey="ai.insights.title" subtitleKey="ai.insights.subtitle" useMutationHook={useGenerateAiInsights} />
            </Route>
            <Route path="/ai-recommendations">
              <AiAnalysisPage titleKey="ai.recommendations.title" subtitleKey="ai.recommendations.subtitle" useMutationHook={useGenerateAiRecommendations} />
            </Route>
            <Route path="/ai-forecasting">
              <AiAnalysisPage titleKey="ai.forecasting.title" subtitleKey="ai.forecasting.subtitle" useMutationHook={useGenerateAiForecasting} />
            </Route>
            <Route path="/ai-alerts">
              <AiAnalysisPage titleKey="ai.alerts.title" subtitleKey="ai.alerts.subtitle" useMutationHook={useGenerateAiAlerts} />
            </Route>
            <Route path="/ai-risk-analysis">
              <AiAnalysisPage titleKey="ai.risk_analysis.title" subtitleKey="ai.risk_analysis.subtitle" useMutationHook={useGenerateAiRiskAnalysis} />
            </Route>
            <Route path="/ai-decision-support">
              <AiAnalysisPage titleKey="ai.decision_support.title" subtitleKey="ai.decision_support.subtitle" useMutationHook={useGenerateAiDecisionSupport} />
            </Route>
            <Route path="/ai-executive-advisor">
              <AiAnalysisPage titleKey="ai.executive_advisor.title" subtitleKey="ai.executive_advisor.subtitle" useMutationHook={useGenerateAiExecutiveAdvisor} />
            </Route>
            <Route path="/insurance-dashboard" component={InsuranceDashboardPage} />
            <Route path="/employee-insurances" component={EmployeeInsurancesPage} />
            <Route path="/insurance-forms" component={InsuranceFormsPage} />
            <Route path="/insurance-additions" component={InsuranceAdditionsPage} />
            <Route path="/insurance-exclusions" component={InsuranceExclusionsPage} />
            <Route path="/insurance-data-amendments" component={InsuranceDataAmendmentsPage} />
            <Route path="/insurance-subscriptions" component={InsuranceSubscriptionsPage} />
            <Route path="/insurance-payment-notices" component={InsurancePaymentNoticesPage} />
            <Route path="/insurance-reconciliations" component={InsuranceReconciliationsPage} />
            <Route path="/insurance-arrears" component={InsuranceArrearsPage} />
            <Route path="/insurance-penalties" component={InsurancePenaltiesPage} />
            <Route path="/service-terminations" component={ServiceTerminationsPage} />
            <Route path="/insurance-settlements" component={InsuranceSettlementsPage} />
            <Route path="/insurance-clearances" component={InsuranceClearancesPage} />
            <Route path="/subcontractor-insurances" component={SubcontractorInsurancesPage} />
            <Route path="/project-labor-insurances" component={ProjectLaborInsurancesPage} />
            <Route path="/insurance-insured-report" component={InsuranceInsuredReportPage} />
            <Route path="/insurance-subscriptions-report" component={InsuranceSubscriptionsReportPage} />
            <Route path="/insurance-arrears-report" component={InsuranceArrearsReportPage} />
            <Route path="/insurance-penalties-report" component={InsurancePenaltiesReportPage} />
            <Route path="/insurance-contractors-report" component={InsuranceContractorsReportPage} />
            <Route>
              <div className="flex h-[50vh] items-center justify-center font-semibold text-lg text-muted-foreground">404 Not Found</div>
            </Route>
          </Switch>
          </Suspense>
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
                <TestingProvider>
                  <OwnerModeProvider>
                    <LookupLabelProvider>
                      <Router />
                    </LookupLabelProvider>
                  </OwnerModeProvider>
                </TestingProvider>
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
