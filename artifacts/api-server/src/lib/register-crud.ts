import type { IRouter, Request } from "express";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { serializeRow, pageParams, qStr } from "./serialize";
import { recordAudit } from "./audit";
import { requirePermission } from "../middleware/auth";

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

  hooks?: CrudHooks;
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
    // Company scoping stays an explicit predicate, exactly as every copy had it.
    if (companyId) conds.push(eq(t.companyId, companyId));
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
      if (!row) {
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
        return created;
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
    if (!existing) {
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
    hooks.derive?.(update);
    hooks.prepareUpdate?.(update, existing);

    let row = existing;
    if (hooks.inUpdateTx) {
      row = await db.transaction(async (tx) => {
        let updated = existing;
        if (Object.keys(update).length) {
          const rows = (await tx.update(t).set(update).where(eq(t.id, id)).returning()) as Row[];
          updated = rows[0];
        }
        await hooks.inUpdateTx!(tx, updated, existing, req);
        return updated;
      });
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
    if (!existing) {
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
