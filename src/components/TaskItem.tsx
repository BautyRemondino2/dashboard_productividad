"use client";

import { useTransition } from "react";
import { toggleTask, deleteTask } from "@/app/actions";
import type { Task } from "@/lib/types";

const PRIORITY_DOT: Record<string, string> = {
  alta: "bg-red-500",
  media: "bg-amber-400",
  baja: "bg-slate-600",
};

interface Props {
  task: Task;
  showDueDate?: boolean;
  isStale?: boolean;   // overdue by ≥3 days — shows orange left border
}

function formatDate(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}`;
}

export default function TaskItem({ task, showDueDate, isStale }: Props) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(() => toggleTask(task.id));
  }

  function handleDelete() {
    startTransition(() => deleteTask(task.id));
  }

  const done = task.status === "hecha";

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        pending ? "opacity-50" : ""
      } hover:bg-slate-900 ${isStale ? "border-l-2 border-orange-700 pl-2" : ""}`}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={pending}
        aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
        className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          done
            ? "bg-slate-700 border-slate-600"
            : "border-slate-600 hover:border-slate-400"
        }`}
      >
        {done && (
          <svg className="w-2.5 h-2.5 text-slate-400" viewBox="0 0 10 10" fill="none">
            <path
              d="M1.5 5l2.5 2.5 4.5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Priority dot */}
      <span
        className={`shrink-0 w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`}
        title={`Prioridad ${task.priority}`}
      />

      {/* Title */}
      <span
        className={`flex-1 text-sm leading-snug ${
          done ? "line-through text-slate-600" : "text-slate-200"
        }`}
      >
        {task.title}
      </span>

      {/* Due date */}
      {showDueDate && task.due_date && (
        <span className="shrink-0 text-xs text-slate-600 tabular-nums">
          {formatDate(task.due_date)}
        </span>
      )}

      {/* Delete button — shows on hover */}
      <button
        onClick={handleDelete}
        disabled={pending}
        aria-label="Eliminar tarea"
        className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-500 transition-all text-xs leading-none"
      >
        ✕
      </button>
    </div>
  );
}
