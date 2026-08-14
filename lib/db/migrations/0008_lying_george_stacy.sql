ALTER TABLE "corrective_actions" ADD COLUMN "nonconformity_id" uuid;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD COLUMN "action_type" text DEFAULT 'corrective' NOT NULL;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD COLUMN "owner_employee_id" uuid;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD COLUMN "progress_percent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD COLUMN "verified_by_employee_id" uuid;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD COLUMN "verification_notes" text;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD COLUMN "task_id" uuid;--> statement-breakpoint
ALTER TABLE "corrective_actions" ADD COLUMN "notes" text;