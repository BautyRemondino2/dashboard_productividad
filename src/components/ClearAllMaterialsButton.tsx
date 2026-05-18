"use client";

import { useState, useTransition, useEffect } from "react";
import { clearAllSubjectMaterials } from "@/app/actions";

interface Props {
  subjectId: number;
  classCount: number;
  materialCount: number;
}

export default function ClearAllMaterialsButton({ subjectId, classCount, materialCount }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  const handleConfirm = () => {
    startTransition(async () => {
      await clearAllSubjectMaterials(subjectId);
      setOpen(false);
    });
  };

  // Don't show if there's nothing to clear
  if (classCount === 0 && materialCount === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] text-slate-600 hover:text-red-400 transition-colors"
        title="Borrar todas las clases y materiales para reimportar desde cero"
      >
        borrar todo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-slate-900 border border-red-900/60 rounded-2xl shadow-2xl p-6">
            <h3 className="text-base font-semibold text-slate-100 mb-2">Borrar todo el contenido</h3>
            <p className="text-[13px] text-slate-400 leading-relaxed mb-4">
              Esto va a eliminar de forma permanente:
            </p>
            <ul className="text-[12.5px] text-slate-300 leading-relaxed space-y-1 mb-4 list-disc pl-5">
              <li><span className="tabular font-semibold text-slate-100">{classCount}</span> clase{classCount !== 1 ? "s" : ""}</li>
              <li><span className="tabular font-semibold text-slate-100">{materialCount}</span> archivo{materialCount !== 1 ? "s" : ""} (en BD y en disco)</li>
            </ul>
            <p className="text-[12px] text-slate-500 leading-relaxed mb-5">
              Los exámenes, tareas y el proyecto Claude de esta materia no se tocan. Útil para reintentar la importación.
            </p>
            <div className="rounded-lg bg-red-950/30 border border-red-900/60 px-3 py-2 mb-5">
              <p className="text-[11px] text-red-300/90">⚠ No se puede deshacer.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-[12px] text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-[12px] font-medium text-slate-100 bg-red-700/70 hover:bg-red-700 border border-red-600 transition-colors disabled:opacity-50"
              >
                {isPending ? "Borrando…" : "Sí, borrar todo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
