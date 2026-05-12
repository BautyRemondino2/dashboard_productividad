"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import type { SubjectROI } from "@/lib/types";

interface Props {
  data: SubjectROI[];
}

function shortName(name: string) {
  // Abbreviate "Capital Markets" → "Cap. Mkt", etc.
  const words = name.split(" ");
  if (words.length === 1) return name.slice(0, 8);
  return words.map(w => w.slice(0, 3)).join(" ");
}

export default function StudyROIChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-slate-600">
          Todavía no registraste sesiones de estudio.
        </p>
        <p className="text-xs text-slate-700 mt-1">
          Usá el formulario de abajo para empezar a trackear.
        </p>
      </div>
    );
  }

  // Chart 1: hours per subject
  const hoursData = data.map(d => ({
    name:  shortName(d.subjectName),
    full:  d.subjectName,
    hours: parseFloat((d.totalMinutes / 60).toFixed(1)),
    grade: d.avgGrade,
  }));

  return (
    <div className="space-y-6">
      {/* Hours bar */}
      <div>
        <p className="text-xs text-slate-600 mb-3">Horas de estudio por materia</p>
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hoursData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={20}>
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} unit="h" />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
                labelStyle={{ color: "#94a3b8", fontSize: 11 }}
                itemStyle={{ color: "#cbd5e1", fontSize: 11 }}
                formatter={(v: unknown, _: unknown, props: { payload?: { full?: string; grade?: number | null } }) => {
                  const p = props?.payload;
                  const label = `${Number(v)}h${p?.grade != null ? ` · nota ${p.grade.toFixed(1)}` : ""}`;
                  return [label, p?.full ?? ""];
                }}
                labelFormatter={() => ""}
              />
              {hoursData.map((d, i) => (
                <Cell key={i} fill={d.grade != null && d.grade >= 7 ? "#10b981" : d.grade != null ? "#f59e0b" : "#334155"} />
              ))}
              <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                {hoursData.map((d, i) => (
                  <Cell key={i} fill={d.grade != null && d.grade >= 7 ? "#10b981" : d.grade != null ? "#f59e0b" : "#3b82f6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ROI table */}
      <div>
        <p className="text-xs text-slate-600 mb-2">Eficiencia (nota / hora de estudio)</p>
        <div className="space-y-1.5">
          {data
            .filter(d => d.roi !== null)
            .sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0))
            .map(d => {
              const roi     = d.roi!;
              const maxRoi  = Math.max(...data.map(x => x.roi ?? 0));
              const pct     = maxRoi > 0 ? (roi / maxRoi) * 100 : 0;
              const color   = roi > 1 ? "bg-emerald-500" : roi > 0.5 ? "bg-amber-500" : "bg-red-500";
              return (
                <div key={d.subjectId} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-40 truncate shrink-0">{d.subjectName}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-slate-400 w-12 text-right shrink-0">
                    {roi.toFixed(2)}/h
                  </span>
                </div>
              );
            })}
        </div>
        {data.filter(d => d.roi === null).length > 0 && (
          <p className="text-xs text-slate-700 mt-2">
            {data.filter(d => d.roi === null).map(d => d.subjectName).join(", ")} — sin nota registrada todavía
          </p>
        )}
      </div>
    </div>
  );
}
