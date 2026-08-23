"use client";

import { useTransition } from "react";
import { refrescarEquity } from "./actions";

/** Tira el caché de Yahoo y recarga. Los datos se cachean 10 min por su cuenta. */
export default function RefrescarEquity() {
  const [pendiente, iniciar] = useTransition();

  return (
    <button
      onClick={() => iniciar(() => refrescarEquity())}
      disabled={pendiente}
      className="text-[11px] px-3 py-1.5 rounded-md border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {pendiente ? "actualizando…" : "↻ actualizar"}
    </button>
  );
}
