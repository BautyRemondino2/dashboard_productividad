"use client";

import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import { FUENTE_INFLACION, GRIS, HOY, META, NUCLEO, REJILLA, escalaLinda, fmtNum, mesCorto } from "./tokens-grafico";
import GraficoExpandible, { RANGOS_MENSUALES } from "@/components/GraficoExpandible";

export interface FilaInflacion {
  fecha: string;
  cpi: number | null;
  core: number | null;
  pceCore: number | null;
}

/**
 * Inflación interanual: IPC general, IPC núcleo y PCE núcleo, contra la meta.
 *
 * Las tres, y no sólo la que titulan los diarios, porque miden cosas distintas
 * y la Fed decide con la tercera: su meta del 2% está definida sobre el PCE, no
 * sobre el IPC. La brecha entre el general y el núcleo es energía y alimentos —
 * ruido que el comité mira pero no persigue.
 *
 * La línea del 2% no es decoración: es el único nivel contra el que estos tres
 * números significan algo.
 */
function Grafico({
  filas,
  alto = 230,
}: {
  filas: FilaInflacion[];
  alto?: number;
}) {
  if (filas.length === 0) return null;

  const valores = filas.flatMap((f) =>
    [f.cpi, f.core, f.pceCore].filter((v): v is number => v != null)
  );
  const escala = escalaLinda(Math.min(...valores, 2), Math.max(...valores), 4);
  const datos = filas.map((f) => ({ ...f, etiqueta: mesCorto(f.fecha.slice(0, 7)) }));

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
            minTickGap={28}
          />
          <YAxis
            domain={[escala.desde, escala.hasta]}
            ticks={escala.ticks}
            tick={{ fill: GRIS, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v: number) => `${fmtNum(v, escala.decimales)}%`}
          />
          <Legend
            verticalAlign="top" align="right" height={22} iconType="plainline" iconSize={14}
            wrapperStyle={{ fontSize: 11, color: GRIS }}
          />
          <ReferenceLine
            y={2}
            stroke={META}
            strokeDasharray="5 4"
            strokeOpacity={0.8}
            label={{ value: "meta 2%", position: "insideBottomRight", fill: META, fontSize: 10 }}
          />
          <Line name="IPC" type="monotone" dataKey="cpi" stroke={HOY} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          <Line name="IPC núcleo" type="monotone" dataKey="core" stroke={NUCLEO} strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls />
          <Line name="PCE núcleo" type="monotone" dataKey="pceCore" stroke={GRIS} strokeWidth={1.6} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Lo que ve la página: el gráfico dentro del card, y el mismo gráfico en grande
 * al tocarlo. El card muestra la serie entera; el modal deja elegir el tramo.
 */
export default function InflacionChart({
  filas,
  alto = 230,
}: {
  filas: FilaInflacion[];
  alto?: number;
}) {
  return (
    <GraficoExpandible
      titulo="Inflación en EE.UU."
      nota="Interanual · la meta de la Fed es 2% sobre el PCE núcleo"
      creditos={FUENTE_INFLACION.creditos}
      extra={FUENTE_INFLACION.extra}
      filas={filas}
      fechaDe={(f) => f.fecha}
      rangos={RANGOS_MENSUALES}
      alto={alto}
    >
      {({ filas, alto }) => <Grafico filas={filas} alto={alto} />}
    </GraficoExpandible>
  );
}
