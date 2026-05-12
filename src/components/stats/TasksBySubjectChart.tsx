"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";
import type { WeeklySubjectBar } from "@/lib/types";

interface Props {
  data: WeeklySubjectBar[];
  subjects: string[];
}

const SUBJECT_COLORS = [
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#06b6d4", // cyan
];

function shortWeek(week: string) {
  const [, w] = week.split("-W");
  return `S${parseInt(w)}`;
}

export default function TasksBySubjectChart({ data, subjects }: Props) {
  if (data.length === 0 || subjects.length === 0) {
    return (
      <p className="text-sm text-slate-600 py-4 text-center">
        Completá tareas vinculadas a materias para ver el gráfico.
      </p>
    );
  }

  // Short names for display
  const shortName = (s: string) => {
    const words = s.split(" ");
    return words.length === 1 ? s.slice(0, 8) : words.map(w => w[0]).join("").slice(0, 4);
  };

  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} barSize={8}>
          <XAxis
            dataKey="week"
            tickFormatter={shortWeek}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
            labelStyle={{ color: "#94a3b8", fontSize: 11 }}
            itemStyle={{ color: "#cbd5e1", fontSize: 11 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((v: unknown, name: unknown) => [String(v), String(name)]) as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={((w: unknown) => shortWeek(String(w))) as any}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, color: "#64748b", paddingTop: 8 }}
            formatter={(value) => shortName(String(value))}
          />
          {subjects.map((subject, i) => (
            <Bar
              key={subject}
              dataKey={subject}
              stackId="a"
              fill={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
              radius={i === subjects.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
