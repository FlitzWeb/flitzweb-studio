ALTER TYPE "public"."contact_kind" ADD VALUE 'visit' BEFORE 'note';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "rating" real;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "review_count" integer;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "lead_score" integer;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "lead_tier" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "lead_hook" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "lead_evidence" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "opener_door" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "opener_dm" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "opener_mail" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "maps_url" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "place_id" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "lead_source" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "researched_on" date;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "route_name" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "route_order" integer;