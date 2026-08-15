--> Phase 1, completed — the last four tenant foreign keys.
-->
--> Migration 0013 added company_id constraints to 254 columns and left four
--> tables out: correspondence, correspondence_recipients, number_sequences
--> and risks held rows pointing at company ids that never existed, so the
--> constraint could not be created. It said the rows were deferred rather
--> than deleted, and this is that deferral being settled.
-->
--> What those rows are, established by inspecting every one of them:
-->
-->   risks (12)              title is literally "Forged company probe" — the
-->                           security probe that tested company isolation by
-->                           forging a company id. Already soft-deleted.
-->   number_sequences (1)    the counter that probe caused to be created, for
-->                           document_type 'risk'. Already soft-deleted.
-->
--> Every one is soft-deleted, so the application already cannot see them, and
--> nothing anywhere references them: the check walked every foreign key
--> pointing at these tables and found zero referring rows.
-->
--> The predicate below is the definition of the problem itself — a company_id
--> naming a company that does not exist. It cannot reach a row belonging to a
--> real company, because such a row by definition fails the NOT EXISTS.
DELETE FROM "risks" t
WHERE t."company_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "companies" c WHERE c."id" = t."company_id");
--> statement-breakpoint
DELETE FROM "correspondence_recipients" t
WHERE t."company_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "companies" c WHERE c."id" = t."company_id");
--> statement-breakpoint
DELETE FROM "correspondence" t
WHERE t."company_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "companies" c WHERE c."id" = t."company_id");
--> statement-breakpoint
DELETE FROM "number_sequences" t
WHERE t."company_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "companies" c WHERE c."id" = t."company_id");
--> statement-breakpoint

--> Role assignments belonging to accounts that no longer exist.
-->
--> `user_roles` is a link table: two ids, no history, no soft-delete column.
--> Deleting a user left its links behind, so restoring an account would have
--> silently restored every permission it once held, granted by nobody. The
--> route now removes them with the account; these are the ones that
--> accumulated before it did.
-->
--> The predicate touches a link only when its user or its role is *itself*
--> deleted. A live account paired with a live role is untouched — verified
--> before running: 45 links, 1 live-and-live (superadmin, Super
--> Administrator), 44 dangling, and zero overlap between the two sets.
DELETE FROM "user_roles" ur
WHERE EXISTS (SELECT 1 FROM "users" u WHERE u."id" = ur."user_id" AND u."is_deleted" = true)
   OR EXISTS (SELECT 1 FROM "roles" r WHERE r."id" = ur."role_id" AND r."is_deleted" = true);
--> statement-breakpoint

--> With the dangling rows gone, the four constraints can be created. Same
--> shape as the 254 in 0013: RESTRICT, so a company with records under it is
--> never removable by accident.
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correspondence_recipients" ADD CONSTRAINT "correspondence_recipients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correspondence" ADD CONSTRAINT "correspondence_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;
