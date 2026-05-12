"use client";

import { useTransition } from "react";
import { toggleTask } from "@/app/actions";
import type { Task } from "@/lib/types";

interface Props {
  task: Task;
  today: string;
  subjectName?: string | null;
  hasNearbyExam?: boolean;  // true if the task's subject has an exam ≤5 days away
}

const PRIORITY_LABEL: Record<string, string> = {
  alta: "Alta", media: "Media", baja: "Baja",
};

const PRIORITY_BORDER: Record<string, string> = {
  alta:  "border-red-800",
  media: "border-amber-800",
  baja:  "border-slate-700",
};

const PRIORITY_BG: Record<string, string> = {
  alta:  "bg-red-950/30",
  media: "bg-amber-950/20",
  baja:  "bg-slate-900",
};

function fmtDate(d: string) {
  const [, m, day] = d.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${months[parseInt(m)-1]}`;
}

export default function FocusBlock({ task, today, subjectName, hasNearbyExam }: Props) {
  const [pending, start] = useTransition();

  const isOverdue  = task.due_date !== null && task.due_date < today;
  const isDueToday = task.due_date === today;

  return (
    <div className={`rounded-xl border px-5 py-4 mb-8 ${PRIORITY_BORDER[task.priority]} ${PRIORITY_BG[task.priority]}`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Label */}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            ✦ Foco principal
            {hasNearbyExam && (
              <span className="ml-2 text-violet-500">· examen próximo</span>
            )}
          </p>

          {/* Title */}
          <p className="text-base font-semibold text-slate-100 leading-snug mb-2">
            {task.title}
          </p>

          {/* Meta */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            {subjectName && (
              <span className="text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                {subjectName}
              </span>
            )}
            <span className="text-xs text-slate-600">
              Prioridad {PRIORITY_LABEL[task.priority]}
            </span>
            {task.due_date && (
              <>
                <span className="text-slate-700">·</span>
                <span className={`text-xs font-medium ${
                  isOverdue ? "text-red-400" : isDueToday ? "text-amber-400" : "text-slate-500"
                }`}>
                  {isOverdue ? "Vencida" : isDueToday ? "Hoy" : fmtDate(task.due_date)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Complete button */}
        <button
          onClick={() => start(() => toggleTask(task.id))}
          disabled={pending}
          aria-label="Marcar como hecha"
          className="shrink-0 w-9 h-9 rounded-lg border border-slate-700 hover:border-emerald-600 hover:bg-emerald-900/30 flex items-center justify-center transition-all disabled:opacity-50"
        >
          {pending ? (
            <span className="w-3 h-3 rounded-full border border-slate-500 border-t-transparent animate-spin" />
          ) : (
            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
