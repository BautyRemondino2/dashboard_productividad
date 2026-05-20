"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleTask } from "@/app/actions";

export type NextActionKind = "overdue" | "task" | "exam" | "summarize" | "study";

export interface NextAction {
  kind: NextActionKind;
  id: number;            // task id, exam id, class id, or subject id depending on kind
  label: string;
  subtitle: string;
  href?: string;
  hue?: number;
  daysOffset?: number;   // negative = overdue, 0 = today, positive = future
  priority?: "alta" | "media" | "baja";
}

const KIND_META: Record<NextActionKind, { icon: string; tone: string }> = {
  overdue:    { icon: "⚠",  tone: "text-red-400 bg-red-950/40 border-red-900/60" },
  task:       { icon: "○",  tone: "text-amber-400 bg-amber-950/30 border-amber-900/60" },
  exam:       { icon: "◷",  tone: "text-violet-300 bg-violet-950/30 border-violet-900/60" },
  summarize:  { icon: "✦",  tone: "text-blue-300 bg-blue-950/30 border-blue-900/60" },
  study:      { icon: "◐",  tone: "text-emerald-400 bg-emerald-950/30 border-emerald-900/60" },
};

export default function NextActions({ actions }: { actions: NextAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 px-5 py-4 mb-6 fade-up fade-up-2">
        <p className="text-[11px] uppercase tracking-widest text-slate-600 mb-1">⚡ Próximas acciones</p>
        <p className="text-[13px] text-slate-500">
          Sin acciones pendientes — todo al día 🎉
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 fade-up fade-up-2">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-[11px] uppercase tracking-widest text-slate-500">⚡ Próximas acciones</h2>
        <span className="text-[10px] text-slate-700 tabular">{actions.length} sugerencia{actions.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {actions.map((a, i) => (
          <ActionCard key={`${a.kind}-${a.id}-${i}`} action={a} />
        ))}
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: NextAction }) {
  const [, startTransition] = useTransition();
  const [doneOptimistic, setDone] = useState(false);
  const meta = KIND_META[action.kind];
  const handleToggle = () => {
    if (action.kind !== "task" && action.kind !== "overdue") return;
    setDone(true);
    startTransition(async () => { await toggleTask(action.id); });
  };

  const dueLabel = (() => {
    if (action.daysOffset == null) return null;
    if (action.daysOffset < 0) return `vencida hace ${Math.abs(action.daysOffset)}d`;
    if (action.daysOffset === 0) return "hoy";
    if (action.daysOffset === 1) return "mañana";
    return `en ${action.daysOffset} días`;
  })();

  const interactive = action.kind === "task" || action.kind === "overdue";

  const inner = (
    <div className={`group rounded-xl border px-4 py-3 flex items-start gap-3 transition-colors ${
      doneOptimistic ? "opacity-50" : ""
    } ${meta.tone} hover:brightness-110`}>
      <span className="text-base leading-none shrink-0 mt-0.5">{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] leading-snug font-medium ${doneOptimistic ? "line-through" : ""}`}>
          {action.label}
        </p>
        <div className="flex items-center gap-2 mt-1 text-[10px] flex-wrap opacity-80">
          <span>{action.subtitle}</span>
          {dueLabel && (
            <>
              <span className="text-slate-600">·</span>
              <span>{dueLabel}</span>
            </>
          )}
          {action.priority === "alta" && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-red-400 font-medium">alta</span>
            </>
          )}
        </div>
      </div>
      {interactive && !doneOptimistic && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggle(); }}
          title="Marcar hecha"
          className="shrink-0 w-5 h-5 rounded border-2 border-current opacity-50 hover:opacity-100 flex items-center justify-center transition-opacity"
        >
        </button>
      )}
    </div>
  );

  if (action.href) {
    return <Link href={action.href}>{inner}</Link>;
  }
  return inner;
}
