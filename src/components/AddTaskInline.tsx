"use client";

import { useRef, useState, useTransition } from "react";
import { createTask } from "@/app/actions";
import type { Priority } from "@/lib/types";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "alta",  label: "Alta"  },
  { value: "media", label: "Media" },
  { value: "baja",  label: "Baja"  },
];

interface SubjectOption {
  id: number;
  name: string;
}

interface Props {
  defaultDueDate?: string;
  subjectId?: number;          // if provided, task is pre-linked to this subject
  subjects?: SubjectOption[];  // if provided, shows subject picker
}

export default function AddTaskInline({ defaultDueDate, subjectId, subjects }: Props) {
  const [open,     setOpen]     = useState(false);
  const [priority, setPriority] = useState<Priority>("media");
  const [selSubjectId, setSelSubjectId] = useState<number | "">(subjectId ?? "");
  const [pending,  startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("context", "facultad");
    fd.set("priority", priority);
    if (selSubjectId) fd.set("subject_id", String(selSubjectId));
    startTransition(async () => {
      await createTask(fd);
      form.reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-400 transition-colors py-1.5 px-3"
      >
        <span className="text-base leading-none">+</span>
        Agregar tarea
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-slate-700 rounded-lg p-3 bg-slate-900 space-y-3">
      <input
        ref={inputRef}
        name="title"
        type="text"
        placeholder="Título de la tarea..."
        required
        disabled={pending}
        onKeyDown={e => e.key === "Escape" && setOpen(false)}
        className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none"
      />

      <div className="flex flex-wrap items-center gap-3">
        {/* Priority */}
        <div className="flex gap-1">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                priority === p.value
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Subject picker — shown only when subjects prop is passed and subjectId not fixed */}
        {subjects && subjects.length > 0 && !subjectId && (
          <select
            value={selSubjectId}
            onChange={e => setSelSubjectId(e.target.value ? Number(e.target.value) : "")}
            className="bg-slate-800 text-xs text-slate-400 rounded px-2 py-0.5 outline-none border border-slate-700 [color-scheme:dark]"
          >
            <option value="">Sin materia</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {/* Due date */}
        <input
          name="due_date"
          type="date"
          defaultValue={defaultDueDate}
          className="bg-transparent text-xs text-slate-500 outline-none [color-scheme:dark]"
        />

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="text-xs text-slate-300 hover:text-white transition-colors font-medium"
          >
            Guardar
          </button>
        </div>
      </div>
    </form>
  );
}
