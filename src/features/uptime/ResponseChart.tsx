"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTime } from "@/lib/format";
import styles from "./chart.module.css";

type Point = { t: number; ms: number | null };

/** Response time line. Failed checks are gaps in the line. */
export function ResponseChart({ points }: { points: Point[] }) {
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fill-ms-resp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.2} />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
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
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "var(--ink-3)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={64}
            tickFormatter={(v) => `${v} ms`}
          />
          <Tooltip
            cursor={{ stroke: "var(--ink-3)", strokeDasharray: "3 3" }}
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
          <Area
            type="monotone"
            dataKey="ms"
            stroke="var(--chart-line)"
            fill="url(#fill-ms-resp)"
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
