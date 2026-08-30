"use client";

import { useTransition } from "react";
import { refrescarEeuu } from "./actions";

/** Tira el caché de FRED, de los futuros y de los feeds de la Fed, y recarga. */
export default function RefrescarEeuu() {
  const [pendiente, iniciar] = useTransition();

  return (
    <button
      onClick={() => iniciar(() => refrescarEeuu())}
      disabled={pendiente}
      className="text-[11px] px-3 py-1.5 rounded-md border border-borde text-secundario hover:text-cuerpo hover:border-outline disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {pendiente ? "actualizando…" : "↻ actualizar"}
    </button>
  );
}
