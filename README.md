# FlitzWeb Studio

Private dashboard for FlitzWeb: all client sites at a glance, with uptime monitoring and alerts, clients and contact, payments, and privacy-friendly stats. One user, magic-link login.

**Stack:** Next.js 16 (App Router) · TypeScript · Postgres (Neon) + Drizzle · Resend · Recharts · Vercel.

## Local development

```bash
cp .env.example .env          # then fill in AUTH_SECRET and CRON_SECRET
docker compose up -d          # local Postgres on port 5433
npm install
npm run db:migrate            # create tables
npm run db:seed               # FlitzWeb + Hakiki Döner
npm run dev
```

Open http://localhost:3000, enter your `ADMIN_EMAIL`, and the login link is printed in the terminal (no `RESEND_API_KEY` needed locally).

Run the uptime check by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/check
```

## Deploying

### 1. Vercel project
Push this repo to GitHub (e.g. `FlitzWeb/flitzweb-studio`) and import it in Vercel. `vercel.json` already runs migrations before every build and registers a daily cron.

### 2. Database (Neon)
In the Vercel project: **Storage → Create Database → Neon** (free plan is plenty). Connect it to the project. This sets `DATABASE_URL` (pooled, used by the app) and `DATABASE_URL_UNPOOLED` (direct, used by migrations).

To seed production once, copy the Neon connection string from the Vercel Storage tab into your local `.env` as `DATABASE_URL` and run `npm run db:seed`. Put your local URL back afterwards.

### 3. Email (Resend)
1. In [Resend](https://resend.com), verify the domain `flitzweb.nl` (Domains → Add, then add the DNS records). Skip this if it is already verified for the booking form.
2. Create an API key (API Keys → Create, "Sending access").

### 4. Environment variables
In Vercel → Settings → Environment Variables (Production):

| Name | Value |
| --- | --- |
| `ADMIN_EMAIL` | the only address that can log in, e.g. `info@flitzweb.nl` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | `https://studio.flitzweb.nl` (or your `*.vercel.app` URL) |
| `RESEND_API_KEY` | from step 3 |
| `EMAIL_FROM` | `FlitzWeb Studio <studio@flitzweb.nl>` |
| `CRON_SECRET` | `openssl rand -hex 24` |
| `ALERT_EMAIL` | optional, if alerts should go somewhere else |

Redeploy after adding them. Optional: add the domain `studio.flitzweb.nl` under Settings → Domains.

### 5. Check every 5 minutes (cron-job.org)
Vercel Hobby only runs crons once a day, so use [cron-job.org](https://cron-job.org) (free):

1. Sign up and click **Create cronjob**.
2. **URL:** `https://studio.flitzweb.nl/api/cron/check`
3. **Execution schedule:** every 5 minutes.
4. Open **Advanced → Headers** and add the header `Authorization` with the value `Bearer <your CRON_SECRET>`.
5. Leave **Request method** on GET. Turn on "notify on failure" if you want an email when the dashboard itself is unreachable.
6. Save, then click **Test run**. You should get `200` with `{"checked": 2, ...}`.

The daily Vercel cron keeps running as a backup. Vercel sends the same `Authorization` header automatically.

## How monitoring works

- Only sites with status **Live** are checked: a GET that follows redirects (10 s timeout), plus a TLS handshake to read the certificate expiry.
- A failure is retried once after 3 s before the site counts as down, so a single blip doesn't email you.
- Alerts go out only on **changes**: up → down, down → up (with how long it was down), and SSL dropping below 14 days. The SSL warning re-arms after renewal. If sending an alert fails, the state isn't saved, so the next run tries again.
- Checks older than 90 days are deleted automatically.
- Uptime counts from a site's first successful check. Failures before that (domain not pointed yet) are setup, not downtime, and stay out of the uptime figures, the incident list and the monthly report (`sinceFirstUp` in `lib/uptime/queries.ts`).

## How money works

- **Invoices** (`payments`) are one-off amounts. **Subscriptions** are monthly. Each month an active subscription gets a **charge** row (`subscription_charges`) due on its billing day; you tap **Betaald** when the money arrives. Charges are created automatically when money pages load and on every cron run (`features/money/charges.ts`).
- Status is never stored: paid = has a paid date, overdue = unpaid and past its due date, otherwise open (`features/money/status.ts`).
- Clients with billing type `no_billing` (family, pro bono) are left out of every total and list, and their Betalingen tab is hidden.
- MRR = the sum of subscriptions that are being charged today (started, past their free months, not ended). What starts later is shown next to it ("€ 30,00 erbij vanaf december 2026").
- The home page's **Deze maand** gauge compares what came in this month with everything due this month (paid items plus open ones with a due date before the month ends), not with the MRR.

### Adding Mollie later
The schema is ready for it: `payments` and `subscription_charges` have `provider` (`manual` | `mollie`), `provider_ref` (the Mollie payment id) and `payments.payment_url` (the checkout link). The plan:

1. `npm i @mollie/api-client`, add `MOLLIE_API_KEY`.
2. A "Betaallink maken" action that creates a Mollie payment for an invoice and stores its id + checkout URL (`MoneyList` already shows a link when `paymentUrl` is set).
3. A public `POST /api/mollie/webhook` (exclude it in `src/proxy.ts`) that fetches the payment from Mollie and, when it's paid, sets `paid_date` and `provider = 'mollie'` — the same thing `setPaid()` in `features/money/actions.ts` does by hand.

## How leads work

- A lead is a row in `clients` with a `stage` (`lead`, `contacted`, `replied`, `meeting`, `client`, `lost`). Existing clients are `client`. Moving a lead to **Klant** is just a stage change, so contact details, notes and the contact log carry over.
- **Leads** (`/leads`) lists everyone who is not a client yet: due follow-ups first, then the best lead score. Chips filter on stage, tier and "website now".
- **Lead research** comes from the leads skill (`~/.claude/skills/leads`). Each run writes `studio-import.json`; pick it at `/leads/importeren` (`features/clients/importResearch.ts`). It carries Google rating and review count, a 0–100 score with tier A/B/C, the hook, the evidence, three drafted openers (door, WhatsApp/DM, mail), the current link, the Maps link and a place in the walking route. A business that is already here (same Maps place id, else same name, else same phone number) only gets those fields filled in: stage, follow-up date, notes and contact log are left alone, and real clients are skipped. The lead's page shows it all in the **Lead-onderzoek** card; its buttons open WhatsApp or the mail app with the draft filled in, the Studio sends nothing.
- **Looproute** (`/leads/looproute`) is the door-to-door walk: leads with a `route_order`, in the order you pass them, with the door pitch. "Langs geweest" logs a `visit` in the contact log and moves a fresh lead to Benaderd. The ↶ next to "Vandaag geweest" takes today's visit back (and returns the lead to Lead if that visit was its only contact).
- `/leads/importeren` also still takes cells pasted from a sheet (columns: Bedrijfsnaam, Branche, Locatie, Contactpersoon, Telefoonnummer, Email, Website status, Gevonden door, Status, Laatste contact, Notities); names that already exist are skipped (`features/clients/importLeads.ts`).
- Each lead and client has a **follow-up date** and a **contact log** (`contact_log`). Logging the first contact moves a fresh lead to Benaderd.
- The home page's **Vandaag** list shows sites that are down, late payments, follow-ups that are due and payments expected within a week.
- Late invoices and charges get a **Herinnering** button (opens WhatsApp or mail with the text filled in; nothing is sent by the Studio itself), and the cron job emails you once per item when it passes its due date (`features/money/overdueAlerts.ts`).
- The monthly report only says "+12% t.o.v. de maand ervoor" when both months were measured in full (not for the running month, not when tracking started halfway through the month before), and it names sources the way a client would ("Instagram", not "l.instagram.com"; `features/summary/sources.ts`).
- A site's **Maandrapport** tab is the monthly update for the client: a 1080 × 1350 picture rendered by `/api/report-image/[siteId]` (`next/og`, login required) that leads with results (per site you pick the number that comes first and gets the blue tile, `sites.report_lead`), plus a short message to send with it (`features/summary/`). On a phone, "Deel afbeelding" passes the picture to WhatsApp through the share sheet; on a computer "Kopieer afbeelding" puts it on the clipboard. Both hand over the picture only: sharing the message along made a share sheet's "Copy" paste two attachments.
- Events, Bezoekers, Rapporten and Live are marked `hidden` in `features/site-tabs/registry.ts`: out of the tab bar, still reachable from the bottom of the Stats tab.

## How versions work

- For each client site, `main` on GitHub is the live site and a second branch (default `concept`) is the version being worked on. The host (Vercel or Cloudflare Pages) builds that branch at its own preview address. The Studio never talks to the host: per site it stores the repo, the concept branch and the concept address (`sites.repo`, `concept_branch`, `concept_url`; set them under Bewerken → Versies).
- A site's **Versies** tab shows live and concept side by side, lists what the concept has that live doesn't (GitHub compare), and has the link to copy or send to the client. "Klant is akkoord" records the yes; both states show up under Vandaag.
- **Zet live** merges the concept branch into `main` through the GitHub API (`lib/github.ts`), after which the host deploys. It needs `GITHUB_TOKEN`; so does comparing a private repo. Without the token the tab still shows both versions and the link.
- The tab judges concept against live **by content**, not by commit counts (`conceptState`): both sides' changes since the branches split are compared file by file, so merge commits and a fix copied to both branches don't count as a difference. That gives the concept badge "Gelijk aan live" or "Loopt achter op live".
- When the concept is behind, **Haal live binnen** merges `main` into the concept (its own work stays), and with nothing of its own on the concept the button is **Zet gelijk aan live**. That button is also offered (with a confirm) to throw the concept's changes away: it adds one commit with live's files on top of the concept, with both branches as parents (`matchBranch`). Nothing is force-pushed, so the old work stays in GitHub's history.

## Stats (Umami-style analytics)

The **Stats** tab of a site works like [Umami](https://umami.is): visitors, visits, views, bounce rate and visit duration (with the change vs the previous period), a chart of views and visitors, and breakdowns by page (plus entry and exit pages), referrer, channel (search, social, email, paid ads, AI assistants, direct, …), UTM tag, browser, OS, device, screen, country, region, city and language. The **Live** tab shows the last 30 minutes (visitors, a per-minute chart and an activity feed) and refreshes every 5 seconds. The **Events** tab lists every custom event with its count, visitors and conversion, and each event's properties with their most common values. The **Bezoekers** tab lists recent (anonymous) visitors; click one for their timeline per visit.

**Filters** (like Umami's filter bar) work on Stats, Events, Bezoekers and Rapporten: click any row in a list (e.g. "Mobiel" or a country) or use "+ Filter" (page, title, referrer, event, UTM, tag, browser, OS, device, screen, language, country, region, city, visitor id; is / is not / contains / does not contain). Filters live in the URL (`?f=apparaat:eq:mobile`), so a filtered view can be bookmarked.

**Rapporten** (saved reports, ported from Umami's queries):

| Report | What it answers |
| --- | --- |
| Funnel | Of the visitors who did step 1, how many did step 2 within N minutes, then step 3, … Steps are pages or events; `*` is a wildcard (`/blog/*`). |
| Route (journey) | The most common sequences of pages and events within a visit, optionally starting or ending at a given step. |
| Retentie | Per day of first visit, the share of visitors who came back on day 1…14. (Visitor ids reset monthly, as in Umami, so returns across a month boundary aren't linked.) |
| Doel (goal) | The share of visitors who reached a page or event. | Pick a period: today, 24 hours, 7/30/90 days or 12 months. Custom trackers (with goals) are listed below that. The **Tracking** tab has the install snippet and the tracker editor.

The definitions are taken from Umami's source so the numbers mean the same thing:

| Metric | Meaning |
| --- | --- |
| Bezoekers (visitors) | Distinct anonymous sessions. Session id = hash of site + IP + user agent + a salt that changes every month + a secret. IP and user agent are never stored. |
| Bezoeken (visits) | A session's activity within the same clock hour; within one page load the tracker keeps the visit for up to 30 minutes (signed token, in page memory only). |
| Weergaven (views) | Pageviews. |
| Bouncepercentage | Visits with exactly one pageview and no custom event, ÷ visits. |
| Bezoekduur | Per visit, last pageview − first pageview; summed ÷ visits. |
| Kanaal | Per visit, from its first pageview: UTM tags, ad-click ids and the referrer's domain (Umami's domain lists). |
| Instap / uitstap | First / last page of each visit, counted in visitors. |

Country/region/city come from Vercel's free geo headers (empty in local development).

**On a client site**, in the `<head>`:

```html
<script defer src="https://studio.flitzweb.nl/t.js" data-site="SITE_KEY"></script>
```

Pageviews are sent automatically (also for client-side navigation). Custom events:

```js
flitz("order_placed");                     // count tracker
flitz("order_placed", { value: 24.50 });   // sum tracker
flitz("order_placed", { value: 24.50, meta: { type: "afhalen" } });
flitz.track("order_placed", { type: "afhalen", value: 24.50 });   // Umami-style
flitz.identify("klant-123", { soort: "vaste klant" });            // name a visitor
```

Clicks without JavaScript (like Umami's `data-umami-event`):

```html
<a href="tel:+31401234567" data-flitz-event="bel_klik" data-flitz-event-plek="header">Bel ons</a>
```

Moving a site from Umami: just swap the script tag. `data-umami-event` attributes and `umami.track()` / `umami.identify()` calls keep working. Script options: `data-auto-track="false"`, `data-domains="a.nl,b.nl"`, `data-tag="…"`, `data-do-not-track="true"`, `data-distinct-id="…"`.

Event properties follow Umami's rules: nested objects become dotted keys (`adres.stad`), max 50 properties, strings max 500 characters. Like Umami, any event name is accepted (max 50 characters); trackers just pick which events get a goal card on the Stats tab. `identify()` lasts for the current page (as in Umami); use `data-distinct-id` on the script tag to keep it across pages.

The tracker source is `src/tracker/t.ts`; `npm run build:tracker` (also run automatically before `npm run build`) minifies it into `public/t.js` (about 2.2 KB, 1.2 KB gzipped).

**From a server** (more reliable than browser JS, e.g. a booking API):

```bash
curl -X POST https://studio.flitzweb.nl/api/ingest \
  -H "Authorization: Bearer <site ingest secret>" \
  -H "Content-Type: application/json" \
  -d '{"event": "order_placed", "value": 24.50, "at": "2026-10-25T18:00:00Z"}'
```

Server events count for trackers but not as visitors (there is no browser session).

Privacy and safety (AVG/GDPR):
- No cookies and nothing stored in the visitor's browser. No IP addresses or user agents stored. Only the page path (query strings dropped, UTM tags kept), the referrer's host, and which ad-click id was present (not the id itself).
- `/api/collect` only accepts events whose `Origin` is the site's own domain (with or without `www`), ignores bots, and is rate-limited to 60 events per minute per visitor (IP hashed, in memory only).
- `/api/ingest` needs the site's secret and is limited to 600 events per minute per site.
- Events older than 400 days are deleted by the cron job.
- To not count your own visits: on the client site, run `localStorage.setItem("flitz-ignore", "1")` in the browser console.

## Project layout

```
src/
  app/
    (dashboard)/        pages behind the login (layout = header + auth check)
      nav.ts            main menu: add a line here for a new section
      sites/[id]/[[...tab]]/  site detail page, renders the tab registry
    api/cron/check/     uptime cron endpoint (also creates monthly charges, prunes old data)
    api/collect/        browser events from t.js
    api/ingest/         server-to-server events
    geld/               money pages
    klanten/            client pages
    login/, auth/verify/ magic-link login
  features/
    site-tabs/          one file per tab + registry.ts (add tabs here)
    uptime/             site cards, status dot, chart, "Check nu"
    clients/, sites/    forms, contact buttons
    money/              invoices, subscriptions, charges, totals
    stats/              stats queries, metric cards, tracker editor, snippets
  lib/
    auth.ts, session.ts magic link + signed session cookie
    uptime/             probe (HTTP + TLS), run (store + alert), queries
    events/             validate + store events, rate limiter, pruning
    analytics/          Umami-style sessions/visits, client detection, periods, queries
  tracker/t.ts          source of the tracking script (built to public/t.js)
    format.ts           Dutch date/euro formatting, Europe/Amsterdam
    email.ts            Resend wrapper (prints to terminal without a key)
  db/
    schema.ts           all tables
    seed.ts
  proxy.ts              redirects logged-out visitors to /login
public/t.js             built tracking script (do not edit; see src/tracker/t.ts)
drizzle/                generated SQL migrations (commit these)
```

### Adding a tab to the site page
Create `src/features/site-tabs/MyTab.tsx` (a component that takes `{ site }`), then add one line to `siteTabs` in `registry.ts`. Use `visible` to hide it for some sites.

### Changing the database
Edit `src/db/schema.ts`, then:

```bash
npm run db:generate   # writes a new SQL file in drizzle/
npm run db:migrate    # applies it locally
```

Commit the migration. Vercel applies it on the next deploy.

### Conventions
- UI copy in Dutch, code and comments in English.
- Money as integer cents (`formatEuro(cents)`), dates shown in Europe/Amsterdam (`lib/format.ts`).
- Colours and spacing only via the CSS variables in `src/app/globals.css`. Light/dark both come from there.

## Next.js notes
This is Next.js 16: middleware is called `proxy.ts`, and the docs for this exact version are in `node_modules/next/dist/docs/`. **Cache Components** (`cacheComponents`) is turned off on purpose: every page reads the login cookie and should always show fresh data, so plain request-time rendering keeps the code simpler.

## Credits

The analytics model (sessions, visits, bounce and duration definitions, device detection, tracker behaviour) is adapted from [Umami](https://github.com/umami-software/umami), MIT License, Copyright (c) 2022 Umami Software, Inc.
