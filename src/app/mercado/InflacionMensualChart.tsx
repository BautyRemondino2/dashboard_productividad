"use client";

import {
  Bar, BarChart, Cell, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { MesInflacion } from "@/lib/inflacion";
import { GRIS, REJILLA, escalaLinda, fmtNum } from "@/app/eeuu/tokens-grafico";

/** El violeta del card: la serie es una sola, así que el hue también. */
const VIOLETA = "#a78bfa";

/**
 * La inflación mensual: lo que midió INDEC y lo que espera el REM, en una barra
 * por mes.
 *
 * **Un solo color a propósito.** Es la misma medida —variación mensual del
 * IPC— en dos regímenes, no dos series distintas: pintarlas de dos hues diría
 * que son dos índices. Lo que separa el dato del pronóstico es el relleno,
 * sólido contra hueco, que además es la codificación que sobrevive a un
 * daltonismo y a una impresión en blanco y negro. El violeta es el del acento
 * del card.
 *
 * La banda tenue sobre los meses esperados hace el corte explícito sin gastar
 * una línea vertical, que sobre un eje de categorías cae en el centro de una
 * barra y se lee como si marcara ese mes.
 *
 * Sin etiqueta sobre cada barra: son veinte y se convierten en ruido. El número
 * del mes en curso ya está en grande arriba y el resto sale al pasar el mouse.
 */
export default function InflacionMensualChart({
  meses,
  alto = 168,
}: {
  meses: MesInflacion[];
  alto?: number;
}) {
  if (meses.length === 0) return null;

  const valores = meses.map((m) => m.valor);
  // Desde cero: son magnitudes y una barra cortada exagera la diferencia.
  const escala = escalaLinda(0, Math.max(...valores), 4);
  const esperados = meses.filter((m) => m.origen === "rem");

  return (
    <div style={{ height: alto }} className="px-2 pt-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={meses} margin={{ top: 6, right: 10, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke={REJILLA} strokeDasharray="2 4" vertical={false} />

          {esperados.length > 0 && (
            <ReferenceArea
              x1={esperados[0].etiqueta}
              x2={esperados[esperados.length - 1].etiqueta}
              fill={VIOLETA}
              fillOpacity={0.045}
            />
          )}

          <XAxis
            dataKey="etiqueta"
            tick={{ fill: GRIS, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: REJILLA }}
            interval={0}
            minTickGap={0}
          />
          <YAxis
            domain={[escala.desde, escala.hasta]}
            ticks={escala.ticks}
            tick={{ fill: GRIS, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={38}
            tickFormatter={(v: number) => `${fmtNum(v, escala.decimales)}%`}
          />
          <Tooltip
            cursor={{ fill: "rgba(167,139,250,0.07)" }}
            contentStyle={{
              background: "rgb(15,23,42)",
              border: "1px solid rgb(51,65,85)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "rgb(148,163,184)", fontSize: 11, marginBottom: 2 }}
            formatter={(v, _n, item) => [
              `${fmtNum(Number(v), 1)}%`,
              (item?.payload as MesInflacion | undefined)?.origen === "rem"
                ? "esperado (REM)"
                : "medido (INDEC)",
            ]}
          />

          <Bar dataKey="valor" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {meses.map((m) => (
              <Cell
                key={m.mes}
                fill={VIOLETA}
                fillOpacity={m.origen === "rem" ? 0.16 : 1}
                stroke={m.origen === "rem" ? VIOLETA : undefined}
                strokeWidth={m.origen === "rem" ? 1 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
