// Database schema. After changing this file run `npm run db:generate`
// to create a migration, then `npm run db:migrate` to apply it.
import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export const billingType = pgEnum("billing_type", ["paying", "no_billing"]);
export const contactChannel = pgEnum("contact_channel", [
  "phone",
  "whatsapp",
  "email",
]);

export const clients = pgTable("clients", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  businessName: text("business_name"),
  contactPerson: text("contact_person"),
  phone: text(),
  whatsapp: text(),
  email: text(),
  preferredChannel: contactChannel("preferred_channel"),
  address: text(),
  notes: text(),
  billingType: billingType("billing_type").notNull().default("paying"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

export const siteStatus = pgEnum("site_status", [
  "live",
  "in_progress",
  "paused",
]);
export const hostingProvider = pgEnum("hosting_provider", ["vercel", "other"]);

export const sites = pgTable(
  "sites",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text().notNull(),
    url: text().notNull(),
    hosting: hostingProvider().notNull().default("vercel"),
    hostingDashboardUrl: text("hosting_dashboard_url"),
    registrar: text(),
    goLiveDate: date("go_live_date"),
    status: siteStatus().notNull().default("live"),
    // Public, non-secret key used by the tracking script (t.js).
    publicKey: text("public_key").notNull().unique(),
    // Secret for server-to-server events (POST /api/ingest).
    ingestSecret: text("ingest_secret").notNull().unique(),

    // Monitor state, kept here so alerts only fire on state *changes*.
    // null = never checked yet.
    isUp: boolean("is_up"),
    downSince: timestamp("down_since", { withTimezone: true }),
    sslAlertSent: boolean("ssl_alert_sent").notNull().default(false),

    createdAt: createdAt(),
  },
  (t) => [index("sites_client_idx").on(t.clientId)],
);

// ---------------------------------------------------------------------------
// Uptime checks
// ---------------------------------------------------------------------------

export const checks = pgTable(
  "checks",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isUp: boolean("is_up").notNull(),
    httpStatus: integer("http_status"),
    responseMs: integer("response_ms"),
    sslExpiresAt: timestamp("ssl_expires_at", { withTimezone: true }),
    error: text(),
  },
  (t) => [index("checks_site_time_idx").on(t.siteId, t.checkedAt)],
);

// ---------------------------------------------------------------------------
// Trackers (custom stats per site; events arrive in stage 4)
// ---------------------------------------------------------------------------

export const aggregation = pgEnum("aggregation", ["count", "sum"]);

export const trackers = pgTable(
  "trackers",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: text().notNull(),
    eventKey: text("event_key").notNull(),
    aggregation: aggregation().notNull().default("count"),
    monthlyGoal: integer("monthly_goal"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("trackers_site_key_idx").on(t.siteId, t.eventKey)],
);

// ---------------------------------------------------------------------------
// Analytics, modelled on Umami (https://github.com/umami-software/umami, MIT).
//
// A *session* is one anonymous visitor: an id derived from a hash of
// site + IP + user agent + a monthly rotating salt. The IP and user agent
// themselves are never stored. A *visit* groups a session's events within
// the same hour (or a 30-minute window inside one page). See
// lib/analytics/collect.ts.
// ---------------------------------------------------------------------------

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey(),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    browser: text(),
    os: text(),
    device: text(), // desktop | laptop | mobile | tablet | ...
    screen: text(), // "1920x1080"
    language: text(), // "nl-NL"
    country: text(), // ISO code, "NL"
    region: text(), // "NL-NB"
    city: text(),
    // Set by flitz.identify(): your own id for this visitor (e.g. a customer
    // number) and extra properties. Only for sites that call identify.
    distinctId: text("distinct_id"),
    data: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_site_time_idx").on(t.siteId, t.createdAt)],
);

/**
 * Pageviews and custom events. Nothing personal: only the path (no query
 * string), the referrer's host, UTM tags and which ad-click id was present.
 */
export const events = pgTable(
  "events",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    // Null for server-to-server events, which have no browser session.
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id"),
    eventKey: text("event_key").notNull(), // "pageview" or a custom event name
    value: doublePrecision(),
    path: text(),
    title: text(),
    hostname: text(),
    referrer: text(), // host only, e.g. "google.com"
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    adClick: text("ad_click"), // "gclid", "fbclid", ... (the id itself is not kept)
    tag: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_site_key_time_idx").on(t.siteId, t.eventKey, t.occurredAt),
    index("events_site_time_idx").on(t.siteId, t.occurredAt),
    index("events_session_idx").on(t.sessionId),
  ],
);

/** Saved analytics reports (Umami's Reports): funnel, journey, retention, goal. */
export const reportType = pgEnum("report_type", ["funnel", "journey", "retention", "goal"]);

export const reports = pgTable(
  "reports",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    type: reportType().notNull(),
    name: text().notNull(),
    // Shape depends on type; validated in features/reports/schema.ts.
    params: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("reports_site_idx").on(t.siteId)],
);

// ---------------------------------------------------------------------------
// Money. Amounts are integer cents. Status (paid / awaiting / overdue) is
// derived from the dates, never stored; see features/money/status.ts.
// ---------------------------------------------------------------------------

// How a payment was settled. "manual" = marked paid by hand in the dashboard.
// A Mollie integration adds "mollie" and fills providerRef/paymentUrl.
export const paymentProvider = pgEnum("payment_provider", ["manual", "mollie"]);

/** One-off invoices. */
export const payments = pgTable(
  "payments",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    description: text().notNull(),
    amountCents: integer("amount_cents").notNull(),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    paidDate: date("paid_date"),
    provider: paymentProvider().notNull().default("manual"),
    providerRef: text("provider_ref"), // e.g. Mollie payment id tr_xxx
    paymentUrl: text("payment_url"), // e.g. Mollie checkout link
    createdAt: createdAt(),
  },
  (t) => [index("payments_client_idx").on(t.clientId)],
);

/** Monthly recurring amounts. Each month produces a subscription_charge. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    description: text().notNull(),
    amountCents: integer("amount_cents").notNull(),
    startDate: date("start_date").notNull(),
    billingDay: integer("billing_day").notNull().default(1), // 1–28
    endDate: date("end_date"),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("subscriptions_client_idx").on(t.clientId)],
);

/** The expected charge for one month of a subscription. */
export const subscriptionCharges = pgTable(
  "subscription_charges",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    period: date().notNull(), // first day of the month
    amountCents: integer("amount_cents").notNull(),
    dueDate: date("due_date").notNull(),
    paidDate: date("paid_date"),
    provider: paymentProvider().notNull().default("manual"),
    providerRef: text("provider_ref"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("charges_sub_period_idx").on(t.subscriptionId, t.period)],
);

// ---------------------------------------------------------------------------
// Auth: one-time magic-link tokens (only the SHA-256 hash is stored)
// ---------------------------------------------------------------------------

export const loginTokens = pgTable("login_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Relations (for db.query.* with `with: {...}`)
// ---------------------------------------------------------------------------

export const clientsRelations = relations(clients, ({ many }) => ({
  sites: many(sites),
  payments: many(payments),
  subscriptions: many(subscriptions),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  client: one(clients, { fields: [payments.clientId], references: [clients.id] }),
  site: one(sites, { fields: [payments.siteId], references: [sites.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  client: one(clients, { fields: [subscriptions.clientId], references: [clients.id] }),
  site: one(sites, { fields: [subscriptions.siteId], references: [sites.id] }),
  charges: many(subscriptionCharges),
}));

export const subscriptionChargesRelations = relations(subscriptionCharges, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [subscriptionCharges.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  client: one(clients, { fields: [sites.clientId], references: [clients.id] }),
  checks: many(checks),
  trackers: many(trackers),
  events: many(events),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  site: one(sites, { fields: [sessions.siteId], references: [sites.id] }),
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  site: one(sites, { fields: [events.siteId], references: [sites.id] }),
  session: one(sessions, { fields: [events.sessionId], references: [sessions.id] }),
}));

export const checksRelations = relations(checks, ({ one }) => ({
  site: one(sites, { fields: [checks.siteId], references: [sites.id] }),
}));

export const trackersRelations = relations(trackers, ({ one }) => ({
  site: one(sites, { fields: [trackers.siteId], references: [sites.id] }),
}));

export type Client = typeof clients.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type Check = typeof checks.$inferSelect;
export type Tracker = typeof trackers.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionCharge = typeof subscriptionCharges.$inferSelect;
