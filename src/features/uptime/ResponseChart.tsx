"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTime } from "@/lib/format";
import styles from "./chart.module.css";

type Point = { t: number; ms: number | null };

/** Response time line. Failed checks are gaps in the line. */
export function ResponseChart({ points }: { points: Point[] }) {
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => formatTime(new Date(t))}
            tick={{ fill: "var(--ink-faint)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "var(--ink-faint)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={64}
            tickFormatter={(v) => `${v} ms`}
          />
          <Tooltip
            cursor={{ stroke: "var(--ink-faint)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Point | undefined;
              if (!active || !p) return null;
              return (
                <div className={styles.tooltip}>
                  <strong>{p.ms == null ? "Offline" : `${p.ms} ms`}</strong>
                  <span>{formatTime(new Date(p.t))}</span>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="ms"
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
