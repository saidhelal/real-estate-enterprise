CREATE TABLE "operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_key" text NOT NULL,
	"source_module" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"actor_name" text NOT NULL,
	"actor_task_key" text,
	"company_id" uuid,
	"target_type" text,
	"target_id" text,
	"idempotency_key" text,
	"correlation_id" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"result" jsonb,
	"outcome_code" text,
	"outcome_message" text,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "operations_idempotency_key_uq" ON "operations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "operations_key_status_idx" ON "operations" USING btree ("operation_key","status");--> statement-breakpoint
CREATE INDEX "operations_company_idx" ON "operations" USING btree ("company_id","requested_at");--> statement-breakpoint
CREATE INDEX "operations_correlation_idx" ON "operations" USING btree ("correlation_id");