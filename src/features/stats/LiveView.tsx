"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatTile, StatTiles } from "@/components/StatTile";
import chartStyles from "@/features/uptime/chart.module.css";
import { browserLabel, countryLabel, deviceLabel } from "@/lib/analytics/labels";
import type { RealtimeData, RealtimeEvent } from "@/lib/analytics/realtime";
import { BreakdownCard } from "./BreakdownCard";
import styles from "./stats.module.css";

const POLL_MS = 5000;
const timeFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Umami-style realtime view: last 30 minutes, refreshed every 5 seconds. */
export function LiveView({ siteId, initial }: { siteId: number; initial: RealtimeData }) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/realtime/${siteId}`, { cache: "no-store" });
        if (res.ok && !stop) setData(await res.json());
      } catch {}
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [siteId]);

  const t = data.totals;
  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <span className={styles.live}>
          <i aria-hidden="true" /> Live · laatste 30 minuten
        </span>
        <span className={styles.muted}>Bijgewerkt {timeFmt.format(new Date(data.at))}</span>
      </div>

      <section className={styles.panel}>
        <StatTiles min={110}>
          <StatTile label="Bezoekers" value={t.visitors} />
          <StatTile label="Weergaven" value={t.views} />
          <StatTile label="Events" value={t.events} />
          <StatTile label="Landen" value={t.countries} />
        </StatTiles>
        <div className={chartStyles.chart}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.minutes} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="minute" tick={{ fill: "var(--ink-faint)", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={32} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--ink-faint)", fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                cursor={{ fill: "color-mix(in srgb, var(--ink) 6%, transparent)" }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as RealtimeData["minutes"][number] | undefined;
                  if (!active || !p) return null;
                  return (
                    <div className={chartStyles.tooltip}>
                      <span>{p.minute}</span>
                      <strong>{p.views} weergaven</strong>
                      <span>{p.visitors} bezoekers</span>
                    </div>
                  );
                }}
              />
              <Bar dataKey="views" fill="var(--chart-line)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className={styles.columns}>
        <section className={styles.panel}>
          <h2 className={styles.h2}>Activiteit</h2>
          {data.events.length === 0 ? (
            <p className={styles.muted}>Nu even niemand op de site.</p>
          ) : (
            <ol className={styles.feed}>
              {data.events.slice(0, 40).map((e, i) => (
                <li key={`${e.sessionId}-${e.at}-${e.type}-${i}`} data-type={e.type}>
                  <time>{timeFmt.format(new Date(e.at))}</time>
                  <span>{describe(e)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <div className={styles.stack}>
          <BreakdownCard
            empty="Geen bezoeken in de laatste 30 minuten."
            tabs={[
              { label: "Pagina's", measure: "Weergaven", total: t.views, rows: data.pages },
              { label: "Verwijzers", measure: "Weergaven", total: t.views, rows: data.referrers },
              {
                label: "Landen",
                measure: "Bezoekers",
                total: t.visitors,
                rows: data.countries.map((r) => ({ ...r, label: countryLabel(r.label) })),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function describe(e: RealtimeEvent) {
  if (e.type === "session") {
    const where = e.city ?? (e.country ? countryLabel(e.country) : null);
    const what = [e.browser && browserLabel(e.browser), e.os, e.device && deviceLabel(e.device).toLowerCase()]
      .filter(Boolean)
      .join(", ");
    return `Nieuwe bezoeker${where ? ` uit ${where}` : ""}${what ? ` (${what})` : ""}${e.referrer ? ` via ${e.referrer}` : ""}`;
  }
  if (e.type === "event") return `Event “${e.eventKey}” op ${e.path ?? "?"}`;
  return `Bekeek ${e.path ?? "?"}`;
}
