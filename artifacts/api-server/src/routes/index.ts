import { Router, type IRouter } from "express";
import { mountModule } from "../lib/module-registry";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import rolesRouter from "./roles";
import companiesRouter from "./companies";
import branchesRouter from "./branches";
import fiscalYearsRouter from "./fiscal-years";
import currenciesRouter from "./currencies";
import settingsRouter from "./settings";
import numberSequencesRouter from "./number-sequences";
import auditRouter from "./audit";
import dashboardRouter from "./dashboard";
import realEstateRouter from "./real-estate";
import crmRouter from "./crm";
import customersRouter from "./customers";
import salesRouter from "./sales";
import installmentsRouter from "./installments";
import unitManagementRouter from "./unit-management";
import financeRouter from "./finance";
import chequesRouter from "./cheques";
import accountingRouter from "./accounting";
import arApRouter from "./ar-ap";
import engineeringRouter from "./engineering";
import constructionRouter from "./construction";
import procurementRouter from "./procurement";
import inventoryRouter from "./inventory";
import hrRouter from "./hr";
import legalRouter from "./legal";
import biRouter from "./bi";
import aiRouter from "./ai";
import landBankRouter from "./land-bank";
import handoverRouter from "./handover";
import customerServiceRouter from "./customer-service";
import fixedAssetsRouter from "./fixed-assets";
import generalAdminRouter from "./general-admin";
import marketingRouter from "./marketing";
import insuranceRouter from "./insurance";
import masterDataRouter from "./master-data";
import changeRequestsRouter from "./change-requests";
import notificationsRouter from "./notifications";
import executiveOversightRouter from "./executive-oversight";
import formTemplatesRouter from "./form-templates";
import printJobsRouter from "./print-jobs";
import portalRouter from "./portal";
import documentsRouter from "./documents";
import testingRouter from "./testing";

const router: IRouter = Router();

// Each module is mounted in isolation: a failure mounting one module is logged
// and recorded (and surfaced by the readiness probe) without preventing the
// others from mounting. Combined with the centralized request error handler in
// app.ts, this contains module-mount and per-request runtime faults so one bad
// module cannot take down the API. (Import-time faults cannot be isolated in
// the single-file esbuild bundle — those surface as build/startup failures.)
// Order is preserved — health/auth first, then portal BEFORE the ERP routers
// (portal manages its own per-route auth and would otherwise be intercepted by
// the ERP routers' router-level requireAuth).
mountModule(router, "health", healthRouter);
mountModule(router, "auth", authRouter);
mountModule(router, "portal", portalRouter);
mountModule(router, "users", usersRouter);
mountModule(router, "roles", rolesRouter);
mountModule(router, "companies", companiesRouter);
mountModule(router, "branches", branchesRouter);
mountModule(router, "fiscalYears", fiscalYearsRouter);
mountModule(router, "currencies", currenciesRouter);
mountModule(router, "settings", settingsRouter);
mountModule(router, "numberSequences", numberSequencesRouter);
mountModule(router, "audit", auditRouter);
mountModule(router, "dashboard", dashboardRouter);
mountModule(router, "realEstate", realEstateRouter);
mountModule(router, "crm", crmRouter);
mountModule(router, "customers", customersRouter);
mountModule(router, "sales", salesRouter);
mountModule(router, "installments", installmentsRouter);
mountModule(router, "unitManagement", unitManagementRouter);
mountModule(router, "finance", financeRouter);
mountModule(router, "cheques", chequesRouter);
mountModule(router, "accounting", accountingRouter);
mountModule(router, "arAp", arApRouter);
mountModule(router, "engineering", engineeringRouter);
mountModule(router, "construction", constructionRouter);
mountModule(router, "procurement", procurementRouter);
mountModule(router, "inventory", inventoryRouter);
mountModule(router, "hr", hrRouter);
mountModule(router, "legal", legalRouter);
mountModule(router, "bi", biRouter);
mountModule(router, "ai", aiRouter);
mountModule(router, "landBank", landBankRouter);
mountModule(router, "handover", handoverRouter);
mountModule(router, "customerService", customerServiceRouter);
mountModule(router, "fixedAssets", fixedAssetsRouter);
mountModule(router, "generalAdmin", generalAdminRouter);
mountModule(router, "marketing", marketingRouter);
mountModule(router, "insurance", insuranceRouter);
mountModule(router, "masterData", masterDataRouter);
mountModule(router, "changeRequests", changeRequestsRouter);
mountModule(router, "notifications", notificationsRouter);
mountModule(router, "executiveOversight", executiveOversightRouter);
mountModule(router, "documents", documentsRouter);
mountModule(router, "formTemplates", formTemplatesRouter);
mountModule(router, "printJobs", printJobsRouter);
mountModule(router, "testing", testingRouter);

export default router;
