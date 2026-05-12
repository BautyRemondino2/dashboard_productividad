"use client";

import { useTransition } from "react";
import { regenerateSummary } from "@/app/actions";

export default function RegenerateSummaryButton({ materialId }: { materialId: number }) {
  const [pending, startTr] = useTransition();
  return (
    <button
      onClick={() => startTr(() => regenerateSummary(materialId))}
      disabled={pending}
      className="text-xs text-amber-500 hover:text-amber-400 transition-colors disabled:opacity-50"
    >
      {pending ? "Generando..." : "↺ Generar resumen"}
    </button>
  );
}
