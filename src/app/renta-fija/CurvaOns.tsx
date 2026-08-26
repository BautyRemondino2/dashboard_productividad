"use client";

import CurvaNS, { type PuntoNube } from "./CurvaNS";
import type { PuntoOn } from "@/lib/bonos";

/**
 * Curva de obligaciones negociables en dólares.
 *
 * Mismo eje que la de soberanos —TIR contra duration— para que se puedan
 * comparar de un vistazo: lo que una ON rinde por encima del soberano de igual
 * plazo es lo que se cobra por el riesgo de la empresa en vez del riesgo país.
 *
 * La curva soberana va de referencia, dibujada sin marcas. El spread contra
 * ella se calcula bono por bono y aparece en el detalle: es el número por el
 * que se mira este gráfico.
 */

const COLOR = "#199e70";
const REFERENCIA = "#3987e5";

/**
 * Debajo de este plazo la TIR anualizada deja de ser comparable.
 *
 * A tres meses del vencimiento, un peso de diferencia en el precio mueve el
 * rendimiento anualizado varios puntos: una ON de Banco Galicia a 98,10 daba
 * 20% anual. El número no está mal calculado, pero es frágil y arriba de la
 * nube parece una oportunidad cuando es ruido de liquidez. Se dibuja apagado y
 * queda afuera del ajuste.
 */
const DURATION_FRAGIL = 0.5;

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function CurvaOns({
  puntos,
  soberanos,
}: {
  puntos: PuntoOn[];
  /** La curva soberana, para ver el spread corporativo. */
  soberanos: { duration: number; tir: number; ticker: string }[];
}) {
  /** Interpola la curva soberana para comparar a igual duration. */
  const soberanoEn = (d: number): number | null => {
    const orden = [...soberanos].sort((a, b) => a.duration - b.duration);
    if (orden.length === 0) return null;
    if (d <= orden[0].duration) return orden[0].tir;
    if (d >= orden[orden.length - 1].duration) return orden[orden.length - 1].tir;
    for (let i = 1; i < orden.length; i++) {
      if (d <= orden[i].duration) {
        const a = orden[i - 1];
        const b = orden[i];
        const t = (d - a.duration) / (b.duration - a.duration || 1);
        return a.tir + t * (b.tir - a.tir);
      }
    }
    return null;
  };

  const nube: PuntoNube[] = puntos.map((p) => {
    const soberano = soberanoEn(p.duration);
    return {
      ticker: p.ticker,
      nombre: p.nombre,
      tir: p.tir,
      duration: p.duration,
      atenuado: p.duration < DURATION_FRAGIL,
      detalle: [
        { label: "precio", valor: `US$${fmt(p.precio)}` },
        ...(soberano != null
          ? [{ label: "sobre el soberano", valor: `${Math.round((p.tir - soberano) * 100)} pb` }]
          : []),
        { label: "vence", valor: String(p.vencimiento) },
      ],
    };
  });

  return (
    <CurvaNS
      series={[
        {
          id: "soberanos",
          etiqueta: "Curva soberana ley NY",
          color: REFERENCIA,
          soloLinea: true,
          puntos: soberanos.map((s) => ({ ticker: s.ticker, tir: s.tir, duration: s.duration })),
        },
        { id: "ons", etiqueta: "Obligaciones negociables", color: COLOR, puntos: nube },
      ]}
      alto={340}
      notaDerecha="Apagadas, las que vencen en menos de seis meses"
      vacio="Sin precios de ONs en este momento."
    />
  );
}
