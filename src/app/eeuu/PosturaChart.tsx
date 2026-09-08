"use client";

import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import { FUENTE_POSTURA, GRIS, REJILLA, TENUE, escalaLinda, fmtNum, mesCorto } from "./tokens-grafico";
import GraficoExpandible from "@/components/GraficoExpandible";

export interface FilaPostura {
  fecha: string;
  real: number;
  nominal: number;
}

/**
 * La tasa real de política monetaria contra su propia historia.
 *
 * El área con signo —verde cuando la tasa real es negativa, roja cuando es
 * positiva— es deliberada: lo que se quiere leer de un vistazo es de qué lado
 * del cero está, no cuánto vale exactamente. El valor exacto está arriba, en
 * la cuenta.
 */
function Grafico({ filas, alto = 150 }: { filas: FilaPostura[]; alto?: number }) {
  if (filas.length < 2) return null;

  const valores = filas.map((f) => f.real);
  const escala = escalaLinda(Math.min(...valores, 0), Math.max(...valores, 0), 3);
  const datos = filas.map((f) => ({ ...f, etiqueta: mesCorto(f.fecha.slice(0, 7)) }));

  // El degradado cambia de color exactamente en el cero: el offset es la altura
  // relativa del cero dentro del dominio del eje.
  const rango = escala.hasta - escala.desde;
  const corteCero = rango > 0 ? Math.min(Math.max((escala.hasta - 0) / rango, 0), 1) : 0.5;

  return (
    <div style={{ height: alto }} className="-ml-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 6, right: 14, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id="gradPostura" x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor="#f87171" stopOpacity={0.5} />
              <stop offset={corteCero} stopColor="#f87171" stopOpacity={0.05} />
              <stop offset={corteCero} stopColor="#34d399" stopOpacity={0.05} />
              <stop offset={1} stopColor="#34d399" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={REJILLA} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="etiqueta"
            tick={{ fill: GRIS, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: REJILLA }}
            minTickGap={40}
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
          <ReferenceLine y={0} stroke={TENUE} strokeDasharray="4 3" />
          <Area
            type="monotone"
            dataKey="real"
            stroke="#e2e8f0"
            strokeWidth={1.6}
            fill="url(#gradPostura)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PosturaChart({ filas, alto = 150 }: { filas: FilaPostura[]; alto?: number }) {
  return (
    <GraficoExpandible
      titulo="Postura de la Fed"
      nota="Tasa real = efectiva − PCE núcleo · de qué lado del cero está"
      creditos={FUENTE_POSTURA.creditos}
      extra={FUENTE_POSTURA.extra}
      filas={filas}
      fechaDe={(f) => f.fecha}
      alto={alto}
      altoModal={400}
    >
      {({ filas, alto }) => <Grafico filas={filas} alto={alto} />}
    </GraficoExpandible>
  );
}
