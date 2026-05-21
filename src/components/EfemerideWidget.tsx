"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  getUpcoming,
  daysUntil,
  isLongWeekend,
  getEfemerides,
  type Efemeride,
} from "@/lib/efemerides";

const TYPE_DOT: Record<Efemeride["type"], string> = {
  feriado:        "bg-emerald-400",
  "no-laborable": "bg-amber-400",
  efemeride:      "bg-slate-500",
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Compact preview chip in the TopNav — clicking it goes to /efemerides. */
export default function EfemerideWidget() {
  const [today, setToday] = useState<string | null>(null);

  // Resolve today client-side to avoid hydration mismatch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(todayISO());
    const t = setInterval(() => setToday(todayISO()), 60 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const next = useMemo(() => (today ? getUpcoming(today, 1)[0] ?? null : null), [today]);
  const yearList = useMemo(() => today ? getEfemerides(Number(today.slice(0, 4))) : [], [today]);

  if (!today || !next) return null;

  const days = daysUntil(today, next.date);
  const isLW = isLongWeekend(next, yearList);
  const dayLabel =
    days === 0 ? "hoy" :
    days === 1 ? "mañana" :
    days <= 7  ? `en ${days} días` :
    `${next.date.slice(8, 10)}/${next.date.slice(5, 7)}`;

  return (
    <Link
      href="/efemerides"
      title={`Próximas efemérides · ${next.title} (${dayLabel})`}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-slate-500 hover:text-slate-200 hover:bg-slate-900/60 transition-colors"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[next.type]}`} />
      <span className="text-slate-300 whitespace-nowrap">{next.short}</span>
      <span className="text-slate-600">·</span>
      <span className={`tabular whitespace-nowrap ${days <= 3 && next.type === "feriado" ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
        {dayLabel}
      </span>
      {isLW && days <= 14 && (
        <span className="text-[9px] text-amber-400 ml-0.5">★</span>
      )}
    </Link>
  );
}
