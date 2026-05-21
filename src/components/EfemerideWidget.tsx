"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  getUpcoming,
  daysUntil,
  fmtEfemerideDate,
  isLongWeekend,
  getEfemerides,
  type Efemeride,
} from "@/lib/efemerides";

const TYPE_DOT: Record<Efemeride["type"], string> = {
  feriado:        "bg-emerald-400",
  "no-laborable": "bg-amber-400",
  efemeride:      "bg-slate-500",
};

const TYPE_LABEL: Record<Efemeride["type"], string> = {
  feriado:        "Feriado",
  "no-laborable": "No laborable",
  efemeride:      "Efeméride",
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function EfemerideWidget() {
  const [today, setToday] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Resolve today client-side to avoid hydration mismatch (server local TZ may differ)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(todayISO());
    const t = setInterval(() => setToday(todayISO()), 60 * 60 * 1000); // refresh hourly
    return () => clearInterval(t);
  }, []);

  // Close on outside click + Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const upcoming = useMemo(() => today ? getUpcoming(today, 8) : [], [today]);
  const next = upcoming[0] ?? null;
  const yearList = useMemo(() => today ? getEfemerides(Number(today.slice(0, 4))) : [], [today]);

  if (!today || !next) return null;

  const days = daysUntil(today, next.date);
  const isLW = isLongWeekend(next, yearList);

  // Pill label
  const dayLabel =
    days === 0 ? "hoy" :
    days === 1 ? "mañana" :
    days <= 7  ? `en ${days} días` :
    fmtEfemerideDate(next.date).split(" ").slice(1, 3).join(" "); // "25 de mayo"

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Próximas efemérides"
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${
          open ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-200 hover:bg-slate-900/60"
        }`}
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
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[420px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-baseline justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Próximas efemérides</p>
              <p className="text-[13px] font-semibold text-slate-100">Argentina · {today.slice(0, 4)}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-300 text-sm leading-none">✕</button>
          </div>

          {/* List */}
          <div className="max-h-[480px] overflow-y-auto">
            {upcoming.map((e, i) => (
              <EfemerideRow
                key={e.date + i}
                ef={e}
                days={daysUntil(today, e.date)}
                isLongWeekend={isLongWeekend(e, yearList)}
                expanded={i === 0}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-800 text-[10px] text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> feriado</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> no laborable</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> efeméride</span>
            </div>
            <span><span className="text-amber-400">★</span> finde largo</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EfemerideRow({ ef, days, isLongWeekend: isLW, expanded }: {
  ef: Efemeride;
  days: number;
  isLongWeekend: boolean;
  expanded: boolean;
}) {
  const [open, setOpen] = useState(expanded);

  return (
    <div className="border-b border-slate-800/60 last:border-b-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-2.5 hover:bg-slate-800/40 transition-colors flex items-start gap-3"
      >
        <span className={`shrink-0 mt-1 w-2 h-2 rounded-full ${TYPE_DOT[ef.type]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <p className="text-[13px] text-slate-100 font-medium">{ef.title}</p>
            <span className={`text-[10px] tabular shrink-0 ${days === 0 ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
              {days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
            <span>{fmtEfemerideDate(ef.date)}</span>
            <span className="text-slate-700">·</span>
            <span>{TYPE_LABEL[ef.type]}</span>
            {isLW && <span className="text-amber-400">· ★ finde largo</span>}
          </div>
        </div>
        <svg className={`w-3 h-3 text-slate-600 shrink-0 mt-1 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-3 pl-9 pr-4">
          <p className="text-[12px] text-slate-400 leading-relaxed">{ef.description}</p>
        </div>
      )}
    </div>
  );
}
