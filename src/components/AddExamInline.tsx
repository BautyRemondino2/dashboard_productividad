"use client";

import { useState, useTransition, useRef } from "react";
import { createExam } from "@/app/actions";
import type { ExamType, Subject } from "@/lib/types";

const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: "parcial", label: "Parcial" },
  { value: "final",   label: "Final"   },
  { value: "tp",      label: "TP"      },
  { value: "quiz",    label: "Quiz"    },
  { value: "otro",    label: "Otro"    },
];

interface Props {
  subjects: Subject[];
  fixedSubjectId?: number; // if set, show subject name as read-only
}

export default function AddExamInline({ subjects, fixedSubjectId }: Props) {
  const [open,    setOpen]    = useState(false);
  const [type,    setType]    = useState<ExamType>("parcial");
  const [pending, start]      = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("type", type);
    if (fixedSubjectId) fd.set("subject_id", String(fixedSubjectId));
    start(async () => {
      await createExam(fd);
      formRef.current?.reset();
      setType("parcial");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-400 transition-colors py-1.5 px-3"
      >
        <span className="text-base leading-none">+</span>
        Agregar examen / TP
      </button>
    );
  }

  const fixedSubject = fixedSubjectId ? subjects.find(s => s.id === fixedSubjectId) : null;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="border border-slate-700 rounded-lg p-3 bg-slate-900 space-y-3"
    >
      {/* Subject selector */}
      {fixedSubject ? (
        <p className="text-xs text-slate-500">{fixedSubject.name}</p>
      ) : (
        <select
          name="subject_id"
          required
          className="w-full bg-slate-800 text-sm text-slate-200 rounded px-2 py-1.5 outline-none border border-slate-700 [color-scheme:dark]"
        >
          <option value="">Seleccioná una materia...</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      {/* Title */}
      <input
        name="title"
        type="text"
        placeholder="Ej: Parcial 1 — Finanzas Internacionales"
        required
        disabled={pending}
        onKeyDown={e => e.key === "Escape" && setOpen(false)}
        className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none"
      />

      <div className="flex flex-wrap items-center gap-3">
        {/* Type */}
        <div className="flex gap-1">
          {EXAM_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                type === t.value
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Date */}
        <input
          name="date"
          type="date"
          required
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
