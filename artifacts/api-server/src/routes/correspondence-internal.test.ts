import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  correspondenceTable,
  correspondenceRecipientsTable,
  employeesTable,
  jobTitlesTable,
  notificationsTable,
  rolesTable,
  userRolesTable,
  usersTable,
} from "@workspace/db";
import app from "../app";
import { ACCESS_COOKIE, signAccessToken, hashPassword } from "../lib/auth";

/**
 * Internal correspondence, exercised against a real organisation chart.
 *
 * Everything here is FIXTURE data, tagged with a per-run marker and removed in
 * `afterAll`. No real employee is promoted, no real reporting line is edited —
 * the chart below exists only for the length of this file, which is the only
 * honest way to test rules that depend on a hierarchy the seed data does not
 * have.
 *
 * The fixture chart:
 *
 *   chairman  (job title flagged `chairman`)
 *        ^
 *   execDir   (job title flagged `executive_director`)
 *        ^
 *   manager ......... peerManager      (two department heads)
 *        ^
 *   staff
 */

const tag = `corrtest-${Date.now()}`;
const COMPANY = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY = "22222222-2222-4222-8222-222222222222";

const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${tag.slice(-12).padStart(12, "0")}`;

const titleChairmanId = id(1);
const titleExecId = id(2);
const titleManagerId = id(3);

const empChairmanId = id(10);
const empExecId = id(11);
const empManagerId = id(12);
const empPeerId = id(13);
const empStaffId = id(14);
const empOtherCoId = id(15);

const userChairmanId = id(20);
const userExecId = id(21);
const userManagerId = id(22);
const userPeerId = id(23);
const userStaffId = id(24);
const userOtherCoId = id(25);
const userNoEmployeeId = id(26);

const roleId = id(30);

const allTitleIds = [titleChairmanId, titleExecId, titleManagerId];
const allEmpIds = [empChairmanId, empExecId, empManagerId, empPeerId, empStaffId, empOtherCoId];
const allUserIds = [
  userChairmanId,
  userExecId,
  userManagerId,
  userPeerId,
  userStaffId,
  userOtherCoId,
  userNoEmployeeId,
];

/** Ids created by the tests themselves, cleaned up at the end. */
const created: string[] = [];

/** Access-token cookie for a user id — same helper shape the other suites use. */
const authCookie = (userId: string): string => `${ACCESS_COOKIE}=${signAccessToken(userId)}`;

const api = (userId: string) => ({
  get: (url: string) => request(app).get(url).set("Cookie", authCookie(userId)),
  post: (url: string) => request(app).post(url).set("Cookie", authCookie(userId)),
});

beforeAll(async () => {
  const passwordHash = await hashPassword("Test@123456");

  await db.insert(rolesTable).values([
    {
      id: roleId,
      name: `${tag}-corr`,
      permissions: ["correspondence.view", "correspondence.create", "correspondence.update"],
    },
  ]);

  await db.insert(jobTitlesTable).values([
    { id: titleChairmanId, companyId: COMPANY, code: `${tag}-CH`, name: "Chairman", nameAr: "رئيس مجلس الإدارة", leadershipRole: "chairman" },
    { id: titleExecId, companyId: COMPANY, code: `${tag}-ED`, name: "Executive Director", nameAr: "المدير التنفيذي", leadershipRole: "executive_director" },
    { id: titleManagerId, companyId: COMPANY, code: `${tag}-MG`, name: "Manager", nameAr: "مدير" },
  ]);

  await db.insert(employeesTable).values([
    { id: empChairmanId, companyId: COMPANY, code: `${tag}-E1`, firstName: "Fixture", lastName: "Chairman", jobTitleId: titleChairmanId },
    { id: empExecId, companyId: COMPANY, code: `${tag}-E2`, firstName: "Fixture", lastName: "Exec", jobTitleId: titleExecId, managerEmployeeId: empChairmanId },
    { id: empManagerId, companyId: COMPANY, code: `${tag}-E3`, firstName: "Fixture", lastName: "Manager", jobTitleId: titleManagerId, managerEmployeeId: empExecId },
    { id: empPeerId, companyId: COMPANY, code: `${tag}-E4`, firstName: "Fixture", lastName: "Peer", jobTitleId: titleManagerId, managerEmployeeId: empExecId },
    { id: empStaffId, companyId: COMPANY, code: `${tag}-E5`, firstName: "Fixture", lastName: "Staff", managerEmployeeId: empManagerId },
    { id: empOtherCoId, companyId: OTHER_COMPANY, code: `${tag}-E6`, firstName: "Fixture", lastName: "OtherCo" },
  ]);

  await db.insert(usersTable).values([
    { id: userChairmanId, username: `${tag}-chair`, fullName: "Fixture Chairman", email: `${tag}-1@t.co`, passwordHash, employeeId: empChairmanId, companyId: COMPANY },
    { id: userExecId, username: `${tag}-exec`, fullName: "Fixture Exec", email: `${tag}-2@t.co`, passwordHash, employeeId: empExecId, companyId: COMPANY },
    { id: userManagerId, username: `${tag}-mgr`, fullName: "Fixture Manager", email: `${tag}-3@t.co`, passwordHash, employeeId: empManagerId, companyId: COMPANY },
    { id: userPeerId, username: `${tag}-peer`, fullName: "Fixture Peer", email: `${tag}-4@t.co`, passwordHash, employeeId: empPeerId, companyId: COMPANY },
    { id: userStaffId, username: `${tag}-staff`, fullName: "Fixture Staff", email: `${tag}-5@t.co`, passwordHash, employeeId: empStaffId, companyId: COMPANY },
    { id: userOtherCoId, username: `${tag}-other`, fullName: "Fixture OtherCo", email: `${tag}-6@t.co`, passwordHash, employeeId: empOtherCoId, companyId: OTHER_COMPANY },
    { id: userNoEmployeeId, username: `${tag}-noemp`, fullName: "Fixture NoEmployee", email: `${tag}-7@t.co`, passwordHash, companyId: COMPANY },
  ]);

  await db
    .insert(userRolesTable)
    .values(allUserIds.map((userId) => ({ userId, roleId })));
});

afterAll(async () => {
  if (created.length) {
    await db
      .delete(correspondenceRecipientsTable)
      .where(inArray(correspondenceRecipientsTable.correspondenceId, created));
    await db.delete(correspondenceTable).where(inArray(correspondenceTable.id, created));
  }
  await db.delete(notificationsTable).where(inArray(notificationsTable.recipientUserId, allUserIds));
  await db.delete(userRolesTable).where(inArray(userRolesTable.userId, allUserIds));
  await db.delete(usersTable).where(inArray(usersTable.id, allUserIds));
  await db.delete(employeesTable).where(inArray(employeesTable.id, allEmpIds));
  await db.delete(jobTitlesTable).where(inArray(jobTitlesTable.id, allTitleIds));
  await db.delete(rolesTable).where(eq(rolesTable.id, roleId));
  await pool.end();
});

/** Send and remember the id so cleanup can find it. */
async function send(
  fromUserId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await api(fromUserId)
    .post("/api/internal-correspondence")
    .send({ companyId: COMPANY, subject: `${tag} subject`, send: true, ...body });
  if (res.body?.id) created.push(String(res.body.id));
  return { status: res.status, body: res.body };
}

describe("leadership resolution comes from the post, never a person", () => {
  it("resolves the current holder of each institutional post", async () => {
    const res = await api(userStaffId).get(
      `/api/internal-correspondence/directory?companyId=${COMPANY}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.leadership.chairman.map((e: { id: string }) => e.id)).toEqual([empChairmanId]);
    expect(res.body.leadership.executiveDirector.map((e: { id: string }) => e.id)).toEqual([
      empExecId,
    ]);
  });

  it("follows the post to a new holder when the title moves", async () => {
    // Succession: give the chairman title to the peer manager instead.
    await db
      .update(employeesTable)
      .set({ jobTitleId: titleChairmanId })
      .where(eq(employeesTable.id, empPeerId));
    await db
      .update(employeesTable)
      .set({ jobTitleId: titleManagerId })
      .where(eq(employeesTable.id, empChairmanId));

    const res = await api(userStaffId).get(
      `/api/internal-correspondence/directory?companyId=${COMPANY}`,
    );
    expect(res.body.leadership.chairman.map((e: { id: string }) => e.id)).toEqual([empPeerId]);

    // Put the chart back for the remaining tests.
    await db
      .update(employeesTable)
      .set({ jobTitleId: titleChairmanId })
      .where(eq(employeesTable.id, empChairmanId));
    await db
      .update(employeesTable)
      .set({ jobTitleId: titleManagerId })
      .where(eq(employeesTable.id, empPeerId));
  });
});

describe("who may write to whom", () => {
  it("staff may write upward to their own manager", async () => {
    const res = await send(userStaffId, { to: [empManagerId] });
    expect(res.status).toBe(201);
  });

  it("staff may not write to an unrelated colleague", async () => {
    const res = await send(userStaffId, { to: [empPeerId] });
    expect(res.status).toBe(403);
    expect(res.body.rejected).toContain(empPeerId);
  });

  it("a manager may write across to a peer manager", async () => {
    const res = await send(userManagerId, { to: [empPeerId] });
    expect(res.status).toBe(201);
  });

  it("a manager may write to the executive director", async () => {
    const res = await send(userManagerId, { to: [empExecId] });
    expect(res.status).toBe(201);
  });

  it("the executive director may write to the chairman", async () => {
    const res = await send(userExecId, { to: [empChairmanId] });
    expect(res.status).toBe(201);
  });

  it("the chairman may write downward to a manager", async () => {
    const res = await send(userChairmanId, { to: [empManagerId] });
    expect(res.status).toBe(201);
  });

  it("staff may not reach the chairman directly", async () => {
    const res = await send(userStaffId, { to: [empChairmanId] });
    expect(res.status).toBe(403);
  });

  it("a login with no employee record is told what to fix, not simply refused", async () => {
    const res = await api(userNoEmployeeId).get(
      `/api/internal-correspondence/directory?companyId=${COMPANY}`,
    );
    expect(res.status).toBe(409);
    expect(String(res.body.error)).toContain("not linked to an employee");
  });
});

describe("mailboxes", () => {
  it("delivers to the recipient inbox and shows in the sender's sent box", async () => {
    const sent = await send(userStaffId, { to: [empManagerId], subject: `${tag} inbox check` });
    expect(sent.status).toBe(201);

    const inbox = await api(userManagerId).get(
      `/api/internal-correspondence?view=inbox&companyId=${COMPANY}&search=${tag}`,
    );
    expect(inbox.status).toBe(200);
    expect(inbox.body.data.map((r: { id: string }) => r.id)).toContain(sent.body.id);

    const sentBox = await api(userStaffId).get(
      `/api/internal-correspondence?view=sent&companyId=${COMPANY}&search=${tag}`,
    );
    expect(sentBox.body.data.map((r: { id: string }) => r.id)).toContain(sent.body.id);
  });

  it("keeps a draft out of the recipient's inbox until it is sent", async () => {
    const res = await api(userStaffId)
      .post("/api/internal-correspondence")
      .send({ companyId: COMPANY, subject: `${tag} draft`, to: [empManagerId], send: false });
    expect(res.status).toBe(201);
    created.push(String(res.body.id));

    const drafts = await api(userStaffId).get(
      `/api/internal-correspondence?view=drafts&companyId=${COMPANY}&search=${tag}`,
    );
    expect(drafts.body.data.map((r: { id: string }) => r.id)).toContain(res.body.id);

    const inbox = await api(userManagerId).get(
      `/api/internal-correspondence?view=inbox&companyId=${COMPANY}&search=${tag}`,
    );
    expect(inbox.body.data.map((r: { id: string }) => r.id)).not.toContain(res.body.id);

    const sendRes = await api(userStaffId).post(
      `/api/internal-correspondence/${res.body.id}/send`,
    );
    expect(sendRes.status).toBe(200);

    const after = await api(userManagerId).get(
      `/api/internal-correspondence?view=inbox&companyId=${COMPANY}&search=${tag}`,
    );
    expect(after.body.data.map((r: { id: string }) => r.id)).toContain(res.body.id);
  });

  it("filters by priority and finds by search", async () => {
    const urgent = await send(userStaffId, {
      to: [empManagerId],
      subject: `${tag} urgent matter`,
      priority: "urgent",
    });
    const filtered = await api(userManagerId).get(
      `/api/internal-correspondence?view=inbox&companyId=${COMPANY}&priority=urgent&search=${tag}`,
    );
    expect(filtered.body.data.map((r: { id: string }) => r.id)).toContain(urgent.body.id);

    const found = await api(userManagerId).get(
      `/api/internal-correspondence?view=inbox&companyId=${COMPANY}&search=urgent matter`,
    );
    expect(found.body.data.map((r: { id: string }) => r.id)).toContain(urgent.body.id);
  });
});

describe("thread, read state and replies", () => {
  it("keeps a reply in the same thread and marks the original read on open", async () => {
    const first = await send(userStaffId, { to: [empManagerId], subject: `${tag} thread root` });
    const threadId = String(first.body.threadId);
    expect(threadId).toBe(String(first.body.id));

    const opened = await api(userManagerId).get(`/api/internal-correspondence/${first.body.id}`);
    expect(opened.status).toBe(200);
    const mine = opened.body.correspondence.recipients.find(
      (r: { employeeId: string }) => r.employeeId === empManagerId,
    );
    expect(mine.readAt).toBeTruthy();

    const reply = await send(userManagerId, {
      to: [empStaffId],
      subject: `RE: ${tag}`,
      parentId: first.body.id,
    });
    expect(reply.status).toBe(201);
    expect(String(reply.body.threadId)).toBe(threadId);

    const thread = await api(userStaffId).get(`/api/internal-correspondence/${first.body.id}`);
    expect(thread.body.thread.length).toBeGreaterThanOrEqual(2);
  });

  it("forwards as a new message in the same thread, gated by the same rule", async () => {
    const first = await send(userStaffId, { to: [empManagerId], subject: `${tag} to forward` });

    const bad = await api(userManagerId)
      .post(`/api/internal-correspondence/${first.body.id}/forward`)
      .send({ to: [empChairmanId] });
    expect(bad.status).toBe(403);

    const ok = await api(userManagerId)
      .post(`/api/internal-correspondence/${first.body.id}/forward`)
      .send({ to: [empPeerId] });
    expect(ok.status).toBe(201);
    created.push(String(ok.body.id));
    expect(String(ok.body.threadId)).toBe(String(first.body.threadId));
  });
});

describe("notifications and unread count", () => {
  it("raises a notification for the recipient and counts it as unread", async () => {
    const before = await api(userManagerId).get("/api/internal-correspondence/unread-count");
    const sent = await send(userStaffId, { to: [empManagerId], subject: `${tag} notify` });

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.recipientUserId, userManagerId),
          eq(notificationsTable.sourceId, String(sent.body.id)),
        ),
      );
    expect(rows.length).toBe(1);
    expect(rows[0].category).toBe("correspondence");

    const after = await api(userManagerId).get("/api/internal-correspondence/unread-count");
    expect(after.body.unread).toBeGreaterThan(before.body.unread);
  });
});

describe("isolation and tampering", () => {
  it("refuses a correspondence the caller is not part of", async () => {
    const sent = await send(userStaffId, { to: [empManagerId], subject: `${tag} private` });
    const res = await api(userPeerId).get(`/api/internal-correspondence/${sent.body.id}`);
    expect(res.status).toBe(404);
  });

  it("answers the same for a foreign id as for a missing one", async () => {
    const missing = await api(userPeerId).get(
      "/api/internal-correspondence/00000000-0000-4000-8000-000000000000",
    );
    expect(missing.status).toBe(404);
  });

  it("does not leak a thread to someone outside it", async () => {
    const first = await send(userStaffId, { to: [empManagerId], subject: `${tag} closed thread` });
    await send(userManagerId, {
      to: [empStaffId],
      subject: `RE: ${tag}`,
      parentId: first.body.id,
    });
    const outsider = await api(userPeerId).get(`/api/internal-correspondence/${first.body.id}`);
    expect(outsider.status).toBe(404);
  });

  it("keeps another company's correspondence out of the inbox", async () => {
    await send(userStaffId, { to: [empManagerId], subject: `${tag} company scoped` });
    const other = await api(userOtherCoId).get(
      `/api/internal-correspondence?view=inbox&companyId=${OTHER_COMPANY}&search=${tag}`,
    );
    expect(other.status).toBe(200);
    expect(other.body.data.length).toBe(0);
  });

  it("refuses an unauthenticated caller", async () => {
    const res = await request(app).get("/api/internal-correspondence");
    expect(res.status).toBe(401);
  });
});

describe("idempotency", () => {
  it("returns the first message instead of sending a second copy", async () => {
    const key = `${tag}-idem-1`;
    const first = await send(userStaffId, {
      to: [empManagerId],
      subject: `${tag} idempotent`,
      idempotencyKey: key,
    });
    expect(first.status).toBe(201);

    const repeat = await api(userStaffId)
      .post("/api/internal-correspondence")
      .send({
        companyId: COMPANY,
        subject: `${tag} idempotent`,
        to: [empManagerId],
        send: true,
        idempotencyKey: key,
      });
    expect(repeat.status).toBe(200);
    expect(repeat.body.replayed).toBe(true);
    expect(String(repeat.body.id)).toBe(String(first.body.id));

    const rows = await db
      .select()
      .from(correspondenceTable)
      .where(
        and(
          eq(correspondenceTable.senderEmployeeId, empStaffId),
          eq(correspondenceTable.refNumber, key),
        ),
      );
    expect(rows.length).toBe(1);
  });
});

describe("archive", () => {
  it("archives for the caller without removing the record", async () => {
    const sent = await send(userStaffId, { to: [empManagerId], subject: `${tag} archive me` });
    const res = await api(userManagerId).post(
      `/api/internal-correspondence/${sent.body.id}/archive`,
    );
    expect(res.status).toBe(200);

    const archived = await api(userManagerId).get(
      `/api/internal-correspondence?view=archived&companyId=${COMPANY}&search=${tag}`,
    );
    expect(archived.body.data.map((r: { id: string }) => r.id)).toContain(sent.body.id);

    const still = await api(userManagerId).get(`/api/internal-correspondence/${sent.body.id}`);
    expect(still.status).toBe(200);
  });
});
