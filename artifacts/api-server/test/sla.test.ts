import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  companiesTable,
  slaPoliciesTable,
  serviceEscalationsTable,
  complaintsTable,
  customersTable,
  notificationsTable,
  numberSequencesTable,
} from "@workspace/db";
import {
  resolvePolicy,
  applyOnCreate,
  stampFirstResponse,
  sweepBreaches,
  slaSources,
} from "../src/lib/sla";

/**
 * Service level agreements.
 *
 * `sla_policies` and `service_escalations` existed as registers and the service
 * records carried `dueAt`, `firstResponseAt` and `escalationLevel` — with
 * nothing writing any of them. So the tests that matter are not "does a policy
 * row save"; they are: does a policy actually reach a record, does the right
 * policy win when several could apply, and does a missed deadline produce
 * exactly one escalation however often the sweep runs.
 *
 * Everything here is FIXTURE data under a per-run tag, removed in `afterAll`.
 */

const tag = `slatest-${Date.now()}`;
const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${tag.slice(-12).padStart(12, "0")}`;

const COMPANY = id(1);
const CUSTOMER = id(2);

const policyAll = id(10);
const policyChannel = id(11);
const policyChannelPriority = id(12);

const complaintOnTime = id(20);
const complaintBreached = id(21);

const HOUR_MS = 3_600_000;

beforeAll(async () => {
  await db
    .insert(companiesTable)
    .values({ id: COMPANY, code: `${tag}-C`, name: `${tag} Company`, nameAr: "شركة اختبار" })
    .onConflictDoNothing();

  await db
    .insert(customersTable)
    .values({
      id: CUSTOMER,
      companyId: COMPANY,
      code: `${tag}-CUST`,
      fullName: `${tag} Customer`,
      nameAr: "عميل اختبار",
    })
    .onConflictDoNothing();

  // Three policies that all *could* apply to a high-priority complaint. Only
  // the most specific one should.
  await db.insert(slaPoliciesTable).values([
    {
      id: policyAll,
      companyId: COMPANY,
      code: `${tag}-ALL`,
      name: "Catch all",
      nameAr: "عام",
      channel: "all",
      priority: "all",
      firstResponseHours: "24",
      resolutionHours: "72",
    },
    {
      id: policyChannel,
      companyId: COMPANY,
      code: `${tag}-CH`,
      name: "Complaints",
      nameAr: "الشكاوى",
      channel: "complaint",
      priority: "all",
      firstResponseHours: "8",
      resolutionHours: "24",
    },
    {
      id: policyChannelPriority,
      companyId: COMPANY,
      code: `${tag}-CHP`,
      name: "Urgent complaints",
      nameAr: "شكاوى عاجلة",
      channel: "complaint",
      priority: "high",
      firstResponseHours: "1",
      resolutionHours: "4",
    },
  ]);
});

afterAll(async () => {
  // The sweep notifies and draws an escalation code, so the fixture company is
  // referenced by rows this file never inserted directly. They are removed
  // here in dependency order — the company FK refuses the delete otherwise,
  // which is the constraint doing exactly what it exists for.
  await db.delete(notificationsTable).where(eq(notificationsTable.companyId, COMPANY));
  await db.delete(numberSequencesTable).where(eq(numberSequencesTable.companyId, COMPANY));
  await db.delete(serviceEscalationsTable).where(eq(serviceEscalationsTable.companyId, COMPANY));
  await db.delete(complaintsTable).where(eq(complaintsTable.companyId, COMPANY));
  await db
    .delete(slaPoliciesTable)
    .where(inArray(slaPoliciesTable.id, [policyAll, policyChannel, policyChannelPriority]));
  await db.delete(customersTable).where(eq(customersTable.id, CUSTOMER));
  await db.delete(companiesTable).where(eq(companiesTable.id, COMPANY));
});

describe("which policy applies", () => {
  it("prefers the policy naming both the channel and the priority", async () => {
    const p = await resolvePolicy(db, COMPANY, "complaint", "high");
    expect(p?.id).toBe(policyChannelPriority);
    expect(p?.resolutionMs).toBe(4 * HOUR_MS);
  });

  it("falls back to the channel policy when the priority does not match", async () => {
    const p = await resolvePolicy(db, COMPANY, "complaint", "low");
    expect(p?.id).toBe(policyChannel);
  });

  it("falls back to the catch-all for a channel with no policy of its own", async () => {
    const p = await resolvePolicy(db, COMPANY, "supportTicket", "high");
    expect(p?.id).toBe(policyAll);
  });

  it("lets the stricter promise win a tie, whatever the row order", async () => {
    // Two policies can be equally specific. Without a rule the answer would be
    // whichever was inserted first, so the same configuration would give two
    // installations different deadlines.
    const p = await resolvePolicy(db, COMPANY, "supportTicket", "all");
    expect(p?.id).toBe(policyAll);
    expect(p?.resolutionMs).toBe(72 * HOUR_MS);
  });

  it("returns nothing for a company with no policies", async () => {
    // No policy is not the same as a zero-hour policy: it means nothing was
    // promised, so nothing can be breached.
    const p = await resolvePolicy(db, id(99), "complaint", "high");
    expect(p).toBeNull();
  });
});

describe("the deadline a record starts with", () => {
  it("counts from the record's own creation time, not from now", async () => {
    // An imported or replayed record must not get a fresh clock.
    const createdAt = new Date(Date.now() - 10 * HOUR_MS);
    const stamp = await applyOnCreate(db, "complaint", {
      companyId: COMPANY,
      priority: "high",
      createdAt,
    });
    expect(stamp.slaPolicyId).toBe(policyChannelPriority);
    expect(stamp.dueAt?.getTime()).toBe(createdAt.getTime() + 4 * HOUR_MS);
  });

  it("leaves a record without a policy undated", async () => {
    const stamp = await applyOnCreate(db, "complaint", { companyId: id(99), priority: "high" });
    expect(stamp).toEqual({ slaPolicyId: null, dueAt: null });
  });
});

describe("the first response", () => {
  it("is stamped when someone takes it on", () => {
    expect(stampFirstResponse({}, { assignedToUserId: id(50) })).not.toBeNull();
    expect(stampFirstResponse({}, { status: "in_progress" })).not.toBeNull();
  });

  it("is not stamped by an edit that does no work", () => {
    expect(stampFirstResponse({}, { status: "open" })).toBeNull();
    expect(stampFirstResponse({}, {})).toBeNull();
  });

  it("is never revised once set", () => {
    // The value records when the customer actually heard back; moving it would
    // rewrite a fact.
    const already = new Date("2026-01-01T00:00:00Z");
    expect(stampFirstResponse({ firstResponseAt: already }, { status: "resolved" })).toBeNull();
  });
});

describe("a missed deadline", () => {
  beforeAll(async () => {
    const now = Date.now();
    await db.insert(complaintsTable).values([
      {
        id: complaintOnTime,
        companyId: COMPANY,
        customerId: CUSTOMER,
        code: `${tag}-OK`,
        subject: "Still within its deadline",
        status: "open",
        slaPolicyId: policyChannelPriority,
        createdAt: new Date(now - HOUR_MS),
        dueAt: new Date(now + 3 * HOUR_MS),
      },
      {
        id: complaintBreached,
        companyId: COMPANY,
        customerId: CUSTOMER,
        code: `${tag}-LATE`,
        subject: "Past its deadline",
        status: "open",
        slaPolicyId: policyChannelPriority,
        createdAt: new Date(now - 5 * HOUR_MS),
        dueAt: new Date(now - HOUR_MS),
      },
    ]);
  });

  it("escalates the late record and leaves the on-time one alone", async () => {
    const r = await sweepBreaches("complaint", COMPANY);
    expect(r.breached).toBe(1);
    expect(r.raised).toBe(1);

    const rows = await db
      .select()
      .from(serviceEscalationsTable)
      .where(
        and(
          eq(serviceEscalationsTable.companyId, COMPANY),
          eq(serviceEscalationsTable.sourceId, complaintBreached),
        ),
      );
    expect(rows).toHaveLength(1);
    // The code comes from the central engine, so it is padded and prefixed —
    // never a timestamp.
    expect(rows[0].code).toMatch(/^[A-Z]+-/);
    expect(rows[0].code).not.toMatch(/\d{13}/);
  });

  it("does not escalate the same breach twice however often it runs", async () => {
    // The sweep runs every fifteen minutes; a breach must produce one
    // escalation, not ninety-six a day.
    const second = await sweepBreaches("complaint", COMPANY);
    const third = await sweepBreaches("complaint", COMPANY);
    expect(second.raised).toBe(0);
    expect(third.raised).toBe(0);

    const rows = await db
      .select()
      .from(serviceEscalationsTable)
      .where(eq(serviceEscalationsTable.sourceId, complaintBreached));
    expect(rows).toHaveLength(1);
  });

  it("raises a second level once it has slipped by as long again", async () => {
    // The level follows how far past the deadline it is, not how long the
    // sweep has been running.
    // Far enough that the breach has slipped by a second full span. The other
    // fixture complaint becomes late at this clock too, so the assertion is
    // about this record's escalations rather than the sweep's total.
    const muchLater = new Date(Date.now() + 4 * HOUR_MS);
    await sweepBreaches("complaint", COMPANY, muchLater);

    const rows = await db
      .select()
      .from(serviceEscalationsTable)
      .where(eq(serviceEscalationsTable.sourceId, complaintBreached));
    expect(rows).toHaveLength(2);
    expect(rows.map((x) => Number(x.level)).sort()).toEqual([1, 2]);
  });

  it("stops caring once the record is closed", async () => {
    await db
      .update(complaintsTable)
      .set({ status: "resolved" })
      .where(eq(complaintsTable.id, complaintBreached));
    const before = await db
      .select()
      .from(serviceEscalationsTable)
      .where(eq(serviceEscalationsTable.sourceId, complaintBreached));
    // Far enough ahead that the on-time record is late too, which is the point:
    // the closed one must be skipped while the sweep still does its work.
    await sweepBreaches("complaint", COMPANY, new Date(Date.now() + 100 * HOUR_MS));
    const after = await db
      .select()
      .from(serviceEscalationsTable)
      .where(eq(serviceEscalationsTable.sourceId, complaintBreached));
    expect(after).toHaveLength(before.length);
  });
});

describe("coverage", () => {
  it("governs every service register that carries a deadline", () => {
    // A register with dueAt columns and no binding here would silently never
    // be swept.
    expect(slaSources().sort()).toEqual(["complaint", "maintenanceRequest", "supportTicket"]);
  });
});
