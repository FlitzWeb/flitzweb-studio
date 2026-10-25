import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { PAGEVIEW } from "@/lib/events/record";
import { filterSql } from "./filters";
import type { Period } from "./periods";
import type { Breakdown } from "./queries";

// Where visitors come from: channels, UTM tags, entry and exit pages.
// Logic follows Umami's getChannelMetrics, getUTM and getPageviewMetrics.

// Domain lists copied from Umami's src/lib/constants.ts.
const SEARCH = ["baidu.com", "bing.com", "duckduckgo.com", "ecosia.org", "google.", "msn.com", "search.brave.com", "yandex."];
const SOCIAL = [
  "bsky.app", "facebook.com", "fb.com", "ig.com", "instagram.com", "linkedin.", "news.ycombinator.com",
  "pinterest.", "reddit.", "snapchat.", "t.co", "threads.net", "tiktok.", "twitter.com", "x.com",
];
const LLM = ["chatgpt.com", "claude.ai", "copilot.microsoft.com", "gemini.google.com", "meta.ai", "perplexity.ai"];
const SHOPPING = ["alibaba.com", "aliexpress.com", "amazon.", "bestbuy.com", "ebay.com", "etsy.com", "newegg.com", "target.com", "walmart.com"];
const EMAIL = ["gmail.", "hotmail.", "mail.yahoo.", "outlook.", "proton.me", "protonmail."];
const VIDEO = ["twitch.", "youtube."];

/** `col ilike '%a%' or col ilike '%b%' ...` with safely bound values. */
const likeAny = (col: SQL, values: string[]) =>
  sql.join(
    values.map((v) => sql`${col} ilike ${`%${v}%`}`),
    sql` or `,
  );

// Site + date range + active filters, for queries on the events table without an alias.
const range = (siteId: number, p: Period) =>
  sql`site_id = ${siteId} and occurred_at between ${p.from.toISOString()} and ${p.to.toISOString()} ${filterSql(p.filters)}`;

export const CHANNEL_LABELS: Record<string, string> = {
  direct: "Direct",
  paidAds: "Betaalde advertenties",
  referral: "Verwijzingen",
  affiliate: "Affiliates",
  sms: "Sms",
  llm: "AI-assistenten",
  organicSearch: "Zoekmachines",
  paidSearch: "Zoekmachines (betaald)",
  organicSocial: "Social media",
  paidSocial: "Social media (betaald)",
  email: "E-mail",
  organicShopping: "Shopping",
  paidShopping: "Shopping (betaald)",
  organicVideo: "Video",
  paidVideo: "Video (betaald)",
};

/** Visitors per channel. Each visit gets the channel of its first pageview. */
export async function getChannels(siteId: number, p: Period): Promise<Breakdown> {
  const ref = sql.raw("coalesce(referrer, '')");
  const medium = sql.raw("coalesce(utm_medium, '')");
  const source = sql.raw("coalesce(utm_source, '')");

  return db.execute<{ label: string; count: number }>(sql`
    with prefix as (
      select
        case when ${medium} ilike 'p%' or ${medium} ilike '%ppc%' or ${medium} ilike '%retargeting%'
          or ${medium} ilike '%paid%' then 'paid' else 'organic' end as prefix,
        referrer, utm_medium, utm_source, ad_click, session_id, visit_id, id, occurred_at
      from events
      where ${range(siteId, p)} and event_key = ${PAGEVIEW} and session_id is not null
    ),
    channels as (
      select case
        when referrer is null and utm_source is null and utm_medium is null and ad_click is null then 'direct'
        when ad_click is not null or ${medium} in ('cpc', 'paid', 'paid_social') or ${source} = 'google' then 'paidAds'
        when ${medium} in ('referral', 'app', 'link') then 'referral'
        when ${medium} ilike '%affiliate%' then 'affiliate'
        when ${medium} ilike '%sms%' or ${source} ilike '%sms%' then 'sms'
        when ${likeAny(ref, LLM)} then 'llm'
        when ${likeAny(ref, SEARCH)} or ${medium} ilike '%organic%' then prefix || 'Search'
        when ${likeAny(ref, SOCIAL)} then prefix || 'Social'
        when ${likeAny(ref, EMAIL)} or ${medium} ilike '%mail%' then 'email'
        when ${likeAny(ref, SHOPPING)} or ${medium} ilike '%shop%' then prefix || 'Shopping'
        when ${likeAny(ref, VIDEO)} or ${medium} ilike '%video%' then prefix || 'Video'
        when referrer is not null then 'referral'
        else '' end as x,
        session_id, visit_id, id, occurred_at
      from prefix
    ),
    visit_channels as (
      select session_id, coalesce(nullif(x, ''), 'direct') as x
      from (
        select x, session_id,
          row_number() over (
            partition by session_id, visit_id
            order by case when x <> '' then 0 else 1 end, occurred_at, id
          ) as row_num
        from channels
      ) ranked
      where row_num = 1
    )
    select x as label, count(distinct session_id)::int as count
    from visit_channels group by 1 order by 2 desc
  `);
}

/** Visitors by the first (entry) or last (exit) page of their visits. */
export async function getEntryExit(siteId: number, p: Period, kind: "entry" | "exit"): Promise<Breakdown> {
  const order = sql.raw(kind === "entry" ? "asc" : "desc");
  return db.execute<{ label: string; count: number }>(sql`
    select x.path as label, count(distinct e.session_id)::int as count
    from events e
    join (
      select distinct on (visit_id) visit_id, path
      from events
      where ${range(siteId, p)} and event_key = ${PAGEVIEW} and visit_id is not null
      order by visit_id, occurred_at ${order}
    ) x on x.visit_id = e.visit_id
    where e.site_id = ${siteId}
      and e.occurred_at between ${p.from.toISOString()} and ${p.to.toISOString()}
      and e.event_key = ${PAGEVIEW}
      and x.path is not null
      ${filterSql(p.filters, "e")}
    group by 1 order by 2 desc limit 10
  `);
}

const UTM_COLUMNS = {
  source: "utm_source",
  medium: "utm_medium",
  campaign: "utm_campaign",
  content: "utm_content",
  term: "utm_term",
} as const;

/** Pageviews per value of each UTM tag (Umami's UTM report). */
export async function getUtm(siteId: number, p: Period) {
  const entries = await Promise.all(
    Object.entries(UTM_COLUMNS).map(async ([key, column]) => {
      const col = sql.raw(column);
      const rows = await db.execute<{ label: string; count: number }>(sql`
        select ${col} as label, count(*)::int as count
        from events
        where ${range(siteId, p)} and event_key = ${PAGEVIEW} and coalesce(${col}, '') <> ''
        group by 1 order by 2 desc limit 10
      `);
      return [key, [...rows] as Breakdown] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<keyof typeof UTM_COLUMNS, Breakdown>;
}
