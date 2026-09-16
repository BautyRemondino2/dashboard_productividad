"use client";

import { useState, useTransition } from "react";
import { guardarTesisPropiaAction } from "./actions";

/**
 * La tesis propia se escribe antes de ver la de Claude — el gate del punto 8
 * del pedido. Escribir "creo que hoy sube el dólar" después de leer el brief
 * no sirve para contrastar nada: hay que comprometerse primero.
 */
export default function TesisForm({
  fecha,
  tesisGuardada,
}: {
  fecha: string;
  tesisGuardada: string | null;
}) {
  const [editando, setEditando] = useState(!tesisGuardada);
  const [texto, setTexto] = useState(tesisGuardada ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarTesisPropiaAction(fecha, texto);
      if (!r.ok) {
        setError(r.error ?? "No se pudo guardar");
        return;
      }
      setEditando(false);
    });
  }

  if (!editando && tesisGuardada) {
    return (
      <div className="rounded-card border border-borde bg-card px-[18px] py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-tenue">Tu tesis de hoy</span>
          <button
            onClick={() => setEditando(true)}
            className="ml-auto text-[11px] text-meta hover:text-cuerpo transition-colors"
          >
            editar
          </button>
        </div>
        <p className="text-[12.5px] text-cuerpo leading-relaxed mt-1.5 whitespace-pre-wrap">{tesisGuardada}</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-borde bg-card px-[18px] py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-tenue mb-2">
        Escribí tu tesis antes de ver la de Claude
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder="Qué esperás del día y por qué, antes de leer el brief…"
        className="w-full rounded-chip border border-outline bg-boton px-3 py-2.5 text-[12.5px] text-cuerpo placeholder:text-meta-suave outline-none focus:border-separador transition-colors resize-y leading-relaxed"
      />
      <div className="flex items-center gap-3 mt-2.5">
        <button
          onClick={guardar}
          disabled={pendiente || texto.trim().length === 0}
          className="text-[12px] px-3.5 py-1.5 rounded-chip border border-outline bg-boton text-cuerpo hover:text-titulo hover:border-separador disabled:opacity-50 transition-colors"
        >
          {pendiente ? "Guardando…" : "Guardar tesis"}
        </button>
        {tesisGuardada && (
          <button
            onClick={() => {
              setTexto(tesisGuardada);
              setEditando(false);
            }}
            className="text-[11px] text-meta hover:text-cuerpo transition-colors"
          >
            cancelar
          </button>
        )}
        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </div>
    </div>
  );
}
