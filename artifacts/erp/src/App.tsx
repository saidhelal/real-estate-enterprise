import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/language-provider";
import { AuthProvider } from "@/lib/auth-provider";
import { LookupLabelProvider } from "@/lib/lookups";
import { AppShell } from "@/components/layout/app-shell";

import Login from "@/pages/login";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import DocumentsPage from "@/pages/documents";
import DocumentDetailPage from "@/pages/document-detail";
import DocumentsDashboardPage from "@/pages/documents-dashboard";
import DocumentApprovalsPage from "@/pages/document-approvals";
import UsersPage from "@/pages/users";
import RolesPage from "@/pages/roles";
import MasterDataPage from "@/pages/master-data";
import DynamicListsPage from "@/pages/dynamic-lists";
import CompaniesPage from "@/pages/companies";
import BranchesPage from "@/pages/branches";
import FiscalYearsPage from "@/pages/fiscal-years";
import CurrenciesPage from "@/pages/currencies";
import NumberSequencesPage from "@/pages/number-sequences";
import AuditLogsPage from "@/pages/audit-logs";
import LoginHistoryPage from "@/pages/login-history";
import SettingsPage from "@/pages/settings";
import ChangePasswordPage from "@/pages/change-password";
import ApprovalsPage from "@/pages/approvals";

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
import GlobalSearchPage from "@/pages/global-search";
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
import TaxCodesPage from "@/pages/tax-codes";
import CustomerInvoicesPage from "@/pages/customer-invoices";
import SupplierInvoicesPage from "@/pages/supplier-invoices";
import PaymentVouchersPage from "@/pages/payment-vouchers";
import ArAgingPage from "@/pages/ar-aging";
import ApAgingPage from "@/pages/ap-aging";
import TaxReportPage from "@/pages/tax-report";
import ChequesPage from "@/pages/cheques";
import ChequeStatusHistorysPage from "@/pages/cheque-status-history";
import ChequeReportsPage from "@/pages/cheque-reports";
import ProfitCentersPage from "@/pages/profit-centers";
import YearEndClosingPage from "@/pages/year-end-closing";
import FinancialReportsPage from "@/pages/financial-reports";

import ExecutiveDashboardPage from "@/pages/executive-dashboard";
import ExecutiveOversightPage from "@/pages/executive-oversight";
import SalesAnalyticsPage from "@/pages/sales-analytics";
import CollectionAnalyticsPage from "@/pages/collection-analytics";
import ConstructionAnalyticsPage from "@/pages/construction-analytics";
import ProcurementAnalyticsPage from "@/pages/procurement-analytics";
import InventoryAnalyticsPage from "@/pages/inventory-analytics";
import HrAnalyticsPage from "@/pages/hr-analytics";
import FinancialAnalyticsPage from "@/pages/financial-analytics";
import ReportsEnginePage from "@/pages/reports-engine";

import EngineeringDashboardPage from "@/pages/engineering-dashboard";
import EngineeringDisciplinesPage from "@/pages/engineering-disciplines";
import ConsultantsPage from "@/pages/consultants";
import DesignPackagesPage from "@/pages/design-packages";
import DrawingCategoriesPage from "@/pages/drawing-categories";
import TechnicalSpecificationsPage from "@/pages/technical-specifications";
import DrawingsPage from "@/pages/drawings";
import DrawingRevisionsPage from "@/pages/drawing-revisions";
import BoqsPage from "@/pages/boqs";
import BoqItemsPage from "@/pages/boq-items";
import BoqQuantityRevisionsPage from "@/pages/boq-quantity-revisions";
import CostEstimatesPage from "@/pages/cost-estimates";
import InspectionRequestsPage from "@/pages/inspection-requests";
import InspectionReportsPage from "@/pages/inspection-reports";
import DefectsPage from "@/pages/defects";
import CorrectiveActionsPage from "@/pages/corrective-actions";
import RfisPage from "@/pages/rfis";
import TechnicalSubmittalsPage from "@/pages/technical-submittals";
import MaterialSubmittalsPage from "@/pages/material-submittals";
import ConsultantResponsesPage from "@/pages/consultant-responses";
import EngineeringProgressPage from "@/pages/engineering-progress";
import ConstructionDashboardPage from "@/pages/construction-dashboard";
import ConstructionReportsPage from "@/pages/construction-reports";
import LandBankDashboardPage from "@/pages/land-bank-dashboard";
import LandBankReportsPage from "@/pages/land-bank-reports";
import LandParcelsPage from "@/pages/land-parcels";
import LandOwnershipsPage from "@/pages/land-ownerships";
import LandLegalStatusesPage from "@/pages/land-legal-statuses";
import LandUtilizationsPage from "@/pages/land-utilizations";
import LandDocumentsPage from "@/pages/land-documents";
import LandAcquisitionsPage from "@/pages/land-acquisitions";
import HandoverDashboardPage from "@/pages/handover-dashboard";
import HandoverReportsPage from "@/pages/handover-reports";
import HandoverRequestsPage from "@/pages/handover-requests";
import HandoverSchedulesPage from "@/pages/handover-schedules";
import HandoverChecklistItemsPage from "@/pages/handover-checklist-items";
import HandoverMinutesPage from "@/pages/handover-minutes";
import HandoverSnagsPage from "@/pages/handover-snags";
import HandoverApprovalsPage from "@/pages/handover-approvals";
import GeneralAdminDashboardPage from "@/pages/general-admin-dashboard";
import CorrespondencePage from "@/pages/correspondence";
import MeetingsPage from "@/pages/meetings";
import AdministrativeDecisionsPage from "@/pages/administrative-decisions";
import AdministrativeTasksPage from "@/pages/administrative-tasks";
import GeneralServicesPage from "@/pages/general-services";
import VehiclesPage from "@/pages/vehicles";
import DriversPage from "@/pages/drivers";
import VehicleMissionsPage from "@/pages/vehicle-missions";
import VehicleMaintenancePage from "@/pages/vehicle-maintenance";
import VisitorLogsPage from "@/pages/visitor-logs";
import CircularsPage from "@/pages/circulars";
import PoliciesPage from "@/pages/policies";
import NotificationsPage from "@/pages/notifications";
import CustomerServiceDashboardPage from "@/pages/customer-service-dashboard";
import CustomerServiceReportsPage from "@/pages/customer-service-reports";
import SlaPoliciesPage from "@/pages/sla-policies";
import ServiceEscalationsPage from "@/pages/service-escalations";
import ComplaintsPage from "@/pages/complaints";
import MaintenanceRequestsPage from "@/pages/maintenance-requests";
import SupportTicketsPage from "@/pages/support-tickets";
import CallLogsPage from "@/pages/call-logs";
import WorkOrdersPage from "@/pages/work-orders";
import CustomerSatisfactionSurveysPage from "@/pages/customer-satisfaction-surveys";
import FixedAssetsDashboardPage from "@/pages/fixed-assets-dashboard";
import FixedAssetsReportsPage from "@/pages/fixed-assets-reports";
import AssetCategoriesPage from "@/pages/asset-categories";
import FixedAssetsPage from "@/pages/fixed-assets";
import AssetTransfersPage from "@/pages/asset-transfers";
import AssetDepreciationsPage from "@/pages/asset-depreciations";
import AssetInventoryCountsPage from "@/pages/asset-inventory-counts";
import AssetDisposalsPage from "@/pages/asset-disposals";
import ContractorsPage from "@/pages/contractors";
import ContractorContractsPage from "@/pages/contractor-contracts";
import ContractBoqItemsPage from "@/pages/contract-boq-items";
import WorkProgressUpdatesPage from "@/pages/work-progress-updates";
import PaymentCertificatesPage from "@/pages/payment-certificates";
import CertificateItemsPage from "@/pages/certificate-items";
import CertificateStatusesPage from "@/pages/certificate-statuses";
import CertificateApprovalsPage from "@/pages/certificate-approvals";
import CertificateApprovalLogsPage from "@/pages/certificate-approval-logs";
import VariationOrdersPage from "@/pages/variation-orders";
import ContractorDeductionsPage from "@/pages/contractor-deductions";
import ContractorAdditionsPage from "@/pages/contractor-additions";
import RetentionsPage from "@/pages/retentions";
import AdvancePaymentsPage from "@/pages/advance-payments";
import AdvanceRecoveriesPage from "@/pages/advance-recoveries";
import ContractorInvoicesPage from "@/pages/contractor-invoices";
import ContractApprovalsPage from "@/pages/contract-approvals";
import ProcurementDashboardPage from "@/pages/procurement-dashboard";
import ProcurementReportsPage from "@/pages/procurement-reports";
import SupplierCategorysPage from "@/pages/supplier-categories";
import SuppliersPage from "@/pages/suppliers";
import SupplierContactsPage from "@/pages/supplier-contacts";
import SupplierEvaluationsPage from "@/pages/supplier-evaluations";
import PurchaseRequestsPage from "@/pages/purchase-requests";
import PurchaseRequestItemsPage from "@/pages/purchase-request-items";
import RfqsPage from "@/pages/rfqs";
import RfqItemsPage from "@/pages/rfq-items";
import RfqSuppliersPage from "@/pages/rfq-suppliers";
import SupplierQuotationsPage from "@/pages/supplier-quotations";
import QuotationItemsPage from "@/pages/quotation-items";
import PurchaseOrdersPage from "@/pages/purchase-orders";
import PurchaseOrderItemsPage from "@/pages/purchase-order-items";
import PurchaseContractsPage from "@/pages/purchase-contracts";
import PurchaseContractAmendmentsPage from "@/pages/purchase-contract-amendments";
import GoodsReceiptNotesPage from "@/pages/goods-receipt-notes";
import GrnItemsPage from "@/pages/grn-items";
import PurchaseReturnsPage from "@/pages/purchase-returns";
import PurchaseReturnItemsPage from "@/pages/purchase-return-items";
import ProcurementApprovalsPage from "@/pages/procurement-approvals";
import InventoryDashboardPage from "@/pages/inventory-dashboard";
import InventoryReportsPage from "@/pages/inventory-reports";
import WarehousesPage from "@/pages/warehouses";
import WarehouseLocationsPage from "@/pages/warehouse-locations";
import ItemCategorysPage from "@/pages/item-categories";
import ItemGroupsPage from "@/pages/item-groups";
import UnitOfMeasuresPage from "@/pages/units-of-measure";
import InventoryItemsPage from "@/pages/inventory-items";
import ReorderLevelsPage from "@/pages/reorder-levels";
import StockOpeningBalancesPage from "@/pages/stock-opening-balances";
import GoodsReceiptsPage from "@/pages/goods-receipts";
import GoodsReceiptItemsPage from "@/pages/goods-receipt-items";
import GoodsIssuesPage from "@/pages/goods-issues";
import GoodsIssueItemsPage from "@/pages/goods-issue-items";
import InventoryTransfersPage from "@/pages/inventory-transfers";
import InventoryTransferItemsPage from "@/pages/inventory-transfer-items";
import StockAdjustmentsPage from "@/pages/stock-adjustments";
import StockAdjustmentItemsPage from "@/pages/stock-adjustment-items";
import StockCountsPage from "@/pages/stock-counts";
import StockCountItemsPage from "@/pages/stock-count-items";
import InventoryLedgersPage from "@/pages/inventory-ledger";
import HrDashboardPage from "@/pages/hr-dashboard";
import HrReportsPage from "@/pages/hr-reports";
import DepartmentsPage from "@/pages/departments";
import SectionsPage from "@/pages/sections";
import JobTitlesPage from "@/pages/job-titles";
import EmployeesPage from "@/pages/employees";
import EmployeeDocumentsPage from "@/pages/employee-documents";
import ShiftsPage from "@/pages/shifts";
import AttendancePage from "@/pages/attendance";
import LeaveTypesPage from "@/pages/leave-types";
import LeaveBalancesPage from "@/pages/leave-balances";
import LeaveRequestsPage from "@/pages/leave-requests";
import FormsPrintingPage from "@/pages/forms-printing";
import SalaryComponentsPage from "@/pages/salary-components";
import PayrollPeriodsPage from "@/pages/payroll-periods";
import PayrollRunsPage from "@/pages/payroll-runs";
import PayslipsPage from "@/pages/payslips";
import EmployeeLoansPage from "@/pages/employee-loans";
import EmployeeAdvancesPage from "@/pages/employee-advances";
import KpiTemplatesPage from "@/pages/kpi-templates";
import EmployeeEvaluationsPage from "@/pages/employee-evaluations";
import LegalDashboardPage from "@/pages/legal-dashboard";
import LegalContractsPage from "@/pages/legal-contracts";
import ContractTemplatesPage from "@/pages/contract-templates";
import ContractVersionsPage from "@/pages/contract-versions";
import LegalContractAmendmentsPage from "@/pages/legal-contract-amendments";
import ContractAddendumsPage from "@/pages/contract-addendums";
import LegalContractAttachmentsPage from "@/pages/legal-contract-attachments";
import ContractEventsPage from "@/pages/contract-events";
import LawFirmsPage from "@/pages/law-firms";
import LegalAdvisorsPage from "@/pages/legal-advisors";
import LegalCasesPage from "@/pages/legal-cases";
import LegalHearingsPage from "@/pages/legal-hearings";
import LegalClaimsPage from "@/pages/legal-claims";
import LegalNoticesPage from "@/pages/legal-notices";
import LegalCaseLinksPage from "@/pages/legal-case-links";
import LegalReportsPage from "@/pages/legal-reports";
import InsuranceDashboardPage from "@/pages/insurance-dashboard";
import EmployeeInsurancesPage from "@/pages/employee-insurances";
import InsuranceFormsPage from "@/pages/insurance-forms";
import InsuranceAdditionsPage from "@/pages/insurance-additions";
import InsuranceExclusionsPage from "@/pages/insurance-exclusions";
import InsuranceDataAmendmentsPage from "@/pages/insurance-data-amendments";
import InsuranceSubscriptionsPage from "@/pages/insurance-subscriptions";
import InsurancePaymentNoticesPage from "@/pages/insurance-payment-notices";
import InsuranceReconciliationsPage from "@/pages/insurance-reconciliations";
import InsuranceArrearsPage from "@/pages/insurance-arrears";
import InsurancePenaltiesPage from "@/pages/insurance-penalties";
import ServiceTerminationsPage from "@/pages/service-terminations";
import InsuranceSettlementsPage from "@/pages/insurance-settlements";
import InsuranceClearancesPage from "@/pages/insurance-clearances";
import SubcontractorInsurancesPage from "@/pages/subcontractor-insurances";
import ProjectLaborInsurancesPage from "@/pages/project-labor-insurances";
import InsuranceInsuredReportPage from "@/pages/insurance-insured-report";
import InsuranceSubscriptionsReportPage from "@/pages/insurance-subscriptions-report";
import InsuranceArrearsReportPage from "@/pages/insurance-arrears-report";
import InsurancePenaltiesReportPage from "@/pages/insurance-penalties-report";
import InsuranceContractorsReportPage from "@/pages/insurance-contractors-report";

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
            <Route path="/documents/:id" component={DocumentDetailPage} />
            <Route path="/documents" component={DocumentsPage} />

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
                <LookupLabelProvider>
                  <Router />
                </LookupLabelProvider>
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
