CREATE TYPE "public"."aggregation" AS ENUM('count', 'sum');--> statement-breakpoint
CREATE TYPE "public"."billing_type" AS ENUM('paying', 'no_billing');--> statement-breakpoint
CREATE TYPE "public"."contact_channel" AS ENUM('phone', 'whatsapp', 'email');--> statement-breakpoint
CREATE TYPE "public"."hosting_provider" AS ENUM('vercel', 'other');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('live', 'in_progress', 'paused');--> statement-breakpoint
CREATE TABLE "checks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"site_id" integer NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_up" boolean NOT NULL,
	"http_status" integer,
	"response_ms" integer,
	"ssl_expires_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"business_name" text,
	"contact_person" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"preferred_channel" "contact_channel",
	"address" text,
	"notes" text,
	"billing_type" "billing_type" DEFAULT 'paying' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" integer NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"hosting" "hosting_provider" DEFAULT 'vercel' NOT NULL,
	"hosting_dashboard_url" text,
	"registrar" text,
	"go_live_date" date,
	"status" "site_status" DEFAULT 'live' NOT NULL,
	"public_key" text NOT NULL,
	"is_up" boolean,
	"down_since" timestamp with time zone,
	"ssl_alert_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_public_key_unique" UNIQUE("public_key")
);
--> statement-breakpoint
CREATE TABLE "trackers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trackers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"site_id" integer NOT NULL,
	"name" text NOT NULL,
	"event_key" text NOT NULL,
	"aggregation" "aggregation" DEFAULT 'count' NOT NULL,
	"monthly_goal" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checks" ADD CONSTRAINT "checks_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trackers" ADD CONSTRAINT "trackers_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checks_site_time_idx" ON "checks" USING btree ("site_id","checked_at");--> statement-breakpoint
CREATE INDEX "sites_client_idx" ON "sites" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trackers_site_key_idx" ON "trackers" USING btree ("site_id","event_key");