"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import styles from "@/features/uptime/chart.module.css";
import { bucketLabel, type Unit } from "./buckets";

type Point = { bucket: string; value: number };

const num = (v: number) => v.toLocaleString("nl-NL", { maximumFractionDigits: 2 });

/** One tracker's value per hour, day or month over the chosen period. */
export function TrackerChart({ points, unit, unitLabel }: { points: Point[]; unit: Unit; unitLabel: string }) {
  const label = bucketLabel(unit);

  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fill-value-tracker" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.2} />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
          <XAxis
            dataKey="bucket"
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
                  <span>{label(p.bucket)}</span>
                </div>
              );
            }}
          />
          <Area
            // Straight segments: a smoothed curve would invent values between buckets.
            type="linear"
            dataKey="value"
            stroke="var(--chart-line)"
            fill="url(#fill-value-tracker)"
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
