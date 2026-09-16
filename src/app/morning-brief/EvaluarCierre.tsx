"use client";

import { useState, useTransition } from "react";
import Card from "@/components/Card";
import { evaluarCierreAction, guardarAprendizajeAction, guardarTesisAciertoAction } from "./actions";
import type { EvaluacionBrief } from "@/lib/morning-brief-tipos";

const ETIQUETA_ACIERTO: Record<string, string> = { si: "Acertó", parcial: "Parcial", no: "No acertó" };

export default function EvaluarCierre({
  fecha,
  evaluacion,
  aprendizajeGuardado,
  tesisAcierto,
}: {
  fecha: string;
  evaluacion: EvaluacionBrief | null;
  aprendizajeGuardado: string | null;
  tesisAcierto: "si" | "parcial" | "no" | null;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aprendizaje, setAprendizaje] = useState(aprendizajeGuardado ?? "");
  const [guardadoAprendizaje, setGuardadoAprendizaje] = useState(false);

  function evaluar() {
    setError(null);
    iniciar(async () => {
      const r = await evaluarCierreAction(fecha);
      if (!r.ok) setError(r.error ?? "No se pudo evaluar el cierre");
    });
  }

  function guardarAprendizaje() {
    iniciar(async () => {
      await guardarAprendizajeAction(fecha, aprendizaje);
      setGuardadoAprendizaje(true);
    });
  }

  return (
    <Card titulo="Cierre" nota="comparación mecánica, sin Claude" cuerpo={false}>
      <div className="p-[18px] space-y-4">
        {!evaluacion ? (
          <div className="flex items-center gap-3">
            <button
              onClick={evaluar}
              disabled={pendiente}
              className="text-[12px] px-3.5 py-1.5 rounded-chip border border-outline bg-boton text-cuerpo hover:text-titulo hover:border-separador disabled:opacity-50 transition-colors"
            >
              {pendiente ? "Evaluando…" : "Evaluar cierre"}
            </button>
            {error && <span className="text-[11px] text-red-400">{error}</span>}
          </div>
        ) : (
          <div className="space-y-2">
            {evaluacion.predicciones.map((p, i) => (
              <div key={i} className="flex items-baseline gap-2.5">
                <span
                  className={`text-[11px] font-medium shrink-0 ${
                    p.acierto == null ? "text-meta-suave" : p.acierto ? "text-sube" : "text-baja"
                  }`}
                >
                  {p.acierto == null ? "sin dato" : p.acierto ? "✓ acertó" : "✗ no acertó"}
                </span>
                <p className="text-[12px] text-secundario leading-snug">{p.enunciado}</p>
                <span className="ml-auto text-[11px] text-meta-suave shrink-0 tabular-nums">
                  predijo {p.direccion_predicha} · cerró {p.direccion_real ?? "s/d"}
                </span>
              </div>
            ))}
            <button
              onClick={evaluar}
              disabled={pendiente}
              className="text-[11px] text-meta hover:text-cuerpo transition-colors"
            >
              {pendiente ? "Re-evaluando…" : "re-evaluar"}
            </button>
          </div>
        )}

        <div className="border-t border-divisor pt-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-tenue">¿Tu tesis acertó hoy?</p>
          <div className="flex items-center gap-2">
            {(["si", "parcial", "no"] as const).map((v) => (
              <button
                key={v}
                onClick={() => iniciar(() => guardarTesisAciertoAction(fecha, v))}
                className={`text-[11.5px] px-2.5 py-1 rounded-chip border transition-colors ${
                  tesisAcierto === v
                    ? "border-separador bg-chip text-titulo"
                    : "border-outline text-secundario hover:text-titulo"
                }`}
              >
                {ETIQUETA_ACIERTO[v]}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-divisor pt-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-tenue">Aprendizaje</p>
          <textarea
            value={aprendizaje}
            onChange={(e) => {
              setAprendizaje(e.target.value);
              setGuardadoAprendizaje(false);
            }}
            rows={3}
            placeholder="Qué te llevás de hoy para el próximo brief…"
            className="w-full rounded-chip border border-outline bg-boton px-3 py-2.5 text-[12.5px] text-cuerpo placeholder:text-meta-suave outline-none focus:border-separador transition-colors resize-y leading-relaxed"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={guardarAprendizaje}
              disabled={pendiente || aprendizaje.trim().length === 0}
              className="text-[12px] px-3.5 py-1.5 rounded-chip border border-outline bg-boton text-cuerpo hover:text-titulo hover:border-separador disabled:opacity-50 transition-colors"
            >
              Guardar
            </button>
            {guardadoAprendizaje && <span className="text-[11px] text-sube">guardado</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}
