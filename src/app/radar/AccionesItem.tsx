"use client";

import { useTransition } from "react";
import { alternarLeido, eliminarItem } from "./actions";

/**
 * Leído y borrar, del lado del cliente para que no haya salto de página.
 *
 * Borrar no pide confirmación: el costo de equivocarse es volver a pegar el
 * mensaje, y un diálogo por cada descarte haría que nadie limpie el feed.
 */
export default function AccionesItem({ id, leido }: { id: number; leido: boolean }) {
  const [pendiente, iniciar] = useTransition();

  return (
    <span className={`flex items-center gap-2.5 ${pendiente ? "opacity-40" : ""}`}>
      <button
        onClick={() => iniciar(() => alternarLeido(id, !leido))}
        className="text-[10px] text-meta hover:text-cuerpo transition-colors"
      >
        {leido ? "no leído" : "leído"}
      </button>
      <button
        onClick={() => iniciar(() => eliminarItem(id))}
        className="text-[10px] text-meta hover:text-baja transition-colors"
      >
        borrar
      </button>
    </span>
  );
}
