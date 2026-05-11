import { getDb } from "@/lib/db";
import type { Habit, HabitLog } from "@/lib/types";
import { localDateStr } from "@/lib/utils";
import HabitWeekRow from "@/components/HabitWeekRow";
import AddHabitInline from "@/components/AddHabitInline";

function calcStreak(logDates: Set<string>): number {
  let streak = 0;
  const date = new Date();
  if (!logDates.has(localDateStr())) {
    date.setDate(date.getDate() - 1);
  }
  while (true) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const ds = `${y}-${m}-${d}`;
    if (!logDates.has(ds)) break;
    streak++;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export default function HabitosPage() {
  const db = getDb();
  const habits = db
    .prepare("SELECT * FROM habits WHERE active = 1 ORDER BY created_at")
    .all() as Habit[];

  const today = localDateStr();

  // Build week dates using local timezone
  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay(); // 0 = Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekDates = Array.from({ length: 7 }, (_, i) => localDateStr(i - daysFromMonday));

  // Load all logs for the past 60 days (enough for streak calc)
  const since = localDateStr(-60);
  const allLogs = db
    .prepare("SELECT * FROM habit_logs WHERE date >= ? ORDER BY date")
    .all(since) as HabitLog[];

  const logsByHabit = new Map<number, Set<string>>();
  for (const log of allLogs) {
    if (!logsByHabit.has(log.habit_id)) logsByHabit.set(log.habit_id, new Set());
    logsByHabit.get(log.habit_id)!.add(log.date);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-100">Hábitos</h1>
        <p className="text-sm text-slate-500 mt-1">Semana actual</p>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-[1fr_auto_repeat(7,2rem)] items-center gap-x-3 mb-2 px-3">
        <span className="text-xs text-slate-600">Hábito</span>
        <span className="text-xs text-slate-600 w-12 text-right">Racha</span>
        {weekDates.map((date, i) => (
          <div key={date} className="flex flex-col items-center">
            <span className="text-xs text-slate-600">{DAY_LABELS[i]}</span>
            <span
              className={`text-[10px] mt-0.5 ${date === today ? "text-slate-300" : "text-slate-700"}`}
            >
              {date.slice(8)}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {habits.map((habit) => {
          const logSet = logsByHabit.get(habit.id) ?? new Set<string>();
          const streak = calcStreak(logSet);
          return (
            <HabitWeekRow
              key={habit.id}
              habit={habit}
              weekDates={weekDates}
              loggedDates={Array.from(logSet)}
              streak={streak}
              today={today}
            />
          );
        })}
      </div>

      {habits.length === 0 && (
        <p className="text-sm text-slate-600 py-4">No hay hábitos activos.</p>
      )}

      <div className="mt-8">
        <AddHabitInline />
      </div>
    </div>
  );
}
