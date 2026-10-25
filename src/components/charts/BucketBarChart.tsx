"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import styles from "@/features/uptime/chart.module.css";
import { bucketLabel, type Unit } from "./buckets";

type Point = { bucket: string; count: number };

/** One series of bars per hour/day/month bucket. */
export function BucketBarChart({ points, unit, unitLabel }: { points: Point[]; unit: Unit; unitLabel: string }) {
  const label = bucketLabel(unit);
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="bucket" tickFormatter={label} tick={{ fill: "var(--ink-faint)", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--ink-faint)", fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, var(--ink) 6%, transparent)" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Point | undefined;
              if (!active || !p) return null;
              return (
                <div className={styles.tooltip}>
                  <span>{label(p.bucket)}</span>
                  <strong>
                    {p.count.toLocaleString("nl-NL")} {unitLabel}
                  </strong>
                </div>
              );
            }}
          />
          <Bar dataKey="count" fill="var(--chart-line)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
