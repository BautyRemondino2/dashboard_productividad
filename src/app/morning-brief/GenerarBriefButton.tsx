"use client";

import { useState, useTransition } from "react";
import { generarBriefAction } from "./actions";

export default function GenerarBriefButton({ yaGenerado, sinClave }: { yaGenerado: boolean; sinClave: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generar() {
    setError(null);
    iniciar(async () => {
      const r = await generarBriefAction();
      if (!r.ok) setError(r.error ?? "No se pudo generar el brief");
    });
  }

  if (sinClave) {
    return (
      <p className="text-[11px] text-amber-500/85 border border-amber-900/50 rounded-chip px-3 py-2 leading-relaxed">
        Falta <code className="text-amber-400/90">ANTHROPIC_API_KEY</code> en el entorno: sin ella no se puede
        generar el brief. En local va en un <code>.env.local</code> en la raíz; en Vercel, en Settings →
        Environment Variables.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={generar}
        disabled={pendiente}
        className="text-[12px] px-3.5 py-1.5 rounded-chip border border-outline bg-boton text-cuerpo hover:text-titulo hover:border-separador disabled:opacity-50 transition-colors"
      >
        {pendiente ? "Generando…" : yaGenerado ? "Regenerar brief" : "Generar brief"}
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
