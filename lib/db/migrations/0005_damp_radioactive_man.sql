CREATE TABLE "pr_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"code" text NOT NULL,
	"interaction_type" text DEFAULT 'meeting' NOT NULL,
	"interaction_date" date DEFAULT now() NOT NULL,
	"subject" text NOT NULL,
	"handled_by_employee_id" uuid,
	"counterpart_name" text,
	"purpose" text,
	"outcome" text,
	"follow_up_required" boolean DEFAULT false NOT NULL,
	"follow_up_date" date,
	"status" text DEFAULT 'completed' NOT NULL,
	"correspondence_id" uuid,
	"meeting_id" uuid,
	"task_id" uuid,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"party_type" text DEFAULT 'company' NOT NULL,
	"relationship_type" text DEFAULT 'operational' NOT NULL,
	"owner_employee_id" uuid,
	"contact_person" text,
	"contact_title" text,
	"phone" text,
	"email" text,
	"website" text,
	"address" text,
	"importance" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_contact_date" date,
	"next_follow_up_date" date,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "legal_name_ar" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "trade_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "legal_form" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "commercial_register" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "official_email" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "fax" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "po_box" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "representative_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "representative_title" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "print_header" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "print_footer" text;