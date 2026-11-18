CREATE TABLE "auth_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"sessions_valid_after" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_usage" (
	"site_id" integer NOT NULL,
	"day" date NOT NULL,
	"events" integer DEFAULT 0 NOT NULL,
	"spike_alert_sent" boolean DEFAULT false NOT NULL,
	CONSTRAINT "site_usage_site_id_day_pk" PRIMARY KEY("site_id","day")
);
--> statement-breakpoint
ALTER TABLE "trackers" ADD COLUMN "server_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_usage" ADD CONSTRAINT "site_usage_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;