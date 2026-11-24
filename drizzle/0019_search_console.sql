CREATE TYPE "public"."search_dimension" AS ENUM('total', 'query', 'page', 'country', 'device');--> statement-breakpoint
CREATE TABLE "search_stats" (
	"site_id" integer NOT NULL,
	"date" date NOT NULL,
	"dimension" "search_dimension" NOT NULL,
	"value" text NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"position" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "gsc_property" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "gsc_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "gsc_error" text;--> statement-breakpoint
ALTER TABLE "search_stats" ADD CONSTRAINT "search_stats_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_stats_site_dim_date_idx" ON "search_stats" USING btree ("site_id","dimension","date");