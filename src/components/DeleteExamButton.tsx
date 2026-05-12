"use client";

import { useTransition } from "react";
import { deleteExam } from "@/app/actions";

export default function DeleteExamButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("¿Eliminar este examen?")) return;
        start(() => deleteExam(id));
      }}
      disabled={pending}
      aria-label="Eliminar examen"
      className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-500 transition-all text-xs leading-none disabled:opacity-50"
    >
      ✕
    </button>
  );
}
