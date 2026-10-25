"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="day"
            tickFormatter={label}
            tick={{ fill: "var(--ink-faint)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--ink-faint)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={num}
          />
          <Tooltip
            cursor={{ stroke: "var(--ink-faint)", strokeDasharray: "3 3" }}
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
          <Line
            // Straight segments: a smoothed curve would invent values between days.
            type="linear"
            dataKey="value"
            stroke="var(--chart-line)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
