import { getDb } from "@/lib/db";
import type { Habit, HabitLog } from "@/lib/types";
import { localDateStr } from "@/lib/utils";
import HabitWeekRow from "@/components/HabitWeekRow";
import AddHabitInline from "@/components/AddHabitInline";

function calcStreak(logDates: Set<string>): number {
  let streak = 0;
  const date = new Date();
  if (!logDates.has(localDateStr())) date.setDate(date.getDate() - 1);
  while (true) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    if (!logDates.has(`${y}-${m}-${d}`)) break;
    streak++;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export default function HabitosPage() {
  const db     = getDb();
  const habits = db.prepare("SELECT * FROM habits WHERE active = 1 ORDER BY created_at").all() as Habit[];
  const today  = localDateStr();

  const todayDate      = new Date();
  const dayOfWeek      = todayDate.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekDates      = Array.from({ length: 7 }, (_, i) => localDateStr(i - daysFromMonday));

  const since   = localDateStr(-60);
  const allLogs = db.prepare("SELECT * FROM habit_logs WHERE date >= ? ORDER BY date").all(since) as HabitLog[];

  const logsByHabit = new Map<number, Set<string>>();
  for (const log of allLogs) {
    if (!logsByHabit.has(log.habit_id)) logsByHabit.set(log.habit_id, new Set());
    logsByHabit.get(log.habit_id)!.add(log.date);
  }

  // Weekly aggregate stats
  const passedDays    = weekDates.filter(d => d <= today).length;
  const totalPossible = habits.length * passedDays;
  const totalDone     = habits.reduce((sum, h) => {
    const logs = logsByHabit.get(h.id) ?? new Set<string>();
    return sum + weekDates.filter(d => d <= today && logs.has(d)).length;
  }, 0);
  const weekPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
  const bestStreak = habits.reduce((max, h) => {
    const logs = logsByHabit.get(h.id) ?? new Set<string>();
    return Math.max(max, calcStreak(logs));
  }, 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-100">Hábitos</h1>
        <p className="text-sm text-slate-500 mt-0.5">Semana actual</p>
      </div>

      {/* Weekly summary */}
      {habits.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <p className="text-[11px] text-slate-500 mb-0.5">Completitud</p>
            <p className={`text-2xl font-semibold tabular-nums ${
              weekPct >= 80 ? "text-emerald-400" : weekPct >= 50 ? "text-amber-400" : "text-slate-300"
            }`}>{weekPct}%</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <p className="text-[11px] text-slate-500 mb-0.5">Esta semana</p>
            <p className="text-2xl font-semibold text-slate-100 tabular-nums">
              {totalDone}<span className="text-sm text-slate-500">/{totalPossible}</span>
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <p className="text-[11px] text-slate-500 mb-0.5">Mejor racha</p>
            <p className="text-2xl font-semibold text-amber-400 tabular-nums">
              {bestStreak} <span className="text-sm">🔥</span>
            </p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {habits.length > 0 && (
        <div className="mb-6 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              weekPct >= 80 ? "bg-emerald-500" : weekPct >= 50 ? "bg-amber-500" : "bg-slate-500"
            }`}
            style={{ width: `${weekPct}%` }}
          />
        </div>
      )}

      {/* Week header */}
      <div className="grid grid-cols-[1fr_auto_repeat(7,2rem)] items-center gap-x-3 mb-2 px-3">
        <span className="text-xs text-slate-600">Hábito</span>
        <span className="text-xs text-slate-600 w-12 text-right">Racha</span>
        {weekDates.map((date, i) => (
          <div key={date} className="flex flex-col items-center">
            <span className="text-xs text-slate-600">{DAY_LABELS[i]}</span>
            <span className={`text-[10px] mt-0.5 ${date === today ? "text-slate-300 font-medium" : "text-slate-700"}`}>
              {date.slice(8)}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {habits.map(habit => {
          const logSet = logsByHabit.get(habit.id) ?? new Set<string>();
          const streak = calcStreak(logSet);
          const weekDone = weekDates.filter(d => d <= today && logSet.has(d)).length;
          return (
            <HabitWeekRow
              key={habit.id}
              habit={habit}
              weekDates={weekDates}
              loggedDates={Array.from(logSet)}
              streak={streak}
              today={today}
              weekDone={weekDone}
              passedDays={passedDays}
            />
          );
        })}
      </div>

      {habits.length === 0 && (
        <p className="text-sm text-slate-600 py-4">No hay hábitos activos todavía.</p>
      )}

      <div className="mt-8">
        <AddHabitInline />
      </div>
    </div>
  );
}
