CREATE TABLE "circular_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"circular_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"employee_id" uuid,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"point_id" uuid,
	"shift_id" uuid,
	"location" text,
	"incident_type" text DEFAULT 'other' NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"reported_by_employee_id" uuid,
	"reported_by_name" text,
	"visitor_log_id" uuid,
	"assigned_to_employee_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"action_taken" text,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"task_id" uuid,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"point_type" text DEFAULT 'gate' NOT NULL,
	"location" text,
	"branch_id" uuid,
	"supervisor_employee_id" uuid,
	"instructions" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"point_id" uuid NOT NULL,
	"guard_employee_id" uuid,
	"shift_date" date NOT NULL,
	"shift_type" text DEFAULT 'morning' NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"check_in_at" timestamp with time zone,
	"check_out_at" timestamp with time zone,
	"handed_over_to_employee_id" uuid,
	"handover_notes" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nonconformities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"source" text DEFAULT 'internal_audit' NOT NULL,
	"raised_date" date DEFAULT now() NOT NULL,
	"department_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'process' NOT NULL,
	"severity" text DEFAULT 'minor' NOT NULL,
	"policy_id" uuid,
	"root_cause" text,
	"owner_employee_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"due_date" date,
	"closed_at" timestamp with time zone,
	"closure_notes" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"department_id" uuid,
	"category" text DEFAULT 'operational' NOT NULL,
	"source" text DEFAULT 'assessment' NOT NULL,
	"likelihood" integer DEFAULT 1 NOT NULL,
	"impact" integer DEFAULT 1 NOT NULL,
	"risk_score" integer DEFAULT 1 NOT NULL,
	"risk_level" text DEFAULT 'low' NOT NULL,
	"owner_employee_id" uuid,
	"treatment_strategy" text DEFAULT 'reduce' NOT NULL,
	"treatment_plan" text,
	"treatment_due_date" date,
	"status" text DEFAULT 'identified' NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"next_review_date" date,
	"residual_score" integer,
	"residual_level" text,
	"closed_at" timestamp with time zone,
	"exposure_amount" numeric(18, 2),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circulars" ADD COLUMN "circular_type" text DEFAULT 'announcement' NOT NULL;--> statement-breakpoint
ALTER TABLE "circulars" ADD COLUMN "priority" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "circulars" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "circulars" ADD COLUMN "publish_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "circulars" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "circulars" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "circulars" ADD COLUMN "published_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "circulars" ADD COLUMN "targeted_count" integer;--> statement-breakpoint
ALTER TABLE "general_service_requests" ADD COLUMN "service_time" text;--> statement-breakpoint
ALTER TABLE "general_service_requests" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "general_service_requests" ADD COLUMN "attendees_count" integer;--> statement-breakpoint
ALTER TABLE "general_service_requests" ADD COLUMN "required_items" text;--> statement-breakpoint
ALTER TABLE "general_service_requests" ADD COLUMN "meeting_id" uuid;--> statement-breakpoint
ALTER TABLE "general_service_requests" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "circular_receipts_circular_idx" ON "circular_receipts" USING btree ("circular_id","read_at");--> statement-breakpoint
CREATE INDEX "circular_receipts_user_idx" ON "circular_receipts" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "security_incidents_status_idx" ON "security_incidents" USING btree ("status","severity");--> statement-breakpoint
CREATE INDEX "security_shifts_point_date_idx" ON "security_shifts" USING btree ("point_id","shift_date");--> statement-breakpoint
CREATE INDEX "nonconformities_status_idx" ON "nonconformities" USING btree ("status","severity");--> statement-breakpoint
CREATE INDEX "risks_level_idx" ON "risks" USING btree ("risk_level","status");