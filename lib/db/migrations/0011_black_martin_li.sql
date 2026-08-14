--> Re-states the corrected predicate so the schema and the database agree
--> whatever order a given environment applied things in. `IF EXISTS` on the
--> drops keeps this safe on a database that never received 0010.
DROP INDEX IF EXISTS "number_sequences_type_company_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "number_sequences_type_global_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "number_sequences_type_company_uq" ON "number_sequences" USING btree ("document_type","company_id") WHERE "number_sequences"."company_id" is not null and "number_sequences"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "number_sequences_type_global_uq" ON "number_sequences" USING btree ("document_type") WHERE "number_sequences"."company_id" is null and "number_sequences"."is_deleted" = false;
