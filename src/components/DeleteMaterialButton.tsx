"use client";

import { useTransition } from "react";
import { deleteMaterial } from "@/app/actions";

export default function DeleteMaterialButton({ id }: { id: number }) {
  const [pending, startTr] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("¿Eliminar este material y su resumen?")) return;
        startTr(() => deleteMaterial(id));
      }}
      disabled={pending}
      aria-label="Eliminar material"
      className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-500 transition-all text-xs leading-none disabled:opacity-50"
    >
      ✕
    </button>
  );
}
