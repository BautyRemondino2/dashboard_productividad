"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { HabitConsistencyPoint } from "@/lib/types";

interface Props {
  data: HabitConsistencyPoint[];
}

function shortDate(d: string) {
  const [, m, day] = d.split("-");
  return `${parseInt(day)}/${parseInt(m)}`;
}

export default function HabitConsistencyChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-600 py-4 text-center">
        Sin registros de hábitos aún.
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="habitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(data.length / 6)}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
            labelStyle={{ color: "#94a3b8", fontSize: 11 }}
            itemStyle={{ color: "#cbd5e1", fontSize: 11 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((v: unknown) => [`${v}%`, "Completados"]) as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={((d: unknown) => shortDate(String(d))) as any}
          />
          <Area
            type="monotone"
            dataKey="pct"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill="url(#habitGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
