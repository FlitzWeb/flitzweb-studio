ALTER TABLE "sessions" ADD COLUMN "distinct_id" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "data" jsonb;