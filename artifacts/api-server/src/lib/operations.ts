import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db, operationsTable, type OperationRow } from "@workspace/db";
import type { AuthUser } from "./auth";
import { canOperateOnCompany } from "./edms";
import { recordAudit, recordSystemAudit, SYSTEM_ACTOR } from "./audit";
import { logger } from "./logger";

/**
 * The Operation Contract.
 *
 * Significant ERP actions previously ended by returning a status code, which
 * means the system could not answer "who did this, under what authority,
 * against what, and what did it actually achieve" for anything beyond the
 * coarse audit row. This gives those actions an identity and a lifecycle.
 *
 * What it is not: it is not a mutation framework. The handler stays inside the
 * business service that owns the rule; this layer only wraps it with identity,
 * authorization, scope, idempotency, timing and recording. If a handler starts
 * living in this file, the responsibility has leaked.
 *
 * What it deliberately reuses rather than replaces:
 *   - RBAC        `requirePermission`'s permission strings and the `"*"` rule
 *   - tenancy     `canOperateOnCompany`
 *   - audit       `recordAudit` / `recordSystemAudit` — no second trail
 *   - notify      handlers call the existing engine; this layer never delivers
 *   - scheduler   supplies a system actor; it does not schedule anything itself
 */

export type OperationStatus = "requested" | "running" | "succeeded" | "partial" | "failed";

/**
 * `partial` is included because the sweeps that already exist genuinely produce
 * it: a run across ten companies where two fail is neither a success nor a
 * failure, and collapsing it into either loses the fact that eight worked.
 * No other state was added speculatively.
 */

export interface OperationActor {
  type: "user" | "system";
  id: string | null;
  name: string;
  /** Present when a scheduler task originated the operation. */
  taskKey?: string;
  /** Effective permissions; empty for system actors, which bypass RBAC. */
  permissions?: string[];
  /** Scope grants, for the company gate. */
  authUser?: AuthUser;
}

/** Business meaning of the operation, distinct from the technical result. */
export interface OperationOutcome {
  /** Stable, machine-readable, e.g. `collection.recorded`, `cheque.returned`. */
  code: string;
  /** Human-readable, safe to display. */
  message: string;
}

export interface OperationHandlerResult<TResult = unknown> {
  result: TResult;
  outcome: OperationOutcome;
  /** Set when the work partially succeeded. */
  partial?: boolean;
}

export interface OperationContext {
  operationId: string;
  actor: OperationActor;
  companyId: string | null;
  targetId: string | null;
  correlationId: string | null;
}

export interface OperationDefinition<TInput = unknown, TResult = unknown> {
  key: string;
  description: string;
  sourceModule: string;
  /**
   * Permission a *user* actor must hold. System actors skip this by design —
   * a scheduled sweep has no user to check — which is exactly why system
   * operations must be tightly scoped at registration and never accept a
   * caller-supplied handler.
   */
  permission?: string;
  targetType?: string;
  handler: (ctx: OperationContext, input: TInput) => Promise<OperationHandlerResult<TResult>>;
}

/** Thrown for authorization and scope refusals so callers can map to a status. */
export class OperationDenied extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, message: string, httpStatus = 403) {
    super(message);
    this.name = "OperationDenied";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const registry = new Map<string, OperationDefinition<never, unknown>>();

export function registerOperation<TInput, TResult>(
  def: OperationDefinition<TInput, TResult>,
): void {
  if (!/^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9-]*$/.test(def.key)) {
    throw new Error(`Invalid operation key "${def.key}" — expected "<domain>.<action>".`);
  }
  if (registry.has(def.key)) {
    throw new Error(`Duplicate operation key "${def.key}".`);
  }
  registry.set(def.key, def as unknown as OperationDefinition<never, unknown>);
}

export function getOperationDefinitions(): Array<Omit<OperationDefinition, "handler">> {
  return [...registry.values()].map(({ handler: _handler, ...rest }) => rest);
}

/** Test seam. */
export function _clearOperationRegistry(): void {
  registry.clear();
}

/* ------------------------------------------------------------------ */
/* Actors                                                              */
/* ------------------------------------------------------------------ */

/** Actor for an authenticated HTTP request. */
export function userActor(user: AuthUser): OperationActor {
  return {
    type: "user",
    id: user.id,
    name: user.username,
    permissions: user.permissions,
    authUser: user,
  };
}

/**
 * Actor for scheduler-originated work. Carries no user id — inventing one would
 * put a false name in the audit trail — and reuses the reserved system name the
 * audit engine already recognises.
 */
export function systemActor(taskKey?: string): OperationActor {
  return { type: "system", id: null, name: SYSTEM_ACTOR, taskKey };
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

export interface ExecuteOptions<TInput> {
  actor: OperationActor;
  input: TInput;
  companyId?: string | null;
  targetId?: string | null;
  /** Supplied by the caller to make a retry resolve to the original run. */
  idempotencyKey?: string | null;
  correlationId?: string | null;
  /** Present for HTTP-originated operations so audit records the request actor. */
  req?: Request;
}

export interface ExecuteResult<TResult = unknown> {
  operationId: string;
  status: OperationStatus;
  result: TResult | null;
  outcome: OperationOutcome | null;
  error: { code: string; message: string } | null;
  /** True when an existing completed operation was returned instead of re-running. */
  replayed: boolean;
}

async function findByIdempotencyKey(key: string): Promise<OperationRow | undefined> {
  const [row] = await db
    .select()
    .from(operationsTable)
    .where(eq(operationsTable.idempotencyKey, key));
  return row;
}

/**
 * Run one operation under the full contract.
 *
 * Order is load-bearing and mirrors the required sequence: authenticate (the
 * caller has already resolved an actor) → check permission → resolve scope →
 * only then create the record and execute. Authorization failures therefore
 * never produce an operation row, because nothing was operated on.
 */
export async function executeOperation<TInput, TResult>(
  key: string,
  opts: ExecuteOptions<TInput>,
): Promise<ExecuteResult<TResult>> {
  const def = registry.get(key) as OperationDefinition<TInput, TResult> | undefined;
  if (!def) {
    throw new OperationDenied("operation.unknown", `Unknown operation "${key}".`, 400);
  }

  const { actor } = opts;
  const companyId = opts.companyId ?? null;

  // --- authorization -------------------------------------------------
  if (actor.type === "user") {
    if (def.permission) {
      const perms = actor.permissions ?? [];
      const allowed = perms.includes("*") || perms.includes(def.permission);
      if (!allowed) {
        throw new OperationDenied(
          "operation.forbidden",
          "You do not have permission to perform this action.",
        );
      }
    }
    // --- tenant scope ------------------------------------------------
    // Reuses the existing company gate rather than re-deriving scope, so the
    // operation layer can never become a way around it.
    if (companyId && actor.authUser && !canOperateOnCompany(actor.authUser, companyId)) {
      throw new OperationDenied(
        "operation.company_forbidden",
        "You do not have access to this company.",
      );
    }
  }

  // --- idempotency ---------------------------------------------------
  if (opts.idempotencyKey) {
    const existing = await findByIdempotencyKey(opts.idempotencyKey);
    if (existing && (existing.status === "succeeded" || existing.status === "partial")) {
      return {
        operationId: existing.id,
        status: existing.status as OperationStatus,
        result: (existing.result as TResult) ?? null,
        outcome: existing.outcomeCode
          ? { code: existing.outcomeCode, message: existing.outcomeMessage ?? "" }
          : null,
        error: null,
        replayed: true,
      };
    }
    if (existing && existing.status === "running") {
      throw new OperationDenied(
        "operation.in_progress",
        "This operation is already running.",
        409,
      );
    }
  }

  // --- record --------------------------------------------------------
  const startedAt = new Date();
  const [row] = await db
    .insert(operationsTable)
    .values({
      operationKey: def.key,
      sourceModule: def.sourceModule,
      status: "running",
      actorType: actor.type,
      actorId: actor.id,
      actorName: actor.name,
      actorTaskKey: actor.taskKey ?? null,
      companyId,
      targetType: def.targetType ?? null,
      targetId: opts.targetId ?? null,
      idempotencyKey: opts.idempotencyKey ?? null,
      correlationId: opts.correlationId ?? null,
      startedAt,
    })
    .returning();

  const ctx: OperationContext = {
    operationId: row.id,
    actor,
    companyId,
    targetId: opts.targetId ?? null,
    correlationId: opts.correlationId ?? null,
  };

  let status: OperationStatus = "succeeded";
  let result: TResult | null = null;
  let outcome: OperationOutcome | null = null;
  let error: { code: string; message: string } | null = null;

  try {
    const handled = await def.handler(ctx, opts.input);
    result = handled.result;
    outcome = handled.outcome;
    status = handled.partial ? "partial" : "succeeded";
  } catch (err) {
    status = "failed";
    const isDenied = err instanceof OperationDenied;
    error = {
      code: isDenied ? err.code : "operation.failed",
      // Only a deliberate, already-safe message reaches the client; anything
      // else is generic so an internal failure cannot leak detail.
      message: isDenied ? err.message : "The operation could not be completed.",
    };
    // Full detail stays server-side.
    logger.error({ err, operationId: row.id, operationKey: def.key }, "Operation failed");
  }

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  // Finalising must not itself fail the operation the caller already observed.
  try {
    await db
      .update(operationsTable)
      .set({
        status,
        completedAt,
        durationMs,
        result: (result ?? null) as never,
        outcomeCode: outcome?.code ?? null,
        outcomeMessage: outcome?.message ?? null,
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
      })
      .where(eq(operationsTable.id, row.id));
  } catch (err) {
    logger.error({ err, operationId: row.id }, "Failed to finalise operation record");
  }

  // --- audit, through the existing engine ----------------------------
  const auditInput = {
    action: def.key,
    entity: def.targetType ?? def.sourceModule,
    entityId: opts.targetId ?? row.id,
    newValue: {
      operationId: row.id,
      status,
      outcome,
      durationMs,
      ...(error ? { error: error.code } : {}),
    },
  };
  if (actor.type === "system" || !opts.req) {
    await recordSystemAudit(auditInput);
  } else {
    await recordAudit(opts.req, auditInput);
  }

  return { operationId: row.id, status, result, outcome, error, replayed: false };
}

/** Read a recorded operation. Used by the API and by tests. */
export async function getOperation(id: string): Promise<OperationRow | undefined> {
  const [row] = await db.select().from(operationsTable).where(eq(operationsTable.id, id));
  return row;
}
