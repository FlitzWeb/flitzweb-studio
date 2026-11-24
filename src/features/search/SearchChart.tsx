"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bucketLabel } from "@/components/charts/buckets";
import styles from "@/features/uptime/chart.module.css";
import { formatCtr, formatPosition } from "./labels";

type Point = { bucket: string; clicks: number; impressions: number; position: number | null };

/**
 * Clicks as bars (left axis) and impressions as a line (right axis): impressions
 * are often fifty times the clicks, so one shared axis would flatten the bars.
 */
export function SearchChart({ points, unit }: { points: Point[]; unit: "day" | "month" }) {
  const label = bucketLabel(unit);
  const axis = { fill: "var(--ink-3)", fontSize: 12 };

  return (
    <div className={styles.chart}>
      <div className={styles.legend} aria-hidden="true">
        <span>
          <i className={styles.swatchBar} /> Klikken
        </span>
        <span>
          <i className={styles.swatchLine} /> Vertoningen
        </span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="4 4" />
          <XAxis dataKey="bucket" tickFormatter={label} tick={axis} axisLine={false} tickLine={false} minTickGap={28} />
          <YAxis yAxisId="clicks" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={40} />
          <YAxis yAxisId="impressions" orientation="right" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, var(--ink) 6%, transparent)" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Point | undefined;
              if (!active || !p) return null;
              return (
                <div className={styles.tooltip}>
                  <span>{label(p.bucket)}</span>
                  <strong>{p.clicks.toLocaleString("nl-NL")} klikken</strong>
                  <span>{p.impressions.toLocaleString("nl-NL")} vertoningen</span>
                  <span>
                    CTR {formatCtr(p.clicks, p.impressions)} · positie {formatPosition(p.position)}
                  </span>
                </div>
              );
            }}
          />
          <Bar yAxisId="clicks" dataKey="clicks" fill="var(--chart-bar)" radius={[5, 5, 0, 0]} isAnimationActive={false} />
          <Line
            yAxisId="impressions"
            type="linear"
            dataKey="impressions"
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
