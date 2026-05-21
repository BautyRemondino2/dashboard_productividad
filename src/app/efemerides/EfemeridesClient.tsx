"use client";

import { useState, useMemo } from "react";
import type { Efemeride, EfemerideType } from "@/lib/efemerides";

interface DecoratedEfemeride extends Efemeride {
  days: number;
  formatted: string;
  longWeekend: boolean;
}

interface Props {
  today: string;
  year: number;
  thisYear: DecoratedEfemeride[];
  nextYear: DecoratedEfemeride[];
}

const TYPE_DOT: Record<EfemerideType, string> = {
  feriado:        "bg-emerald-400",
  "no-laborable": "bg-amber-400",
  efemeride:      "bg-slate-500",
};

const TYPE_LABEL: Record<EfemerideType, string> = {
  feriado:        "Feriado",
  "no-laborable": "No laborable",
  efemeride:      "Efeméride",
};

const TYPE_TONE: Record<EfemerideType, string> = {
  feriado:        "border-emerald-900/40 bg-emerald-950/15",
  "no-laborable": "border-amber-900/40 bg-amber-950/15",
  efemeride:      "border-slate-800 bg-slate-900/30",
};

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

type FilterType = "all" | "feriado" | "no-laborable" | "efemeride" | "long-weekend";

export default function EfemeridesClient({ today, year, thisYear, nextYear }: Props) {
  const [yearTab, setYearTab] = useState<"this" | "next" | "upcoming">("upcoming");
  const [filter, setFilter] = useState<FilterType>("all");

  const currentList = useMemo(() => {
    let base: DecoratedEfemeride[];
    if (yearTab === "this") base = thisYear;
    else if (yearTab === "next") base = nextYear;
    else base = [...thisYear, ...nextYear].filter(e => e.days >= 0).slice(0, 30);

    if (filter === "long-weekend") return base.filter(e => e.longWeekend);
    if (filter === "all") return base;
    return base.filter(e => e.type === filter);
  }, [yearTab, filter, thisYear, nextYear]);

  const next = useMemo(() => {
    return [...thisYear, ...nextYear].find(e => e.days >= 0) ?? null;
  }, [thisYear, nextYear]);

  // Group by month for the calendar view
  const byMonth = useMemo(() => {
    const map = new Map<number, DecoratedEfemeride[]>();
    for (const e of currentList) {
      const month = Number(e.date.slice(5, 7));
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [currentList]);

  const stats = useMemo(() => {
    const base = yearTab === "next" ? nextYear : thisYear;
    return {
      feriados: base.filter(e => e.type === "feriado").length,
      noLab:    base.filter(e => e.type === "no-laborable").length,
      efems:    base.filter(e => e.type === "efemeride").length,
      findes:   base.filter(e => e.longWeekend).length,
    };
  }, [yearTab, thisYear, nextYear]);

  return (
    <div className="px-8 py-7 max-w-[1100px] mx-auto fade-up fade-up-1">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">Calendario</p>
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">Efemérides argentinas</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Feriados nacionales, días no laborables y fechas históricas con su contexto.
        </p>
      </div>

      {/* Next event hero */}
      {next && (
        <div
          className={`mb-6 rounded-xl border px-6 py-5 fade-up fade-up-2 ${
            next.days === 0 ? "border-emerald-700 bg-emerald-950/30"
            : next.days <= 3 ? "border-emerald-900/60 bg-emerald-950/20"
            : "border-slate-800 bg-slate-900/40"
          }`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${TYPE_DOT[next.type]}`} />
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Próxima fecha</p>
                {next.longWeekend && <span className="text-[10px] text-amber-400">★ finde largo</span>}
              </div>
              <h2 className="text-2xl font-semibold text-slate-100 tracking-tight">{next.title}</h2>
              <p className="text-[13px] text-slate-400 mt-1 capitalize">
                {next.formatted}
                <span className="text-slate-700"> · </span>
                {TYPE_LABEL[next.type]}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-4xl font-bold tabular leading-none ${
                next.days === 0 ? "text-emerald-300" : next.days <= 3 ? "text-emerald-400" : "text-slate-200"
              }`}>
                {next.days === 0 ? "HOY" : next.days}
              </p>
              {next.days !== 0 && (
                <p className="text-[11px] text-slate-500 mt-1">día{next.days !== 1 ? "s" : ""}</p>
              )}
            </div>
          </div>
          <p className="text-[13px] text-slate-300 leading-relaxed mt-4 text-pretty">{next.description}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 fade-up fade-up-3">
        <Stat label="Feriados" value={stats.feriados} dotClass="bg-emerald-400" />
        <Stat label="No laborables" value={stats.noLab} dotClass="bg-amber-400" />
        <Stat label="Efemérides" value={stats.efems} dotClass="bg-slate-500" />
        <Stat label="Findes largos" value={stats.findes} dotClass="bg-amber-300" star />
      </div>

      {/* Tabs + filters */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap fade-up fade-up-4">
        <div className="inline-flex items-center bg-slate-900/60 border border-slate-800 rounded-md p-0.5 gap-0.5">
          <TabPill active={yearTab === "upcoming"} onClick={() => setYearTab("upcoming")}>Próximas</TabPill>
          <TabPill active={yearTab === "this"} onClick={() => setYearTab("this")}>{year}</TabPill>
          <TabPill active={yearTab === "next"} onClick={() => setYearTab("next")}>{year + 1}</TabPill>
        </div>

        <div className="flex items-center gap-1 text-[11px] flex-wrap">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Todo</FilterChip>
          <FilterChip active={filter === "feriado"} onClick={() => setFilter("feriado")} dotClass="bg-emerald-400">Feriados</FilterChip>
          <FilterChip active={filter === "no-laborable"} onClick={() => setFilter("no-laborable")} dotClass="bg-amber-400">No lab.</FilterChip>
          <FilterChip active={filter === "efemeride"} onClick={() => setFilter("efemeride")} dotClass="bg-slate-500">Efemérides</FilterChip>
          <FilterChip active={filter === "long-weekend"} onClick={() => setFilter("long-weekend")}>★ Findes largos</FilterChip>
        </div>
      </div>

      {/* Body */}
      <div className="fade-up fade-up-5">
        {byMonth.length === 0 ? (
          <p className="text-center text-[13px] text-slate-500 py-12">Sin resultados con este filtro.</p>
        ) : yearTab === "upcoming" ? (
          <div className="space-y-2">
            {currentList.map((e, i) => (
              <EfemerideCard key={`${e.date}-${i}`} ef={e} today={today} expanded={i === 0} />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {byMonth.map(([month, items]) => (
              <section key={month}>
                <h3 className="text-[11px] uppercase tracking-widest text-slate-600 mb-2 sticky top-2 bg-slate-950/85 backdrop-blur py-1.5 z-10">
                  {MONTHS[month - 1]}
                </h3>
                <div className="space-y-2">
                  {items.map((e, i) => (
                    <EfemerideCard key={`${e.date}-${i}`} ef={e} today={today} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, dotClass, star }: { label: string; value: number; dotClass: string; star?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 flex items-center gap-3">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 whitespace-nowrap">{label}</p>
        <p className="text-xl font-semibold text-slate-100 tabular leading-none">
          {value}
          {star && <span className="text-amber-300 text-base ml-1">★</span>}
        </p>
      </div>
    </div>
  );
}

function TabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-[11px] transition-colors whitespace-nowrap ${
        active ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, children, dotClass }: {
  active: boolean; onClick: () => void; children: React.ReactNode; dotClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap ${
        active
          ? "bg-slate-800 border-slate-700 text-slate-100"
          : "border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700"
      }`}
    >
      {dotClass && <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />}
      {children}
    </button>
  );
}

function EfemerideCard({ ef, today, expanded }: { ef: DecoratedEfemeride; today: string; expanded?: boolean }) {
  const [open, setOpen] = useState(!!expanded);
  void today;

  const dayLabel =
    ef.days < 0 ? `hace ${Math.abs(ef.days)} día${Math.abs(ef.days) !== 1 ? "s" : ""}`
    : ef.days === 0 ? "hoy"
    : ef.days === 1 ? "mañana"
    : `en ${ef.days} días`;

  return (
    <article className={`rounded-xl border transition-colors ${TYPE_TONE[ef.type]}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-3 flex items-start gap-3"
      >
        <span className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${TYPE_DOT[ef.type]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold text-slate-100">{ef.title}</h3>
            <span className={`text-[11px] tabular shrink-0 ${
              ef.days === 0 ? "text-emerald-300 font-medium" :
              ef.days < 0 ? "text-slate-600" :
              ef.days <= 3 ? "text-emerald-400 font-medium" :
              "text-slate-500"
            }`}>
              {dayLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap capitalize">
            <span>{ef.formatted}</span>
            <span className="text-slate-700">·</span>
            <span>{TYPE_LABEL[ef.type]}</span>
            {ef.longWeekend && <span className="text-amber-400 normal-case">· ★ finde largo</span>}
          </div>
        </div>
        <svg className={`w-3.5 h-3.5 text-slate-600 shrink-0 mt-2 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4 pl-12 pr-5">
          <p className="text-[13px] text-slate-300 leading-relaxed text-pretty">{ef.description}</p>
        </div>
      )}
    </article>
  );
}
