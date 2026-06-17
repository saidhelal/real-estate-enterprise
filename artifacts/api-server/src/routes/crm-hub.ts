import { Router, type IRouter } from "express";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { type AnyPgColumn } from "drizzle-orm/pg-core";
import {
  db,
  customersTable,
  customerContactsTable,
  customerNotesTable,
  customerDocumentsTable,
  leadsTable,
  reservationsTable,
  contractsTable,
  unitsTable,
  unitStatusesTable,
  unitTypesTable,
  projectsTable,
  buildingsTable,
  installmentPlansTable,
  installmentSchedulesTable,
  usersTable,
} from "@workspace/db";
import {
  GetCrmDashboardResponse,
  ListCrmAvailableUnitsResponse,
  GetCrmCustomerProfileResponse,
  CrmGlobalSearchResponse,
  GetCrmSalesPerformanceResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

/**
 * CRM & Sales Center — a read/aggregation business layer over EXISTING entities.
 * No new tables: every figure is derived from real-estate units, leads, customers,
 * reservations, contracts and installment schedules. Money is strictly read-only
 * here (payment status only); receipts/collections stay under Finance, and contract
 * lifecycle stays under Legal Affairs (we only expose status + the linked id).
 */

const num = (v: string | null | undefined): string => v ?? "0";

// ---------- GET /crm/dashboard ----------
router.get("/crm/dashboard", requirePermission("crm.view"), async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const companyId = qStr(req.query as Record<string, unknown>, "companyId") || null;
  const scoped = (notDeleted: SQL, companyCol: AnyPgColumn): SQL =>
    companyId ? (and(notDeleted, eq(companyCol, companyId)) as SQL) : notDeleted;

  const customersWhere = scoped(eq(customersTable.isDeleted, false), customersTable.companyId);
  const leadsWhere = scoped(eq(leadsTable.isDeleted, false), leadsTable.companyId);
  const reservationsWhere = scoped(eq(reservationsTable.isDeleted, false), reservationsTable.companyId);
  const contractsWhere = scoped(eq(contractsTable.isDeleted, false), contractsTable.companyId);
  const unitsWhere = scoped(eq(unitsTable.isDeleted, false), unitsTable.companyId);
  const schedulesWhere = scoped(eq(installmentSchedulesTable.isDeleted, false), installmentSchedulesTable.companyId);

  const [
    customerRows,
    leadRows,
    reservationRows,
    classRows,
    leadStatusRows,
    reservationStatusRows,
    unitStatusRows,
    paidRow,
    overdueRow,
    dueRow,
  ] = await Promise.all([
    db.select({ value: count() }).from(customersTable).where(customersWhere),
    db.select({ value: count() }).from(leadsTable).where(leadsWhere),
    db.select({ value: count() }).from(reservationsTable).where(reservationsWhere),
    db
      .select({ key: customersTable.classification, value: count() })
      .from(customersTable)
      .where(customersWhere)
      .groupBy(customersTable.classification),
    db
      .select({ key: leadsTable.status, value: count() })
      .from(leadsTable)
      .where(leadsWhere)
      .groupBy(leadsTable.status),
    db
      .select({ key: reservationsTable.status, value: count() })
      .from(reservationsTable)
      .where(reservationsWhere)
      .groupBy(reservationsTable.status),
    db
      .select({ code: unitStatusesTable.code, value: count() })
      .from(unitsTable)
      .leftJoin(unitStatusesTable, eq(unitsTable.unitStatusId, unitStatusesTable.id))
      .where(unitsWhere)
      .groupBy(unitStatusesTable.code),
    db
      .select({
        c: count(),
        amount: sql<string>`coalesce(sum(${installmentSchedulesTable.paidAmount}), 0)::text`,
      })
      .from(installmentSchedulesTable)
      .where(and(schedulesWhere, eq(installmentSchedulesTable.status, "paid"))),
    db
      .select({
        c: count(),
        amount: sql<string>`coalesce(sum(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount}), 0)::text`,
      })
      .from(installmentSchedulesTable)
      .where(and(schedulesWhere, ne(installmentSchedulesTable.status, "paid"), lt(installmentSchedulesTable.dueDate, today))),
    db
      .select({
        c: count(),
        amount: sql<string>`coalesce(sum(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount}), 0)::text`,
      })
      .from(installmentSchedulesTable)
      .where(and(schedulesWhere, ne(installmentSchedulesTable.status, "paid"), sql`${installmentSchedulesTable.dueDate} >= ${today}`)),
  ]);

  const totalContractsRow = await db.select({ value: count() }).from(contractsTable).where(contractsWhere);

  const unitByStatus = (code: string): number =>
    unitStatusRows.find((r) => r.code === code)?.value ?? 0;

  const totalLeads = leadRows[0]?.value ?? 0;
  const totalContracts = totalContractsRow[0]?.value ?? 0;
  const conversionRate =
    totalLeads > 0 ? ((totalContracts / totalLeads) * 100).toFixed(1) : "0";

  res.json(
    GetCrmDashboardResponse.parse({
      totalCustomers: customerRows[0]?.value ?? 0,
      totalLeads,
      totalReservations: reservationRows[0]?.value ?? 0,
      activeReservations: reservationStatusRows.find((r) => r.key === "active")?.value ?? 0,
      totalContracts,
      availableUnits: unitByStatus("available"),
      reservedUnits: unitByStatus("reserved"),
      soldUnits: unitByStatus("sold"),
      conversionRate,
      customersByClassification: classRows.map((r) => ({
        key: r.key ?? "unclassified",
        label: null,
        count: r.value,
      })),
      leadsByStatus: leadStatusRows.map((r) => ({ key: r.key, label: null, count: r.value })),
      reservationsByStatus: reservationStatusRows.map((r) => ({ key: r.key, label: null, count: r.value })),
      paymentStatus: {
        paid: paidRow[0]?.c ?? 0,
        overdue: overdueRow[0]?.c ?? 0,
        due: dueRow[0]?.c ?? 0,
        paidAmount: num(paidRow[0]?.amount),
        overdueAmount: num(overdueRow[0]?.amount),
        dueAmount: num(dueRow[0]?.amount),
      },
    }),
  );
});

// ---------- GET /crm/available-units ----------
router.get("/crm/available-units", requirePermission("crm.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const companyId = qStr(q, "companyId");
  const projectId = qStr(q, "projectId");
  const search = qStr(q, "search");

  const filters: SQL[] = [
    eq(unitsTable.isDeleted, false),
    sql`lower(${unitStatusesTable.code}) = 'available'`,
  ];
  if (companyId) filters.push(eq(unitsTable.companyId, companyId));
  if (projectId) filters.push(eq(unitsTable.projectId, projectId));
  if (search) {
    const s = or(ilike(unitsTable.code, `%${search}%`), ilike(unitsTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const where = and(...filters);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(unitsTable)
    .innerJoin(unitStatusesTable, eq(unitsTable.unitStatusId, unitStatusesTable.id))
    .where(where);

  const rows = await db
    .select({
      id: unitsTable.id,
      code: unitsTable.code,
      name: unitsTable.name,
      nameAr: unitsTable.nameAr,
      projectId: unitsTable.projectId,
      projectName: projectsTable.name,
      buildingId: unitsTable.buildingId,
      buildingName: buildingsTable.name,
      unitTypeId: unitsTable.unitTypeId,
      unitTypeName: unitTypesTable.name,
      area: unitsTable.area,
      bedrooms: unitsTable.bedrooms,
      bathrooms: unitsTable.bathrooms,
      basePrice: unitsTable.basePrice,
      status: unitStatusesTable.code,
    })
    .from(unitsTable)
    .innerJoin(unitStatusesTable, eq(unitsTable.unitStatusId, unitStatusesTable.id))
    .leftJoin(projectsTable, eq(unitsTable.projectId, projectsTable.id))
    .leftJoin(buildingsTable, eq(unitsTable.buildingId, buildingsTable.id))
    .leftJoin(unitTypesTable, eq(unitsTable.unitTypeId, unitTypesTable.id))
    .where(where)
    .orderBy(desc(unitsTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  res.json(ListCrmAvailableUnitsResponse.parse({ data: rows, total, page, pageSize }));
});

// ---------- GET /crm/customers/:id/profile ----------
router.get("/crm/customers/:id/profile", requirePermission("crm.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.id, id), eq(customersTable.isDeleted, false)));
  if (!customer) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [
    assignedRow,
    reservations,
    contracts,
    notes,
    contacts,
    documents,
  ] = await Promise.all([
    customer.assignedToUserId
      ? db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, customer.assignedToUserId))
      : Promise.resolve([] as Array<{ fullName: string }>),
    db
      .select({
        id: reservationsTable.id,
        code: reservationsTable.code,
        unitId: reservationsTable.unitId,
        unitCode: unitsTable.code,
        status: reservationsTable.status,
        reservationDate: reservationsTable.reservationDate,
        expiryDate: reservationsTable.expiryDate,
        amount: reservationsTable.amount,
      })
      .from(reservationsTable)
      .leftJoin(unitsTable, eq(reservationsTable.unitId, unitsTable.id))
      .where(and(eq(reservationsTable.customerId, id), eq(reservationsTable.isDeleted, false)))
      .orderBy(desc(reservationsTable.createdAt)),
    db
      .select({
        id: contractsTable.id,
        code: contractsTable.code,
        unitId: contractsTable.unitId,
        unitCode: unitsTable.code,
        status: contractsTable.status,
        contractDate: contractsTable.contractDate,
        totalPrice: contractsTable.totalPrice,
        legalContractId: contractsTable.legalContractId,
      })
      .from(contractsTable)
      .leftJoin(unitsTable, eq(contractsTable.unitId, unitsTable.id))
      .where(and(eq(contractsTable.customerId, id), eq(contractsTable.isDeleted, false)))
      .orderBy(desc(contractsTable.createdAt)),
    db
      .select()
      .from(customerNotesTable)
      .where(and(eq(customerNotesTable.customerId, id), eq(customerNotesTable.isDeleted, false)))
      .orderBy(desc(customerNotesTable.createdAt)),
    db
      .select()
      .from(customerContactsTable)
      .where(and(eq(customerContactsTable.customerId, id), eq(customerContactsTable.isDeleted, false)))
      .orderBy(desc(customerContactsTable.createdAt)),
    db
      .select()
      .from(customerDocumentsTable)
      .where(and(eq(customerDocumentsTable.customerId, id), eq(customerDocumentsTable.isDeleted, false)))
      .orderBy(desc(customerDocumentsTable.createdAt)),
  ]);

  const contractIds = contracts.map((c) => c.id);
  const planRows = contractIds.length
    ? await db
        .select({ id: installmentPlansTable.id })
        .from(installmentPlansTable)
        .where(and(eq(installmentPlansTable.isDeleted, false), inArray(installmentPlansTable.contractId, contractIds)))
    : [];
  const planIds = planRows.map((p) => p.id);

  let paidAmount = "0";
  let dueAmount = "0";
  let overdueAmount = "0";
  if (planIds.length) {
    const today = new Date().toISOString().slice(0, 10);
    const [agg] = await db
      .select({
        paid: sql<string>`coalesce(sum(${installmentSchedulesTable.paidAmount}), 0)::text`,
        due: sql<string>`coalesce(sum(case when ${installmentSchedulesTable.status} <> 'paid' and ${installmentSchedulesTable.dueDate} >= ${today} then ${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount} else 0 end), 0)::text`,
        overdue: sql<string>`coalesce(sum(case when ${installmentSchedulesTable.status} <> 'paid' and ${installmentSchedulesTable.dueDate} < ${today} then ${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount} else 0 end), 0)::text`,
      })
      .from(installmentSchedulesTable)
      .where(and(eq(installmentSchedulesTable.isDeleted, false), inArray(installmentSchedulesTable.planId, planIds)));
    paidAmount = agg?.paid ?? "0";
    dueAmount = agg?.due ?? "0";
    overdueAmount = agg?.overdue ?? "0";
  }

  const [contractTotalRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${contractsTable.totalPrice}), 0)::text`,
    })
    .from(contractsTable)
    .where(and(eq(contractsTable.customerId, id), eq(contractsTable.isDeleted, false)));
  const totalContractValue = contractTotalRow?.total ?? "0";

  res.json(
    GetCrmCustomerProfileResponse.parse({
      customer: serializeRow(customer),
      assignedToName: assignedRow[0]?.fullName ?? null,
      stats: {
        reservations: reservations.length,
        contracts: contracts.length,
        totalContractValue,
        paidAmount,
        dueAmount,
        overdueAmount,
      },
      reservations: reservations.map(serializeRow),
      contracts: contracts.map(serializeRow),
      notes: notes.map(serializeRow),
      contacts: contacts.map(serializeRow),
      documents: documents.map(serializeRow),
    }),
  );
});

// ---------- GET /crm/search ----------
router.get("/crm/search", requirePermission("crm.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const term = qStr(q, "q");
  const companyId = qStr(q, "companyId");
  if (!term) {
    res.json(CrmGlobalSearchResponse.parse({ customers: [], units: [], contracts: [], reservations: [] }));
    return;
  }
  const like = `%${term}%`;
  const scope = (col: AnyPgColumn): SQL | undefined => (companyId ? eq(col, companyId) : undefined);

  const [customers, units, contracts, reservations] = await Promise.all([
    db
      .select({ id: customersTable.id, code: customersTable.code, label: customersTable.fullName, status: customersTable.classification })
      .from(customersTable)
      .where(
        and(
          eq(customersTable.isDeleted, false),
          scope(customersTable.companyId),
          or(ilike(customersTable.code, like), ilike(customersTable.fullName, like), ilike(customersTable.phone, like)),
        ),
      )
      .limit(10),
    db
      .select({ id: unitsTable.id, code: unitsTable.code, label: unitsTable.name, status: unitStatusesTable.code })
      .from(unitsTable)
      .leftJoin(unitStatusesTable, eq(unitsTable.unitStatusId, unitStatusesTable.id))
      .where(and(eq(unitsTable.isDeleted, false), scope(unitsTable.companyId), or(ilike(unitsTable.code, like), ilike(unitsTable.name, like))))
      .limit(10),
    db
      .select({ id: contractsTable.id, code: contractsTable.code, label: contractsTable.code, status: contractsTable.status })
      .from(contractsTable)
      .where(and(eq(contractsTable.isDeleted, false), scope(contractsTable.companyId), ilike(contractsTable.code, like)))
      .limit(10),
    db
      .select({ id: reservationsTable.id, code: reservationsTable.code, label: reservationsTable.code, status: reservationsTable.status })
      .from(reservationsTable)
      .where(and(eq(reservationsTable.isDeleted, false), scope(reservationsTable.companyId), ilike(reservationsTable.code, like)))
      .limit(10),
  ]);

  res.json(CrmGlobalSearchResponse.parse({ customers, units, contracts, reservations }));
});

// ---------- GET /crm/sales-performance ----------
router.get("/crm/sales-performance", requirePermission("crm.view"), async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId") || null;
  const scoped = (notDeleted: SQL, companyCol: AnyPgColumn): SQL =>
    companyId ? (and(notDeleted, eq(companyCol, companyId)) as SQL) : notDeleted;

  const [custByRep, leadByRep, users] = await Promise.all([
    db
      .select({ userId: customersTable.assignedToUserId, value: count() })
      .from(customersTable)
      .where(scoped(eq(customersTable.isDeleted, false), customersTable.companyId))
      .groupBy(customersTable.assignedToUserId),
    db
      .select({ userId: leadsTable.assignedToUserId, value: count() })
      .from(leadsTable)
      .where(scoped(eq(leadsTable.isDeleted, false), leadsTable.companyId))
      .groupBy(leadsTable.assignedToUserId),
    db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.isDeleted, false)),
  ]);

  // Reservations + contracts attribute to the rep that owns the customer.
  const [resByRep, contractByRep] = await Promise.all([
    db
      .select({ userId: customersTable.assignedToUserId, value: count() })
      .from(reservationsTable)
      .innerJoin(customersTable, eq(reservationsTable.customerId, customersTable.id))
      .where(scoped(eq(reservationsTable.isDeleted, false), reservationsTable.companyId))
      .groupBy(customersTable.assignedToUserId),
    db
      .select({
        userId: customersTable.assignedToUserId,
        value: count(),
        total: sql<string>`coalesce(sum(${contractsTable.totalPrice}), 0)::text`,
      })
      .from(contractsTable)
      .innerJoin(customersTable, eq(contractsTable.customerId, customersTable.id))
      .where(scoped(eq(contractsTable.isDeleted, false), contractsTable.companyId))
      .groupBy(customersTable.assignedToUserId),
  ]);

  const userName = new Map(users.map((u) => [u.id, u.fullName]));
  const repIds = new Set<string>();
  for (const r of [...custByRep, ...leadByRep, ...resByRep, ...contractByRep]) {
    if (r.userId) repIds.add(r.userId);
  }
  const findVal = (rows: Array<{ userId: string | null; value: number }>, id: string): number =>
    rows.find((r) => r.userId === id)?.value ?? 0;

  const reps = Array.from(repIds).map((id) => {
    const leads = findVal(leadByRep, id);
    const contracts = findVal(contractByRep, id);
    const total = contractByRep.find((r) => r.userId === id)?.total ?? "0";
    return {
      userId: id,
      userName: userName.get(id) ?? null,
      customers: findVal(custByRep, id),
      leads,
      reservations: findVal(resByRep, id),
      contracts,
      conversionRate: leads > 0 ? ((contracts / leads) * 100).toFixed(1) : "0",
      totalContractValue: total,
    };
  });
  reps.sort((a, b) => Number(b.totalContractValue) - Number(a.totalContractValue));

  res.json(GetCrmSalesPerformanceResponse.parse({ reps }));
});

export default router;
