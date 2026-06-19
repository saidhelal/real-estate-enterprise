import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  usersTable,
  rolesTable,
  userRolesTable,
  userScopesTable,
  notificationsTable,
} from "@workspace/db";
import app from "../app";
import { ACCESS_COOKIE, signAccessToken, hashPassword } from "../lib/auth";

// Integration tests for the Notification Center access boundaries.
//
// The notification inbox enforces per-user scope in `scopeFilter`:
//   - "*" or "notifications.viewAll"  -> sees every notification
//   - a user with department scope    -> own rows + their department's rows
//   - any other authenticated user    -> own rows only
// Cross-scope get/patch/delete/restore must 404, and manual creation (POST)
// requires the `notifications.create` permission.
//
// All fixtures are tagged with a unique per-run sourceRef so list assertions can
// filter to exactly this run's rows (the dev DB may contain unrelated data).

const RUN = randomUUID().slice(0, 8);
const tag = `notif-test-${RUN}`;

// Two distinct department ids used to prove department-scope isolation.
const DEPT_A = randomUUID();
const DEPT_B = randomUUID();

// Role ids
const roleNoneId = randomUUID();
const roleViewAllId = randomUUID();
const roleStarId = randomUUID();
const roleCreateId = randomUUID();

// User ids
const userPlainId = randomUUID(); // dept A member, but NO department scope grant
const userDeptId = randomUUID(); // department-scoped to DEPT_A
const userViewAllId = randomUUID(); // notifications.viewAll
const userStarId = randomUUID(); // "*"
const userCreateId = randomUUID(); // notifications.create only
const userOtherAId = randomUUID(); // another DEPT_A member (owns notifOtherA)
const userOtherBId = randomUUID(); // a DEPT_B member (owns notifOtherB)
const userMarkId = randomUUID(); // owns the mark-all-read fixtures

// Notification ids
const notifPlainId = randomUUID(); // owned by userPlain (dept A)
const notifOtherAId = randomUUID(); // owned by userOtherA (dept A)
const notifOtherBId = randomUUID(); // owned by userOtherB (dept B)
const notifDeptOwnId = randomUUID(); // owned by userDept (dept A)
const notifTrashId = randomUUID(); // owned by userPlain, soft-deleted (trash)
const notifOtherTrashId = randomUUID(); // owned by userOtherA, soft-deleted
const notifMark1Id = randomUUID(); // owned by userMark, unread + live
const notifMark2Id = randomUUID(); // owned by userMark, unread + live
const notifMarkTrashId = randomUUID(); // owned by userMark, unread but trashed

const allUserIds = [
  userPlainId,
  userDeptId,
  userViewAllId,
  userStarId,
  userCreateId,
  userOtherAId,
  userOtherBId,
  userMarkId,
];
const allRoleIds = [roleNoneId, roleViewAllId, roleStarId, roleCreateId];
const allNotifIds: string[] = [
  notifPlainId,
  notifOtherAId,
  notifOtherBId,
  notifDeptOwnId,
  notifTrashId,
  notifOtherTrashId,
  notifMark1Id,
  notifMark2Id,
  notifMarkTrashId,
];

/** Build the access-token cookie header for a given user id. */
function authCookie(userId: string): string {
  return `${ACCESS_COOKIE}=${signAccessToken(userId)}`;
}

/** GET /api/notifications scoped to this run via the unique sourceRef tag. */
async function listIds(userId: string, view = "all"): Promise<string[]> {
  const res = await request(app)
    .get("/api/notifications")
    .query({ search: tag, view, pageSize: 200 })
    .set("Cookie", authCookie(userId));
  expect(res.status).toBe(200);
  return (res.body.data as Array<{ id: string }>).map((r) => r.id);
}

beforeAll(async () => {
  const passwordHash = await hashPassword("Test@123456");

  await db.insert(rolesTable).values([
    { id: roleNoneId, name: `${tag}-none`, permissions: [] },
    { id: roleViewAllId, name: `${tag}-viewall`, permissions: ["notifications.viewAll"] },
    { id: roleStarId, name: `${tag}-star`, permissions: ["*"] },
    { id: roleCreateId, name: `${tag}-create`, permissions: ["notifications.create"] },
  ]);

  await db.insert(usersTable).values([
    { id: userPlainId, username: `${tag}-plain`, fullName: "Plain User", email: "p@t.co", passwordHash },
    { id: userDeptId, username: `${tag}-dept`, fullName: "Dept User", email: "d@t.co", passwordHash },
    { id: userViewAllId, username: `${tag}-viewall`, fullName: "ViewAll User", email: "v@t.co", passwordHash },
    { id: userStarId, username: `${tag}-star`, fullName: "Star User", email: "s@t.co", passwordHash },
    { id: userCreateId, username: `${tag}-create`, fullName: "Create User", email: "c@t.co", passwordHash },
    { id: userOtherAId, username: `${tag}-othera`, fullName: "Other A", email: "oa@t.co", passwordHash },
    { id: userOtherBId, username: `${tag}-otherb`, fullName: "Other B", email: "ob@t.co", passwordHash },
    { id: userMarkId, username: `${tag}-mark`, fullName: "Mark User", email: "m@t.co", passwordHash },
  ]);

  await db.insert(userRolesTable).values([
    { userId: userPlainId, roleId: roleNoneId },
    { userId: userDeptId, roleId: roleNoneId },
    { userId: userViewAllId, roleId: roleViewAllId },
    { userId: userStarId, roleId: roleStarId },
    { userId: userCreateId, roleId: roleCreateId },
    { userId: userOtherAId, roleId: roleNoneId },
    { userId: userOtherBId, roleId: roleNoneId },
    { userId: userMarkId, roleId: roleNoneId },
  ]);

  // Only userDept gets a department scope grant (DEPT_A). userPlain belongs to
  // dept A by virtue of its notification's departmentId, but has no scope grant,
  // so it must still see only its own rows.
  await db.insert(userScopesTable).values([
    { userId: userDeptId, scopeType: "department", scopeId: DEPT_A },
  ]);

  await db.insert(notificationsTable).values([
    { id: notifPlainId, recipientUserId: userPlainId, departmentId: DEPT_A, title: "Plain own", sourceRef: tag },
    { id: notifOtherAId, recipientUserId: userOtherAId, departmentId: DEPT_A, title: "Other A dept", sourceRef: tag },
    { id: notifOtherBId, recipientUserId: userOtherBId, departmentId: DEPT_B, title: "Other B dept", sourceRef: tag },
    { id: notifDeptOwnId, recipientUserId: userDeptId, departmentId: DEPT_A, title: "Dept own", sourceRef: tag },
    { id: notifTrashId, recipientUserId: userPlainId, departmentId: DEPT_A, title: "Plain trash", sourceRef: tag, isDeleted: true },
    { id: notifOtherTrashId, recipientUserId: userOtherAId, departmentId: DEPT_A, title: "Other A trash", sourceRef: tag, isDeleted: true },
    { id: notifMark1Id, recipientUserId: userMarkId, title: "Mark unread 1", sourceRef: tag, isRead: false },
    { id: notifMark2Id, recipientUserId: userMarkId, title: "Mark unread 2", sourceRef: tag, isRead: false },
    { id: notifMarkTrashId, recipientUserId: userMarkId, title: "Mark trashed", sourceRef: tag, isRead: false, isDeleted: true },
  ]);
});

afterAll(async () => {
  await db.delete(notificationsTable).where(inArray(notificationsTable.id, allNotifIds));
  await db.delete(userScopesTable).where(inArray(userScopesTable.userId, allUserIds));
  await db.delete(userRolesTable).where(inArray(userRolesTable.userId, allUserIds));
  await db.delete(usersTable).where(inArray(usersTable.id, allUserIds));
  await db.delete(rolesTable).where(inArray(rolesTable.id, allRoleIds));
  await pool.end();
});

describe("notification list scope", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("a regular user sees only their own rows", async () => {
    const ids = await listIds(userPlainId);
    expect(ids).toContain(notifPlainId);
    // Same department (DEPT_A) but no scope grant -> not visible.
    expect(ids).not.toContain(notifOtherAId);
    expect(ids).not.toContain(notifDeptOwnId);
    expect(ids).not.toContain(notifOtherBId);
  });

  it("a department-scoped user sees their department's rows", async () => {
    const ids = await listIds(userDeptId);
    expect(ids).toContain(notifDeptOwnId); // own
    expect(ids).toContain(notifPlainId); // dept A colleague
    expect(ids).toContain(notifOtherAId); // dept A colleague
    // Another department's row is not visible.
    expect(ids).not.toContain(notifOtherBId);
  });

  it("a viewAll user sees all rows", async () => {
    const ids = await listIds(userViewAllId);
    for (const id of [notifPlainId, notifOtherAId, notifOtherBId, notifDeptOwnId]) {
      expect(ids).toContain(id);
    }
  });

  it('a "*" user sees all rows', async () => {
    const ids = await listIds(userStarId);
    for (const id of [notifPlainId, notifOtherAId, notifOtherBId, notifDeptOwnId]) {
      expect(ids).toContain(id);
    }
  });
});

describe("cross-user record access is blocked", () => {
  it("GET another user's notification returns 404", async () => {
    const res = await request(app)
      .get(`/api/notifications/${notifOtherBId}`)
      .set("Cookie", authCookie(userPlainId));
    expect(res.status).toBe(404);
  });

  it("PATCH another user's notification returns 404 and does not mutate it", async () => {
    const res = await request(app)
      .patch(`/api/notifications/${notifOtherBId}`)
      .set("Cookie", authCookie(userPlainId))
      .send({ isRead: true });
    expect(res.status).toBe(404);

    const [row] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, notifOtherBId));
    expect(row.isRead).toBe(false);
  });

  it("DELETE another user's notification returns 404 and does not soft-delete it", async () => {
    const res = await request(app)
      .delete(`/api/notifications/${notifOtherAId}`)
      .set("Cookie", authCookie(userPlainId));
    expect(res.status).toBe(404);

    const [row] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, notifOtherAId));
    expect(row.isDeleted).toBe(false);
  });

  it("restoring another user's trashed notification returns 404", async () => {
    const res = await request(app)
      .post(`/api/notifications/${notifOtherTrashId}/restore`)
      .set("Cookie", authCookie(userPlainId));
    expect(res.status).toBe(404);

    const [row] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, notifOtherTrashId));
    expect(row.isDeleted).toBe(true);
  });
});

describe("owner can manage their own notification", () => {
  it("PATCH own notification succeeds", async () => {
    const res = await request(app)
      .patch(`/api/notifications/${notifPlainId}`)
      .set("Cookie", authCookie(userPlainId))
      .send({ isFavorite: true });
    expect(res.status).toBe(200);
    expect(res.body.isFavorite).toBe(true);
  });

  it("trash -> restore round-trips own notification", async () => {
    const del = await request(app)
      .delete(`/api/notifications/${notifPlainId}`)
      .set("Cookie", authCookie(userPlainId));
    expect(del.status).toBe(200);

    const restore = await request(app)
      .post(`/api/notifications/${notifPlainId}/restore`)
      .set("Cookie", authCookie(userPlainId));
    expect(restore.status).toBe(200);

    // The response schema omits isDeleted, so confirm the round-trip in the DB.
    const [row] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, notifPlainId));
    expect(row.isDeleted).toBe(false);
  });
});

describe("create requires notifications.create", () => {
  it("a user without the permission gets 403", async () => {
    const res = await request(app)
      .post("/api/notifications")
      .set("Cookie", authCookie(userPlainId))
      .send({ recipientUserId: userPlainId, title: "Nope", sourceRef: tag });
    expect(res.status).toBe(403);
  });

  it("a user with notifications.create can create", async () => {
    const res = await request(app)
      .post("/api/notifications")
      .set("Cookie", authCookie(userCreateId))
      .send({ recipientUserId: userCreateId, title: "Created", sourceRef: tag });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    // Track for teardown.
    allNotifIds.push(res.body.id as string);
  });
});

// Locks the backend semantics behind the UI "Mark all read" button: it clears
// the caller's own live, unread rows only — never another user's rows, and never
// trashed rows. (The UI flow itself is verified end-to-end via the testing skill.)
describe("mark-all-read clears only the caller's live unread rows", () => {
  async function isReadOf(id: string): Promise<boolean> {
    const [row] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id));
    return row.isRead;
  }

  it("marks the caller's live unread rows read, leaving trashed and other users' rows untouched", async () => {
    // Precondition: another user (userOtherB) has a live unread row.
    expect(await isReadOf(notifOtherBId)).toBe(false);

    const res = await request(app)
      .post("/api/notifications/mark-all-read")
      .set("Cookie", authCookie(userMarkId));
    expect(res.status).toBe(200);

    // Caller's own live unread rows are now read.
    expect(await isReadOf(notifMark1Id)).toBe(true);
    expect(await isReadOf(notifMark2Id)).toBe(true);
    // Trashed rows are excluded.
    expect(await isReadOf(notifMarkTrashId)).toBe(false);
    // Another user's unread row is untouched (scope-respecting).
    expect(await isReadOf(notifOtherBId)).toBe(false);
  });
});
