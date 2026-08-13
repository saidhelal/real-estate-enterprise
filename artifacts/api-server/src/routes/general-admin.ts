import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  correspondenceTable,
  meetingsTable,
  administrativeDecisionsTable,
  administrativeTasksTable,
  generalServiceRequestsTable,
  vehiclesTable,
  driversTable,
  vehicleMissionsTable,
  vehicleMaintenanceLogsTable,
  visitorLogsTable,
  circularsTable,
  policiesTable,
  fixedAssetsTable,
} from "@workspace/db";
import {
  ListCorrespondenceResponse,
  CreateCorrespondenceBody,
  GetCorrespondenceResponse,
  UpdateCorrespondenceBody,
  ListMeetingsResponse,
  CreateMeetingBody,
  GetMeetingResponse,
  UpdateMeetingBody,
  ListAdministrativeDecisionsResponse,
  CreateAdministrativeDecisionBody,
  GetAdministrativeDecisionResponse,
  UpdateAdministrativeDecisionBody,
  ListAdministrativeTasksResponse,
  CreateAdministrativeTaskBody,
  GetAdministrativeTaskResponse,
  UpdateAdministrativeTaskBody,
  ListGeneralServicesResponse,
  CreateGeneralServiceBody,
  GetGeneralServiceResponse,
  UpdateGeneralServiceBody,
  ListVehiclesResponse,
  CreateVehicleBody,
  GetVehicleResponse,
  UpdateVehicleBody,
  ListDriversResponse,
  CreateDriverBody,
  GetDriverResponse,
  UpdateDriverBody,
  ListVehicleMissionsResponse,
  CreateVehicleMissionBody,
  GetVehicleMissionResponse,
  UpdateVehicleMissionBody,
  ListVehicleMaintenanceResponse,
  CreateVehicleMaintenanceBody,
  GetVehicleMaintenanceResponse,
  UpdateVehicleMaintenanceBody,
  ListVisitorLogsResponse,
  CreateVisitorLogBody,
  GetVisitorLogResponse,
  UpdateVisitorLogBody,
  ListCircularsResponse,
  CreateCircularBody,
  GetCircularResponse,
  UpdateCircularBody,
  ListPoliciesResponse,
  CreatePolicyBody,
  GetPolicyResponse,
  UpdatePolicyBody,
  GetGeneralAdminDashboardResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// General Administration (الإدارة العامة): corporate back-office module.
// Generic CRUD per entity (soft-delete list with search/filters, create/get/
// patch/delete), each guarded by `${module}.${action}`, with best-effort audit.
// serializeRow converts Date->ISO; numeric stays string.

interface CrudSchema {
  parse: (v: unknown) => unknown;
  safeParse: (
    v: unknown,
  ) =>
    | { success: true; data: Record<string, unknown> }
    | { success: false; error: { message: string } };
}

import { registerCrud } from "../lib/register-crud";


registerCrud(router, {
  base: "/correspondence",
  module: "correspondence",
  entity: "correspondence",
  table: correspondenceTable,
  searchCols: ["code", "subject"],
  filterCols: ["companyId", "direction", "correspondenceType", "status", "priority", "assignedToEmployeeId"],
  listResp: ListCorrespondenceResponse,
  createBody: CreateCorrespondenceBody,
  getResp: GetCorrespondenceResponse,
  updateBody: UpdateCorrespondenceBody,
});

registerCrud(router, {
  base: "/meetings",
  module: "meetings",
  entity: "meeting",
  table: meetingsTable,
  searchCols: ["code", "title"],
  filterCols: ["companyId", "meetingType", "status", "chairpersonEmployeeId"],
  listResp: ListMeetingsResponse,
  createBody: CreateMeetingBody,
  getResp: GetMeetingResponse,
  updateBody: UpdateMeetingBody,
});

registerCrud(router, {
  base: "/administrative-decisions",
  module: "administrativeDecisions",
  entity: "administrativeDecision",
  table: administrativeDecisionsTable,
  searchCols: ["code", "title"],
  filterCols: ["companyId", "decisionType", "status", "meetingId", "assignedToEmployeeId"],
  listResp: ListAdministrativeDecisionsResponse,
  createBody: CreateAdministrativeDecisionBody,
  getResp: GetAdministrativeDecisionResponse,
  updateBody: UpdateAdministrativeDecisionBody,
});

registerCrud(router, {
  base: "/administrative-tasks",
  module: "administrativeTasks",
  entity: "administrativeTask",
  table: administrativeTasksTable,
  searchCols: ["code", "title"],
  filterCols: ["companyId", "status", "priority", "assignedToEmployeeId", "assignedByUserId"],
  listResp: ListAdministrativeTasksResponse,
  createBody: CreateAdministrativeTaskBody,
  getResp: GetAdministrativeTaskResponse,
  updateBody: UpdateAdministrativeTaskBody,
});

registerCrud(router, {
  base: "/general-services",
  module: "generalServices",
  entity: "generalService",
  table: generalServiceRequestsTable,
  searchCols: ["code", "title"],
  filterCols: ["companyId", "serviceType", "status", "priority", "assignedToEmployeeId"],
  listResp: ListGeneralServicesResponse,
  createBody: CreateGeneralServiceBody,
  getResp: GetGeneralServiceResponse,
  updateBody: UpdateGeneralServiceBody,
});

registerCrud(router, {
  base: "/vehicles",
  module: "vehicles",
  entity: "vehicle",
  table: vehiclesTable,
  searchCols: ["code", "plateNumber"],
  filterCols: ["companyId", "vehicleType", "ownershipType", "status", "assignedDriverId"],
  listResp: ListVehiclesResponse,
  createBody: CreateVehicleBody,
  getResp: GetVehicleResponse,
  updateBody: UpdateVehicleBody,
});

registerCrud(router, {
  base: "/drivers",
  module: "drivers",
  entity: "driver",
  table: driversTable,
  searchCols: ["code", "fullName"],
  filterCols: ["companyId", "status", "employeeId"],
  listResp: ListDriversResponse,
  createBody: CreateDriverBody,
  getResp: GetDriverResponse,
  updateBody: UpdateDriverBody,
});

registerCrud(router, {
  base: "/vehicle-missions",
  module: "vehicleMissions",
  entity: "vehicleMission",
  table: vehicleMissionsTable,
  searchCols: ["code", "purpose"],
  filterCols: ["companyId", "vehicleId", "driverId", "status"],
  listResp: ListVehicleMissionsResponse,
  createBody: CreateVehicleMissionBody,
  getResp: GetVehicleMissionResponse,
  updateBody: UpdateVehicleMissionBody,
});

registerCrud(router, {
  base: "/vehicle-maintenance",
  module: "vehicleMaintenance",
  entity: "vehicleMaintenance",
  table: vehicleMaintenanceLogsTable,
  searchCols: ["code", "description"],
  filterCols: ["companyId", "vehicleId", "logType", "status"],
  listResp: ListVehicleMaintenanceResponse,
  createBody: CreateVehicleMaintenanceBody,
  getResp: GetVehicleMaintenanceResponse,
  updateBody: UpdateVehicleMaintenanceBody,
});

registerCrud(router, {
  base: "/visitor-logs",
  module: "visitorLogs",
  entity: "visitorLog",
  table: visitorLogsTable,
  searchCols: ["code", "visitorName"],
  filterCols: ["companyId", "status", "permitStatus", "hostEmployeeId"],
  listResp: ListVisitorLogsResponse,
  createBody: CreateVisitorLogBody,
  getResp: GetVisitorLogResponse,
  updateBody: UpdateVisitorLogBody,
});

registerCrud(router, {
  base: "/circulars",
  module: "circulars",
  entity: "circular",
  table: circularsTable,
  searchCols: ["code", "title"],
  filterCols: ["companyId", "audience", "status", "departmentId"],
  listResp: ListCircularsResponse,
  createBody: CreateCircularBody,
  getResp: GetCircularResponse,
  updateBody: UpdateCircularBody,
});

registerCrud(router, {
  base: "/policies",
  module: "policies",
  entity: "policy",
  table: policiesTable,
  searchCols: ["code", "title"],
  filterCols: ["companyId", "policyType", "status", "ownerEmployeeId"],
  listResp: ListPoliciesResponse,
  createBody: CreatePolicyBody,
  getResp: GetPolicyResponse,
  updateBody: UpdatePolicyBody,
});

// General Administration dashboard: live counts. Permission-gated like the other
// per-module dashboards (customer-service/handover/fixed-assets all require a
// representative module's view permission). assetsCount reuses the existing
// fixed-assets register (admin assets / custody).
router.get("/general-admin-dashboard", requirePermission("administrativeTasks.view"), async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countOf = async (table: any): Promise<number> => {
    const f: SQL[] = [eq(table.isDeleted, false)];
    if (companyId) f.push(eq(table.companyId, companyId));
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(table).where(and(...f));
    return count;
  };
  const [meetingsCount, decisionsCount, tasksCount, visitorsCount, vehiclesCount, assetsCount] =
    await Promise.all([
      countOf(meetingsTable),
      countOf(administrativeDecisionsTable),
      countOf(administrativeTasksTable),
      countOf(visitorLogsTable),
      countOf(vehiclesTable),
      countOf(fixedAssetsTable),
    ]);
  res.json(
    GetGeneralAdminDashboardResponse.parse({
      meetingsCount,
      decisionsCount,
      tasksCount,
      visitorsCount,
      vehiclesCount,
      assetsCount,
    }),
  );
});

export default router;
