CREATE TABLE "scheduler_task_state" (
	"task_key" text PRIMARY KEY NOT NULL,
	"last_started_at" timestamp with time zone,
	"last_finished_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_status" text,
	"last_duration_ms" integer,
	"last_error" text,
	"last_result" text,
	"run_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
