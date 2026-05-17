"use client";

import { useState, useTransition, useEffect } from "react";
import { closeSemester } from "@/app/actions";

interface Props {
  semesterName: string;
}

export default function SemesterControl({ semesterName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!confirming) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirming(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [confirming]);

  const handleClose = () => {
    startTransition(async () => {
      await closeSemester();
      setConfirming(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 hover:text-slate-100 transition-colors"
        title="Archivar materias actuales y empezar uno nuevo"
      >
        <span className="text-[10px] uppercase tracking-widest text-slate-500">Semestre</span>
        <span className="font-medium tabular text-slate-200">{semesterName}</span>
        <span className="text-slate-600 text-[10px]">·</span>
        <span className="text-slate-400 hover:text-slate-200">Cerrar</span>
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirming(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-semibold text-slate-100 mb-2">Cerrar semestre {semesterName}</h3>
            <p className="text-[13px] text-slate-400 leading-relaxed mb-4">
              Las 5 materias actuales con todas sus clases, resúmenes, tareas y exámenes
              quedarán archivadas en <span className="font-medium text-slate-300">/archivo/{semesterName}</span>.
              Se creará un semestre nuevo con materias vacías.
            </p>
            <div className="rounded-lg bg-amber-950/30 border border-amber-900/60 px-3 py-2 mb-5">
              <p className="text-[11px] text-amber-300/90">
                ⚠ El semestre archivado quedará en modo solo lectura. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-[12px] text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleClose}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-[12px] font-medium text-slate-100 bg-red-700/70 hover:bg-red-700 border border-red-600 transition-colors disabled:opacity-50"
              >
                {isPending ? "Cerrando…" : "Sí, cerrar semestre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
