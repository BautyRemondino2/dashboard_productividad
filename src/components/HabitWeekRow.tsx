"use client";

import { useTransition } from "react";
import { toggleHabitLog } from "@/app/actions";
import type { Habit } from "@/lib/types";

interface Props {
  habit: Habit;
  weekDates: string[];
  loggedDates: string[];
  streak: number;
  today: string;
}

export default function HabitWeekRow({ habit, weekDates, loggedDates, streak, today }: Props) {
  const [pending, startTransition] = useTransition();
  const logSet = new Set(loggedDates);

  function handleToggle(date: string) {
    startTransition(() => toggleHabitLog(habit.id, date));
  }

  return (
    <div
      className={`grid grid-cols-[1fr_auto_repeat(7,2rem)] items-center gap-x-3 px-3 py-2.5 rounded-lg hover:bg-slate-900 transition-colors ${
        pending ? "opacity-50" : ""
      }`}
    >
      {/* Habit name */}
      <span className="text-sm text-slate-200 truncate">{habit.name}</span>

      {/* Streak */}
      <div className="w-12 flex items-center justify-end gap-1">
        {streak > 0 && (
          <>
            <span className="text-xs text-amber-400">{streak}</span>
            <span className="text-xs text-amber-500">🔥</span>
          </>
        )}
        {streak === 0 && <span className="text-xs text-slate-700">—</span>}
      </div>

      {/* Day checkboxes */}
      {weekDates.map((date) => {
        const done = logSet.has(date);
        const isToday = date === today;
        const isFuture = date > today;
        return (
          <button
            key={date}
            disabled={pending || isFuture}
            onClick={() => !isFuture && handleToggle(date)}
            aria-label={`${habit.name} — ${date}`}
            className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
              isFuture
                ? "cursor-default"
                : done
                ? "bg-emerald-900 hover:bg-emerald-800"
                : isToday
                ? "border border-slate-600 hover:border-slate-400"
                : "hover:bg-slate-800"
            }`}
          >
            {done ? (
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 10 10" fill="none">
                <path
                  d="M1.5 5l2.5 2.5 4.5-5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isFuture ? "bg-slate-800" : isToday ? "bg-slate-500" : "bg-slate-800"
                }`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
