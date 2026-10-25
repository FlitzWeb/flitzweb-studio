"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import styles from "@/features/uptime/chart.module.css";
import { bucketLabel, type Unit } from "./buckets";

type Point = { bucket: string; views: number; visitors: number };

/** Views as bars, visitors as a line, Umami-style. One shared axis. */
export function TrafficChart({ points, unit }: { points: Point[]; unit: Unit }) {
  const label = bucketLabel(unit);

  return (
    <div className={styles.chart}>
      <div className={styles.legend} aria-hidden="true">
        <span>
          <i className={styles.swatchBar} /> Weergaven
        </span>
        <span>
          <i className={styles.swatchLine} /> Bezoekers
        </span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
          <XAxis
            dataKey="bucket"
            tickFormatter={label}
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, var(--ink) 6%, transparent)" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Point | undefined;
              if (!active || !p) return null;
              return (
                <div className={styles.tooltip}>
                  <span>{label(p.bucket)}</span>
                  <strong>{p.visitors.toLocaleString("nl-NL")} bezoekers</strong>
                  <span>{p.views.toLocaleString("nl-NL")} weergaven</span>
                </div>
              );
            }}
          />
          <Bar dataKey="views" fill="var(--chart-bar)" radius={[5, 5, 0, 0]} isAnimationActive={false} />
          <Line
            type="linear"
            dataKey="visitors"
            stroke="var(--chart-line)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
