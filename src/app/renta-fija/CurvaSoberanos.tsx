"use client";

import { useState } from "react";
import {
  CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis, ZAxis,
} from "recharts";
import type { PuntoCurva, SpreadLey, Validacion } from "@/lib/bonos";

/**
 * Curva de rendimientos de los soberanos hard-dollar.
 *
 * TIR contra duration, que es como se mira una curva: la duration dice cuánto
 * tiempo tarda en promedio en volver la plata, y es lo comparable entre bonos
 * que amortizan distinto. El vencimiento solo engañaría — un bono que amortiza
 * desde 2025 y vence en 2046 no es un bono a veinte años.
 *
 * Dos series porque la diferencia entre ley NY y ley argentina **es** el dato:
 * el spread entre las dos curvas es lo que el mercado cobra por litigar en
 * Nueva York en vez de en Buenos Aires.
 */

const COLOR = {
  NY: "#3987e5",
  AR: "#d95926",
} as const;

/** Los que no cierran contra el resto de la curva van apagados. */
const GRIS = "#64748b";

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function CurvaSoberanos({
  puntos,
  spreads,
  validacion,
}: {
  puntos: PuntoCurva[];
  spreads: SpreadLey[];
  validacion: Validacion;
}) {
  const [activo, setActivo] = useState<string | null>(null);

  if (puntos.length === 0) {
    return (
      <p className="text-[12px] text-slate-600">
        Sin precios cargados. Usá ↻ Actualizar para traerlos de las fuentes.
      </p>
    );
  }

  const sospechoso = (t: string) => validacion.sospechosos.includes(t);
  const punto = activo ? puntos.find((p) => p.ticker === activo) : null;

  const series = (["NY", "AR"] as const).map((ley) => ({
    ley,
    datos: puntos.filter((p) => p.ley === ley),
  }));

  const tirs = puntos.map((p) => p.tir);
  const min = Math.floor(Math.min(...tirs) - 1);
  const max = Math.ceil(Math.max(...tirs) + 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-5 flex-wrap">
        {series.map((s) => (
          <span key={s.ley} className="flex items-center gap-2">
            <span className="w-3 h-[3px] rounded-full" style={{ background: COLOR[s.ley] }} />
            <span className="text-[11px] text-slate-400">
              Ley {s.ley === "NY" ? "Nueva York" : "argentina"}
            </span>
            <span className="text-[10px] text-slate-600">{s.datos.length}</span>
          </span>
        ))}
        {validacion.implicita != null && (
          <span className="text-[10px] text-slate-600 ml-auto">
            El riesgo país implica una TIR de {fmt(validacion.implicita, 1)}%
          </span>
        )}
      </div>

      <div className="h-[300px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="duration"
              name="Duration"
              domain={[0, "dataMax + 0.6"]}
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
              tickFormatter={(v: number) => `${fmt(v, 1)}a`}
            />
            <YAxis
              type="number"
              dataKey="tir"
              name="TIR"
              domain={[min, max]}
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
              tickFormatter={(v: number) => `${v}%`}
              width={42}
            />
            <ZAxis range={[70, 70]} />

            {series.map((s) => (
              <Scatter
                key={s.ley}
                data={s.datos}
                line={{ stroke: COLOR[s.ley], strokeWidth: 2 }}
                lineType="joint"
                isAnimationActive={false}
                shape={(props: unknown) => {
                  const { cx, cy, payload } = props as {
                    cx: number; cy: number; payload: PuntoCurva;
                  };
                  const dudoso = sospechoso(payload.ticker);
                  const esta = activo === payload.ticker;
                  return (
                    <g
                      onMouseEnter={() => setActivo(payload.ticker)}
                      onMouseLeave={() => setActivo(null)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Área de contacto más grande que la marca */}
                      <circle cx={cx} cy={cy} r={14} fill="transparent" />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={esta ? 7 : 5}
                        fill={dudoso ? GRIS : COLOR[s.ley]}
                        stroke="#020617"
                        strokeWidth={2}
                        strokeDasharray={dudoso ? "2 2" : undefined}
                      />
                      <text
                        x={cx}
                        y={cy - 12}
                        textAnchor="middle"
                        fill={esta ? "#e2e8f0" : "#64748b"}
                        fontSize={10}
                      >
                        {payload.ticker}
                      </text>
                    </g>
                  );
                }}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* El detalle va fijo abajo y no como tooltip flotante: así se puede
          comparar moviéndose entre puntos sin que el cartel tape el gráfico */}
      <div className="min-h-[46px] rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-2.5">
        {punto ? (
          <div className="flex items-baseline gap-x-6 gap-y-1 flex-wrap">
            <span className="text-[13px] font-semibold text-slate-100">{punto.ticker}</span>
            <span className="text-[11px] text-slate-500">{punto.nombre}</span>
            <span className="text-[11px] text-slate-400">
              precio <span className="text-slate-200 tabular-nums">US${fmt(punto.precio)}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              TIR <span className="text-slate-200 tabular-nums">{fmt(punto.tir)}%</span>
            </span>
            <span className="text-[11px] text-slate-400">
              duration <span className="text-slate-200 tabular-nums">{fmt(punto.duration)} años</span>
            </span>
            <span className="text-[11px] text-slate-400">
              vence <span className="text-slate-200 tabular-nums">{punto.vencimiento}</span>
            </span>
            {sospechoso(punto.ticker) && (
              <span className="text-[10px] text-amber-500/90">flujos a verificar</span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-600">
            Pasá el mouse por un punto para ver precio, TIR y duration.
          </p>
        )}
      </div>

      {spreads.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
            Lo que cuesta la ley
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {spreads.map((s) => {
              const dudoso =
                validacion.sospechosos.includes(s.ar.ticker) ||
                validacion.sospechosos.includes(s.ny.ticker);
              return (
                <span key={s.vencimiento} className="flex items-baseline gap-1.5">
                  <span className="text-[11px] text-slate-500">{s.vencimiento}</span>
                  <span
                    className={`text-[13px] tabular-nums ${dudoso ? "text-slate-600" : "text-slate-200"}`}
                  >
                    {s.spreadPb > 0 ? "+" : ""}{Math.round(s.spreadPb)} pb
                  </span>
                  {dudoso && <span className="text-[9px] text-amber-600/80">?</span>}
                </span>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5 leading-relaxed">
            Cuánto más rinde el Bonar que el Global del mismo año. Mismos flujos y mismo
            deudor: la diferencia es dónde se litiga si hay default.
          </p>
        </div>
      )}

      {validacion.mensaje && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-2.5">
          <p className="text-[11px] text-amber-500/90 leading-relaxed">{validacion.mensaje}</p>
        </div>
      )}
    </div>
  );
}
