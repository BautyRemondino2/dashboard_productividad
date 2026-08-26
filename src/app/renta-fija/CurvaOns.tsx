"use client";

import { useMemo } from "react";
import CurvaNS, { type PuntoNube } from "./CurvaNS";
import { ajustarNelsonSiegel } from "@/lib/nelson-siegel";
import type { PuntoOn } from "@/lib/bonos";

/**
 * Curva de obligaciones negociables en dólares.
 *
 * Van dos curvas a propósito. La verde es la nube corporativa con su ajuste; la
 * azul es la soberana ley NY, que está de referencia: **lo que una ON rinde por
 * encima de la soberana al mismo plazo es lo que se cobra por el riesgo de la
 * empresa en vez del riesgo país**, y ese spread es el número por el que se
 * mira este gráfico. Aparece bono por bono en el detalle.
 *
 * El spread se mide contra la curva ajustada y no interpolando los soberanos
 * crudos: la línea azul que se ve dibujada es esa misma función, así que el
 * número del detalle y la distancia en pantalla son lo mismo. Los soberanos van
 * de 1,5 a 5,9 años de duration; para una ON fuera de ese tramo no hay contra
 * qué compararla y el dato no se muestra, en vez de estirar la referencia hasta
 * donde no llega.
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
  const referencia = useMemo(() => ajustarNelsonSiegel(soberanos), [soberanos]);

  const nube: PuntoNube[] = puntos.map((p) => {
    const comparable =
      referencia && p.duration >= referencia.rango.min && p.duration <= referencia.rango.max;
    const spread = comparable ? (p.tir - referencia.tasa(p.duration)) * 100 : null;

    return {
      ticker: p.ticker,
      nombre: p.nombre,
      tir: p.tir,
      duration: p.duration,
      atenuado: p.duration < DURATION_FRAGIL,
      detalle: [
        { label: "precio", valor: `US$${fmt(p.precio)}` },
        ...(spread != null
          ? [{ label: "sobre el soberano", valor: `${spread > 0 ? "+" : ""}${Math.round(spread)} pb` }]
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
          etiqueta: "Soberana ley NY (referencia)",
          color: REFERENCIA,
          soloLinea: true,
          puntos: soberanos.map((s) => ({ ticker: s.ticker, tir: s.tir, duration: s.duration })),
        },
        { id: "ons", etiqueta: "Obligaciones negociables", color: COLOR, puntos: nube },
      ]}
      notaDerecha="Apagadas, las que vencen en menos de seis meses"
      vacio="Sin precios de ONs en este momento."
    />
  );
}
