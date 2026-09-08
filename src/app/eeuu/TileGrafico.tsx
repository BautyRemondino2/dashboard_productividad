"use client";

import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import Sparkline from "@/components/Sparkline";
import GraficoExpandible, {
  RANGOS_DIARIOS, RANGOS_MENSUALES,
} from "@/components/GraficoExpandible";
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
 * El rango va en años para las series mensuales y en días para las diarias: en
 * un dato mensual, "90 días" son tres puntos.
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
      rangos={ind.frecuencia === "diaria" ? RANGOS_DIARIOS : RANGOS_MENSUALES}
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
