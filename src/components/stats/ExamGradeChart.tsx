"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import type { ExamGradePoint } from "@/lib/types";

interface Props {
  data: ExamGradePoint[];
}

const EXAM_TYPE_LABELS: Record<string, string> = {
  parcial: "Parcial", final: "Final", tp: "TP", quiz: "Quiz", otro: "Otro",
};

function shortDate(d: string) {
  const [, m, day] = d.split("-");
  return `${parseInt(day)}/${parseInt(m)}`;
}

function gradeColor(g: number) {
  if (g >= 8) return "#10b981"; // emerald
  if (g >= 6) return "#f59e0b"; // amber
  if (g >= 4) return "#f97316"; // orange
  return "#ef4444";              // red
}

export default function ExamGradeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-600 py-4 text-center">
        Cargá notas en tus exámenes para ver el historial.
      </p>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    label: `${d.title} (${EXAM_TYPE_LABELS[d.type]})`,
  }));

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} barSize={20}>
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 10]}
            ticks={[0, 2, 4, 6, 8, 10]}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={4} stroke="#374151" strokeDasharray="3 3" />
          <ReferenceLine y={7} stroke="#374151" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
            labelStyle={{ color: "#94a3b8", fontSize: 11 }}
            itemStyle={{ color: "#cbd5e1", fontSize: 11 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((v: unknown, _: unknown, item: any) => [`${v}/10`, item?.payload?.subject ?? ""]) as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={((d: unknown, payload: any) => payload?.[0]?.payload?.label ?? shortDate(String(d))) as any}
          />
          <Bar dataKey="grade" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={gradeColor(entry.grade)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
