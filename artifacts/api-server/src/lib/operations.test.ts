import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AuthUser } from "./auth";

/**
 * Contract tests. The database, audit and logger are stubbed so these assert
 * the contract's own guarantees — authorization, scope, idempotency, lifecycle,
 * error containment — without writing business rows.
 */

interface StoredOp extends Record<string, unknown> {
  id: string;
  status: string;
  idempotencyKey: string | null;
}

let rows: StoredOp[] = [];
let seq = 0;

vi.mock("@workspace/db", () => {
  let lookupKey: string | null = null;
  const db = {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(rows.filter((r) => r.idempotencyKey === lookupKey)),
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        returning: () => {
          const row = { ...v, id: `op-${++seq}` } as StoredOp;
          rows.push(row);
          return Promise.resolve([row]);
        },
      }),
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => ({
        where: () => {
          const row = rows.at(-1);
          if (row) Object.assign(row, v);
          return Promise.resolve();
        },
      }),
    }),
    __lookup: (k: string | null) => {
      lookupKey = k;
    },
  };
  return { db, operationsTable: { idempotencyKey: "idempotency_key", id: "id" } };
});

vi.mock("./logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

vi.mock("./audit", () => ({
  recordAudit: vi.fn(async () => undefined),
  recordSystemAudit: vi.fn(async () => undefined),
  SYSTEM_ACTOR: "system",
}));

// Reuses the real company gate — the point is that the contract defers to it.
vi.mock("./edms", () => ({
  canOperateOnCompany: (user: AuthUser, companyId: string) =>
    user.permissions.includes("*") || user.companyId === companyId,
}));

const ops = await import("./operations");
const { registerOperation, executeOperation, userActor, systemActor, OperationDenied, _clearOperationRegistry } = ops;
const { recordAudit, recordSystemAudit } = await import("./audit");
const dbm = await import("@workspace/db");

function lookup(key: string | null) {
  (dbm.db as unknown as { __lookup: (k: string | null) => void }).__lookup(key);
}

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u1",
    username: "alice",
    fullName: "Alice",
    email: "a@x",
    roles: [],
    permissions: ["docs.run"],
    mustChangePassword: false,
    scopes: { branchIds: [], departmentIds: [], projectIds: [] },
    companyId: "c1",
    ...overrides,
  } as AuthUser;
}

const ok = async () => ({ result: { n: 1 }, outcome: { code: "x.done", message: "Done." } });

beforeEach(() => {
  _clearOperationRegistry();
  rows = [];
  seq = 0;
  lookup(null);
  vi.mocked(recordAudit).mockClear();
  vi.mocked(recordSystemAudit).mockClear();
});

describe("registry", () => {
  it("rejects a malformed key", () => {
    expect(() =>
      registerOperation({ key: "bad", description: "", sourceModule: "m", handler: ok }),
    ).toThrow(/Invalid operation key/);
  });

  it("rejects a duplicate key", () => {
    registerOperation({ key: "docs.run", description: "", sourceModule: "m", handler: ok });
    expect(() =>
      registerOperation({ key: "docs.run", description: "", sourceModule: "m", handler: ok }),
    ).toThrow(/Duplicate/);
  });

  it("rejects an unknown operation at execute time", async () => {
    await expect(
      executeOperation("docs.nope", { actor: userActor(user()), input: {} }),
    ).rejects.toBeInstanceOf(OperationDenied);
  });
});

describe("lifecycle", () => {
  beforeEach(() => {
    registerOperation({ key: "docs.run", description: "", sourceModule: "documents", permission: "docs.run", handler: ok });
  });

  it("records running then finalises as succeeded", async () => {
    const r = await executeOperation("docs.run", { actor: userActor(user()), input: {} });
    expect(r.status).toBe("succeeded");
    expect(r.operationId).toBeTruthy();
    expect(r.result).toEqual({ n: 1 });
    expect(r.outcome).toEqual({ code: "x.done", message: "Done." });
    // The row started life as running and was finalised in place.
    expect(rows[0].status).toBe("succeeded");
    expect(rows[0].completedAt).toBeInstanceOf(Date);
    expect(rows[0].durationMs).toBeTypeOf("number");
  });

  it("marks partial when the handler reports it", async () => {
    registerOperation({
      key: "docs.partial",
      description: "",
      sourceModule: "documents",
      handler: async () => ({ result: {}, outcome: { code: "p", message: "some" }, partial: true }),
    });
    const r = await executeOperation("docs.partial", { actor: systemActor("t"), input: {} });
    expect(r.status).toBe("partial");
  });
});

describe("RBAC", () => {
  beforeEach(() => {
    registerOperation({ key: "docs.run", description: "", sourceModule: "documents", permission: "docs.run", handler: ok });
  });

  it("allows a user holding the permission", async () => {
    const r = await executeOperation("docs.run", { actor: userActor(user()), input: {} });
    expect(r.status).toBe("succeeded");
  });

  it("rejects a user without the permission and records nothing", async () => {
    await expect(
      executeOperation("docs.run", { actor: userActor(user({ permissions: [] })), input: {} }),
    ).rejects.toMatchObject({ code: "operation.forbidden", httpStatus: 403 });
    // Authorization failed before anything was operated on, so no row exists.
    expect(rows).toHaveLength(0);
  });

  it("allows a super admin via the wildcard", async () => {
    const r = await executeOperation("docs.run", { actor: userActor(user({ permissions: ["*"] })), input: {} });
    expect(r.status).toBe("succeeded");
  });

  it("does not apply user permissions to a system actor", async () => {
    const r = await executeOperation("docs.run", { actor: systemActor("task.key"), input: {} });
    expect(r.status).toBe("succeeded");
  });
});

describe("tenant isolation", () => {
  beforeEach(() => {
    registerOperation({ key: "docs.run", description: "", sourceModule: "documents", permission: "docs.run", handler: ok });
  });

  it("allows an operation against the actor's own company", async () => {
    const r = await executeOperation("docs.run", { actor: userActor(user()), input: {}, companyId: "c1" });
    expect(r.status).toBe("succeeded");
    expect(rows[0].companyId).toBe("c1");
  });

  it("rejects an operation against another company", async () => {
    await expect(
      executeOperation("docs.run", { actor: userActor(user()), input: {}, companyId: "c2" }),
    ).rejects.toMatchObject({ code: "operation.company_forbidden" });
    expect(rows).toHaveLength(0);
  });

  it("records the company scope on the operation", async () => {
    await executeOperation("docs.run", { actor: userActor(user({ permissions: ["*"] })), input: {}, companyId: "c9" });
    expect(rows[0].companyId).toBe("c9");
  });
});

describe("actor", () => {
  beforeEach(() => {
    registerOperation({ key: "docs.run", description: "", sourceModule: "documents", handler: ok });
  });

  it("records a human actor", async () => {
    await executeOperation("docs.run", { actor: userActor(user()), input: {} });
    expect(rows[0]).toMatchObject({ actorType: "user", actorId: "u1", actorName: "alice" });
  });

  it("records a system actor with no user id and no fake name", async () => {
    await executeOperation("docs.run", { actor: systemActor("installments.overdue-sweep"), input: {} });
    expect(rows[0]).toMatchObject({
      actorType: "system",
      actorId: null,
      actorName: "system",
      actorTaskKey: "installments.overdue-sweep",
    });
  });
});

describe("idempotency", () => {
  beforeEach(() => {
    registerOperation({ key: "docs.run", description: "", sourceModule: "documents", handler: ok });
  });

  it("replays a completed operation instead of executing again", async () => {
    let calls = 0;
    registerOperation({
      key: "docs.counted",
      description: "",
      sourceModule: "documents",
      handler: async () => { calls++; return { result: { calls }, outcome: { code: "c", message: "" } }; },
    });

    const first = await executeOperation("docs.counted", { actor: systemActor(), input: {}, idempotencyKey: "k-1" });
    expect(first.replayed).toBe(false);
    expect(calls).toBe(1);

    lookup("k-1");
    const second = await executeOperation("docs.counted", { actor: systemActor(), input: {}, idempotencyKey: "k-1" });
    // The business effect must happen once, and the caller gets a stable answer.
    expect(calls).toBe(1);
    expect(second.replayed).toBe(true);
    expect(second.operationId).toBe(first.operationId);
    expect(second.status).toBe("succeeded");
  });

  it("refuses a duplicate while the original is still running", async () => {
    rows.push({ id: "op-x", status: "running", idempotencyKey: "k-2" });
    lookup("k-2");
    await expect(
      executeOperation("docs.run", { actor: systemActor(), input: {}, idempotencyKey: "k-2" }),
    ).rejects.toMatchObject({ code: "operation.in_progress", httpStatus: 409 });
  });

  it("re-runs when the previous attempt failed", async () => {
    rows.push({ id: "op-y", status: "failed", idempotencyKey: "k-3" });
    lookup("k-3");
    const r = await executeOperation("docs.run", { actor: systemActor(), input: {}, idempotencyKey: "k-3" });
    expect(r.replayed).toBe(false);
    expect(r.status).toBe("succeeded");
  });
});

describe("failure and error containment", () => {
  it("finalises a failed operation and returns a stable operationId", async () => {
    registerOperation({
      key: "docs.boom",
      description: "",
      sourceModule: "documents",
      handler: async () => { throw new Error("connection string postgres://secret@host"); },
    });

    const r = await executeOperation("docs.boom", { actor: systemActor(), input: {} });
    expect(r.status).toBe("failed");
    expect(r.operationId).toBeTruthy();
    // Internal detail must never reach the client.
    expect(r.error?.message).toBe("The operation could not be completed.");
    expect(r.error?.message).not.toContain("secret");
    expect(r.error?.code).toBe("operation.failed");
    // State is consistent: the row is finalised, not left "running".
    expect(rows[0].status).toBe("failed");
    expect(rows[0].completedAt).toBeInstanceOf(Date);
  });

  it("preserves a deliberate denial message from the handler", async () => {
    registerOperation({
      key: "docs.denied",
      description: "",
      sourceModule: "documents",
      handler: async () => { throw new OperationDenied("cheque.returned", "Cheque was returned."); },
    });
    const r = await executeOperation("docs.denied", { actor: systemActor(), input: {} });
    expect(r.error).toEqual({ code: "cheque.returned", message: "Cheque was returned." });
  });
});

describe("audit integration", () => {
  beforeEach(() => {
    registerOperation({ key: "docs.run", description: "", sourceModule: "documents", targetType: "company", handler: ok });
  });

  it("uses the request-aware audit engine for a human actor", async () => {
    const req = { authUser: { id: "u1" }, log: { error: vi.fn() } } as never;
    await executeOperation("docs.run", { actor: userActor(user()), input: {}, targetId: "c1", req });
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordSystemAudit).not.toHaveBeenCalled();
    expect(vi.mocked(recordAudit).mock.calls[0][1]).toMatchObject({
      action: "docs.run",
      entity: "company",
      entityId: "c1",
    });
  });

  it("uses the system audit path for a system actor", async () => {
    await executeOperation("docs.run", { actor: systemActor("t"), input: {} });
    expect(recordSystemAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("audits failures too", async () => {
    registerOperation({
      key: "docs.fail2",
      description: "",
      sourceModule: "documents",
      handler: async () => { throw new Error("x"); },
    });
    await executeOperation("docs.fail2", { actor: systemActor(), input: {} });
    expect(recordSystemAudit).toHaveBeenCalled();
  });
});
