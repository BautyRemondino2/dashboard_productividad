"use client";

import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import Sparkline from "@/components/Sparkline";
import GraficoExpandible from "@/components/GraficoExpandible";
import { FUENTE_TILE, GRIS, HOY, REJILLA, escalaLinda, fmtNum, mesCorto } from "./tokens-grafico";
import { SPARK, type IndicadorUsa } from "@/lib/eeuu";
import type { PuntoSerie } from "@/lib/fred";

/**
 * La miniatura de un indicador, y su serie completa al tocarla.
 *
 * En el tile el sparkline mide 64×22: alcanza para ver si viene subiendo y
 * nada más. La pregunta que sigue —"¿esto es alto contra su propia historia?"—
 * necesita el eje, y el eje necesita espacio. De ahí que el mismo dato se abra
 * en grande con el rango a elección.
 *
 * Los rangos son los mismos para todos los indicadores; el que no da puntos
 * suficientes se muestra deshabilitado. En el desempleo —mensual— "30 días" es
 * un solo dato, y decirlo enseña algo sobre la serie.
 */

const fmtEje = (valor: number, unidad: IndicadorUsa["unidad"], decimales: number) =>
  unidad === "%" || unidad === "pb" ? `${fmtNum(valor, decimales)}%` : fmtNum(valor, decimales);

function Grafico({
  filas,
  alto,
  unidad,
}: {
  filas: PuntoSerie[];
  alto: number;
  unidad: IndicadorUsa["unidad"];
}) {
  if (filas.length < 2) {
    return (
      <div style={{ height: alto }} className="flex items-center justify-center text-[12px] text-meta-suave">
        Falta historia para graficar.
      </div>
    );
  }

  const valores = filas.map((p) => p.valor);
  const escala = escalaLinda(Math.min(...valores), Math.max(...valores), 4);
  const datos = filas.map((p) => ({ ...p, etiqueta: mesCorto(p.fecha.slice(0, 7)) }));

  return (
    <div style={{ height: alto }} className="-ml-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 14, bottom: 0, left: 2 }}>
          <CartesianGrid stroke={REJILLA} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="etiqueta"
            tick={{ fill: GRIS, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: REJILLA }}
            minTickGap={34}
          />
          <YAxis
            domain={[escala.desde, escala.hasta]}
            ticks={escala.ticks}
            tick={{ fill: GRIS, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => fmtEje(v, unidad, escala.decimales)}
          />
          <Tooltip
            contentStyle={{
              background: "rgb(15,23,42)",
              border: "1px solid rgb(51,65,85)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "rgb(148,163,184)", fontSize: 11, marginBottom: 2 }}
            formatter={(v) => [
              typeof v === "number" ? fmtEje(v, unidad, escala.decimales) : "—",
              "valor",
            ]}
          />
          <Line
            type="monotone"
            dataKey="valor"
            stroke={HOY}
            strokeWidth={1.9}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TileGrafico({
  ind,
  color,
}: {
  ind: IndicadorUsa;
  color: string;
}) {
  return (
    <GraficoExpandible
      titulo={ind.label}
      nota={ind.nota}
      creditos={FUENTE_TILE.creditos}
      extra={FUENTE_TILE.extra}
      filas={ind.serie}
      fechaDe={(p) => p.fecha}
      alto={22}
      altoModal={380}
      ayuda={`Ver la serie completa de ${ind.label}`}
    >
      {({ filas, alto, expandido }) =>
        expandido ? (
          <Grafico filas={filas} alto={alto} unidad={ind.unidad} />
        ) : (
          <Sparkline
            data={ind.serie.slice(-SPARK).map((p) => p.valor)}
            color={color}
            width={64}
            height={22}
          />
        )
      }
    </GraficoExpandible>
  );
}
