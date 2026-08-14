--> Corrected before it was ever applied.
--> As generated, these indexes covered every row. This table soft-deletes, and
--> nineteen document types still carry four soft-deleted copies each from a
--> non-idempotent seed — so the unique index could never be created and the
--> migration would fail on any database holding that history. Restricting both
--> to live rows states the rule that was actually meant: one definition in use
--> per document type per scope. Migration 0011 carries the same predicate.
CREATE UNIQUE INDEX IF NOT EXISTS "number_sequences_type_company_uq" ON "number_sequences" USING btree ("document_type","company_id") WHERE "number_sequences"."company_id" is not null and "number_sequences"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "number_sequences_type_global_uq" ON "number_sequences" USING btree ("document_type") WHERE "number_sequences"."company_id" is null and "number_sequences"."is_deleted" = false;
