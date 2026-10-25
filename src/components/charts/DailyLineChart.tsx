"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import styles from "@/features/uptime/chart.module.css";

type Point = { day: string; value: number };

const dayFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", day: "numeric", month: "short" });
const label = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));
const num = (v: number) => v.toLocaleString("nl-NL", { maximumFractionDigits: 2 });

/** One series per day (e.g. the last 30 days of a tracker). */
export function DailyLineChart({ points, unitLabel }: { points: Point[]; unitLabel: string }) {
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fill-value-daily" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.2} />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
          <XAxis
            dataKey="day"
            tickFormatter={label}
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={num}
          />
          <Tooltip
            cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Point | undefined;
              if (!active || !p) return null;
              return (
                <div className={styles.tooltip}>
                  <strong>
                    {num(p.value)} {unitLabel}
                  </strong>
                  <span>{label(p.day)}</span>
                </div>
              );
            }}
          />
          <Area
            // Straight segments: a smoothed curve would invent values between days.
            type="linear"
            dataKey="value"
            stroke="var(--chart-line)"
            fill="url(#fill-value-daily)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
