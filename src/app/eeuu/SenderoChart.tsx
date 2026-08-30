"use client";

import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import { GRIS, HOY, REJILLA, TENUE, escalaLinda, fmtNum, mesCorto } from "./tokens-grafico";

export interface FilaSendero {
  mes: string;
  tasaImplicita: number;
  /** Movimiento descontado si ese mes tiene reunión, en pb. */
  cambioPb: number | null;
  conProyecciones: boolean;
}

/**
 * El sendero de tasa que descuentan los futuros de fondos federales.
 *
 * Cada punto es un contrato mensual: la tasa promedio que el mercado espera que
 * rija ese mes. La línea punteada es dónde está hoy, así que la distancia
 * vertical entre la curva y esa línea *es* lo que el mercado tiene descontado.
 *
 * Los meses con reunión van marcados con un punto lleno y su movimiento
 * implícito arriba: es donde efectivamente se decide, el resto de los meses sólo
 * arrastran lo que ya pasó.
 */
export default function SenderoChart({
  filas,
  effrHoy,
  alto = 220,
}: {
  filas: FilaSendero[];
  effrHoy: number;
  alto?: number;
}) {
  if (filas.length === 0) return null;

  const valores = [...filas.map((f) => f.tasaImplicita), effrHoy];
  const escala = escalaLinda(Math.min(...valores), Math.max(...valores), 4);

  const datos = filas.map((f) => ({ ...f, etiqueta: mesCorto(f.mes) }));

  return (
    <div style={{ height: alto }} className="-ml-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 22, right: 14, bottom: 4, left: 2 }}>
          <CartesianGrid stroke={REJILLA} strokeDasharray="2 4" vertical={false} />
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
            width={44}
            tickFormatter={(v: number) => `${fmtNum(v, escala.decimales)}%`}
          />
          <ReferenceLine
            y={effrHoy}
            stroke={TENUE}
            strokeDasharray="5 4"
            label={{ value: `hoy ${fmtNum(effrHoy)}%`, position: "insideTopLeft", fill: GRIS, fontSize: 10 }}
          />
          <Line
            type="monotone"
            dataKey="tasaImplicita"
            stroke={HOY}
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload, index } = props as {
                cx: number; cy: number; index: number; payload: FilaSendero;
              };
              if (payload.cambioPb == null) {
                return <circle key={index} cx={cx} cy={cy} r={2} fill={HOY} fillOpacity={0.45} />;
              }
              const signo = payload.cambioPb > 0 ? "+" : "";
              return (
                <g key={index}>
                  <circle cx={cx} cy={cy} r={3.5} fill={HOY} />
                  <text x={cx} y={cy - 10} textAnchor="middle" fill={GRIS} fontSize={9}>
                    {signo}
                    {Math.round(payload.cambioPb)}
                  </text>
                </g>
              );
            }}
            activeDot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
