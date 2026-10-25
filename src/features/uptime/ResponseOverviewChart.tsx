"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTime } from "@/lib/format";
import styles from "./chart.module.css";

export type ResponseSeries = { key: string; name: string; color: string; avg: number | null };
type Point = { t: number } & Record<string, number | null>;

/** Response time of every live site over the last 24 hours, one line each. */
export function ResponseOverviewChart({ points, series }: { points: Point[]; series: ResponseSeries[] }) {
  return (
    <div className={styles.chart}>
      {series.length > 1 && (
        <ul className={styles.legend}>
          {series.map((s) => (
            <li key={s.key}>
              <i className={styles.swatchLine} style={{ background: s.color }} aria-hidden="true" />
              {s.name}
              {s.avg != null && <small className="num">{s.avg} ms</small>}
            </li>
          ))}
        </ul>
      )}
      <ResponsiveContainer width="100%" height={232}>
        <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity={series.length > 1 ? 0.12 : 0.2} />
                <stop offset="1" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => formatTime(new Date(t))}
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
            tickMargin={8}
          />
          <YAxis
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={58}
            tickFormatter={(v) => `${v} ms`}
          />
          <Tooltip
            cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className={styles.tooltip}>
                  <span>{formatTime(new Date(Number(label)))}</span>
                  {series.map((s) => {
                    const v = payload.find((p) => p.dataKey === s.key)?.value;
                    return (
                      <span key={s.key} className={styles.tooltipRow}>
                        <i style={{ background: s.color }} aria-hidden="true" />
                        {s.name}
                        <strong className="num">{v == null ? "–" : `${v} ms`}</strong>
                      </span>
                    );
                  })}
                </div>
              );
            }}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#fill-${s.key})`}
              connectNulls
              dot={false}
              activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
