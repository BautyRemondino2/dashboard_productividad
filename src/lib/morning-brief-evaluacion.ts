/**
 * Morning Brief — evaluación al cierre. Todo en código, nunca con Claude: es
 * una comparación mecánica entre lo predicho a la mañana y lo que terminó
 * pasando.
 *
 * Bandas de "estable" (de `morning-brief-config.ts`, fijadas por el diseño
 * del brief): tasas ±2 pb, caución ±50 pb, riesgo país ±5 pb, precios ±0,25%.
 */
import { construirIndicadorPorId, type IndicadorBrief } from "@/lib/morning-brief-datos";
import { indicadorPorId } from "@/lib/morning-brief-config";
import type { DireccionPrediccion, EvaluacionBrief, EvaluacionPrediccion, PrediccionBrief } from "@/lib/morning-brief-tipos";

function direccionReal(indicador: IndicadorBrief, bandaEstable: number): DireccionPrediccion | null {
  if (indicador.variacion == null) return null;
  if (Math.abs(indicador.variacion) <= bandaEstable) return "estable";
  return indicador.variacion > 0 ? "sube" : "baja";
}

export interface ResultadoEvaluacion {
  cierre: Record<string, IndicadorBrief>;
  evaluacion: EvaluacionBrief;
  aciertos: number;
  total: number;
}

/**
 * Re-fetchea sólo los indicadores citados en `predicciones` (no todo el
 * snapshot) y compara la dirección real contra la predicha.
 */
export async function evaluarPredicciones(predicciones: PrediccionBrief[]): Promise<ResultadoEvaluacion> {
  const idsUnicos = [...new Set(predicciones.map((p) => p.indicador))];
  const indicadores = new Map<string, IndicadorBrief>();

  await Promise.all(
    idsUnicos.map(async (id) => {
      const ind = await construirIndicadorPorId(id);
      if (ind) indicadores.set(id, ind);
    })
  );

  const detalle: EvaluacionPrediccion[] = predicciones.map((p) => {
    const ind = indicadores.get(p.indicador);
    const cfg = indicadorPorId(p.indicador);
    const real = ind && cfg ? direccionReal(ind, cfg.bandaEstable) : null;
    return {
      enunciado: p.enunciado,
      indicador: p.indicador,
      direccion_predicha: p.direccion,
      direccion_real: real,
      acierto: real == null ? null : real === p.direccion,
    };
  });

  const aciertos = detalle.filter((d) => d.acierto === true).length;

  return {
    cierre: Object.fromEntries(indicadores),
    evaluacion: { predicciones: detalle },
    aciertos,
    total: detalle.length,
  };
}
