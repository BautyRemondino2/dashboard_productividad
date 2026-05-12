"use client";

import { useState, useTransition } from "react";
import { updateExamGrade } from "@/app/actions";

export default function RecordGradeButton({ examId, currentGrade }: { examId: number; currentGrade: number | null }) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState(currentGrade != null ? String(currentGrade) : "");
  const [pending, start]      = useTransition();

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`text-xs tabular-nums font-medium px-2 py-0.5 rounded transition-colors ${
          currentGrade != null
            ? currentGrade >= 7
              ? "text-emerald-400 hover:text-emerald-300"
              : currentGrade >= 4
              ? "text-amber-400 hover:text-amber-300"
              : "text-red-400 hover:text-red-300"
            : "text-slate-600 hover:text-slate-400 border border-slate-800"
        }`}
      >
        {currentGrade != null ? currentGrade : "Cargar nota"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="0"
        max="10"
        step="0.5"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter") {
            e.preventDefault();
            const g = parseFloat(value);
            if (!isNaN(g) && g >= 0 && g <= 10) {
              start(async () => {
                await updateExamGrade(examId, g);
                setEditing(false);
              });
            }
          }
        }}
        autoFocus
        className="w-14 bg-slate-800 border border-slate-600 text-xs text-slate-100 rounded px-1.5 py-0.5 outline-none tabular-nums [color-scheme:dark]"
        placeholder="0–10"
        disabled={pending}
      />
      <button
        onClick={() => {
          const g = parseFloat(value);
          if (!isNaN(g) && g >= 0 && g <= 10) {
            start(async () => {
              await updateExamGrade(examId, g);
              setEditing(false);
            });
          }
        }}
        disabled={pending}
        className="text-xs text-emerald-500 hover:text-emerald-400 font-medium disabled:opacity-50"
      >
        OK
      </button>
      <button
        onClick={() => setEditing(false)}
        className="text-xs text-slate-600 hover:text-slate-400"
      >
        ✕
      </button>
    </div>
  );
}
