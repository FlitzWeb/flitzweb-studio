CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"browser" text,
	"os" text,
	"device" text,
	"screen" text,
	"language" text,
	"country" text,
	"region" text,
	"city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "visit_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "hostname" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "utm_source" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "utm_medium" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "utm_content" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "utm_term" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ad_click" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "tag" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_site_time_idx" ON "sessions" USING btree ("site_id","created_at");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_site_time_idx" ON "events" USING btree ("site_id","occurred_at");--> statement-breakpoint
CREATE INDEX "events_session_idx" ON "events" USING btree ("session_id");