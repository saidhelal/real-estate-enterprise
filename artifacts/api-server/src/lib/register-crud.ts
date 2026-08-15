import type { IRouter, Request } from "express";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { serializeRow, pageParams, qStr } from "./serialize";
import { recordAudit } from "./audit";
import { requirePermission } from "../middleware/auth";
import { nextNumber } from "./doc-number";

/**
 * The one CRUD route factory.
 *
 * Ten modules had each grown their own private copy of this — same permission
 * gate, same soft-delete filter, same company scoping, same search and
 * pagination — in two structurally different shapes that were already drifting
 * apart. A fix to any of that had to be applied ten times, and one copy could
 * not receive another's options.
 *
 * This owns CRUD *infrastructure* only. It deliberately knows nothing about
 * accounting, workflow, GL posting or lifecycle locks: modules that need those
 * pass callbacks and keep the rule in the module that owns it. If a business
 * term ever appears in this file, the responsibility has leaked.
 */

/** Minimal shapes so callers can pass generated Zod schemas without coupling. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParseSchema = { safeParse(v: unknown): any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResponseSchema = { parse(v: unknown): any };

export type Row = Record<string, unknown>;

/**
 * Refuse a mutation for a business reason. Thrown from a hook; the factory
 * turns it into the status the hook asked for and performs no write.
 */
export class CrudRefused extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = "CrudRefused";
    this.status = status;
  }
}

/** The transaction handle Drizzle hands a callback. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface CrudHooks {
  /**
   * Runs inside the same transaction as the insert. Anything that must commit
   * or roll back *with* the row belongs here rather than in `afterCreate` —
   * a side effect that can leave the row committed and itself missing is a
   * correctness bug, not a best-effort nicety.
   *
   * The factory only supplies the transaction and the created row; what the
   * callback does with them stays the module's business.
   */
  inCreateTx?: (tx: Tx, row: Row, req: Request) => Promise<void>;
  /** Same contract, inside the soft-delete transaction. */
  inDeleteTx?: (tx: Tx, row: Row, req: Request) => Promise<void>;
  /**
   * Adjust a PATCH payload with the current row in hand, before it is written.
   * Richer than `derive`, which never sees the stored row — a module needs both
   * to decide, for example, that a value has become immutable because of the
   * state the row is already in.
   */
  prepareUpdate?: (update: Row, existing: Row) => void;
  /**
   * Runs inside the update transaction, after the row is written. Receives both
   * versions so the module can work out what changed without the factory
   * needing to understand any of it.
   */
  inUpdateTx?: (tx: Tx, updated: Row, existing: Row, req: Request) => Promise<void>;
  /**
   * Runs before PATCH/DELETE with the current row. Throw `CrudRefused` to block.
   * This is how a module enforces a lifecycle lock without the factory knowing
   * what its statuses mean.
   */
  guardMutation?: (row: Row, action: "update" | "delete", req: Request) => void | Promise<void>;
  /** Mutate the payload in place before insert/update — computed columns. */
  derive?: (row: Row) => void;
  /** Best-effort side effects after a successful write. Must not throw. */
  afterCreate?: (req: Request, row: Row) => Promise<void>;
  afterUpdate?: (req: Request, row: Row, previous: Row) => Promise<void>;
  afterDelete?: (req: Request, row: Row) => Promise<void>;
}

export interface CrudConfig {
  /** Route segment. `base` is the alias used by the second config family. */
  path?: string;
  base?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  /** Permission namespace — `${module}.view|create|update|delete`. */
  module: string;
  /** Human entity name used in audit rows and 404 messages. */
  entity: string;

  createBody: ParseSchema;
  updateBody: ParseSchema;
  /** `listResp` is the alias used by the second config family. */
  listResponse?: ResponseSchema;
  listResp?: ResponseSchema;
  /** Present only where a module validates its single-row response. */
  getResp?: ResponseSchema;
  /**
   * Register `GET /:id` without a response schema. Needed because the original
   * copies disagreed: some exposed a single-row read and some did not, and
   * registering it everywhere would add a public endpoint to modules that never
   * had one. Implied by `getResp`.
   */
  getOne?: boolean;
  /** Overrides the 404 body where a module used different wording. */
  notFoundMessage?: string;

  /** Columns matched with ILIKE. `searchCols` is the alias. */
  search?: string[];
  searchCols?: string[];
  /** Columns accepted as exact-match query filters. */
  filterCols?: string[];
  /**
   * Columns silently dropped from a PATCH payload. Used where a value has
   * already driven a downstream record and may no longer move.
   */
  immutableFields?: string[];

  /**
   * Have the system issue this record's business code.
   *
   * Set it and the module stops accepting a code from the client: the value is
   * drawn from the central sequence engine, scoped to the caller's company, and
   * the field becomes immutable afterwards. A code the caller can choose is not
   * an identifier — two callers eventually choose the same one, and no unique
   * index in this schema would catch it.
   *
   * `documentType` names the sequence; `field` defaults to `code`.
   */
  generatedCode?: { documentType: string; field?: string };

  hooks?: CrudHooks;
}

/**
 * The company a request is confined to, or null for an unconfined caller.
 *
 * Company scoping used to be whatever `?companyId=` the caller happened to
 * send, which is a filter, not a boundary: dropping the parameter returned
 * every company's rows, and changing it returned someone else's. A tenant
 * column that only the client decides to apply is not isolation.
 *
 * So it is read from the session instead. A user carrying a `companyId` is
 * pinned to it and cannot widen or redirect the scope from the query string.
 * A user without one — service accounts, the platform administrator, and every
 * row that predates the column — keeps the previous behaviour exactly, which
 * is what makes this safe to put in the shared engine rather than in each of
 * the forty-odd modules that would otherwise each need their own copy.
 */
export function callerCompanyId(req: Request): string | null {
  return req.authUser?.companyId ?? null;
}

/**
 * The company condition for a table, or undefined when there is none to apply.
 *
 * The factory scopes every resource it registers. Custom action endpoints —
 * approve, publish, transition — are not registered resources, so each was
 * writing `if (scope) conds.push(eq(t.companyId, scope))` for itself. Six
 * copies of one rule is six chances to forget it, and forgetting it is a
 * tenant reading another tenant's row.
 *
 * Returns undefined for an unpinned caller (a service account or the platform
 * administrator) and for a table with no company column, which is what makes
 * it safe to drop into an existing condition list unchanged:
 *
 *   const conds = [eq(t.id, id), eq(t.isDeleted, false)];
 *   const scoped = companyScope(t, req);
 *   if (scoped) conds.push(scoped);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function companyScope(t: any, req: Request): SQL | undefined {
  const scope = callerCompanyId(req);
  if (!scope || !hasCompanyColumn(t)) return undefined;
  return eq(t.companyId, scope);
}

/**
 * Does this table carry a company column at all? Reference tables like
 * currencies and lookup types are deliberately global, and scoping them would
 * empty them out for every tenant user.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasCompanyColumn(t: any): boolean {
  return Boolean(t?.companyId);
}

/**
 * Is this row outside the caller's company?
 *
 * Answered as "not found" rather than "forbidden" wherever it is used: a 403
 * on a foreign id confirms the id exists, which turns a blocked read into a
 * working existence oracle over another tenant's data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function outOfScope(t: any, row: Row, req: Request): boolean {
  const scope = callerCompanyId(req);
  if (!scope || !hasCompanyColumn(t)) return false;
  return String(row.companyId ?? "") !== scope;
}

/** Resolve the two historical spellings to one internal shape. */
function normalise(cfg: CrudConfig) {
  // One family wrote "units", the other "/units". Strip the slash so the
  // factory always builds exactly one separator.
  const path = (cfg.path ?? cfg.base)?.replace(/^\/+/, "");
  if (!path) throw new Error(`CRUD config for "${cfg.entity}" needs a path.`);
  const listResponse = cfg.listResponse ?? cfg.listResp;
  if (!listResponse) throw new Error(`CRUD config for "${cfg.entity}" needs a list response schema.`);
  return {
    path,
    listResponse,
    search: cfg.search ?? cfg.searchCols ?? [],
    filterCols: cfg.filterCols ?? [],
  };
}

/**
 * Register list/get/create/update/delete for one entity on the given router.
 *
 * Behaviour is the union of what the ten copies already did; nothing was
 * invented. `GET /:id` is registered only when a module supplied `getResp`,
 * because the copies that lacked it never had that route and adding one would
 * change their public surface.
 */
export function registerCrud(router: IRouter, cfg: CrudConfig): void {
  const t = cfg.table;
  const { path, listResponse, search, filterCols } = normalise(cfg);
  const hooks = cfg.hooks ?? {};

  // ---- list -------------------------------------------------------------
  router.get(`/${path}`, requirePermission(`${cfg.module}.view`), async (req, res): Promise<void> => {
    const query = req.query as Record<string, unknown>;
    const { page, pageSize, offset } = pageParams(query);
    const searchTerm = qStr(query, "search");
    const companyId = qStr(query, "companyId");

    const conds: SQL[] = [eq(t.isDeleted, false)];
    // Company scoping stays an explicit predicate, exactly as every copy had
    // it — but a caller pinned to a company overrides whatever was asked for,
    // so a missing or foreign `?companyId=` cannot widen the result set.
    const scope = callerCompanyId(req);
    const effectiveCompanyId = hasCompanyColumn(t) && scope ? scope : companyId;
    if (effectiveCompanyId) conds.push(eq(t.companyId, effectiveCompanyId));
    for (const col of filterCols) {
      const v = qStr(query, col);
      if (v) conds.push(eq(t[col], v));
    }
    if (searchTerm && search.length) {
      const like = `%${searchTerm}%`;
      const ors = search.map((c) => ilike(t[c], like));
      const combined = or(...ors);
      if (combined) conds.push(combined);
    }
    const where = and(...conds);

    const rows = (await db
      .select()
      .from(t)
      .where(where)
      .orderBy(desc(t.createdAt))
      .limit(pageSize)
      .offset(offset)) as Row[];
    const countRows = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(t)
      .where(where)) as { count: number }[];

    res.json(listResponse.parse({ data: rows.map(serializeRow), total: countRows[0].count, page, pageSize }));
  });

  // ---- get one (only where the module already had it) --------------------
  if (cfg.getResp || cfg.getOne) {
    const getResp = cfg.getResp;
    router.get(`/${path}/:id`, requirePermission(`${cfg.module}.view`), async (req, res): Promise<void> => {
      const id = String(req.params.id);
      const found = (await db
        .select()
        .from(t)
        .where(and(eq(t.id, id), eq(t.isDeleted, false)))) as Row[];
      const row = found[0];
      if (!row || outOfScope(t, row, req)) {
        res.status(404).json({ error: cfg.notFoundMessage ?? `${cfg.entity} not found` });
        return;
      }
      // Validate only where the module supplied a schema; the copies that had
      // no schema returned the serialised row directly.
      res.json(getResp ? getResp.parse(serializeRow(row)) : serializeRow(row));
    });
  }

  // ---- create -----------------------------------------------------------
  router.post(`/${path}`, requirePermission(`${cfg.module}.create`), async (req, res): Promise<void> => {
    const parsed = cfg.createBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const values = { ...(parsed.data as Row) };
    // A pinned caller writes into their own company whatever the body claimed;
    // otherwise a create is an unchecked way to plant rows in another tenant.
    const createScope = callerCompanyId(req);
    if (createScope && hasCompanyColumn(t)) values.companyId = createScope;

    // A system-issued code is taken from the central sequence, never from the
    // body. Whatever the client sent is discarded rather than rejected: the
    // field is not theirs to set, and failing the request would only teach
    // callers to keep sending it.
    if (cfg.generatedCode) {
      const field = cfg.generatedCode.field ?? "code";
      // The sequence is chosen by the caller's own company and nothing else.
      // Falling back to the body's `companyId` made the create draw from a
      // different counter than the preview endpoint reads, so the number the
      // form showed was not the number the record got — and it would also
      // have let an unpinned caller take numbers from a named tenant's
      // sequence, which is the thing session-scoping exists to prevent.
      const issued = await nextNumber(cfg.generatedCode.documentType, createScope);
      values[field] = issued.value;
    }

    hooks.derive?.(values);

    // A transactional hook makes the whole create atomic: if it throws, the
    // insert rolls back with it. Without one, a plain insert is used so the
    // simple modules pay no transaction cost.
    let row: Row;
    if (hooks.inCreateTx) {
      row = await db.transaction(async (tx) => {
        const inserted = (await tx.insert(t).values(values).returning()) as Row[];
        const created = inserted[0];
        await hooks.inCreateTx!(tx, created, req);
        // Re-read, because the hook may have changed the row it was given —
        // a derived total, a stamped deadline. Returning the pre-hook copy
        // sent the caller a record that contradicted the database, and the
        // screen then showed the number the user typed rather than the one
        // the system computed. Same transaction, so this cannot see anyone
        // else's write.
        const [after] = (await tx.select().from(t).where(eq(t.id, created.id))) as Row[];
        return after ?? created;
      });
    } else {
      const inserted = (await db.insert(t).values(values).returning()) as Row[];
      row = inserted[0];
    }

    await recordAudit(req, { action: "create", entity: cfg.entity, entityId: row.id as string, newValue: row });
    // Side effects are best-effort: a hook failure must not undo a committed
    // write or turn a successful create into a 500.
    if (hooks.afterCreate) {
      try {
        await hooks.afterCreate(req, row);
      } catch (err) {
        req.log?.error({ err, entity: cfg.entity }, "afterCreate hook failed");
      }
    }
    // Validate the created row where the module supplied a single-row schema;
    // the copies without one returned it serialised directly.
    res.status(201).json(cfg.getResp ? cfg.getResp.parse(serializeRow(row)) : serializeRow(row));
  });

  // ---- update -----------------------------------------------------------
  router.patch(`/${path}/:id`, requirePermission(`${cfg.module}.update`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const parsed = cfg.updateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existingRows = (await db
      .select()
      .from(t)
      .where(and(eq(t.id, id), eq(t.isDeleted, false)))) as Row[];
    const existing = existingRows[0];
    if (!existing || outOfScope(t, existing, req)) {
      res.status(404).json({ error: cfg.notFoundMessage ?? `${cfg.entity} not found` });
      return;
    }

    if (hooks.guardMutation) {
      try {
        await hooks.guardMutation(existing, "update", req);
      } catch (err) {
        if (err instanceof CrudRefused) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        throw err;
      }
    }

    const update: Row = {};
    for (const [k, v] of Object.entries(parsed.data as Row)) {
      if (v !== undefined) update[k] = v;
    }
    for (const field of cfg.immutableFields ?? []) delete update[field];
    if (cfg.generatedCode) delete update[cfg.generatedCode.field ?? "code"];
    // Several update schemas accept `companyId`. For a pinned caller that would
    // be a one-field way to hand a row to another tenant, so it is dropped
    // rather than rejected — the rest of the edit still applies.
    if (callerCompanyId(req) && hasCompanyColumn(t)) delete update.companyId;
    // `CrudRefused` is honoured from these hooks too, not only from
    // `guardMutation`. A module that refuses an edit while shaping the payload
    // — because the payload is what makes it invalid — was otherwise turning a
    // deliberate business refusal into a 500.
    try {
      hooks.derive?.(update);
      hooks.prepareUpdate?.(update, existing);
    } catch (err) {
      if (err instanceof CrudRefused) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      throw err;
    }

    let row = existing;
    if (hooks.inUpdateTx) {
      try {
        row = await db.transaction(async (tx) => {
          let updated = existing;
          if (Object.keys(update).length) {
            const rows = (await tx.update(t).set(update).where(eq(t.id, id)).returning()) as Row[];
            updated = rows[0];
          }
          await hooks.inUpdateTx!(tx, updated, existing, req);
          // Re-read for the same reason as the create path: the hook may have
          // recomputed a derived column, and the response must be what was
          // stored rather than what was written on the way in.
          const [after] = (await tx.select().from(t).where(eq(t.id, id))) as Row[];
          return after ?? updated;
        });
      } catch (err) {
        // A refusal from inside the update transaction is a business answer,
        // not a fault — and the transaction has already rolled the write back.
        // Every other hook point honoured `CrudRefused`; this one turned it
        // into a 500, which is why a module with a rule that can only be
        // checked against the written row had nowhere safe to put it.
        if (err instanceof CrudRefused) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        throw err;
      }
    } else if (Object.keys(update).length) {
      const updated = (await db.update(t).set(update).where(eq(t.id, id)).returning()) as Row[];
      row = updated[0];
    }

    await recordAudit(req, { action: "update", entity: cfg.entity, entityId: id, oldValue: existing, newValue: row });
    if (hooks.afterUpdate) {
      try {
        await hooks.afterUpdate(req, row, existing);
      } catch (err) {
        req.log?.error({ err, entity: cfg.entity }, "afterUpdate hook failed");
      }
    }
    res.json(serializeRow(row));
  });

  // ---- delete (soft) ----------------------------------------------------
  router.delete(`/${path}/:id`, requirePermission(`${cfg.module}.delete`), async (req, res): Promise<void> => {
    const id = String(req.params.id);

    // The row is always read before the soft delete, for two reasons: a lifecycle
    // guard needs to inspect it, and the audit trail records what was removed.
    // Several of the original copies captured `oldValue` here and others did not
    // — recording it is the richer, safer behaviour and belongs to the shared
    // CRUD/Audit infrastructure, not to any one module.
    const existingRows = (await db
      .select()
      .from(t)
      .where(and(eq(t.id, id), eq(t.isDeleted, false)))) as Row[];
    const existing = existingRows[0];
    if (!existing || outOfScope(t, existing, req)) {
      res.status(404).json({ error: cfg.notFoundMessage ?? `${cfg.entity} not found` });
      return;
    }

    if (hooks.guardMutation) {
      try {
        await hooks.guardMutation(existing, "delete", req);
      } catch (err) {
        if (err instanceof CrudRefused) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        throw err;
      }
    }

    // Same reasoning as create: a reversal that must undo with the delete runs
    // inside the transaction, not after it.
    let row: Row;
    if (hooks.inDeleteTx) {
      row = await db.transaction(async (tx) => {
        await tx
          .update(t)
          .set({ isDeleted: true, isActive: false })
          .where(and(eq(t.id, id), eq(t.isDeleted, false)));
        await hooks.inDeleteTx!(tx, existing, req);
        return existing;
      });
    } else {
      const deleted = (await db
        .update(t)
        .set({ isDeleted: true, isActive: false })
        .where(and(eq(t.id, id), eq(t.isDeleted, false)))
        .returning()) as Row[];
      row = deleted[0] ?? existing;
    }

    await recordAudit(req, { action: "delete", entity: cfg.entity, entityId: id, oldValue: existing });
    if (hooks.afterDelete) {
      try {
        await hooks.afterDelete(req, row);
      } catch (err) {
        req.log?.error({ err, entity: cfg.entity }, "afterDelete hook failed");
      }
    }
    res.json({ success: true });
  });
}
