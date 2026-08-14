import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, prPartiesTable, prInteractionsTable } from "@workspace/db";
import {
  ListPrPartiesResponse,
  CreatePrPartyBody,
  GetPrPartyResponse,
  UpdatePrPartyBody,
  ListPrInteractionsResponse,
  CreatePrInteractionBody,
  GetPrInteractionResponse,
  UpdatePrInteractionBody,
} from "@workspace/api-zod";
import { registerCrud, CrudRefused, type Row } from "../lib/register-crud";
import { requireAuth, requirePermission } from "../middleware/auth";
import { serializeRow } from "../lib/serialize";

/**
 * Public Relations.
 *
 * Two registers on the shared CRUD engine — the external parties themselves,
 * and the log of contacts with them — plus the small amount of behaviour that
 * is genuinely PR's own: keeping a party's "last contacted" in step with its
 * interactions, and refusing to log a contact against a party that belongs to
 * another company.
 *
 * Everything a contact *produces* stays where it already lives. A letter is a
 * row in the correspondence register, a meeting is a row in `meetings`, a
 * follow-up is an administrative task, an attachment is a CDMS document. This
 * module stores their ids and nothing else; there is no second copy of any of
 * them to drift out of date.
 */

const router: IRouter = Router();
router.use(requireAuth);

/** A party in the caller's reach, or null. Company scope is applied by hand
 *  here because this runs before the engine's own scoping. */
async function loadParty(partyId: string, companyId: string | null): Promise<Row | null> {
  const conds = [eq(prPartiesTable.id, partyId), eq(prPartiesTable.isDeleted, false)];
  if (companyId) conds.push(eq(prPartiesTable.companyId, companyId));
  const [row] = await db.select().from(prPartiesTable).where(and(...conds));
  return (row as Row) ?? null;
}

/**
 * Recompute a party's contact dates from its interactions.
 *
 * Derived rather than trusted from the payload: the columns exist to answer
 * "who have we not spoken to lately", and an answer a caller can set by hand
 * is worth nothing. Recomputed from scratch instead of nudged forward so that
 * editing or deleting the newest interaction corrects the party too.
 */
async function refreshPartyContactDates(partyId: string): Promise<void> {
  const [agg] = await db
    .select({
      last: sql<string | null>`max(${prInteractionsTable.interactionDate})`,
      next: sql<string | null>`min(${prInteractionsTable.followUpDate}) filter (
        where ${prInteractionsTable.followUpRequired} = true
          and ${prInteractionsTable.followUpDate} is not null
          and ${prInteractionsTable.status} <> 'cancelled'
      )`,
    })
    .from(prInteractionsTable)
    .where(and(eq(prInteractionsTable.partyId, partyId), eq(prInteractionsTable.isDeleted, false)));

  await db
    .update(prPartiesTable)
    .set({ lastContactDate: agg?.last ?? null, nextFollowUpDate: agg?.next ?? null })
    .where(eq(prPartiesTable.id, partyId));
}

registerCrud(router, {
  base: "/pr-parties",
  module: "publicRelations",
  entity: "prParty",
  table: prPartiesTable,
  searchCols: ["code", "name", "nameAr", "contactPerson"],
  filterCols: [
    "companyId",
    "partyType",
    "relationshipType",
    "importance",
    "status",
    "ownerEmployeeId",
  ],
  listResp: ListPrPartiesResponse,
  createBody: CreatePrPartyBody,
  getResp: GetPrPartyResponse,
  updateBody: UpdatePrPartyBody,
  hooks: {
    // Contact dates are computed from the interaction log, never sent in.
    derive(row) {
      delete row.lastContactDate;
      delete row.nextFollowUpDate;
    },
    async guardMutation(row, action) {
      if (action !== "delete") return;
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(prInteractionsTable)
        .where(
          and(
            eq(prInteractionsTable.partyId, row.id as string),
            eq(prInteractionsTable.isDeleted, false),
          ),
        );
      if (count > 0) {
        throw new CrudRefused(
          `This party has ${count} recorded contact(s). Remove or reassign them first.`,
          409,
        );
      }
    },
  },
});

registerCrud(router, {
  base: "/pr-interactions",
  module: "publicRelationsInteractions",
  entity: "prInteraction",
  table: prInteractionsTable,
  searchCols: ["code", "subject", "counterpartName"],
  filterCols: ["companyId", "partyId", "interactionType", "status", "handledByEmployeeId"],
  listResp: ListPrInteractionsResponse,
  createBody: CreatePrInteractionBody,
  getResp: GetPrInteractionResponse,
  updateBody: UpdatePrInteractionBody,
  hooks: {
    async guardMutation(row, action, req) {
      // Both edits and deletes change what the party's dates should be; the
      // party id is captured here because after a soft delete the row is
      // filtered out of the recompute.
      if (action === "update") {
        const target = (req.body as Row | undefined)?.partyId;
        if (typeof target === "string" && target !== row.partyId) {
          if (!(await loadParty(target, req.authUser?.companyId ?? null))) {
            throw new CrudRefused("That party does not exist.", 404);
          }
        }
      }
    },
    async afterCreate(_req, row) {
      await refreshPartyContactDates(row.partyId as string);
    },
    async afterUpdate(_req, row, previous) {
      await refreshPartyContactDates(row.partyId as string);
      if (previous.partyId && previous.partyId !== row.partyId) {
        await refreshPartyContactDates(previous.partyId as string);
      }
    },
    async afterDelete(_req, row) {
      await refreshPartyContactDates(row.partyId as string);
    },
  },
});

/**
 * A party's contact history, newest first.
 *
 * Registered by hand rather than left to a `?partyId=` filter on the list
 * route so the party is verified to be in the caller's company before any of
 * its history comes back — a nested read that resolves its parent first cannot
 * be turned into a cross-tenant probe by guessing ids.
 */
router.get(
  "/pr-parties/:id/interactions",
  // Gated on the log's own permission, because interaction rows are what comes
  // back. `requirePermission` is any-of, so naming the party permission here
  // as well would widen access rather than narrow it.
  requirePermission("publicRelationsInteractions.view"),
  async (req, res): Promise<void> => {
    const scope = req.authUser?.companyId ?? null;
    const party = await loadParty(String(req.params.id), scope);
    if (!party) {
      res.status(404).json({ error: "prParty not found" });
      return;
    }
    const rows = await db
      .select()
      .from(prInteractionsTable)
      .where(
        and(
          eq(prInteractionsTable.partyId, party.id as string),
          eq(prInteractionsTable.isDeleted, false),
        ),
      )
      .orderBy(desc(prInteractionsTable.interactionDate), desc(prInteractionsTable.createdAt));
    res.json({ data: rows.map(serializeRow), total: rows.length, page: 1, pageSize: rows.length });
  },
);

export default router;
