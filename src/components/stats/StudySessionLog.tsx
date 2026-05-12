"use client";

import { useTransition, useState, useRef } from "react";
import { logStudySession } from "@/app/actions";
import type { Subject } from "@/lib/types";

interface Props {
  subjects: Subject[];
  today: string;
}

export default function StudySessionLog({ subjects, today }: Props) {
  const [pending, start] = useTransition();
  const [done, setDone]  = useState(false);
  const formRef          = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await logStudySession(fd);
      formRef.current?.reset();
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[150px]">
        <label className="text-xs text-slate-500 block mb-1">Materia</label>
        <select
          name="subject_id"
          required
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
        >
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="w-28">
        <label className="text-xs text-slate-500 block mb-1">Minutos</label>
        <input
          name="minutes"
          type="number"
          min="1"
          max="480"
          defaultValue="60"
          required
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500 tabular-nums"
        />
      </div>

      <div className="w-36">
        <label className="text-xs text-slate-500 block mb-1">Fecha</label>
        <input
          name="date"
          type="date"
          defaultValue={today}
          required
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
        />
      </div>

      <div className="flex-1 min-w-[120px]">
        <label className="text-xs text-slate-500 block mb-1">Notas (opcional)</label>
        <input
          name="notes"
          type="text"
          placeholder="Ej: Capítulo 3, problemas…"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500 placeholder-slate-700"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors disabled:opacity-50"
      >
        {done ? "✓ Guardado" : pending ? "Guardando…" : "Registrar"}
      </button>
    </form>
  );
}
