CREATE TYPE "public"."client_stage" AS ENUM('lead', 'contacted', 'replied', 'meeting', 'client', 'lost');--> statement-breakpoint
CREATE TYPE "public"."contact_kind" AS ENUM('whatsapp', 'phone', 'email', 'meeting', 'note');--> statement-breakpoint
CREATE TABLE "contact_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contact_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" integer NOT NULL,
	"kind" "contact_kind" DEFAULT 'note' NOT NULL,
	"body" text NOT NULL,
	"occurred_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "stage" "client_stage" DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "next_follow_up" date;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "website_status" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "overdue_alert_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_charges" ADD COLUMN "overdue_alert_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_log" ADD CONSTRAINT "contact_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_log_client_idx" ON "contact_log" USING btree ("client_id","occurred_on");