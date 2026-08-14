CREATE TABLE "correspondence_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"correspondence_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" text DEFAULT 'to' NOT NULL,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "employee_id" uuid;--> statement-breakpoint
ALTER TABLE "correspondence" ADD COLUMN "is_internal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "correspondence" ADD COLUMN "sender_employee_id" uuid;--> statement-breakpoint
ALTER TABLE "correspondence" ADD COLUMN "thread_id" uuid;--> statement-breakpoint
ALTER TABLE "correspondence" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "correspondence" ADD COLUMN "correspondence_kind" text;--> statement-breakpoint
ALTER TABLE "correspondence" ADD COLUMN "confidentiality" text DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "correspondence" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "correspondence" ADD COLUMN "reply_due_date" date;--> statement-breakpoint
ALTER TABLE "correspondence" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "correspondence" ADD COLUMN "archived_at" timestamp with time zone;