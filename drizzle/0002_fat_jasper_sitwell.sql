CREATE TABLE "events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"site_id" integer NOT NULL,
	"event_key" text NOT NULL,
	"value" double precision,
	"path" text,
	"referrer" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "ingest_secret" text;--> statement-breakpoint
-- Give existing sites a random secret before making the column required.
UPDATE "sites" SET "ingest_secret" = 'fws_' || encode(sha256((random()::text || clock_timestamp()::text || id::text)::bytea), 'hex');--> statement-breakpoint
ALTER TABLE "sites" ALTER COLUMN "ingest_secret" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_site_key_time_idx" ON "events" USING btree ("site_id","event_key","occurred_at");--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_ingest_secret_unique" UNIQUE("ingest_secret");