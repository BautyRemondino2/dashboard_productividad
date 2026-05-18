"use client";

import { useState, useTransition } from "react";
import { clearInbox } from "@/app/actions";

interface Props {
  subjectId: number;
  count: number;
}

export default function ClearInboxButton({ subjectId, count }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleClear = () => {
    startTransition(async () => {
      await clearInbox(subjectId);
      setConfirming(false);
    });
  };

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px]">
        <span className="text-red-400">¿Eliminar {count} archivo{count !== 1 ? "s" : ""} del inbox?</span>
        <button
          onClick={handleClear}
          disabled={isPending}
          className="text-red-400 hover:text-red-300 font-medium underline decoration-dotted disabled:opacity-50"
        >
          {isPending ? "…" : "Sí"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="text-slate-500 hover:text-slate-300"
        >
          no
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
      title="Borrar todos los archivos del inbox para reintentar"
    >
      vaciar
    </button>
  );
}
