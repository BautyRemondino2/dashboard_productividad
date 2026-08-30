"use client";

import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import { ANIO, GRIS, HOY, MES, REJILLA, escalaLinda, fmtNum } from "./tokens-grafico";
import type { PuntoCurva } from "@/lib/eeuu";

/**
 * La curva del Tesoro de hoy contra la de hace un mes y la de hace un año.
 *
 * El nivel de la curva importa menos que **cómo se movió**: una suba paralela
 * dice una cosa (revisión de la tasa neutral) y un empinamiento sólo en el
 * tramo largo dice otra bien distinta (más prima por plazo, más déficit). Por
 * eso las tres líneas y no una sola.
 *
 * El eje horizontal es categórico y no proporcional al plazo. Con escala real
 * de años, los siete vencimientos de menos de tres años —donde se decide todo
 * lo que tiene que ver con la política monetaria— se amontonan contra el
 * origen y el gráfico queda dominado por el tramo 20-30, que casi no se mueve.
 */
export default function CurvaTesoroChart({
  puntos,
  alto = 240,
}: {
  puntos: PuntoCurva[];
  alto?: number;
}) {
  const validos = puntos.filter((p) => p.hoy != null || p.hace1m != null || p.hace1a != null);
  if (validos.length === 0) return null;

  const valores = validos.flatMap((p) =>
    [p.hoy, p.hace1m, p.hace1a].filter((v): v is number => v != null)
  );
  const escala = escalaLinda(Math.min(...valores), Math.max(...valores), 5);

  return (
    <div style={{ height: alto }} className="-ml-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={validos} margin={{ top: 8, right: 14, bottom: 0, left: 2 }}>
          <CartesianGrid stroke={REJILLA} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: GRIS, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: REJILLA }}
            interval={0}
          />
          <YAxis
            domain={[escala.desde, escala.hasta]}
            ticks={escala.ticks}
            tick={{ fill: GRIS, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => `${fmtNum(v, escala.decimales)}%`}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={22}
            iconType="plainline"
            iconSize={14}
            wrapperStyle={{ fontSize: 11, color: GRIS }}
          />
          <Line
            name="hace un año" type="monotone" dataKey="hace1a" stroke={ANIO}
            strokeWidth={1.4} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls
          />
          <Line
            name="hace un mes" type="monotone" dataKey="hace1m" stroke={MES}
            strokeWidth={1.6} dot={false} isAnimationActive={false} connectNulls
          />
          <Line
            name="hoy" type="monotone" dataKey="hoy" stroke={HOY}
            strokeWidth={2.4} dot={{ r: 2.5, fill: HOY }} isAnimationActive={false} connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
