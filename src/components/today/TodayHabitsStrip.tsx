"use client";

import { useTransition } from "react";
import { toggleHabitLog } from "@/app/actions";

interface HabitStatus {
  id: number;
  name: string;
  done: boolean;
}

interface Props {
  habits: HabitStatus[];
  today: string;
}

export default function TodayHabitsStrip({ habits, today }: Props) {
  if (habits.length === 0) return null;

  const done  = habits.filter(h => h.done).length;
  const total = habits.length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Hábitos hoy</p>
        <p className={`text-xs tabular-nums font-medium ${done === total ? "text-emerald-400" : "text-slate-500"}`}>
          {done}/{total}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {habits.map(h => (
          <HabitChip key={h.id} habit={h} today={today} />
        ))}
      </div>
    </div>
  );
}

function HabitChip({ habit, today }: { habit: HabitStatus; today: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() => start(() => toggleHabitLog(habit.id, today))}
      disabled={pending}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
        habit.done
          ? "bg-emerald-900/50 border border-emerald-700 text-emerald-300"
          : "bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
      }`}
    >
      {habit.done ? "✓ " : ""}{habit.name}
    </button>
  );
}
