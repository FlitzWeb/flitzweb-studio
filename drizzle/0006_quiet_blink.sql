CREATE TYPE "public"."cost_category" AS ENUM('software', 'ai', 'domain', 'hosting', 'hardware', 'other');--> statement-breakpoint
CREATE TYPE "public"."cost_interval" AS ENUM('monthly', 'yearly', 'once');--> statement-breakpoint
CREATE TABLE "costs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "costs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"category" "cost_category" DEFAULT 'software' NOT NULL,
	"amount_cents" integer NOT NULL,
	"interval" "cost_interval" DEFAULT 'monthly' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
