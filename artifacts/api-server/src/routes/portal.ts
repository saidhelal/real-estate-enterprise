import { nextNumber } from "../lib/doc-number";
import { Router, type IRouter } from "express";
import { and, eq, ne, lt, gte, inArray, desc, asc, sql } from "drizzle-orm";
import {
  db,
  customersTable,
  customerUsersTable,
  customerSessionsTable,
  customerOtpsTable,
  maintenanceRequestsTable,
  complaintsTable,
  customerNotificationsTable,
  supportTicketsTable,
  supportTicketMessagesTable,
  customerDeviceTokensTable,
  customerUploadsTable,
  contractsTable,
  reservationsTable,
  unitsTable,
  projectsTable,
  buildingsTable,
  installmentPlansTable,
  installmentSchedulesTable,
  receiptsTable,
  customerDocumentsTable,
} from "@workspace/db";
import {
  PortalLoginBody,
  PortalForgotPasswordBody,
  PortalVerifyOtpBody,
  CreateMaintenanceRequestBody,
  CreateComplaintBody,
  CreateSupportTicketBody,
  CreateSupportTicketMessageBody,
  RegisterDeviceTokenBody,
  GetPortalDashboardResponse,
  GetPortalUnitsResponse,
  GetPortalContractsResponse,
  GetPortalInstallmentsResponse,
  GetPortalCollectionsResponse,
  GetPortalDocumentsResponse,
  ListMaintenanceRequestsResponse,
  ListComplaintsResponse,
  GetPortalNotificationsResponse,
  ListSupportTicketsResponse,
  GetSupportTicketResponse,
} from "@workspace/api-zod";
import {
  PORTAL_REFRESH_COOKIE,
  PORTAL_REFRESH_TTL_SECONDS,
  PORTAL_MAX_FAILED_ATTEMPTS,
  PORTAL_LOCKOUT_MINUTES,
  hashPassword,
  verifyPassword,
  signPortalAccessToken,
  generateRefreshToken,
  hashToken,
  generateOtpCode,
  setPortalAuthCookies,
  setPortalAccessCookie,
  clearPortalAuthCookies,
} from "../lib/portal-auth";
import { requireCustomerAuth } from "../middleware/portal-auth";
import { Readable } from "stream";
import {
  UploadPortalFileBody,
  UploadPortalFileResponse,
} from "@workspace/api-zod";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";

const router: IRouter = Router();

const objectStorageService = new ObjectStorageService();

const isProduction = process.env.NODE_ENV === "production";

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Portal request references.
 *
 * Was a base-36 timestamp plus three random digits — unique by luck, and
 * unreadable to the customer quoting it back over the phone. Comes from the
 * central sequence like every other issued identifier; the prefix names the
 * sequence rather than being pasted into the string.
 */
async function genCode(prefix: string, companyId: string | null = null): Promise<string> {
  return (await nextNumber(prefix, companyId)).value;
}

// Verify that an attachment path supplied on a write was minted by
// /portal/uploads for THIS customer. Returns false for any path the customer
// does not own (forged / another customer's object), so attachments can never
// reference foreign objects.
async function ownsUploadPath(
  customerId: string,
  attachmentUrl: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: customerUploadsTable.id })
    .from(customerUploadsTable)
    .where(
      and(
        eq(customerUploadsTable.customerId, customerId),
        eq(customerUploadsTable.objectPath, attachmentUrl),
      ),
    )
    .limit(1);
  return Boolean(row);
}

// Active-payment receipt statuses (exclude drafts and unwound vouchers).
const PAID_RECEIPT_STATUSES = ["approved", "posted", "confirmed"];
// "In progress" request statuses for the open-requests counter.
const OPEN_STATUSES = ["open", "in_progress", "pending"];

async function customerNameFields(customerId: string): Promise<{
  customerName: string;
  customerNameAr: string | null;
}> {
  const [c] = await db
    .select({ fullName: customersTable.fullName, nameAr: customersTable.nameAr })
    .from(customersTable)
    .where(eq(customersTable.id, customerId));
  return {
    customerName: c?.fullName ?? "",
    customerNameAr: c?.nameAr ?? null,
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

router.post("/portal/auth/login", async (req, res): Promise<void> => {
  const parsed = PortalLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;
  const ip = req.ip ?? null;
  const userAgent = req.get("user-agent") ?? null;

  const [user] = await db
    .select()
    .from(customerUsersTable)
    .where(
      and(
        eq(customerUsersTable.username, username),
        eq(customerUsersTable.isDeleted, false),
      ),
    );

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }
  if (user.status === "inactive" || !user.isActive) {
    res.status(401).json({ error: "Account is inactive. Contact support." });
    return;
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    res.status(401).json({ error: "Account is locked. Try again later." });
    return;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failedAttempts = Number(user.failedAttempts) + 1;
    const shouldLock = failedAttempts >= PORTAL_MAX_FAILED_ATTEMPTS;
    await db
      .update(customerUsersTable)
      .set({
        failedAttempts: String(failedAttempts),
        status: shouldLock ? "locked" : user.status,
        lockedUntil: shouldLock
          ? new Date(Date.now() + PORTAL_LOCKOUT_MINUTES * 60 * 1000)
          : user.lockedUntil,
      })
      .where(eq(customerUsersTable.id, user.id));
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  await db
    .update(customerUsersTable)
    .set({
      failedAttempts: "0",
      status: "active",
      lockedUntil: null,
      lastLoginAt: new Date(),
    })
    .where(eq(customerUsersTable.id, user.id));

  const refreshRaw = generateRefreshToken();
  await db.insert(customerSessionsTable).values({
    companyId: user.companyId,
    customerUserId: user.id,
    customerId: user.customerId,
    refreshTokenHash: hashToken(refreshRaw),
    userAgent,
    ipAddress: ip,
    expiresAt: new Date(Date.now() + PORTAL_REFRESH_TTL_SECONDS * 1000),
  });

  const accessToken = signPortalAccessToken(user.id);
  setPortalAuthCookies(res, accessToken, refreshRaw);

  const names = await customerNameFields(user.customerId);
  res.json({
    accessToken,
    refreshToken: refreshRaw,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      customerId: user.customerId,
      companyId: user.companyId,
      ...names,
    },
  });
});

router.post("/portal/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = PortalForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { identifier } = parsed.data;

  const [user] = await db
    .select()
    .from(customerUsersTable)
    .where(
      and(
        eq(customerUsersTable.isDeleted, false),
        sql`(${customerUsersTable.username} = ${identifier} OR ${customerUsersTable.email} = ${identifier} OR ${customerUsersTable.phone} = ${identifier})`,
      ),
    );

  // Always respond success to avoid account enumeration.
  if (!user) {
    res.json({ success: true });
    return;
  }

  const code = generateOtpCode();
  await db.insert(customerOtpsTable).values({
    companyId: user.companyId,
    customerUserId: user.id,
    identifier,
    codeHash: hashToken(code),
    purpose: "password_reset",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  if (!isProduction) {
    req.log?.info({ identifier }, "portal password-reset OTP issued");
  }
  res.json({ success: true, devCode: isProduction ? null : code });
});

router.post("/portal/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = PortalVerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { identifier, code, newPassword } = parsed.data;

  const [otp] = await db
    .select()
    .from(customerOtpsTable)
    .where(
      and(
        eq(customerOtpsTable.identifier, identifier),
        eq(customerOtpsTable.purpose, "password_reset"),
        eq(customerOtpsTable.isDeleted, false),
      ),
    )
    .orderBy(desc(customerOtpsTable.createdAt))
    .limit(1);

  if (
    !otp ||
    otp.consumedAt ||
    otp.expiresAt.getTime() < Date.now() ||
    otp.codeHash !== hashToken(code)
  ) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(customerOtpsTable)
      .set({ consumedAt: new Date() })
      .where(eq(customerOtpsTable.id, otp.id));
    if (otp.customerUserId) {
      await tx
        .update(customerUsersTable)
        .set({
          passwordHash: await hashPassword(newPassword),
          failedAttempts: "0",
          status: "active",
          lockedUntil: null,
        })
        .where(eq(customerUsersTable.id, otp.customerUserId));
    }
  });

  res.json({ success: true });
});

router.post("/portal/auth/refresh", async (req, res): Promise<void> => {
  // Web sends the refresh token via httpOnly cookie; mobile may send it in the
  // body or an x-refresh-token header (Bearer flow).
  const cookieRaw = req.cookies?.[PORTAL_REFRESH_COOKIE] as string | undefined;
  const bodyRaw =
    typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  const headerRaw = req.get("x-refresh-token") ?? undefined;
  const raw = cookieRaw ?? bodyRaw ?? headerRaw;
  const fromCookie = !!cookieRaw;

  if (!raw) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }

  const tokenHash = hashToken(raw);
  const [session] = await db
    .select()
    .from(customerSessionsTable)
    .where(eq(customerSessionsTable.refreshTokenHash, tokenHash));

  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    if (fromCookie) clearPortalAuthCookies(res);
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const [user] = await db
    .select()
    .from(customerUsersTable)
    .where(
      and(
        eq(customerUsersTable.id, session.customerUserId),
        eq(customerUsersTable.isDeleted, false),
      ),
    );
  const lockedNow = !!user?.lockedUntil && user.lockedUntil.getTime() > Date.now();
  if (!user || !user.isActive || user.status !== "active" || lockedNow) {
    await db
      .update(customerSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(customerSessionsTable.id, session.id));
    if (fromCookie) clearPortalAuthCookies(res);
    res.status(401).json({ error: "Account is not active." });
    return;
  }

  const accessToken = signPortalAccessToken(session.customerUserId);

  if (fromCookie) {
    // Rotate the web refresh token.
    const newRaw = generateRefreshToken();
    await db
      .update(customerSessionsTable)
      .set({
        refreshTokenHash: hashToken(newRaw),
        expiresAt: new Date(Date.now() + PORTAL_REFRESH_TTL_SECONDS * 1000),
      })
      .where(eq(customerSessionsTable.id, session.id));
    setPortalAuthCookies(res, accessToken, newRaw);
  } else {
    setPortalAccessCookie(res, accessToken);
  }

  res.json({ accessToken });
});

router.post("/portal/auth/logout", async (req, res): Promise<void> => {
  const cookieRaw = req.cookies?.[PORTAL_REFRESH_COOKIE] as string | undefined;
  const bodyRaw =
    typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;
  const headerRaw = req.get("x-refresh-token") ?? undefined;
  const raw = cookieRaw ?? bodyRaw ?? headerRaw;
  if (raw) {
    await db
      .update(customerSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(customerSessionsTable.refreshTokenHash, hashToken(raw)));
  }
  clearPortalAuthCookies(res);
  res.json({ success: true });
});

router.get("/portal/me", requireCustomerAuth, async (req, res): Promise<void> => {
  const cu = req.portalUser!;
  const [user] = await db
    .select()
    .from(customerUsersTable)
    .where(eq(customerUsersTable.id, cu.id));
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const names = await customerNameFields(cu.customerId);
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    customerId: user.customerId,
    companyId: user.companyId,
    ...names,
  });
});

// ---------------------------------------------------------------------------
// Read endpoints (every query scoped to req.portalUser.customerId)
// ---------------------------------------------------------------------------

router.get(
  "/portal/dashboard",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    const day = today();

    const contractRows = await db
      .select({ id: contractsTable.id, unitId: contractsTable.unitId })
      .from(contractsTable)
      .where(
        and(
          eq(contractsTable.customerId, customerId),
          eq(contractsTable.isDeleted, false),
        ),
      );
    const contractIds = contractRows.map((c) => c.id);

    const reservationUnits = await db
      .select({ unitId: reservationsTable.unitId })
      .from(reservationsTable)
      .where(
        and(
          eq(reservationsTable.customerId, customerId),
          eq(reservationsTable.isDeleted, false),
        ),
      );

    const unitIds = new Set<string>();
    for (const c of contractRows) if (c.unitId) unitIds.add(c.unitId);
    for (const r of reservationUnits) if (r.unitId) unitIds.add(r.unitId);

    const [{ totalContractValue }] = await db
      .select({
        totalContractValue: sql<string>`coalesce(sum(${contractsTable.totalPrice}), 0)::text`,
      })
      .from(contractsTable)
      .where(
        and(
          eq(contractsTable.customerId, customerId),
          eq(contractsTable.isDeleted, false),
        ),
      );

    // Installment aggregates (scoped via plan -> contract -> customer).
    let totalDue = "0";
    let totalPaid = "0";
    let totalOutstanding = "0";
    let overdueCount = 0;
    let overdueAmount = "0";
    let nextDueDate: string | null = null;
    let nextDueAmount: string | null = null;

    if (contractIds.length > 0) {
      const [agg] = await db
        .select({
          totalDue: sql<string>`coalesce(sum(${installmentSchedulesTable.amount}), 0)::text`,
          totalPaid: sql<string>`coalesce(sum(${installmentSchedulesTable.paidAmount}), 0)::text`,
          totalOutstanding: sql<string>`coalesce(sum(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount}), 0)::text`,
        })
        .from(installmentSchedulesTable)
        .innerJoin(
          installmentPlansTable,
          eq(installmentPlansTable.id, installmentSchedulesTable.planId),
        )
        .where(
          and(
            inArray(installmentPlansTable.contractId, contractIds),
            eq(installmentSchedulesTable.isDeleted, false),
          ),
        );
      totalDue = agg.totalDue;
      totalPaid = agg.totalPaid;
      totalOutstanding = agg.totalOutstanding;

      const [over] = await db
        .select({
          count: sql<number>`count(*)::int`,
          amount: sql<string>`coalesce(sum(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount}), 0)::text`,
        })
        .from(installmentSchedulesTable)
        .innerJoin(
          installmentPlansTable,
          eq(installmentPlansTable.id, installmentSchedulesTable.planId),
        )
        .where(
          and(
            inArray(installmentPlansTable.contractId, contractIds),
            eq(installmentSchedulesTable.isDeleted, false),
            ne(installmentSchedulesTable.status, "paid"),
            lt(installmentSchedulesTable.dueDate, day),
          ),
        );
      overdueCount = over.count;
      overdueAmount = over.amount;

      const [next] = await db
        .select({
          dueDate: installmentSchedulesTable.dueDate,
          remaining: sql<string>`(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount})::text`,
        })
        .from(installmentSchedulesTable)
        .innerJoin(
          installmentPlansTable,
          eq(installmentPlansTable.id, installmentSchedulesTable.planId),
        )
        .where(
          and(
            inArray(installmentPlansTable.contractId, contractIds),
            eq(installmentSchedulesTable.isDeleted, false),
            ne(installmentSchedulesTable.status, "paid"),
            gte(installmentSchedulesTable.dueDate, day),
          ),
        )
        .orderBy(asc(installmentSchedulesTable.dueDate))
        .limit(1);
      if (next) {
        nextDueDate = next.dueDate;
        nextDueAmount = next.remaining;
      }
    }
    void totalDue;

    const [openMaint] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(maintenanceRequestsTable)
      .where(
        and(
          eq(maintenanceRequestsTable.customerId, customerId),
          eq(maintenanceRequestsTable.isDeleted, false),
          inArray(maintenanceRequestsTable.status, OPEN_STATUSES),
        ),
      );
    const [openComplaints] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(complaintsTable)
      .where(
        and(
          eq(complaintsTable.customerId, customerId),
          eq(complaintsTable.isDeleted, false),
          inArray(complaintsTable.status, OPEN_STATUSES),
        ),
      );
    const [openTickets] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(supportTicketsTable)
      .where(
        and(
          eq(supportTicketsTable.customerId, customerId),
          eq(supportTicketsTable.isDeleted, false),
          inArray(supportTicketsTable.status, OPEN_STATUSES),
        ),
      );

    const [unread] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerNotificationsTable)
      .where(
        and(
          eq(customerNotificationsTable.customerId, customerId),
          eq(customerNotificationsTable.isDeleted, false),
          eq(customerNotificationsTable.isRead, false),
        ),
      );

    const trend = await db
      .select({
        period: sql<string>`to_char(${receiptsTable.receiptDate}, 'YYYY-MM')`,
        value: sql<string>`coalesce(sum(${receiptsTable.amount}), 0)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(receiptsTable)
      .where(
        and(
          eq(receiptsTable.customerId, customerId),
          eq(receiptsTable.isDeleted, false),
          inArray(receiptsTable.status, PAID_RECEIPT_STATUSES),
        ),
      )
      .groupBy(sql`to_char(${receiptsTable.receiptDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${receiptsTable.receiptDate}, 'YYYY-MM')`);

    const body = GetPortalDashboardResponse.parse({
      unitsCount: unitIds.size,
      contractsCount: contractRows.length,
      totalContractValue,
      totalPaid,
      totalOutstanding,
      overdueCount,
      overdueAmount,
      openRequests:
        openMaint.count + openComplaints.count + openTickets.count,
      unreadNotifications: unread.count,
      nextDueDate,
      nextDueAmount,
      paymentTrend: trend,
    });
    res.json(body);
  },
);

router.get("/portal/units", requireCustomerAuth, async (req, res): Promise<void> => {
  const { customerId } = req.portalUser!;

  const contractUnits = await db
    .select({ unitId: contractsTable.unitId })
    .from(contractsTable)
    .where(
      and(
        eq(contractsTable.customerId, customerId),
        eq(contractsTable.isDeleted, false),
      ),
    );
  const reservationUnits = await db
    .select({ unitId: reservationsTable.unitId })
    .from(reservationsTable)
    .where(
      and(
        eq(reservationsTable.customerId, customerId),
        eq(reservationsTable.isDeleted, false),
      ),
    );

  const statusByUnit = new Map<string, string>();
  for (const r of reservationUnits) if (r.unitId) statusByUnit.set(r.unitId, "reserved");
  for (const c of contractUnits) if (c.unitId) statusByUnit.set(c.unitId, "contracted");

  const unitIds = [...statusByUnit.keys()];
  if (unitIds.length === 0) {
    res.json([]);
    return;
  }

  const rows = await db
    .select({
      id: unitsTable.id,
      code: unitsTable.code,
      area: unitsTable.area,
      price: unitsTable.basePrice,
      projectName: projectsTable.name,
      buildingName: buildingsTable.name,
    })
    .from(unitsTable)
    .leftJoin(projectsTable, eq(projectsTable.id, unitsTable.projectId))
    .leftJoin(buildingsTable, eq(buildingsTable.id, unitsTable.buildingId))
    .where(inArray(unitsTable.id, unitIds));

  const body = GetPortalUnitsResponse.parse(
    rows.map((r) => ({
      id: r.id,
      code: r.code,
      projectName: r.projectName,
      buildingName: r.buildingName,
      unitType: null,
      area: r.area,
      price: r.price,
      status: statusByUnit.get(r.id) ?? "unknown",
    })),
  );
  res.json(body);
});

router.get(
  "/portal/contracts",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    const rows = await db
      .select({
        id: contractsTable.id,
        code: contractsTable.code,
        unitId: contractsTable.unitId,
        unitCode: unitsTable.code,
        contractDate: contractsTable.contractDate,
        totalPrice: contractsTable.totalPrice,
        downPayment: contractsTable.downPayment,
        status: contractsTable.status,
      })
      .from(contractsTable)
      .leftJoin(unitsTable, eq(unitsTable.id, contractsTable.unitId))
      .where(
        and(
          eq(contractsTable.customerId, customerId),
          eq(contractsTable.isDeleted, false),
        ),
      )
      .orderBy(desc(contractsTable.contractDate));
    res.json(GetPortalContractsResponse.parse(rows));
  },
);

router.get(
  "/portal/installments",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    const rows = await db
      .select({
        id: installmentSchedulesTable.id,
        contractId: contractsTable.id,
        contractCode: contractsTable.code,
        installmentNo: installmentSchedulesTable.installmentNumber,
        dueDate: installmentSchedulesTable.dueDate,
        amount: installmentSchedulesTable.amount,
        paidAmount: installmentSchedulesTable.paidAmount,
        status: installmentSchedulesTable.status,
      })
      .from(installmentSchedulesTable)
      .innerJoin(
        installmentPlansTable,
        eq(installmentPlansTable.id, installmentSchedulesTable.planId),
      )
      .innerJoin(
        contractsTable,
        eq(contractsTable.id, installmentPlansTable.contractId),
      )
      .where(
        and(
          eq(contractsTable.customerId, customerId),
          eq(installmentSchedulesTable.isDeleted, false),
        ),
      )
      .orderBy(asc(installmentSchedulesTable.dueDate));
    res.json(GetPortalInstallmentsResponse.parse(rows));
  },
);

router.get(
  "/portal/collections",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    const rows = await db
      .select({
        id: receiptsTable.id,
        code: receiptsTable.code,
        amount: receiptsTable.amount,
        paymentDate: receiptsTable.receiptDate,
        method: receiptsTable.paymentMethod,
        reference: receiptsTable.reference,
      })
      .from(receiptsTable)
      .where(
        and(
          eq(receiptsTable.customerId, customerId),
          eq(receiptsTable.isDeleted, false),
          inArray(receiptsTable.status, PAID_RECEIPT_STATUSES),
        ),
      )
      .orderBy(desc(receiptsTable.receiptDate));
    res.json(GetPortalCollectionsResponse.parse(rows));
  },
);

router.get(
  "/portal/documents",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    const rows = await db
      .select()
      .from(customerDocumentsTable)
      .where(
        and(
          eq(customerDocumentsTable.customerId, customerId),
          eq(customerDocumentsTable.isDeleted, false),
        ),
      )
      .orderBy(desc(customerDocumentsTable.createdAt));
    res.json(
      GetPortalDocumentsResponse.parse(
        rows.map((r) => ({
          id: r.id,
          docType: r.docType,
          docNumber: r.docNumber,
          fileUrl: r.fileName,
          issueDate: r.issueDate,
          expiryDate: r.expiryDate,
        })),
      ),
    );
  },
);

// ---------------------------------------------------------------------------
// Maintenance requests
// ---------------------------------------------------------------------------

router.get(
  "/portal/maintenance-requests",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    const rows = await db
      .select()
      .from(maintenanceRequestsTable)
      .where(
        and(
          eq(maintenanceRequestsTable.customerId, customerId),
          eq(maintenanceRequestsTable.isDeleted, false),
        ),
      )
      .orderBy(desc(maintenanceRequestsTable.createdAt));
    res.json(
      ListMaintenanceRequestsResponse.parse(
        rows.map((r) => ({
          id: r.id,
          code: r.code,
          unitId: r.unitId,
          contractId: r.contractId,
          category: r.category,
          priority: r.priority,
          subject: r.subject,
          description: r.description,
          status: r.status,
          attachmentUrl: r.attachmentUrl,
          resolvedAt: iso(r.resolvedAt),
          createdAt: r.createdAt.toISOString(),
          updatedAt: iso(r.updatedAt),
        })),
      ),
    );
  },
);

router.post(
  "/portal/maintenance-requests",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId, id: customerUserId, companyId } = req.portalUser!;
    const parsed = CreateMaintenanceRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;

    // If a unit/contract is referenced, it must belong to this customer.
    if (d.contractId) {
      const [c] = await db
        .select({ id: contractsTable.id })
        .from(contractsTable)
        .where(
          and(
            eq(contractsTable.id, d.contractId),
            eq(contractsTable.customerId, customerId),
            eq(contractsTable.isDeleted, false),
          ),
        );
      if (!c) {
        res.status(403).json({ error: "Contract does not belong to you" });
        return;
      }
    }

    if (d.attachmentUrl && !(await ownsUploadPath(customerId, d.attachmentUrl))) {
      res.status(400).json({ error: "Invalid attachment" });
      return;
    }

    const [row] = await db
      .insert(maintenanceRequestsTable)
      .values({
        companyId,
        customerId,
        customerUserId,
        code: await genCode("portalMaintenanceRequest", companyId),
        unitId: d.unitId ?? null,
        contractId: d.contractId ?? null,
        category: d.category ?? "general",
        priority: d.priority ?? "medium",
        subject: d.subject,
        description: d.description ?? null,
        attachmentUrl: d.attachmentUrl ?? null,
      })
      .returning();

    res.status(201).json(
      ListMaintenanceRequestsResponse.element.parse({
        id: row.id,
        code: row.code,
        unitId: row.unitId,
        contractId: row.contractId,
        category: row.category,
        priority: row.priority,
        subject: row.subject,
        description: row.description,
        status: row.status,
        attachmentUrl: row.attachmentUrl,
        resolvedAt: iso(row.resolvedAt),
        createdAt: row.createdAt.toISOString(),
        updatedAt: iso(row.updatedAt),
      }),
    );
  },
);

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------

router.get(
  "/portal/complaints",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    const rows = await db
      .select()
      .from(complaintsTable)
      .where(
        and(
          eq(complaintsTable.customerId, customerId),
          eq(complaintsTable.isDeleted, false),
        ),
      )
      .orderBy(desc(complaintsTable.createdAt));
    res.json(
      ListComplaintsResponse.parse(
        rows.map((r) => ({
          id: r.id,
          code: r.code,
          category: r.category,
          subject: r.subject,
          description: r.description,
          status: r.status,
          attachmentUrl: r.attachmentUrl,
          resolvedAt: iso(r.resolvedAt),
          createdAt: r.createdAt.toISOString(),
          updatedAt: iso(r.updatedAt),
        })),
      ),
    );
  },
);

router.post(
  "/portal/complaints",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId, id: customerUserId, companyId } = req.portalUser!;
    const parsed = CreateComplaintBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    if (d.attachmentUrl && !(await ownsUploadPath(customerId, d.attachmentUrl))) {
      res.status(400).json({ error: "Invalid attachment" });
      return;
    }
    const [row] = await db
      .insert(complaintsTable)
      .values({
        companyId,
        customerId,
        customerUserId,
        code: await genCode("portalComplaint", companyId),
        category: d.category ?? "general",
        subject: d.subject,
        description: d.description ?? null,
        attachmentUrl: d.attachmentUrl ?? null,
      })
      .returning();
    res.status(201).json(
      ListComplaintsResponse.element.parse({
        id: row.id,
        code: row.code,
        category: row.category,
        subject: row.subject,
        description: row.description,
        status: row.status,
        attachmentUrl: row.attachmentUrl,
        resolvedAt: iso(row.resolvedAt),
        createdAt: row.createdAt.toISOString(),
        updatedAt: iso(row.updatedAt),
      }),
    );
  },
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

router.get(
  "/portal/notifications",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    const rows = await db
      .select()
      .from(customerNotificationsTable)
      .where(
        and(
          eq(customerNotificationsTable.customerId, customerId),
          eq(customerNotificationsTable.isDeleted, false),
        ),
      )
      .orderBy(desc(customerNotificationsTable.createdAt));
    res.json(
      GetPortalNotificationsResponse.parse(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          category: r.category,
          link: r.link,
          isRead: r.isRead,
          readAt: iso(r.readAt),
          createdAt: r.createdAt.toISOString(),
        })),
      ),
    );
  },
);

router.post(
  "/portal/notifications/:id/read",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    const id = String(req.params.id);
    const result = await db
      .update(customerNotificationsTable)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(customerNotificationsTable.id, id),
          eq(customerNotificationsTable.customerId, customerId),
          eq(customerNotificationsTable.isDeleted, false),
        ),
      )
      .returning({ id: customerNotificationsTable.id });
    if (result.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  },
);

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

router.get(
  "/portal/support-tickets",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    const rows = await db
      .select()
      .from(supportTicketsTable)
      .where(
        and(
          eq(supportTicketsTable.customerId, customerId),
          eq(supportTicketsTable.isDeleted, false),
        ),
      )
      .orderBy(desc(supportTicketsTable.createdAt));
    res.json(
      ListSupportTicketsResponse.parse(
        rows.map((r) => ({
          id: r.id,
          code: r.code,
          subject: r.subject,
          category: r.category,
          priority: r.priority,
          status: r.status,
          closedAt: iso(r.closedAt),
          createdAt: r.createdAt.toISOString(),
          updatedAt: iso(r.updatedAt),
        })),
      ),
    );
  },
);

router.post(
  "/portal/support-tickets",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId, id: customerUserId, companyId } = req.portalUser!;
    const parsed = CreateSupportTicketBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const names = await customerNameFields(customerId);

    const ticket = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(supportTicketsTable)
        .values({
          companyId,
          customerId,
          customerUserId,
          code: await genCode("portalTicket", companyId),
          subject: d.subject,
          category: d.category ?? "general",
          priority: d.priority ?? "medium",
        })
        .returning();
      await tx.insert(supportTicketMessagesTable).values({
        companyId,
        ticketId: t.id,
        customerId,
        authorType: "customer",
        authorId: customerUserId,
        authorName: names.customerName,
        body: d.body,
      });
      return t;
    });

    res.status(201).json(
      ListSupportTicketsResponse.element.parse({
        id: ticket.id,
        code: ticket.code,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        closedAt: iso(ticket.closedAt),
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: iso(ticket.updatedAt),
      }),
    );
  },
);

router.get(
  "/portal/support-tickets/:id",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    const id = String(req.params.id);
    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(
        and(
          eq(supportTicketsTable.id, id),
          eq(supportTicketsTable.customerId, customerId),
          eq(supportTicketsTable.isDeleted, false),
        ),
      );
    if (!ticket) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const messages = await db
      .select()
      .from(supportTicketMessagesTable)
      .where(
        and(
          eq(supportTicketMessagesTable.ticketId, ticket.id),
          eq(supportTicketMessagesTable.customerId, customerId),
          eq(supportTicketMessagesTable.isDeleted, false),
        ),
      )
      .orderBy(asc(supportTicketMessagesTable.createdAt));

    res.json(
      GetSupportTicketResponse.parse({
        ticket: {
          id: ticket.id,
          code: ticket.code,
          subject: ticket.subject,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          closedAt: iso(ticket.closedAt),
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: iso(ticket.updatedAt),
        },
        messages: messages.map((m) => ({
          id: m.id,
          ticketId: m.ticketId,
          authorType: m.authorType,
          authorName: m.authorName,
          body: m.body,
          attachmentUrl: m.attachmentUrl,
          createdAt: m.createdAt.toISOString(),
        })),
      }),
    );
  },
);

router.post(
  "/portal/support-tickets/:id/messages",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId, id: customerUserId, companyId } = req.portalUser!;
    const parsed = CreateSupportTicketMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const id = String(req.params.id);
    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(
        and(
          eq(supportTicketsTable.id, id),
          eq(supportTicketsTable.customerId, customerId),
          eq(supportTicketsTable.isDeleted, false),
        ),
      );
    if (!ticket) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (
      parsed.data.attachmentUrl &&
      !(await ownsUploadPath(customerId, parsed.data.attachmentUrl))
    ) {
      res.status(400).json({ error: "Invalid attachment" });
      return;
    }
    const names = await customerNameFields(customerId);
    await db.transaction(async (tx) => {
      await tx.insert(supportTicketMessagesTable).values({
        companyId,
        ticketId: ticket.id,
        customerId,
        authorType: "customer",
        authorId: customerUserId,
        authorName: names.customerName,
        body: parsed.data.body,
        attachmentUrl: parsed.data.attachmentUrl ?? null,
      });
      // Re-open the ticket if a customer replies after it was resolved/closed.
      if (ticket.status === "closed" || ticket.status === "resolved") {
        await tx
          .update(supportTicketsTable)
          .set({ status: "open", closedAt: null })
          .where(eq(supportTicketsTable.id, ticket.id));
      }
    });
    res.status(201).json({ success: true });
  },
);

// ---------------------------------------------------------------------------
// Mobile (P18)
// ---------------------------------------------------------------------------

router.post(
  "/portal/device-tokens",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId, id: customerUserId, companyId } = req.portalUser!;
    const parsed = RegisterDeviceTokenBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const [existing] = await db
      .select({ id: customerDeviceTokensTable.id })
      .from(customerDeviceTokensTable)
      .where(
        and(
          eq(customerDeviceTokensTable.customerId, customerId),
          eq(customerDeviceTokensTable.token, d.token),
        ),
      );
    if (existing) {
      await db
        .update(customerDeviceTokensTable)
        .set({
          customerUserId,
          platform: d.platform ?? "web",
          deviceName: d.deviceName ?? null,
          isDeleted: false,
          isActive: true,
          lastSeenAt: new Date(),
        })
        .where(eq(customerDeviceTokensTable.id, existing.id));
    } else {
      await db.insert(customerDeviceTokensTable).values({
        companyId,
        customerId,
        customerUserId,
        token: d.token,
        platform: d.platform ?? "web",
        deviceName: d.deviceName ?? null,
      });
    }
    res.json({ success: true });
  },
);

// P18 file/image upload: presigned-URL flow. The client requests an upload
// target (uploadUrl = presigned PUT to GCS, fileUrl = the path to store on the
// record and use later for serving), uploads bytes directly to GCS, then saves
// fileUrl on the maintenance request / complaint / ticket.
router.post(
  "/portal/uploads",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const parsed = UploadPortalFileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { customerId, id: customerUserId, companyId } = req.portalUser!;
    try {
      // The file does not exist yet (presigned PUT). Return the normalized
      // `/objects/...` path as fileUrl; the client uploads bytes directly to GCS
      // then stores fileUrl on the maintenance request / complaint / ticket
      // message. We record an immutable owner mapping (objectPath -> customer)
      // here so that both attachment writes and file serving can authorize
      // against the path the server actually minted for THIS customer — a
      // customer can never reference or read another customer's object.
      const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
      const fileUrl = objectStorageService.normalizeObjectEntityPath(uploadUrl);
      await db.insert(customerUploadsTable).values({
        companyId,
        customerId,
        customerUserId,
        objectPath: fileUrl,
        fileName: parsed.data.fileName ?? null,
        contentType: parsed.data.contentType ?? null,
      });
      res.json(UploadPortalFileResponse.parse({ uploadUrl, fileUrl }));
    } catch (error) {
      req.log.error({ err: error }, "Error generating portal upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

// Serve a previously uploaded portal object. Customer-scoped: the file is only
// served if it is referenced by a record (maintenance request, complaint, or
// ticket message) belonging to the authenticated customer — so a customer can
// never read another customer's attachment even by guessing its path.
router.get(
  "/portal/files/*objectPath",
  requireCustomerAuth,
  async (req, res): Promise<void> => {
    const { customerId } = req.portalUser!;
    try {
      const raw = req.params.objectPath;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      const objectPath = `/objects/${wildcardPath}`;

      // Authorize against the immutable upload owner mapping, not against
      // forgeable record references: the object is served only if it was minted
      // for THIS customer by /portal/uploads.
      const [owned] = await db
        .select({ id: customerUploadsTable.id })
        .from(customerUploadsTable)
        .where(
          and(
            eq(customerUploadsTable.customerId, customerId),
            eq(customerUploadsTable.objectPath, objectPath),
          ),
        )
        .limit(1);
      if (!owned) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      const response = await objectStorageService.downloadObject(objectFile);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving portal object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;
