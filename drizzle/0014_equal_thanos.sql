ALTER TABLE "sites" ADD COLUMN "repo" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "concept_branch" text DEFAULT 'concept' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "concept_url" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "concept_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "concept_approved_at" timestamp with time zone;