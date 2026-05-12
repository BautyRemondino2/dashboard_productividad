"use client";

import type { HeatmapDay } from "@/lib/types";

interface Props {
  data: HeatmapDay[];
}

const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DAYS   = ["L","M","X","J","V","S","D"];

function colorForCount(n: number) {
  if (n === 0) return "bg-slate-800";
  if (n === 1) return "bg-emerald-900";
  if (n === 2) return "bg-emerald-800";
  if (n <= 4)  return "bg-emerald-600";
  return "bg-emerald-400";
}

export default function ActivityHeatmap({ data }: Props) {
  // Build a lookup map date → count
  const byDate = new Map<string, number>(data.map(d => [d.date, d.count]));

  // Build 53 weeks grid: start from 364 days ago (Mon of that week)
  const today     = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the Monday of the week that started 364 days ago
  const startDay  = new Date(today);
  startDay.setDate(today.getDate() - 364);
  // Align to Monday (day 1): go back to the Monday of that week
  const dow       = startDay.getDay(); // 0=Sun, 1=Mon, ...
  const toMon     = dow === 0 ? -6 : 1 - dow;
  startDay.setDate(startDay.getDate() + toMon);

  // Build column × row grid (col = week, row = day 0=Mon..6=Sun)
  const weeks: { date: string; count: number; isFuture: boolean }[][] = [];
  const cur = new Date(startDay);

  while (cur <= today) {
    const week: { date: string; count: number; isFuture: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().slice(0, 10);
      week.push({
        date:     iso,
        count:    byDate.get(iso) ?? 0,
        isFuture: cur > today,
      });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  // Month labels: find where each month starts in the week grid
  const monthLabels: { col: number; label: string }[] = [];
  weeks.forEach((week, col) => {
    const day1 = week[0].date;
    const m = parseInt(day1.slice(5, 7)) - 1;
    const d = parseInt(day1.slice(8, 10));
    if (d <= 7) {
      monthLabels.push({ col, label: MONTHS[m] });
    }
  });

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 min-w-max">
        {/* Month labels */}
        <div className="flex gap-0.5 mb-1 ml-5">
          {weeks.map((_, col) => {
            const lbl = monthLabels.find(ml => ml.col === col);
            return (
              <div key={col} className="w-2.5 text-[9px] text-slate-600 text-center">
                {lbl ? lbl.label : ""}
              </div>
            );
          })}
        </div>

        {/* Grid rows (Mon–Sun) */}
        {DAYS.map((dayLabel, row) => (
          <div key={row} className="flex items-center gap-0.5">
            <span className="w-4 text-[9px] text-slate-600 text-right mr-1 select-none">
              {row % 2 === 0 ? dayLabel : ""}
            </span>
            {weeks.map((week, col) => {
              const cell = week[row];
              if (!cell) return <div key={col} className="w-2.5 h-2.5" />;
              return (
                <div
                  key={col}
                  title={`${cell.date}: ${cell.count} tarea${cell.count !== 1 ? "s" : ""}`}
                  className={`w-2.5 h-2.5 rounded-[2px] transition-colors ${
                    cell.isFuture ? "bg-slate-900" : colorForCount(cell.count)
                  }`}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-1 mt-2 ml-5">
          <span className="text-[9px] text-slate-600 mr-1">Menos</span>
          {[0,1,2,3,5].map(n => (
            <div key={n} className={`w-2.5 h-2.5 rounded-[2px] ${colorForCount(n)}`} />
          ))}
          <span className="text-[9px] text-slate-600 ml-1">Más</span>
        </div>
      </div>
    </div>
  );
}
